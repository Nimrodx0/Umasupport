#!/usr/bin/env node
'use strict';
/*
 * P2.33 surface contrast under source-identical rank/time predicate SHAPE.
 * Existing turf/dirt source skill IDs differ. This tests W of a shared partial
 * mechanism ONLY, not one original skill across surfaces, whole AND/OR or game.
 *
 * Surface, venue and geometry co-vary. Uses outer course W intervals for each
 * distance bin and original full30 plus two disjoint 15-seed subdivisions.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const fixed=require('./globalsim_roster32.cjs');
const agg=require('./skill_roster32_aggregate.cjs');
const splits=require('./skill_source32_split15_w.cjs');
const prior=require('./skill_specificity32_research.cjs');
const W=require('./skill_p2_33_distance_w.cjs');
const cross=require('../src/skill_p2_33_surface_crosswalk.cjs');
const STATUS='P2.33-source-identical-rank-time-surface-proxy-W-not-same-skill';
const EPS=1e-5;
const MARGIN=5; // hypothetical sensitivity, NOT real use significance
const round=x=>Number(x.toFixed(6));
function surfaceContrast(turf,dirt){
 if(!turf||!dirt||turf.type!==dirt.type||
  turf.distanceClass!==dirt.distanceClass)
  throw Error('P2.33 surfaces not paired in same distance class');
 const low=round(turf.lowerWPercent-dirt.upperWPercent);
 const high=round(turf.upperWPercent-dirt.lowerWPercent);
 if(!Number.isFinite(low)||!Number.isFinite(high)||low>high+EPS)
  throw Error('P2.33 invalid turf/dirt proxy W intervals');
 return {distanceClass:turf.distanceClass,distanceType:turf.type,
  turfMinusDirtLowerPoints:low,turfMinusDirtUpperPoints:high,
  direction:low>EPS?'turf-higher':
   high< -EPS?'dirt-higher':'held-overlap-or-course-confounding',
  fivePointSensitivityDirection:low>MARGIN+EPS?'turf-higher':
   high< -MARGIN-EPS?'dirt-higher':null};
}
function compareOne(modelIndex,tf,df,style,scenario,n,mode,courses){
 const turf=W.groupedW(modelIndex,tf,style,scenario,n,mode,courses);
 const dirt=W.groupedW(modelIndex,df,style,scenario,n,mode,courses);
 if(turf===null&&dirt===null)return null;
 if(!turf||!dirt||turf.length!==4||dirt.length!==4)
  throw Error('P2.33 source shape one surface unavailable unexpectedly');
 return {turf,dirt,comparisons:turf.map((v,i)=>surfaceContrast(v,dirt[i]))};
}
function audit(manifest,fullReports,halfReports){
 const shapes=cross.pairedMechanisms(manifest);
 if(!Array.isArray(fullReports)||fullReports.length!==4||
  !halfReports||fixed.SCENARIOS.some(s=>
   !Array.isArray(halfReports[s])||halfReports[s].length!==2))
  throw Error('P2.33 missing full model and split source reports');
 const full=agg.validateReports(manifest,fullReports,30);
 const halves=new Map();
 for(const scenario of fixed.SCENARIOS){
  const f=fullReports.find(x=>x.scenario===scenario);
  halves.set(scenario,splits.validateHalves(f,halfReports[scenario],scenario));
 }
 const indexes=[full,...[0,1].map(i=>
  new Map(fixed.SCENARIOS.map(s=>[s,halves.get(s)[i]])))];
 const profiles=new Map(manifest.profiles.map(x=>[x.sourceNumericId,x]));
 const rows=[],missing=[];
 for(const pair of shapes.paired){
  const tf=profiles.get(pair.turfSourceNumericId);
  const df=profiles.get(pair.dirtSourceNumericId);
  if(!tf||!df||tf.surface!=='turf'||df.surface!=='dirt'||
   tf.distanceScope!=='all'||df.distanceScope!=='all'||
   tf.timing!==df.timing||tf.bandId!==df.bandId||
   pair.turfSourceNumericId===pair.dirtSourceNumericId)
   throw Error('P2.33 fixed source predicate identities drifted');
  for(const style of fixed.STYLES)
   for(const scenario of fixed.SCENARIOS)for(const fieldSize of [9,12])
    for(const mode of fixed.MODES){
     const cells=indexes.map(index=>compareOne(index,tf,df,style,
      scenario,fieldSize,mode,fixed.COURSES));
     if(cells.every(x=>x===null)){
      missing.push({mechanismKey:pair.mechanismKey,style,scenario,
       fieldSize,mode,reason:'same-style-absent-from-artificial-roster'});
      continue;
     }
     if(cells.some(x=>x===null))
      throw Error('P2.33 surf proxy missing source runner in only one split');
     const [original,early,late]=cells;
     for(let i=0;i<4;i++){
      const a=original.comparisons[i],b=early.comparisons[i],
       c=late.comparisons[i];
      if(a.distanceType!==b.distanceType||a.distanceType!==c.distanceType)
       throw Error('P2.33 mismatched source distance bin');
      const directional=a.direction!=='held-overlap-or-course-confounding';
      const confirmed=directional&&
       b.direction===a.direction&&c.direction===a.direction;
      const five=a.fivePointSensitivityDirection!==null&&
       b.fivePointSensitivityDirection===a.fivePointSensitivityDirection&&
       c.fivePointSensitivityDirection===a.fivePointSensitivityDirection;
      rows.push({mechanismKey:pair.mechanismKey,
       originalTurfSourceId:tf.sourceNumericId,
       originalDirtSourceId:df.sourceNumericId,
       sourceIDIdentical:false,style,scenario,fieldSize,mode,
       distanceType:a.distanceType,distanceClass:a.distanceClass,
       turfW:original.turf[i],dirtW:original.dirt[i],
       original30:a,first15:b,last15:c,
       bothHalvesConfirmOriginalDirection:confirmed,
       bothHalvesConfirmHypotheticalFivePointGap:five,
       originalSkillWholeAND:false,
       onlySharedPartialMechanism:true});
     }
    }
 }
 const strong=rows.filter(x=>
  x.original30.direction!=='held-overlap-or-course-confounding');
 const five=rows.filter(x=>x.original30.fivePointSensitivityDirection!==null);
 const matching=x=>new Set(x.map(z=>z.mechanismKey+'|'+z.style)).size;
 const byDistance=Object.fromEntries([1,2,3,4].map(n=>{
  const cur=rows.filter(x=>x.distanceType===n);
  return [n,{comparableContexts:cur.length,
   pooledDirectionalContexts:cur.filter(x=>
    x.original30.direction!=='held-overlap-or-course-confounding').length,
   bothHalvesDirectionalContexts:cur.filter(x=>
    x.bothHalvesConfirmOriginalDirection).length,
   bothHalvesHypotheticalFivePointContexts:cur.filter(x=>
    x.bothHalvesConfirmHypotheticalFivePointGap).length}];
 }));
 // The original fixed UmaSim + GlobalSim course registry independent audit
 // has already verified both IDs at Tokyo raceTrackId=10005, distance 1200.
 // This narrows venue/distance confounding, NOT course geometry or surface.
 const tokyoTurf=fixed.COURSES.find(x=>x.id===10501);
 const tokyoDirt=fixed.COURSES.find(x=>x.id===10508);
 if(!tokyoTurf||!tokyoDirt||tokyoTurf.surface!=='turf'||
    tokyoDirt.surface!=='dirt'||tokyoTurf.distance!==1200||
    tokyoDirt.distance!==1200||tokyoTurf.distanceType!==1||
    tokyoDirt.distanceType!==1)
  throw Error('P2.33 verified same-venue/distance reference pair drift');
 const tokyo1200=rows.filter(x=>x.distanceType===1);
 if(tokyo1200.length!==240||
    tokyo1200.some(x=>x.turfW.observedCourses.length!==1||
     x.turfW.observedCourses[0].courseId!==10501||
     x.dirtW.observedCourses.length!==1||
     x.dirtW.observedCourses[0].courseId!==10508))
  throw Error('P2.33 original Tokyo1200 source courses changed');
 const tokyoSummary={
  verification:'pinned-two-source-course-registry-confirmed-in-P2.15',
  venueId:10005,distanceMetres:1200,
  turfCourseId:10501,dirtCourseId:10508,
  matchedOriginalMechanismDistanceCells:tokyo1200.length,
  strict30:tokyo1200.filter(x=>
   x.original30.direction!=='held-overlap-or-course-confounding').length,
  strictConfirmedBothHalves:tokyo1200.filter(x=>
   x.bothHalvesConfirmOriginalDirection).length,
  hypotheticalFivePointConfirmedBothHalves:tokyo1200.filter(x=>
   x.bothHalvesConfirmHypotheticalFivePointGap).length,
  courseGeometryAndSurfaceStillConfounded:true
 };
 const total=shapes.paired.length*fixed.STYLES.length*fixed.SCENARIOS.length*
  2*fixed.MODES.length*4;
 if(total!==1024||rows.length!==960||missing.length!==16||
  rows.some(x=>x.sourceIDIdentical)||
  missing.some(x=>x.style!=='Nige'||x.scenario!=='noFront'))
  throw Error('P2.33 fixed paired source partial mechanism cardinality drift');
 // Missing 16 CONTEXTS span 4 distances each, i.e. 64 missing W cases.
 return {schemaVersion:1,status:STATUS,
  source:{globalSimRevision:fixed.PIN,
   fixedOriginalUmaSimSkillSHA256:fixed.SOURCE_SHA,
   originalFull30ArtifactSha256:prior.PINNED,
   splitModel:'same original 30 seeds partitioned into 0..14 and 15..29',
   skillIdentitiesFrom:'fixed source ID provenance in 32-research manifest'},
  design:{partialRankAndTimingMechanismIdentical:true,
   originalSourceSkillIDsIdentical:false,
   originalFullSkillRouteEquivalent:false,
   sameSurfaceWithinEachWMeasurement:true,
   betweenSurfacesDifferentCoursesAndPossiblyVenues:true,
   headcounts:[9,12],rosters:fixed.SCENARIOS,
   styles:fixed.STYLES,modes:fixed.MODES,distanceTypes:[1,2,3,4],
   full30SeedModelReplayed:true,realGameObservations:false,
   courseBounds:'minimum source-course W lower / maximum source-course W upper',
   strictDirectionalCriterion:'non-overlapping W bounds, not statistical significance',
   hypotheticalFivePointSensitivity:true},
  denominators:{originalDistanceUnrestrictedSourceProfiles:10,
   sharedRankTimeMechanisms:shapes.paired.length,
   unpairedRankTimeMechanisms:shapes.held.length,
   candidateCellsIncludingAbsentStyle:total,
   absentStyleScenarioHeadModeCells:missing.length,
   absentStyleDistanceCells:missing.length*4,
   comparableMechanismStyleScenarioHeadModeDistanceCells:rows.length,
   originalSameSkillCrossSurfaceMeasured:0,
   sourceWholeANDVerified:0,gameActivationMeasured:0,
   P3SuitabilityScored:0},
  summary:{pooledStrictDirectionalCells:strong.length,
   strictDirectionConfirmedBothHalves:strong.filter(x=>
    x.bothHalvesConfirmOriginalDirection).length,
   pooledFivePointDirectionalCells:five.length,
   fivePointConfirmedBothHalves:five.filter(x=>
    x.bothHalvesConfirmHypotheticalFivePointGap).length,
   mechanismStylePairsWithAnyConfirmedDirection:matching(rows.filter(x=>
    x.bothHalvesConfirmOriginalDirection)),
   mechanismStylePairsWithAnyConfirmedFivePoint:matching(rows.filter(x=>
    x.bothHalvesConfirmHypotheticalFivePointGap)),
   byDistanceType:byDistance,
   sameVenueSameDistanceTokyo1200:tokyoSummary},
  sourceMechanismPairs:shapes.paired,
  unpairedSourceMechanisms:shapes.held,
  rows,missingContexts:missing,
  limitations:[
   'Both surfaces share only the exact rank/time predicate shape. The two fixed sourceNumericIds are DIFFERENT ORIGINAL SKILLS, not matched source skill activation.',
   'Candidate source skills with identical current rank/time terms may have other dynamic AND terms, OR paths or historical preConditions; this experiment does not resolve them.',
   'Surface changes together with course geometry, venue, race dynamics and possibly aptitude; the causal turf/dirt effect is not identified.',
   'The 10501/10508 Tokyo1200 case fixes raceTrackId and 1200m in original registries, but NOT turf/dirt course geometry or real aptitude.',
   'A fixed 30-seed aggregate and its 15+15 partitions are artificial model observations, not independent real-game samples or confidence intervals.',
   'Do not promote any strict interval separation or hypothetical five-point margin to a product effect threshold.',
   'No official card score, W/D full skill suitability or game proc is evaluated.'
  ]};
}
function main(args){
 if(args.length!==14)throw Error('Usage: P2.33 surface-W manifest 4full30 8split15 output.json');
 const [manifestPath,...files]=args;
 const full=files.slice(0,4).map((p,i)=>{
  const bytes=fs.readFileSync(p);
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==
   prior.PINNED[fixed.SCENARIOS[i]])
   throw Error('P2.33 source original full30 SHA drift');
  return JSON.parse(bytes);
 });
 const halves=Object.fromEntries(fixed.SCENARIOS.map((s,i)=>
  [s,[JSON.parse(fs.readFileSync(files[4+i*2],'utf8')),
   JSON.parse(fs.readFileSync(files[5+i*2],'utf8'))]]));
 const output=audit(JSON.parse(fs.readFileSync(manifestPath,'utf8')),full,halves);
 fs.writeFileSync(files[12],JSON.stringify(output,null,2)+'\n');
 console.log('P2_33_SHARED_MECHANISM_SURFACE_W='+JSON.stringify({
  denominators:output.denominators,summary:output.summary}));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STATUS,surfaceContrast,compareOne,audit,main};
