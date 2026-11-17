'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const fixed=require('../tools/globalsim_roster32.cjs');
const study=require('../tools/skill_p2_33_surface_w.cjs');
const cross=require('../src/skill_p2_33_surface_crosswalk.cjs');
const pairs=cross.pairedMechanisms(manifest).paired;
function synthetic(){
 const reports=fixed.SCENARIOS.map(scenario=>{
  const contextRows=[];
  for(const c of fixed.COURSES)for(const n of [9,12])
   for(const mode of fixed.MODES)
    for(const [timing,bands] of fixed.courseTargets(manifest,c))
     for(const bandId of bands)
      for(const [i,style] of fixed.STYLES.entries()){
       const count=fixed.COUNTS[scenario][n][i];
       if(!count)continue;
       const runners=count*30;
       const w=[80,60,40,20][i];
       contextRows.push({scenario,surface:c.surface,courseId:c.id,
        distance:c.distance,fieldSize:n,mode,timing,bandId,style,
        status:'complete-model-measurement',runners,validRunners:runners,
        unresolvedRunners:0,unresolvedReasons:{},
        opportunityPercent:w,pointOccupancyPercent:w,
        opportunityLowerBoundPercent:w,opportunityUpperBoundPercent:w});
      }
  return {schemaVersion:2,scenario,
   status:'P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation',
   modelRevision:fixed.PIN,sourceSkillRegistrySha256:fixed.SOURCE_SHA,
   researchManifestSha256:manifest.source.previousArtifactSha256,
   rosterCounts:fixed.COUNTS[scenario],runnersPerStyleMissingIsNull:true,
   unresolvedTrajectoryIsBoundedNotZero:true,
   seedsPerCell:30,models:12,simulations:1440,
   profileCount:32,profileCourseInstances:94,
   observedRows:contextRows.length,missingStyleContextCells:scenario==='noFront'?300:0,
   heldContextCells:0,unresolvedRunnerWindows:0,contextRows};
 });
 const halves=Object.fromEntries(fixed.SCENARIOS.map((scenario,i)=>
  [scenario,[0,15].map(repStart=>{
   const r=structuredClone(reports[i]);
   r.seedsPerCell=15;r.simulations=720;
   r.seedWindow={repStart,repEndExclusive:repStart+15};
   for(const x of r.contextRows){x.runners/=2;x.validRunners/=2;}
   return r;
  })]));
 return {reports,halves};
}
function editW(report,p,surface,style,value,filter=()=>true){
 const cands=report.contextRows.filter(x=>x.surface===surface&&
  x.timing===p.timing&&x.bandId===p.bandId&&x.style===style&&filter(x));
 assert(cands.length>0);
 for(const x of cands){
  x.opportunityPercent=value;x.pointOccupancyPercent=value;
  x.opportunityLowerBoundPercent=value;
  x.opportunityUpperBoundPercent=value;
 }
}
test('cross-surface lower/upper conservation rejects unpaired distance and retains held bounds',()=>{
 const t={type:1,distanceClass:'sprint',lowerWPercent:30,upperWPercent:70};
 const d={type:1,distanceClass:'sprint',lowerWPercent:45,upperWPercent:50};
 const c=study.surfaceContrast(t,d);
 assert.equal(c.direction,'held-overlap-or-course-confounding');
 assert.equal(c.fivePointSensitivityDirection,null);
 assert.equal(c.turfMinusDirtLowerPoints,-20);
 assert.equal(c.turfMinusDirtUpperPoints,25);
 assert.equal(study.surfaceContrast({...t,lowerWPercent:90,upperWPercent:90},d).direction,'turf-higher');
 assert.throws(()=>study.surfaceContrast(t,{...d,type:2}),/not paired/);
});
test('fixed 32-rank profile cohort has 4 source-identical SHAPES but ZERO same source skills',()=>{
 const {reports,halves}=synthetic();
 const before=JSON.stringify({reports,halves});
 const x=study.audit(manifest,reports,halves);
 assert.equal(JSON.stringify({reports,halves}),before);
 assert.equal(x.denominators.sharedRankTimeMechanisms,4);
 assert.equal(x.denominators.unpairedRankTimeMechanisms,2);
 assert.equal(x.denominators.candidateCellsIncludingAbsentStyle,1024);
 assert.equal(x.denominators.absentStyleScenarioHeadModeCells,16);
 assert.equal(x.denominators.absentStyleDistanceCells,64);
 assert.equal(x.denominators.comparableMechanismStyleScenarioHeadModeDistanceCells,960);
 assert.equal(x.denominators.originalSameSkillCrossSurfaceMeasured,0);
 assert.equal(x.summary.pooledStrictDirectionalCells,0);
 assert.equal(x.summary.fivePointConfirmedBothHalves,0);
 assert.equal(x.rows.length,960);
 assert(x.rows.every(y=>y.sourceIDIdentical===false&&y.originalSkillWholeAND===false));
 assert(x.sourceMechanismPairs.every(y=>y.turfSourceNumericId!==y.dirtSourceNumericId));
});
test('surface proxy difference is measured at EXACT shared rank/time shape, roster and field',()=>{
 const {reports,halves}=synthetic();
 const p=pairs.find(x=>x.timing==='phase_random:1'&&x.bandId==='top50');
 assert(p);
 editW(reports[0],p,'turf','Senkou',90);
 editW(reports[0],p,'dirt','Senkou',10);
 for(const h of halves.balanced){
  editW(h,p,'turf','Senkou',90);
  editW(h,p,'dirt','Senkou',10);
 }
 const x=study.audit(manifest,reports,halves);
 const witness=x.rows.find(r=>r.mechanismKey===p.mechanismKey&&
  r.scenario==='balanced'&&r.style==='Senkou'&&
  r.fieldSize===9&&r.mode===fixed.MODES[0]&&r.distanceType===1);
 assert(witness);
 assert.equal(witness.original30.direction,'turf-higher');
 assert.equal(witness.bothHalvesConfirmOriginalDirection,true);
 assert.equal(witness.bothHalvesConfirmHypotheticalFivePointGap,true);
 assert(x.summary.strictDirectionConfirmedBothHalves>0);
 assert(x.summary.mechanismStylePairsWithAnyConfirmedDirection>0);
});
test('contradictory seed halves do not confirm pooled surface direction',()=>{
 const {reports,halves}=synthetic();
 const p=pairs[0];
 editW(reports[0],p,'turf','Senkou',60);
 editW(reports[0],p,'dirt','Senkou',40);
 editW(halves.balanced[0],p,'turf','Senkou',20);
 editW(halves.balanced[1],p,'turf','Senkou',100);
 // 20+100 over two equally-populated 15-seed windows == 60 pooled.
 const x=study.audit(manifest,reports,halves);
 const row=x.rows.find(y=>y.mechanismKey===p.mechanismKey&&
  y.scenario==='balanced'&&y.style==='Senkou'&&
  y.fieldSize===9&&y.mode===fixed.MODES[0]);
 assert.equal(row.original30.direction,'turf-higher');
 assert.equal(row.first15.direction,'dirt-higher');
 assert.equal(row.last15.direction,'turf-higher');
 assert.equal(row.bothHalvesConfirmOriginalDirection,false);
});
test('reconciler fails closed if source ID / disjoint cohort drifts',()=>{
 const {reports,halves}=synthetic();
 halves.backHeavy[1].seedWindow.repStart=0;
 assert.throws(()=>study.audit(manifest,reports,halves),/invalid disjoint/);
});
