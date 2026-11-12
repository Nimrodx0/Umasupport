#!/usr/bin/env node
'use strict';
/*
 * P2.17b: the P2.17 distance-class comparison at two disjoint 15-seed windows.
 * Each source signature, individual course, scenario, field size, ability mode,
 * style pair and event orientation is matched BEFORE confirming a replicate.
 *
 * No extra races, whole-skill activation, actual game evidence, formal
 * suitability thresholds or causal effects of distance_type are inferred.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const model=require('./globalsim_roster32.cjs');
const pair=require('./skill_specificity32_research.cjs');
const split=require('./skill_source32_split15_w.cjs');
const distance=require('./skill_distance_style_interaction.cjs');
const STATUS='P2.17b-fixed-distance-W-gap-split15-replication-not-causal';
const TOL=0.00001;
const labelKey=c=>[c.scenario,c.fieldSize,c.mode].join('|');
const contrastKey=c=>[c.firstDistance,c.secondDistance].join('|');
const profileKey=r=>[r.sourceNumericId,r.surface,r.distanceScope,
 r.timing,r.bandId].join('|');
function signReversalOrientation(a,b){
 if(a.allCourseDirection==='first'&&b.allCourseDirection==='second')
  return 'first-style-at-first-distance_to_second-style-at-second-distance';
 if(a.allCourseDirection==='second'&&b.allCourseDirection==='first')
  return 'second-style-at-first-distance_to_first-style-at-second-distance';
 return null;
}
function gapShiftOrientation(c){
 if(c.conservativeGapShiftLowerPoints>5+TOL)return 'positive';
 if(c.conservativeGapShiftUpperPoints< -5-TOL)return 'negative';
 return null;
}
function eventFor(groups,contrast){
 const a=groups.find(x=>x.label===contrast.firstDistance);
 const b=groups.find(x=>x.label===contrast.secondDistance);
 if(!a||!b||a.type>=b.type)throw Error('P2.17b missing source distance pair');
 const c=distance.compareDistanceGroups(a,b);
 if(c.firstDistance!==contrast.firstDistance||
  c.secondDistance!==contrast.secondDistance)
  throw Error('P2.17b distance contrast order drift');
 return {signReversal:signReversalOrientation(a,b),
  gapShift:gapShiftOrientation(c),contrast:c};
}
function auditCohort(originalRows,profiles,halves,courseSet,expectedPairs){
 if(!Array.isArray(originalRows)||originalRows.length!==expectedPairs)
  throw Error('P2.17b missing original P2.17 cohort');
 const rows=[];
 for(const baseline of originalRows){
  const source=profiles.get(profileKey(baseline));
  if(!source||baseline.distanceScope!=='all'||
   !pair.PAIRS.some(([a,b])=>a===baseline.first&&b===baseline.second))
   throw Error('P2.17b invalid original source and style pair');
  const observations=halves.map(index=>distance.contextsForProfile(
   index,source,baseline.first,baseline.second,courseSet));
  if(observations.some(x=>x.contexts.length!==baseline.contexts.length||
   JSON.stringify(x.absent)!==JSON.stringify(baseline.absent)))
   throw Error('P2.17b source style absence or fixed contexts drift');
  const indexHalves=observations.map(x=>new Map(x.contexts.map(
   c=>[labelKey(c),c])));
  if(indexHalves.some(idx=>idx.size!==baseline.contexts.length))
   throw Error('P2.17b repeated split context');
  const points=[];
  for(const context of baseline.contexts){
   const lookup=labelKey(context),parts=indexHalves.map(x=>x.get(lookup));
   if(parts.some(x=>!x))throw Error('P2.17b lost original context');
   if(!Array.isArray(context.contrasts)||context.contrasts.length!==6)
    throw Error('P2.17b original distance contrasts missing');
   const baseGroups=context.groups;
   for(const bc of context.contrasts){
    const orig=eventFor(baseGroups,bc);
    const halfEvents=parts.map(c=>eventFor(c.groups,bc));
    if(orig.signReversal!==null!==bc.allCourseStrictSignReversal||
     (orig.gapShift!==null)!==bc.gapShiftAboveFivePoints)
     throw Error('P2.17b original P2.17 event orientation mismatch');
    // Distinct half reports may show opposite signs or ties. A confirmation
    // requires BOTH halves to show the same direction as original30.
    const signBoth=orig.signReversal!==null&&halfEvents.every(x=>
     x.signReversal===orig.signReversal);
    const marginBoth=orig.gapShift!==null&&halfEvents.every(x=>
     x.gapShift===orig.gapShift);
    // Invariant: pooled 30-seed comparisons cannot fail an interval event
    // passed in identical orientation by each constituent 15-seed half.
    if(orig.signReversal===null&&halfEvents[0].signReversal!==null&&
       halfEvents[0].signReversal===halfEvents[1].signReversal)
     throw Error('P2.17b both strict half reversals absent in full30');
    if(orig.gapShift===null&&halfEvents[0].gapShift!==null&&
       halfEvents[0].gapShift===halfEvents[1].gapShift)
     throw Error('P2.17b both strict half shifts absent in full30');
    points.push({scenario:context.scenario,fieldSize:context.fieldSize,
     mode:context.mode,distanceClasses:[bc.firstDistance,bc.secondDistance],
     original30:{signReversalOrientation:orig.signReversal,
      gapShiftOrientation:orig.gapShift},
     first15:{signReversalOrientation:halfEvents[0].signReversal,
      gapShiftOrientation:halfEvents[0].gapShift},
     last15:{signReversalOrientation:halfEvents[1].signReversal,
      gapShiftOrientation:halfEvents[1].gapShift},
     bothHalvesConfirmOriginal30SignReversal:signBoth,
     bothHalvesConfirmOriginal30FivePointGapShift:marginBoth});
   }
  }
  if(points.length!==baseline.contexts.length*6)
   throw Error('P2.17b lost distance comparison cells');
  rows.push({sourceNumericId:baseline.sourceNumericId,
   surface:baseline.surface,distanceScope:baseline.distanceScope,
   timing:baseline.timing,bandId:baseline.bandId,
   first:baseline.first,second:baseline.second,
   missingStyleContextCount:baseline.absent.length,
   comparisons:points});
 }
 const events=rows.flatMap(x=>x.comparisons);
 function summarize(kind,confirm){
  const base=events.filter(x=>x.original30[kind]!==null);
  const accepted=base.filter(x=>x[confirm]);
  const a=rows.filter(x=>x.comparisons.some(y=>y.original30[kind]!==null));
  const b=rows.filter(x=>x.comparisons.some(y=>y[confirm]));
  return {original30SourcePairCount:a.length,
   bothHalvesConfirmedSourcePairCount:b.length,
   original30EventContextCount:base.length,
   sameContextAndOrientationConfirmedEventCount:accepted.length,
   original30OnlyEventContextCount:base.length-accepted.length,
   first15SameOrientationCount:base.filter(x=>
    x.first15[kind]===x.original30[kind]).length,
   last15SameOrientationCount:base.filter(x=>
    x.last15[kind]===x.original30[kind]).length};
 }
 return {sourceConditionStylePairs:rows.length,
  comparableEventContextCells:events.length,
  missingStyleRosterHeadModeContextCells:rows.reduce((n,x)=>
   n+x.missingStyleContextCount,0),
  strictSignReversal:summarize('signReversalOrientation',
   'bothHalvesConfirmOriginal30SignReversal'),
  fivePointGapShift:summarize('gapShiftOrientation',
   'bothHalvesConfirmOriginal30FivePointGapShift'),rows};
}
function audit(manifest,fullReports,splitReports,p231){
 model.verifyManifest(manifest);
 if(!Array.isArray(fullReports)||fullReports.length!==4||
  !splitReports||model.SCENARIOS.some(s=>!Array.isArray(splitReports[s])||
   splitReports[s].length!==2))
  throw Error('P2.17b incomplete fixed 30/15 source reports');
 // P2.17 verifies all fixed original source, source profile, P2.31 SHA and
 // 30-seed context population. P2.13 independently reconstructs all original
 // 30-seed W bounds and runner counts from the two disjoint 15-seed halves.
 const original=distance.audit(manifest,fullReports,p231);
 const sourceIndex=new Map();
 for(const scenario of model.SCENARIOS){
  const full=fullReports.find(r=>r.scenario===scenario);
  const validated=split.validateHalves(full,splitReports[scenario],scenario);
  sourceIndex.set(scenario,validated);
 }
 const halves=[0,1].map(i=>new Map(model.SCENARIOS.map(s=>[
  s,sourceIndex.get(s)[i]])));
 const profiles=new Map(manifest.profiles.map(x=>[profileKey(x),x]));
 if(profiles.size!==32)throw Error('P2.17b duplicate source profile');
 const general=auditCohort(original.rows,profiles,halves,
  model.COURSES,60);
 const tokyo=auditCohort(original.tokyoTurfRows,profiles,halves,
  distance.validateTokyo(),24);
 if(general.comparableEventContextCells!==5040||
  tokyo.comparableEventContextCells!==2016||
  general.missingStyleRosterHeadModeContextCells!==120||
  tokyo.missingStyleRosterHeadModeContextCells!==48||
  general.strictSignReversal.original30SourcePairCount!==
   original.summary.allOriginalEligibleCourses.pairsWithStrictCrossDistanceSignReversal||
  general.fivePointGapShift.original30SourcePairCount!==
   original.summary.allOriginalEligibleCourses.pairsWithFivePointOrGreaterConservativeGapShift||
  tokyo.strictSignReversal.original30SourcePairCount!==
   original.summary.sameVenueTokyoTurf.pairsWithStrictCrossDistanceSignReversal||
  tokyo.fivePointGapShift.original30SourcePairCount!==
   original.summary.sameVenueTokyoTurf.pairsWithFivePointOrGreaterConservativeGapShift||
  general.strictSignReversal.original30EventContextCount!==
   original.summary.allOriginalEligibleCourses.crossDistanceComparisonsWithStrictSignReversal||
  general.fivePointGapShift.original30EventContextCount!==
   original.summary.allOriginalEligibleCourses.crossDistanceComparisonsWithFivePointConservativeGapShift||
  tokyo.strictSignReversal.original30EventContextCount!==
   original.summary.sameVenueTokyoTurf.crossDistanceComparisonsWithStrictSignReversal||
  tokyo.fivePointGapShift.original30EventContextCount!==
   original.summary.sameVenueTokyoTurf.crossDistanceComparisonsWithFivePointConservativeGapShift)
  throw Error('P2.17b contradiction with original distance study');
 return {schemaVersion:1,status:STATUS,
  source:{modelRevision:model.PIN,
   umaSimSkillRegistrySha256:model.SOURCE_SHA,
   originalFull30ReportSha256:pair.PINNED,
   originalP217Status:original.status,
   seededHalfValidation:'P2.13 validateHalves: every original30 W interval reconstructed'},
  design:{originalSourceRankTimingSignatures:10,
   restrictedSourceDistanceProfilesExcluded:22,
   sampleHalfSeeds:['0..14','15..29'],
   perHalfModelRaces:2880,totalFixedModelRaces:5760,
   noNewIndependentRealGameSamples:true,
   unit:'same original partial-condition, style pair, roster, headcount, mode and distance pair',
   conservativelyHeldCourseHeterogeneity:true,
   hypotheticalFivePercentagePointMarginNotProductApproved:true},
  summary:{allOriginalEligibleCourses:{
   sourceConditionStylePairs:general.sourceConditionStylePairs,
   comparableEventContextCells:general.comparableEventContextCells,
   missingStyleRosterHeadModeContextCells:general.missingStyleRosterHeadModeContextCells,
   strictSignReversal:general.strictSignReversal,
   fivePointGapShift:general.fivePointGapShift},
   sameVenueTokyoTurf:{
    sourceConditionStylePairs:tokyo.sourceConditionStylePairs,
    comparableEventContextCells:tokyo.comparableEventContextCells,
    missingStyleRosterHeadModeContextCells:tokyo.missingStyleRosterHeadModeContextCells,
    strictSignReversal:tokyo.strictSignReversal,
    fivePointGapShift:tokyo.fivePointGapShift}},
  rows:general.rows,tokyoTurfRows:tokyo.rows,
  limitations:[
   'Confirmed means exact same source partial rank/time condition, direction and roster/headcount/mode/distance pair exceeded the original pooled bounds IN BOTH original disjoint 15-seed subsets.',
   'Two nonoverlapping halves of the same fixed 30-seed simulation design are not independent real-world samples and do not provide statistical confidence intervals.',
   'Distance class contrasts conflate distance with individual course geometry, even in the same Tokyo venue.',
   'Only 10 original distance-unrestricted source signatures are examined; restricted 22 source predicates are never counterfactually moved to unsupported distances.',
   'Missing Nige in noFront is missing and not silently treated as 0 or a style failure.',
   'W rank/time opportunity is not actual game activation; D=O-U, full AND/OR, preConditions, multiple Invoke and all skill effects remain unresolved.',
   'Five percentage points is hypothetical sensitivity only, not a user-approved style or card suitability threshold.'
  ]};
}
function main(args){
 if(args.length!==15)throw Error('Usage: p2-17b manifest 4full30 8split15 P2.31 output');
 const [manifestPath,...rest]=args;
 const paths=rest.slice(0,4),splits=rest.slice(4,12),
  p231Path=rest[12],out=rest[13];
 const full=paths.map((path,i)=>{
  const b=fs.readFileSync(path);
  if(crypto.createHash('sha256').update(b).digest('hex')!==
   pair.PINNED[model.SCENARIOS[i]])
   throw Error('P2.17b original30 immutable artifact drift');
  return JSON.parse(b);
 });
 const halves=Object.fromEntries(model.SCENARIOS.map((scenario,i)=>[
  scenario,[JSON.parse(fs.readFileSync(splits[i*2],'utf8')),
   JSON.parse(fs.readFileSync(splits[i*2+1],'utf8'))]]));
 const result=audit(JSON.parse(fs.readFileSync(manifestPath,'utf8')),
  full,halves,JSON.parse(fs.readFileSync(p231Path,'utf8')));
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('P2_17B_DISTANCE_SPLIT15='+JSON.stringify(result.summary));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STATUS,signReversalOrientation,gapShiftOrientation,
 eventFor,auditCohort,audit,main};
