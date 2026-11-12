'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const model=require('../tools/globalsim_roster32.cjs');
const pair=require('../tools/skill_specificity32_research.cjs');
const study=require('../tools/skill_distance_style_interaction.cjs');
function fixture(){
 const reportRows=[];
 for(const scenario of model.SCENARIOS){
  const rows=[];
  for(const course of model.COURSES)for(const n of [9,12])
   for(const mode of model.MODES)
    for(const [timing,bands] of model.courseTargets(manifest,course))
     for(const bandId of bands)for(const [i,style] of model.STYLES.entries()){
      const count=model.COUNTS[scenario][n][i];
      if(!count)continue;
      const value=[75,65,35,25][i];
      rows.push({scenario,surface:course.surface,courseId:course.id,
       distance:course.distance,fieldSize:n,mode,timing,bandId,style,
       status:'complete-model-measurement',runners:count*30,
       validRunners:count*30,unresolvedRunners:0,unresolvedReasons:{},
       opportunityPercent:value,pointOccupancyPercent:value-1,
       opportunityLowerBoundPercent:value,
       opportunityUpperBoundPercent:value});
     }
  reportRows.push({
   schemaVersion:2,scenario,
   status:'P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation',
   modelRevision:model.PIN,sourceSkillRegistrySha256:model.SOURCE_SHA,
   researchManifestSha256:manifest.source.previousArtifactSha256,
   rosterCounts:model.COUNTS[scenario],
   runnersPerStyleMissingIsNull:true,unresolvedTrajectoryIsBoundedNotZero:true,
   seedsPerCell:30,models:12,simulations:1440,
   profileCount:32,profileCourseInstances:94,
   observedRows:rows.length,missingStyleContextCells:scenario==='noFront'?300:0,
   heldContextCells:0,unresolvedRunnerWindows:0,contextRows:rows
  });
 }
 const baseline={
  schemaVersion:1,
  status:'P2.31-individual-course-mode-W-margin-vs-scenario-mean-research-only',
  source:{modelRevision:model.PIN,skillRegistrySha256:model.SOURCE_SHA,
   sourceArtifactSha256:pair.PINNED},
  design:{sourceSignatures:32,styleComparisons:192},
  rows:manifest.profiles.flatMap(p=>pair.PAIRS.map(([first,second])=>({
   sourceNumericId:p.sourceNumericId,surface:p.surface,
   distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
   first,second,priorConsensus:'synthetic-no-gate-assessment'
  })))
 };
 return {reports:reportRows,p231:baseline};
}
function modify(reports,p,scenario,n,mode,courseId,style,val){
 const source=reports.find(x=>x.scenario===scenario);
 const row=source.contextRows.find(x=>x.courseId===courseId&&
  x.fieldSize===n&&x.mode===mode&&x.style===style&&
  x.timing===p.timing&&x.bandId===p.bandId);
 assert(row);
 row.opportunityPercent=val;
 row.pointOccupancyPercent=val-1;
 row.opportunityLowerBoundPercent=val;
 row.opportunityUpperBoundPercent=val;
}
test('P2.17 only compares same original distance-unrestricted source predicate and surfaces',()=>{
 const {reports,p231}=fixture();
 const original=JSON.stringify({reports,p231});
 const a=study.audit(manifest,reports,p231);
 assert.equal(JSON.stringify({reports,p231}),original);
 assert.equal(a.design.distanceUnrestrictedSourceSignatures,10);
 assert.equal(a.design.distanceRestrictedSourceSignaturesExcluded,22);
 assert.deepEqual(a.design.distanceClasses,['sprint','mile','middle','long']);
 assert.equal(a.summary.allOriginalEligibleCourses.sourceConditionStylePairs,60);
 assert.equal(a.summary.allOriginalEligibleCourses.matchedRosterHeadModeContexts,840);
 assert.equal(a.summary.allOriginalEligibleCourses.missingStyleRosterHeadModeContexts,120);
 assert.equal(a.summary.allOriginalEligibleCourses.matchedCrossDistanceClassComparisons,5040);
 assert.equal(a.summary.sameVenueTokyoTurf.sourceConditionStylePairs,24);
 assert.equal(a.summary.sameVenueTokyoTurf.matchedRosterHeadModeContexts,336);
 assert.equal(a.summary.sameVenueTokyoTurf.missingStyleRosterHeadModeContexts,48);
 assert.equal(a.summary.sameVenueTokyoTurf.matchedCrossDistanceClassComparisons,2016);
 assert.equal(a.summary.allOriginalEligibleCourses.pairsWithStrictCrossDistanceSignReversal,0);
 assert.equal(a.summary.allOriginalEligibleCourses.pairsWithFivePointOrGreaterConservativeGapShift,0);
 assert.equal(a.summary.sameVenueTokyoTurf.pairsWithStrictCrossDistanceSignReversal,0);
 assert.equal(a.summary.sameVenueTokyoTurf.pairsWithFivePointOrGreaterConservativeGapShift,0);
 assert.equal(a.rows.length,60);
 assert(a.rows.every(x=>x.distanceScope==='all'));
 assert(a.rows.filter(x=>x.first==='Nige').every(x=>x.absent.length===4));
 assert(a.rows.filter(x=>x.first!=='Nige').every(x=>x.absent.length===0));
 assert(a.rows.every(x=>x.contexts.every(c=>c.contrasts.length===6)));
 assert(a.limitations.some(x=>x.includes('does NOT isolate distance')));
 assert(!Object.hasOwn(a,'cardSuitability'));
});
test('matched roster/head/mode shows a source-matched cross-distance reversal and a conservative W gap shift',()=>{
 const {reports,p231}=fixture();
 const p=manifest.profiles.find(x=>x.surface==='turf'&&x.distanceScope==='all');
 assert(p);
 modify(reports,p,'balanced',9,model.MODES[0],10501,'Nige',95);
 for(const courseId of [10502,10304])
  modify(reports,p,'balanced',9,model.MODES[0],courseId,'Nige',25);
 const a=study.audit(manifest,reports,p231);
 const key=x=>x.sourceNumericId===p.sourceNumericId&&
  x.first==='Nige'&&x.second==='Senkou';
 const row=a.rows.find(key),tokyo=a.tokyoTurfRows.find(key);
 assert(row&&tokyo);
 const check=x=>x.contexts.find(z=>z.scenario==='balanced'&&
  z.fieldSize===9&&z.mode===model.MODES[0]);
 const full=check(row),venue=check(tokyo);
 for(const ctx of [full,venue]){
  assert(ctx.hasStrictSignReversalAcrossDistances);
  assert(ctx.hasFivePointStyleGapShiftAcrossDistances);
  const contrast=ctx.contrasts.find(x=>x.firstDistance==='sprint'&&
   x.secondDistance==='mile');
  assert(contrast.allCourseStrictSignReversal);
  assert(contrast.gapShiftAboveFivePoints);
  assert.equal(contrast.conservativeGapShiftLowerPoints,70);
  assert.equal(contrast.conservativeGapShiftUpperPoints,70);
 }
 assert(a.summary.allOriginalEligibleCourses.pairsWithStrictCrossDistanceSignReversal>=1);
 assert(a.summary.sameVenueTokyoTurf.pairsWithStrictCrossDistanceSignReversal>=1);
});
test('conservative per-class outer interval must not turn one conflicting mile course into a false strict reversal',()=>{
 const {reports,p231}=fixture();
 const p=manifest.profiles.find(x=>x.surface==='turf'&&x.distanceScope==='all');
 modify(reports,p,'balanced',9,model.MODES[0],10502,'Nige',25);
 const a=study.audit(manifest,reports,p231);
 const row=a.rows.find(x=>x.sourceNumericId===p.sourceNumericId&&
  x.first==='Nige'&&x.second==='Senkou');
 const ctx=row.contexts.find(x=>x.scenario==='balanced'&&
  x.fieldSize===9&&x.mode===model.MODES[0]);
 const mile=ctx.groups.find(x=>x.label==='mile');
 assert.equal(mile.allCourseDirection,'held-overlap-or-course-mixed');
 assert.equal(mile.courseIds.length,2);
 const before=ctx.contrasts.find(x=>x.firstDistance==='sprint'&&
  x.secondDistance==='mile');
 assert.equal(before.allCourseStrictSignReversal,false);
 assert.equal(before.gapShiftAboveFivePoints,false);
 assert(!ctx.hasStrictSignReversalAcrossDistances);
 assert(!ctx.hasFivePointStyleGapShiftAcrossDistances);
});
test('P2.17 refuses corrupted P2.31 source, incomplete course and unsupported distance-scope comparison',()=>{
 const {reports,p231}=fixture();
 const broken=structuredClone(p231);
 broken.source.modelRevision='not-GlobalSim-v77';
 assert.throws(()=>study.audit(manifest,reports,broken),/incompatible pinned P2.31/);
 const duplicate=structuredClone(p231);
 duplicate.rows[1]=structuredClone(duplicate.rows[0]);
 assert.throws(()=>study.audit(manifest,reports,duplicate),/duplicated prior source pair/);
 const noCell=structuredClone(reports);
 const p=manifest.profiles.find(x=>x.surface==='turf'&&x.distanceScope==='all');
 const row=noCell[0].contextRows;
 let ix=row.findIndex(x=>x.courseId===10501&&x.fieldSize===9&&
  x.mode===model.MODES[0]&&x.timing===p.timing&&x.bandId===p.bandId&&
  x.style==='Nige');
 assert(ix>=0);
 row.splice(ix,1);noCell[0].observedRows=row.length;
 assert.throws(()=>study.audit(manifest,noCell,p231),/missing or corrupted identical-source/);
 const valid=fixture();
 const indexed=new Map();
 assert.throws(()=>study.distanceClass(indexed,
  manifest.profiles.find(x=>x.distanceScope!=='all'),
  'Nige','Senkou','balanced',9,model.MODES[0],1,model.COURSES),
 /cannot cross source distance scope/);
 assert.equal(valid.reports.length,4);
});
