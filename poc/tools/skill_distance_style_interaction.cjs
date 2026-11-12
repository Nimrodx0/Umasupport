#!/usr/bin/env node
'use strict';
/*
 * P2.17 observational, fixed-model only.
 * The rank/timing source signature is held identical across distance types.
 * Headcount, artificial roster, strength mode, surface and style pair are
 * matched. Course geometry varies with distance: no distance causal effect.
 * W gap contrasts only; O-U/D, whole-skill AND, game procs not evaluated.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const model=require('./globalsim_roster32.cjs');
const agg=require('./skill_roster32_aggregate.cjs');
const pair=require('./skill_specificity32_research.cjs');
const TYPES=[1,2,3,4];
const DISTANCE_LABELS=['sprint','mile','middle','long'];
const THRESHOLD=5; // hypothetical sensitivity, NOT authorized product threshold
const TOKYO_TURF=Object.freeze([10501,10502,10504,10506]);
const STATUS='P2.17-distance-associated-style-gap-conditional-observation-not-causal';
const round=x=>Number(x.toFixed(6));
const ident=p=>[p.sourceNumericId,p.surface,p.distanceScope,p.timing,p.bandId].join('|');
const lookup=(course,n,mode,p,style)=>
 [course,n,mode,p.timing,p.bandId,style].join('|');
function typeName(id){
 if(!TYPES.includes(id))throw Error('Unrecognized source race distance type');
 return DISTANCE_LABELS[id-1];
}
function validateTokyo(){
 const courses=TOKYO_TURF.map(id=>model.COURSES.find(c=>c.id===id));
 if(courses.some(c=>!c||c.surface!=='turf')||
  JSON.stringify(courses.map(c=>c.distanceType))!=='[1,2,3,4]')
  throw Error('P2.17 pinned Tokyo-turf source courses changed');
 return courses;
}
function distanceClass(index,p,first,second,scenario,n,mode,type,courses){
 if(!model.SCENARIOS.includes(scenario)||![9,12].includes(n)||
  !model.MODES.includes(mode)||!TYPES.includes(type)||
  !model.STYLES.includes(first)||!model.STYLES.includes(second)||
  first===second||p.distanceScope!=='all')
  throw Error('P2.17 cannot cross source distance scope or unknown context');
 const group=courses.filter(c=>c.surface===p.surface&&c.distanceType===type);
 if(!group.length)throw Error('P2.17 missing source eligible distance class');
 const ix=index.get(scenario);
 if(!ix)throw Error('P2.17 missing fixed original scenario');
 const contrasts=group.map(c=>{
  const a=ix.get(lookup(c.id,n,mode,p,first));
  const d=ix.get(lookup(c.id,n,mode,p,second));
  if(!a||!d||a.courseId!==c.id||d.courseId!==c.id||
   a.distance!==c.distance||d.distance!==c.distance||
   a.surface!==p.surface||d.surface!==p.surface)
   throw Error('P2.17 missing or corrupted identical-source course context');
  const result=pair.sameContextContrast(a,d);
  if(result.status==='not-applicable-absent-style')
   throw Error('P2.17 source absent style not handled as missing');
  return {courseId:c.id,
   differenceLowerPoints:result.differenceLowerPoints,
   differenceUpperPoints:result.differenceUpperPoints,
   status:result.status};
 });
 const lo=Math.min(...contrasts.map(x=>x.differenceLowerPoints));
 const hi=Math.max(...contrasts.map(x=>x.differenceUpperPoints));
 if(lo>hi+pair.EPS)throw Error('P2.17 invalid per-distance signed W gap interval');
 return {type,label:typeName(type),courseIds:group.map(c=>c.id),
  gapLowerPoints:round(lo),gapUpperPoints:round(hi),
  allCourseDirection:lo>pair.EPS?'first':
   hi< -pair.EPS?'second':'held-overlap-or-course-mixed',
  // Convex outer interval conservatively spans EVERY eligible course.
  courseContrasts:contrasts};
}
function compareDistanceGroups(a,b){
 if(!a||!b||a.type>=b.type)throw Error('P2.17 distance-class order invalid');
 const lower=round(a.gapLowerPoints-b.gapUpperPoints);
 const upper=round(a.gapUpperPoints-b.gapLowerPoints);
 if(lower>upper+pair.EPS)throw Error('P2.17 inconsistent class gap intervals');
 const first=a.allCourseDirection,second=b.allCourseDirection;
 const strictReversal=(first==='first'&&second==='second')||
  (first==='second'&&second==='first');
 return {firstDistance:a.label,secondDistance:b.label,
  conservativeGapShiftLowerPoints:lower,
  conservativeGapShiftUpperPoints:upper,
  allCourseStrictSignReversal:strictReversal,
  // Compare FIRST-vs-SECOND running-style W gap BETWEEN distance classes.
  // This is a distance-ASSOCIATED shift, not a causal distance effect.
  gapShiftAboveFivePoints:lower>THRESHOLD+pair.EPS||
   upper< -THRESHOLD-pair.EPS};
}
function contextsForProfile(index,p,first,second,courses){
 const contexts=[],absent=[];
 for(const scenario of model.SCENARIOS)for(const n of [9,12]){
  const counts=model.COUNTS[scenario][n];
  const available=counts[model.STYLES.indexOf(first)]>0&&
   counts[model.STYLES.indexOf(second)]>0;
  for(const mode of model.MODES){
   if(!available){
    absent.push({scenario,fieldSize:n,mode,
     disposition:'style-not-present-do-not-assign-zero'});
    continue;
   }
   const groups=TYPES.map(type=>distanceClass(index,p,first,second,
    scenario,n,mode,type,courses));
   const contrasts=groups.flatMap((a,i)=>groups.slice(i+1)
    .map(b=>compareDistanceGroups(a,b)));
   if(contrasts.length!==6)throw Error('P2.17 lost distance-group comparisons');
   contexts.push({scenario,fieldSize:n,mode,groups,contrasts,
    hasStrictSignReversalAcrossDistances:
     contrasts.some(x=>x.allCourseStrictSignReversal),
    hasFivePointStyleGapShiftAcrossDistances:
     contrasts.some(x=>x.gapShiftAboveFivePoints)});
  }
 }
 if(contexts.length+absent.length!==16||
  contexts.length!==(first==='Nige'||second==='Nige'?12:16)||
  contexts.some(c=>c.groups.length!==4))
  throw Error('P2.17 incomplete or absent-style scenario coverage');
 return {contexts,absent};
}
function summarizeRows(rows){
 const contexts=rows.flatMap(x=>x.contexts),absent=rows.flatMap(x=>x.absent);
 const comparisons=contexts.flatMap(x=>x.contrasts);
 return {sourceConditionStylePairs:rows.length,
  matchedRosterHeadModeContexts:contexts.length,
  missingStyleRosterHeadModeContexts:absent.length,
  matchedCrossDistanceClassComparisons:comparisons.length,
  pairsWithStrictCrossDistanceSignReversal:rows.filter(x=>
   x.contexts.some(c=>c.hasStrictSignReversalAcrossDistances)).length,
  pairsWithFivePointOrGreaterConservativeGapShift:rows.filter(x=>
   x.contexts.some(c=>c.hasFivePointStyleGapShiftAcrossDistances)).length,
  matchedContextsWithStrictCrossDistanceSignReversal:contexts.filter(c=>
   c.hasStrictSignReversalAcrossDistances).length,
  matchedContextsWithFivePointConservativeGapShift:contexts.filter(c=>
   c.hasFivePointStyleGapShiftAcrossDistances).length,
  crossDistanceComparisonsWithStrictSignReversal:comparisons.filter(c=>
   c.allCourseStrictSignReversal).length,
  crossDistanceComparisonsWithFivePointConservativeGapShift:
   comparisons.filter(c=>c.gapShiftAboveFivePoints).length};
}
function audit(manifest,reports,p231){
 model.verifyManifest(manifest);
 const index=agg.validateReports(manifest,reports,30);
 if(!p231||p231.schemaVersion!==1||
  p231.status!=='P2.31-individual-course-mode-W-margin-vs-scenario-mean-research-only'||
  p231.source?.modelRevision!==model.PIN||
  p231.source?.skillRegistrySha256!==model.SOURCE_SHA||
  JSON.stringify(p231.source?.sourceArtifactSha256)!==
   JSON.stringify(pair.PINNED)||
  p231.design?.sourceSignatures!==32||
  p231.design?.styleComparisons!==192||
  !Array.isArray(p231.rows)||p231.rows.length!==192)
  throw Error('P2.17 incompatible pinned P2.31 condition provenance');
 const all=manifest.profiles.filter(p=>p.distanceScope==='all');
 const restricted=manifest.profiles.length-all.length;
 if(all.length!==10||restricted!==22||
  all.filter(p=>p.surface==='turf').length!==4||
  all.filter(p=>p.surface==='dirt').length!==6||
  model.COURSES.length!==12)
  throw Error('P2.17 source distance-unrestricted cohort changed');
 const verifiedTokyo=validateTokyo();
 const baseline=new Map();
 for(const x of p231.rows){
  const k=[x.sourceNumericId,x.surface,x.distanceScope,x.timing,x.bandId,
   x.first,x.second].join('|');
  if(baseline.has(k))throw Error('P2.17 duplicated prior source pair');
  baseline.set(k,x);
 }
 const rows=[],tokyoRows=[];
 for(const p of all)for(const [first,second] of pair.PAIRS){
  const key=[ident(p),first,second].join('|');
  const original=baseline.get(key);
  if(!original||original.distanceScope!=='all')
   throw Error('P2.17 missing original P2.31 source style pair');
  const data=contextsForProfile(index,p,first,second,model.COURSES);
  rows.push({sourceNumericId:p.sourceNumericId,surface:p.surface,
   distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
   first,second,originalP231PriorConsensus:original.priorConsensus,
   ...data});
  if(p.surface==='turf')tokyoRows.push({
   sourceNumericId:p.sourceNumericId,surface:p.surface,
   distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
   first,second,
   ...contextsForProfile(index,p,first,second,verifiedTokyo)});
 }
 if(rows.length!==60||tokyoRows.length!==24)
  throw Error('P2.17 source-condition comparison cohort changed');
 const allCount=summarizeRows(rows),tokyoCount=summarizeRows(tokyoRows);
 if(allCount.matchedRosterHeadModeContexts!==840||
  allCount.missingStyleRosterHeadModeContexts!==120||
  allCount.matchedCrossDistanceClassComparisons!==5040||
  tokyoCount.matchedRosterHeadModeContexts!==336||
  tokyoCount.missingStyleRosterHeadModeContexts!==48||
  tokyoCount.matchedCrossDistanceClassComparisons!==2016)
  throw Error('P2.17 source-matched distance comparison cardinality changed');
 return {schemaVersion:1,status:STATUS,
  source:{modelRevision:model.PIN,umaSimSkillSha256:model.SOURCE_SHA,
   original30SeedArtifactSha256:pair.PINNED},
  design:{distanceUnrestrictedSourceSignatures:all.length,
   distanceRestrictedSourceSignaturesExcluded:restricted,
   sourceSignatureStylePairs:rows.length,
   distanceClasses:DISTANCE_LABELS,
   rosters:model.SCENARIOS,fieldSizes:[9,12],modes:model.MODES,
   sourceSurfaceKeptFixed:true,comparisonStatistic:'W-first-minus-second-interval',
   courseHeterogeneity:'min lower/max upper across eligible courses',
   hypotheticalGapShiftMarginPoints:THRESHOLD,
   unitOfReplication:'same source predicate, pair, roster, headcount and ability mode',
   tokyoTurfCourseIds:TOKYO_TURF,
   observedRealGameSkillProc:false},
  summary:{allOriginalEligibleCourses:allCount,sameVenueTokyoTurf:tokyoCount},
  rows,tokyoTurfRows:tokyoRows,
  limitations:[
   'Only 10 original distance-unrestricted partial rank/time predicates allow a cross-distance comparison without changing the source predicate; 22 restricted source predicates excluded.',
   'Matched same-surface/roster/headcount/ability does NOT isolate distance: all courses have different geometry, and most dirt distance classes also change venue.',
   'Same-venue Tokyo turf sensitivity retains the venue, but its course shape, distance, lap profile and real race format still differ.',
   'A robust sign reversal or W-gap shift is a context-specific observation, not a causal distance_type effect or universal running-style rating.',
   'Course bounds are a conservative envelope over individual course aggregate W intervals; 30 seeds per course remain aggregated and are not independent real-world observations.',
   'Missing runners in noFront are absent, never recorded as zero W or negative superiority.',
   'Ground/dirt/turf are compared in separate source conditions; no turf-versus-dirt causal comparison is made.',
   'Original source full AND/OR, preConditions, Invoke, phase trigger draw, actual skill activation and benefit remain untested.',
   'The 5-point gap-shift sensitivity is a hypothetical diagnostic threshold, not an approved product threshold.',
   'W rank/time opportunity and D=O-U specificity are distinct. No card score, skill proc rate or public suitability label is emitted.'
  ]};
}
function main(args){
 if(args.length!==7)throw Error('Usage: skill_distance_style_interaction.cjs manifest balanced frontHeavy backHeavy noFront P2.31.json output.json');
 const [manifest,...rest]=args;
 const reportPaths=rest.slice(0,4),p231Path=rest[4],outPath=rest[5];
 const reports=reportPaths.map((path,i)=>{
  const raw=fs.readFileSync(path);
  if(crypto.createHash('sha256').update(raw).digest('hex')!==
   pair.PINNED[model.SCENARIOS[i]])
   throw Error('P2.17 immutable 30-seed source report checksum mismatch');
  return JSON.parse(raw);
 });
 const out=audit(JSON.parse(fs.readFileSync(manifest,'utf8')),
  reports,JSON.parse(fs.readFileSync(p231Path,'utf8')));
 fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
 console.log('P2_17_DISTANCE_OBSERVATION='+JSON.stringify(out.summary));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STATUS,DISTANCE_LABELS,TOKYO_TURF,
 validateTokyo,distanceClass,compareDistanceGroups,contextsForProfile,
 summarizeRows,audit,main};
