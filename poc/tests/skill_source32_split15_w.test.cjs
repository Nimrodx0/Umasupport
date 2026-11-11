'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const model=require('../tools/globalsim_roster32.cjs');
const prior=require('../tools/skill_specificity32_research.cjs');
const p229=require('../tools/skill_reference_scenario_gate.cjs');
const p230=require('../tools/skill_context_margin_sensitivity.cjs');
const p231=require('../tools/skill_context_individual_margin.cjs');
const split=require('../tools/skill_source32_split15_w.cjs');
const eq=(a,b)=>assert.deepEqual(a,b);
function fakeReports(seeds=30){
 const reports=[];
 const rates=[75,65,35,25];
 for(const scenario of model.SCENARIOS){
  const rows=[];
  for(const course of model.COURSES)
   for(const n of [9,12])
    for(const mode of model.MODES)
     for(const [timing,bands] of model.courseTargets(manifest,course))
      for(const bandId of bands)
       for(const [i,style] of model.STYLES.entries()){
        const count=model.COUNTS[scenario][n][i];
        if(!count)continue;
        const v=rates[i];
        rows.push({scenario,surface:course.surface,courseId:course.id,
         distance:course.distance,fieldSize:n,mode,timing,bandId,style,
         status:'complete-model-measurement',runners:count*seeds,
         validRunners:count*seeds,unresolvedRunners:0,unresolvedReasons:{},
         opportunityPercent:v,pointOccupancyPercent:v-1,
         opportunityLowerBoundPercent:v,opportunityUpperBoundPercent:v});
       }
  reports.push({schemaVersion:2,
   status:'P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation',
   modelRevision:model.PIN,sourceSkillRegistrySha256:model.SOURCE_SHA,
   researchManifestSha256:manifest.source.previousArtifactSha256,
   scenario,rosterCounts:model.COUNTS[scenario],
   runnersPerStyleMissingIsNull:true,unresolvedTrajectoryIsBoundedNotZero:true,
   seedsPerCell:seeds,models:12,simulations:12*2*2*seeds,
   profileCount:32,profileCourseInstances:94,
   observedRows:rows.length,missingStyleContextCells:scenario==='noFront'?300:0,
   heldContextCells:0,unresolvedRunnerWindows:0,contextRows:rows});
 }
 return reports;
}
function sourceFixture(){
 const reports=fakeReports(30),old=[];
 for(const p of manifest.profiles)for(const fieldSize of [9,12])
  for(const [i,style] of model.STYLES.entries())
   old.push({...p,fieldSize,style,scenarios:{balanced:{
    opportunityPercent:[75,65,35,25][i]}}});
 const aggregate={schemaVersion:2,
  status:'p2-model-only-32-source-condition-opportunities-across-four-artificial-rosters',
  design:{sourceConditionProfiles:32,raceCases:5760},profiles:old};
 const twoAxis=prior.quantify(manifest,reports,aggregate);
 const base=p229.audit(twoAxis),margin=p230.analyze(twoAxis,base);
 const individual=p231.audit(manifest,reports,margin);
 const halves=Object.fromEntries(model.SCENARIOS.map((scenario,i)=>{
  const full=reports[i];
  const arr=[0,15].map(start=>({
   ...structuredClone(full),seedsPerCell:15,simulations:720,
   seedWindow:{repStart:start,repEndExclusive:start+15},
   contextRows:full.contextRows.map(r=>({
    ...structuredClone(r),runners:r.runners/2,validRunners:r.validRunners/2
   }))
  }));
  return [scenario,arr];
 }));
 return {reports,individual,halves};
}
test('disjoint 0-14 and 15-29 repetitions preserve original seed+horse assignments',()=>{
 const a=model.plans('balanced',{seedsPerCell:15,repStart:0});
 const b=model.plans('balanced',{seedsPerCell:15,repStart:15});
 const all=model.plans('balanced',{seedsPerCell:30});
 assert.equal(a.length,720);assert.equal(b.length,720);assert.equal(all.length,1440);
 eq([...a,...b].map(x=>[x.course.id,x.fieldSize,x.mode,x.rep,x.seed,x.strategies])
  .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
  all.map(x=>[x.course.id,x.fieldSize,x.mode,x.rep,x.seed,x.strategies])
  .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const ids=new Set(a.map(x=>[x.course.id,x.fieldSize,x.mode,x.rep].join('|')));
 assert(b.every(x=>!ids.has([x.course.id,x.fieldSize,x.mode,x.rep].join('|'))));
 assert.throws(()=>model.plans('balanced',{seedsPerCell:15,repStart:7}),/disjoint halves/);
 assert.throws(()=>model.plans('balanced',{seedsPerCell:3}),/even seeds/);
});
test('all original 192 partial condition pairs are reproducibly compared across both disjoint halves',()=>{
 const {reports,individual,halves}=sourceFixture();
 const before=JSON.stringify({reports,individual,halves});
 const out=split.audit(manifest,reports,halves,individual);
 assert.equal(JSON.stringify({reports,individual,halves}),before);
 assert.equal(out.rows.length,192);
 assert.equal(out.design.originalModelRaces,5760);
 for(const t of ['0','1','3','5']){
  const v=out.summary[t];
  assert.equal(v.original30SeedIndividualContextPass,192);
  assert.equal(v.bothDisjoint15SeedHalvesPass,192);
  assert.equal(v.original30OnlyNotBothHalves,0);
  assert.equal(v.fullCoverageBothPass,96);
  assert.equal(v.observedOnlyMissingStyleBothPass,96);
 }
 assert(out.rows.filter(x=>x.first==='Nige').every(x=>
  x.missingHeadcountScenarioCells.length===2));
 assert.equal(out.design.independentRealWorldSamples,false);
 assert.equal(Object.hasOwn(out,'cardScore'),false);
});
test('a 30-seed strong direction can reverse in first 15 and recover in second 15',()=>{
 const {reports,individual,halves}=sourceFixture();
 const range=halves.balanced;
 for(const [i,v] of [50,100].entries()){
  const row=range[i].contextRows.find(x=>x.courseId===10502&&
   x.fieldSize===9&&x.mode==='equal'&&x.style==='Nige'&&
   x.timing==='phase_laterhalf_random:0'&&x.bandId==='top50');
  assert(row);
  row.opportunityPercent=v;row.opportunityLowerBoundPercent=v;
  row.opportunityUpperBoundPercent=v;row.pointOccupancyPercent=v-1;
 }
 const out=split.audit(manifest,reports,halves,individual);
 assert(out.summary['0'].original30OnlyNotBothHalves>0);
 const x=out.rows.find(x=>x.sourceNumericId==='200681'&&
  x.first==='Nige'&&x.second==='Senkou');
 assert(x&&x.thresholds['0'].full30Pass&&!x.thresholds['0'].both15Pass);
 assert(x.strictlyOppositeOriginalDirectionInAnyContextByHalf[0]);
 assert(!x.strictlyOppositeOriginalDirectionInAnyContextByHalf[1]);
});
test('tampered half windows or aggregate totals are rejected, not promoted',()=>{
 const {reports,individual,halves}=sourceFixture();
 halves.backHeavy[1].seedWindow.repStart=0;
 assert.throws(()=>split.audit(manifest,reports,halves,individual),
  /invalid disjoint/);
 halves.backHeavy[1].seedWindow.repStart=15;
 const tampered=halves.frontHeavy[0].contextRows[0];
 tampered.opportunityLowerBoundPercent+=2;
 tampered.opportunityUpperBoundPercent+=2;
 tampered.opportunityPercent+=2;
 tampered.pointOccupancyPercent+=2;
 assert.throws(()=>split.audit(manifest,reports,halves,individual),
  /not reconstructed/);
});
