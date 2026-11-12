'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const model=require('../tools/globalsim_roster32.cjs');
const pair=require('../tools/skill_specificity32_research.cjs');
const dist=require('../tools/skill_distance_style_interaction.cjs');
const split=require('../tools/skill_distance_split15_reliability.cjs');
function sourceFixture(){
 const reports=[];
 for(const scenario of model.SCENARIOS){
  const rows=[];
  for(const course of model.COURSES)for(const n of [9,12])
   for(const mode of model.MODES)
    for(const [timing,bands] of model.courseTargets(manifest,course))
     for(const bandId of bands)for(const [i,style] of model.STYLES.entries()){
      const runnerCount=model.COUNTS[scenario][n][i]*30;
      if(!runnerCount)continue;
      const w=[75,65,35,25][i];
      rows.push({scenario,surface:course.surface,courseId:course.id,
       distance:course.distance,fieldSize:n,mode,timing,bandId,style,
       status:'complete-model-measurement',runners:runnerCount,
       validRunners:runnerCount,unresolvedRunners:0,unresolvedReasons:{},
       opportunityPercent:w,pointOccupancyPercent:w-1,
       opportunityLowerBoundPercent:w,opportunityUpperBoundPercent:w});
     }
  reports.push({schemaVersion:2,scenario,
   status:'P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation',
   modelRevision:model.PIN,sourceSkillRegistrySha256:model.SOURCE_SHA,
   researchManifestSha256:manifest.source.previousArtifactSha256,
   rosterCounts:model.COUNTS[scenario],runnersPerStyleMissingIsNull:true,
   unresolvedTrajectoryIsBoundedNotZero:true,seedsPerCell:30,models:12,
   simulations:1440,profileCount:32,profileCourseInstances:94,
   observedRows:rows.length,missingStyleContextCells:scenario==='noFront'?300:0,
   heldContextCells:0,unresolvedRunnerWindows:0,contextRows:rows});
 }
 const p231={schemaVersion:1,
  status:'P2.31-individual-course-mode-W-margin-vs-scenario-mean-research-only',
  source:{modelRevision:model.PIN,skillRegistrySha256:model.SOURCE_SHA,
   sourceArtifactSha256:pair.PINNED},
  design:{sourceSignatures:32,styleComparisons:192},
  rows:manifest.profiles.flatMap(p=>pair.PAIRS.map(([first,second])=>({
   sourceNumericId:p.sourceNumericId,surface:p.surface,
   distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
   first,second,priorConsensus:'synthetic-no-prod-inference'})))
 };
 return {reports,p231};
}
function setW(rows,p,courseIds,style,value){
 for(const courseId of courseIds){
  const row=rows.find(x=>x.courseId===courseId&&
   x.fieldSize===9&&x.mode===model.MODES[0]&&
   x.timing===p.timing&&x.bandId===p.bandId&&x.style===style);
  assert(row,'Missing source-matched experimental row');
  row.opportunityPercent=value;
  row.pointOccupancyPercent=value-1;
  row.opportunityLowerBoundPercent=value;
  row.opportunityUpperBoundPercent=value;
 }
}
function makeHalves(fullReports){
 return Object.fromEntries(model.SCENARIOS.map((scenario,i)=>{
  const source=fullReports[i];
  return [scenario,[0,15].map(start=>{
   const out=structuredClone(source);
   out.seedsPerCell=15;out.simulations=720;
   out.seedWindow={repStart:start,repEndExclusive:start+15};
   out.contextRows=source.contextRows.map(r=>({
    ...structuredClone(r),runners:r.runners/2,
    validRunners:r.validRunners/2
   }));
   return out;
  })];
 }));
}
test('P2.17b preserves exactly matched source/distance/pair and records no invented game proc',()=>{
 const {reports,p231}=sourceFixture();
 const halves=makeHalves(reports);
 const before=JSON.stringify({reports,halves,p231});
 const a=split.audit(manifest,reports,halves,p231);
 assert.equal(JSON.stringify({reports,halves,p231}),before);
 assert.equal(a.status,split.STATUS);
 assert.equal(a.summary.allOriginalEligibleCourses.sourceConditionStylePairs,60);
 assert.equal(a.summary.allOriginalEligibleCourses.comparableEventContextCells,5040);
 assert.equal(a.summary.allOriginalEligibleCourses.missingStyleRosterHeadModeContextCells,120);
 assert.equal(a.summary.sameVenueTokyoTurf.sourceConditionStylePairs,24);
 assert.equal(a.summary.sameVenueTokyoTurf.comparableEventContextCells,2016);
 assert.equal(a.summary.sameVenueTokyoTurf.missingStyleRosterHeadModeContextCells,48);
 assert.equal(a.summary.allOriginalEligibleCourses.strictSignReversal.original30EventContextCount,0);
 assert.equal(a.summary.allOriginalEligibleCourses.fivePointGapShift.original30EventContextCount,0);
 assert.equal(a.summary.allOriginalEligibleCourses.strictSignReversal.sameContextAndOrientationConfirmedEventCount,0);
 assert.equal(a.design.noNewIndependentRealGameSamples,true);
 assert.equal(Object.hasOwn(a,'cardSuitability'),false);
 assert(a.rows.every(x=>x.distanceScope==='all'));
 assert(a.rows.filter(x=>x.first==='Nige').every(x=>x.missingStyleContextCount===4));
});
test('a strict original30 distance reversal disappears in first 15 even while source sums exactly reconcile',()=>{
 const {reports,p231}=sourceFixture();
 const p=manifest.profiles.find(x=>x.surface==='turf'&&x.distanceScope==='all');
 assert(p);
 setW(reports[0].contextRows,p,[10502,10304],'Nige',50);
 const halves=makeHalves(reports);
 // Full30 Tokyo mile Nige 50; first15 80, second15 20.
 // P2.13 reconstructs W=50 exactly from the two disjoint halves.
 setW(halves.balanced[0].contextRows,p,[10502,10304],'Nige',80);
 setW(halves.balanced[1].contextRows,p,[10502,10304],'Nige',20);
 const a=split.audit(manifest,reports,halves,p231);
 const row=a.rows.find(x=>x.sourceNumericId===p.sourceNumericId&&
  x.first==='Nige'&&x.second==='Senkou');
 const ctx=row.comparisons.find(x=>x.scenario==='balanced'&&
  x.fieldSize===9&&x.mode===model.MODES[0]&&
  x.distanceClasses.join('|')==='sprint|mile');
 assert(ctx);
 assert(ctx.original30.signReversalOrientation);
 assert.equal(ctx.first15.signReversalOrientation,null);
 assert.equal(ctx.last15.signReversalOrientation,
  ctx.original30.signReversalOrientation);
 assert.equal(ctx.bothHalvesConfirmOriginal30SignReversal,false);
 assert.equal(ctx.bothHalvesConfirmOriginal30FivePointGapShift,false);
 assert(a.summary.allOriginalEligibleCourses.strictSignReversal.original30EventContextCount>0);
 assert(a.summary.allOriginalEligibleCourses.strictSignReversal.original30OnlyEventContextCount>0);
 assert(a.summary.sameVenueTokyoTurf.strictSignReversal.original30OnlyEventContextCount>0);
});
test('a stable original30 reversal is confirmed in both halves at the EXACT same context and direction',()=>{
 const {reports,p231}=sourceFixture();
 const p=manifest.profiles.find(x=>x.surface==='turf'&&x.distanceScope==='all');
 setW(reports[0].contextRows,p,[10502,10304],'Nige',50);
 const halves=makeHalves(reports);
 const a=split.audit(manifest,reports,halves,p231);
 const row=a.rows.find(x=>x.sourceNumericId===p.sourceNumericId&&
  x.first==='Nige'&&x.second==='Senkou');
 const x=row.comparisons.find(x=>x.scenario==='balanced'&&
  x.fieldSize===9&&x.mode===model.MODES[0]&&
  x.distanceClasses.join('|')==='sprint|mile');
 assert(x&&x.bothHalvesConfirmOriginal30SignReversal);
 assert(x.bothHalvesConfirmOriginal30FivePointGapShift);
 assert(a.summary.allOriginalEligibleCourses.strictSignReversal.sameContextAndOrientationConfirmedEventCount>0);
 assert(a.summary.sameVenueTokyoTurf.fivePointGapShift.sameContextAndOrientationConfirmedEventCount>0);
});
test('modified or missing seed windows and original partial condition identities fail closed',()=>{
 const {reports,p231}=sourceFixture();
 const halves=makeHalves(reports);
 halves.noFront[1].seedWindow.repStart=0;
 assert.throws(()=>split.audit(manifest,reports,halves,p231),/invalid disjoint/);
 halves.noFront[1].seedWindow.repStart=15;
 const row=halves.balanced[0].contextRows[0];
 row.opportunityLowerBoundPercent+=1;
 row.opportunityUpperBoundPercent+=1;
 row.opportunityPercent+=1;
 row.pointOccupancyPercent+=1;
 assert.throws(()=>split.audit(manifest,reports,halves,p231),/not reconstructed/);
 const bad=sourceFixture();
 bad.p231.source.skillRegistrySha256='untrusted';
 assert.throws(()=>split.audit(manifest,bad.reports,makeHalves(bad.reports),
  bad.p231),/incompatible pinned P2.31/);
});
