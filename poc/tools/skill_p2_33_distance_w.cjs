#!/usr/bin/env node
'use strict';
/*
 * P2.33: same original rank/time partial condition AND SAME running style,
 * contrast raw 10m W across 4 distance classes within one fixed surface.
 * 30 seeds and both original 15-seed halves are matched by
 * signature/roster/headcount/mode/target distance classes.
 *
 * Source predicates are NOT whole-skill AND/OR or game skill activation.
 * The course-distance contrast is observational and geometrically confounded.
 * This study does not compare two differently sourced turf/dirt skills.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const model=require('./globalsim_roster32.cjs');
const agg=require('./skill_roster32_aggregate.cjs');
const split=require('./skill_source32_split15_w.cjs');
const original=require('./skill_specificity32_research.cjs');
const distance=require('./skill_distance_style_interaction.cjs');
const STATUS='P2.33-same-source-partial-condition-same-style-distance-W-split15-research-only';
const EPS=0.00001;
const MARGIN=5; // hypothetical sensitivity only; NOT a product threshold
const TYPES=[1,2,3,4];
const round=n=>Number(n.toFixed(6));
const key=(course,n,mode,p,style)=>[course,n,mode,p.timing,p.bandId,style].join('|');
const sourceKey=p=>[p.sourceNumericId,p.surface,p.distanceScope,p.timing,p.bandId].join('|');

function groupedW(index,p,style,scenario,n,mode,courses){
 if(!model.STYLES.includes(style)||!model.SCENARIOS.includes(scenario)||
  ![9,12].includes(n)||!model.MODES.includes(mode)||
  !Array.isArray(courses)||p.distanceScope!=='all')
  throw Error('P2.33 invalid source/style/model context');
 if(model.COUNTS[scenario][n][model.STYLES.indexOf(style)]===0)
  return null; // Absent runner is missing, NEVER 0 W.
 const byScenario=index.get(scenario);
 if(!byScenario)throw Error('P2.33 source scenario missing');
 return TYPES.map(type=>{
  const selected=courses.filter(c=>c.surface===p.surface&&c.distanceType===type);
  if(!selected.length)throw Error('P2.33 distance class not represented in source surface');
  const values=selected.map(c=>{
   const row=byScenario.get(key(c.id,n,mode,p,style));
   if(!row||row.scenario!==scenario||row.surface!==p.surface||
    row.distance!==c.distance||row.courseId!==c.id||
    row.fieldSize!==n||row.mode!==mode||row.style!==style||
    !Number.isFinite(row.opportunityLowerBoundPercent)||
    !Number.isFinite(row.opportunityUpperBoundPercent))
    throw Error('P2.33 missing/mismatched source course W');
   return {courseId:c.id,
    lowerWPercent:row.opportunityLowerBoundPercent,
    upperWPercent:row.opportunityUpperBoundPercent,
    unresolvedRunners:row.unresolvedRunners};
  });
  return {type,distanceClass:distance.DISTANCE_LABELS[type-1],
   courseIds:selected.map(c=>c.id),
   // Envelope retains both rank uncertainty and heterogeneous courses.
   lowerWPercent:round(Math.min(...values.map(x=>x.lowerWPercent))),
   upperWPercent:round(Math.max(...values.map(x=>x.upperWPercent))),
   heldRunnerCount:values.reduce((a,x)=>a+x.unresolvedRunners,0),
   observedCourses:values};
 });
}

function compareW(a,b){
 if(!a||!b||a.type>=b.type)throw Error('P2.33 unordered distance comparison');
 const low=round(a.lowerWPercent-b.upperWPercent);
 const high=round(a.upperWPercent-b.lowerWPercent);
 if(!Number.isFinite(low)||!Number.isFinite(high)||low>high+EPS)
  throw Error('P2.33 invalid distance W bounds');
 const direction=low>EPS?'first-higher':
  high< -EPS?'second-higher':'held-overlap-or-course-mixed';
 const fivePointDirection=low>MARGIN+EPS?'first-higher':
  high< -MARGIN-EPS?'second-higher':null;
 return {firstDistance:a.distanceClass,secondDistance:b.distanceClass,
  differenceLowerPoints:low,differenceUpperPoints:high,
  direction,fivePointSensitivityDirection:fivePointDirection};
}

function comparisons(groups){
 if(!Array.isArray(groups)||groups.length!==4||
  groups.some((x,i)=>x.type!==i+1))
  throw Error('P2.33 source distance classes not complete');
 return groups.flatMap((a,i)=>groups.slice(i+1).map(b=>compareW(a,b)));
}
function matchedCohort(profiles,indexes,courses){
 const rows=[],missing=[];
 for(const p of profiles)for(const style of model.STYLES)
  for(const scenario of model.SCENARIOS)for(const n of [9,12])
   for(const mode of model.MODES){
    const context={scenario,fieldSize:n,mode};
    const groups=indexes.map(index=>groupedW(index,p,style,
     scenario,n,mode,courses));
    if(groups.every(x=>x===null)){
     missing.push({sourceNumericId:p.sourceNumericId,surface:p.surface,style,
      ...context,reason:'style-not-present-in-artificial-roster'});
     continue;
    }
    if(groups.some(x=>x===null))
     throw Error('P2.33 same source runner disappeared between seed halves');
    const [full,early,late]=groups.map(comparisons);
    if(full.length!==6||early.length!==6||late.length!==6)
     throw Error('P2.33 missing distance comparisons');
    const contrasts=full.map((c,i)=>{
     if(c.firstDistance!==early[i].firstDistance||
      c.firstDistance!==late[i].firstDistance||
      c.secondDistance!==early[i].secondDistance||
      c.secondDistance!==late[i].secondDistance)
      throw Error('P2.33 unmatched distance contrast');
     const both=c.direction!=='held-overlap-or-course-mixed'&&
      early[i].direction===c.direction&&late[i].direction===c.direction;
     const five=c.fivePointSensitivityDirection!==null&&
      early[i].fivePointSensitivityDirection===
       c.fivePointSensitivityDirection&&
      late[i].fivePointSensitivityDirection===
       c.fivePointSensitivityDirection;
     return {distancePair:[c.firstDistance,c.secondDistance],
      original30:c,first15:early[i],last15:late[i],
      bothHalvesConfirmOriginal30Direction:both,
      bothHalvesConfirmOriginal30FivePointSensitivity:five};
    });
    rows.push({sourceNumericId:p.sourceNumericId,surface:p.surface,
     distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
     style,...context,
     perDistanceW:groups[0],
     contrasts,metric:'10m-rank-time-partial-condition-W-not-activation'});
   }
 const events=rows.flatMap(x=>x.contrasts);
 const strict=events.filter(x=>
  x.original30.direction!=='held-overlap-or-course-mixed');
 const five=events.filter(x=>
  x.original30.fivePointSensitivityDirection!==null);
 const countRows=selector=>new Set(rows.filter(x=>x.contrasts.some(selector))
  .map(x=>sourceKey(x)+'|'+x.style)).size;
 return {summary:{
  originalSourceProfiles:profiles.length,
  profileStylePairs:profiles.length*model.STYLES.length,
  matchedSourceStyleRosterHeadModeContexts:rows.length,
  absentStyleContextCells:missing.length,
  distancePairContextCells:events.length,
  strictOriginal30Events:strict.length,
  strictBothHalvesConfirmedEvents:strict.filter(x=>
   x.bothHalvesConfirmOriginal30Direction).length,
  strictOriginal30ProfileStylePairs:countRows(x=>
   x.original30.direction!=='held-overlap-or-course-mixed'),
  strictBothHalvesConfirmedProfileStylePairs:countRows(x=>
   x.bothHalvesConfirmOriginal30Direction),
  fivePointOriginal30Events:five.length,
  fivePointBothHalvesConfirmedEvents:five.filter(x=>
   x.bothHalvesConfirmOriginal30FivePointSensitivity).length,
  fivePointBothHalvesConfirmedProfileStylePairs:countRows(x=>
   x.bothHalvesConfirmOriginal30FivePointSensitivity)
 },rows,missing};
}
function audit(manifest,fullReports,halfReports){
 model.verifyManifest(manifest);
 if(!Array.isArray(fullReports)||fullReports.length!==4||
  !halfReports||model.SCENARIOS.some(s=>!Array.isArray(halfReports[s])||
   halfReports[s].length!==2))
  throw Error('P2.33 incomplete pinned 30/15-seed input');
 const full=agg.validateReports(manifest,fullReports,30);
 const halves=new Map();
 for(const scenario of model.SCENARIOS){
  const parent=fullReports.find(r=>r.scenario===scenario);
  halves.set(scenario,split.validateHalves(parent,halfReports[scenario],scenario));
 }
 const indexes=[full,...[0,1].map(i=>
  new Map(model.SCENARIOS.map(s=>[s,halves.get(s)[i]])))];
 const profiles=manifest.profiles.filter(p=>p.distanceScope==='all');
 const turf=profiles.filter(x=>x.surface==='turf');
 const dirt=profiles.filter(x=>x.surface==='dirt');
 const turfIds=new Set(turf.map(x=>x.sourceNumericId));
 const shared=turf.filter(x=>dirt.some(y=>y.sourceNumericId===x.sourceNumericId))
  .map(x=>x.sourceNumericId);
 if(profiles.length!==10||turf.length!==4||dirt.length!==6||
  new Set(profiles.map(sourceKey)).size!==10||
  shared.length||model.COURSES.length!==12)
  throw Error('P2.33 fixed cohort or source surface comparability drift');
 const all=matchedCohort(profiles,indexes,model.COURSES);
 const tokyo=matchedCohort(turf,indexes,distance.validateTokyo());
 const shape=(x,profileCount)=>{
  if(x.summary.originalSourceProfiles!==profileCount||
   x.summary.matchedSourceStyleRosterHeadModeContexts!==profileCount*60||
   x.summary.absentStyleContextCells!==profileCount*4||
   x.summary.distancePairContextCells!==profileCount*60*6||
   x.rows.some(r=>r.distanceScope!=='all'||r.perDistanceW.length!==4)||
   x.missing.some(r=>r.style!=='Nige'||r.scenario!=='noFront'))
   throw Error('P2.33 cohort cardinality / noFront absence drift');
 };
 shape(all,10);shape(tokyo,4);
 return {schemaVersion:1,status:STATUS,
  source:{globalSimRevision:model.PIN,umaSimSkillRegistrySha256:model.SOURCE_SHA,
   full30ArtifactSha256:original.PINNED,
   disjointHalves:'P2.13 original30 runner/W reconstruction verified',
   sourceManifestPreviousArtifactSha256:manifest.source.previousArtifactSha256},
  design:{noNewModelRaces:true,noNewRealGameObservations:true,
   eligibleDistanceUnrestrictedSourceProfiles:10,
   excludedDistanceRestrictedSourceProfiles:22,
   turfProfiles:4,dirtProfiles:6,
   sourceIDsPresentOnBothSurfaces:0,
   surfaceComparison:'not-identifiable: no source-exact turf/dirt pair',
   fields:[9,12],styles:model.STYLES,rosters:model.SCENARIOS,
   seedPartitions:['0..14','15..29'],modes:model.MODES,
   observedMetric:'within-surface same-source same-style W by distance class',
   courseAggregation:'min lower and max upper of per-course W interval',
   fivePointSensitivity:'hypothetical, not product-grade threshold',
   noStyleRunnerNotZero:true},
  summary:{sameSurfaceAllEligibleCourses:all.summary,
   sameVenueTokyoTurf:tokyo.summary},
  rows:all.rows,tokyoTurfRows:tokyo.rows,
  missingContexts:all.missing,
  limitations:[
   'Original partial rank/time source signature is not the whole source skill AND/OR/Invoke or a game proc.',
   'Distance groups compare different course geometries; even same-venue Tokyo turf cannot identify the causal effect of distance.',
   'Turf and dirt source IDs are disjoint in this fixed cohort; a same-skill turf/dirt W comparison is unavailable, not zero.',
   'Outer course interval and rank uncertainty may hold contrasts; a held direction is not evidence of no distance difference.',
   'Disjoint halves belong to the same artificial model design, not independent real races.',
   'Five-point margin is a hypothetical sensitivity criterion, not an approved suitability threshold.',
   'No D=O-U, card scoring, source full AND, game skill proc or product UI is inferred.'
  ]};
}
function main(args){
 if(args.length!==14)
  throw Error('Usage: P2.33 manifest 4full30 8split15 output.json');
 const [manifestPath,...rest]=args;
 const full=rest.slice(0,4).map((p,i)=>{
  const bytes=fs.readFileSync(p);
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(hash!==original.PINNED[model.SCENARIOS[i]])
   throw Error('P2.33 immutable original30 SHA mismatch');
  return JSON.parse(bytes);
 });
 const halves=Object.fromEntries(model.SCENARIOS.map((s,i)=>[s,[
  JSON.parse(fs.readFileSync(rest[4+i*2],'utf8')),
  JSON.parse(fs.readFileSync(rest[5+i*2],'utf8'))]]));
 const output=audit(JSON.parse(fs.readFileSync(manifestPath,'utf8')),full,halves);
 fs.writeFileSync(rest[12],JSON.stringify(output,null,2)+'\n');
 console.log('P2_33_SAME_STYLE_DISTANCE_W='+JSON.stringify(output.summary));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STATUS,EPS,MARGIN,groupedW,compareW,comparisons,
 matchedCohort,audit,main};
