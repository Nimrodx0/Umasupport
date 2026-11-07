'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../tools/globalsim_roster32.cjs');
const join=require('../tools/skill_roster32_aggregate.cjs');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,
 '../data/p2_position_condition32_research.v1.json'),'utf8'));
const eq=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
test('32 source-scoped rank/time/surface signatures stay fixed and valid',()=>{
 assert.equal(model.verifyManifest(manifest),true);
 assert.equal(manifest.profiles.length,32);
 assert.equal(manifest.profiles.filter(x=>x.surface==='dirt').length,6);
 assert.equal(manifest.profiles.filter(x=>x.surface==='turf').length,26);
 assert.equal(manifest.profiles.find(x=>x.sourceNumericId==='200681').distanceScope,'mile');
 assert.equal(model.courseTargets(manifest,
  model.COURSES.find(x=>x.id===10502)).get('phase_laterhalf_random:0').has('top50'),true);
 const bad=structuredClone(manifest);bad.profiles[0].bandId='fabricated';
 assert.throws(()=>model.verifyManifest(bad),/Invalid manifest/);
 const dup=structuredClone(manifest);dup.profiles[1]={...dup.profiles[0]};
 assert.throws(()=>model.verifyManifest(dup),/Duplicate fixed source/);
});
test('fixed 9/12 scenario definitions, matching seeds and exact noFront Nige absence',()=>{
 assert.deepEqual(model.COUNTS.balanced[9],[2,2,3,2]);
 assert.deepEqual(model.COUNTS.balanced[12],[3,3,3,3]);
 assert.deepEqual(model.COUNTS.noFront[12],[0,4,4,4]);
 for(const scenario of model.SCENARIOS){
  for(const n of [9,12]){
   const r=model.roster(n,scenario,5);
   assert.equal(r.strategies.length,n);
   eq(model.STYLES.map(s=>r.strategies.filter(x=>x===s).length),
    model.COUNTS[scenario][n]);
  }
  const ps=model.plans(scenario,{seedsPerCell:2});
  assert.equal(ps.length,96);
  for(const p of ps){
   assert.equal(p.seed,model.plans('balanced',
    {seedsPerCell:2}).find(x=>x.course.id===p.course.id&&
     x.fieldSize===p.fieldSize&&x.mode===p.mode&&x.rep===p.rep).seed);
  }
 }
 assert(!model.roster(9,'noFront',1).strategies.includes('Nige'));
 assert.throws(()=>model.plans('invented',{seedsPerCell:2}),/Fixed scenario/);
 assert.throws(()=>model.plans('balanced',{seedsPerCell:3}),/even seeds/);
});
test('source 9/12 integer rank fractions are preserved and no fake time windows appear',()=>{
 const top=model.eligibility(9,'top50');
 assert.deepEqual([...top],[1,2,3,4,5]);
 assert.deepEqual([...model.eligibility(12,'top50')],[1,2,3,4,5,6]);
 assert.deepEqual([...model.eligibility(9,'from40')],[4,5,6,7,8,9]);
 const early=model.windowRatios('phase_laterhalf_random:0');
 assert(Math.abs(early.startRate-1/12)<1e-8);
 assert(Math.abs(early.endRate-1/6)<1e-8);
 assert.throws(()=>model.windowRatios('phase_firstquarter_random:1'),/Unrecognized/);
});
function syntheticReports(){
 const reports=[];
 for(const scenario of model.SCENARIOS){
  const rows=[];
  for(const course of model.COURSES)
   for(const n of [9,12])
    for(const mode of model.MODES)
     for(const [timing,bandIds] of model.courseTargets(manifest,course))
      for(const bandId of bandIds)
       for(const [i,style] of model.STYLES.entries()){
        const count=model.COUNTS[scenario][n][i];
        if(!count)continue;
        const value=style==='Sasi'?(
         scenario==='balanced'?30:
          scenario==='frontHeavy'?5:
           scenario==='backHeavy'?85:70
        ):style==='Nige'?(
         scenario==='frontHeavy'?99:scenario==='backHeavy'?70:95
        ):60;
        rows.push({scenario,surface:course.surface,courseId:course.id,
         distance:course.distance,fieldSize:n,mode,timing,bandId,style,
         status:'complete-model-measurement',runners:count*2,
         validRunners:count*2,unresolvedRunners:0,unresolvedReasons:{},
         pointOccupancyPercent:value/2,opportunityPercent:value,
         opportunityLowerBoundPercent:value,
         opportunityUpperBoundPercent:value});
       }
  reports.push({schemaVersion:2,
   status:'P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation',
   modelRevision:model.PIN,sourceSkillRegistrySha256:model.SOURCE_SHA,
   scenario,rosterCounts:model.COUNTS[scenario],
   models:12,seedsPerCell:2,simulations:96,
   profileCount:32,profileCourseInstances:94,
   observedRows:rows.length,runnersPerStyleMissingIsNull:true,
   unresolvedTrajectoryIsBoundedNotZero:true,
   heldContextCells:0,unresolvedRunnerWindows:0,
   contextRows:rows});
 }
 return reports;
}
test('noFront Nige is null and never reported as zero percent',()=>{
 const reports=syntheticReports();
 const a=join.analyze(manifest,reports);
 assert.equal(a.design.raceCases,384);
 assert.equal(a.profiles.length,256);
 assert.equal(a.summary.all.count,256);
 assert.equal(a.summary.all.noFrontMissingStyleCases,64);
 const p=a.profiles.find(x=>x.sourceNumericId==='200681'&&
  x.fieldSize===9&&x.style==='Nige');
 assert.equal(p.applicableScenarioCount,3);
 assert.equal(p.measuredScenarioCount,3);
 assert.equal(p.scenarios.noFront.opportunityPercent,null);
 assert.equal(p.scenarios.noFront.status,'no-style-runners');
 assert.equal(p.scenarios.balanced.opportunityPercent,95);
 assert.equal(p.scenarios.frontHeavy.opportunityPercent,99);
 assert.equal(p.scenarios.backHeavy.opportunityPercent,70);
 const s=a.profiles.find(x=>x.sourceNumericId==='200681'&&
  x.fieldSize===12&&x.style==='Sasi');
 assert.equal(s.scenarios.balanced.opportunityPercent,30);
 assert.equal(s.scenarios.frontHeavy.opportunityPercent,5);
 assert.equal(s.scenarios.backHeavy.opportunityPercent,85);
 assert.equal(s.scenarios.noFront.opportunityPercent,70);
 assert.equal(s.rangeAcrossScenariosPoints,80);
 assert.equal(s.candidateThresholdRobustness['20-80'].robustness,'unstable');
});
test('missing or duplicated scenario contexts fail rather than reporting a zero',()=>{
 const reports=syntheticReports();
 reports[0].contextRows.pop();
 assert.throws(()=>join.analyze(manifest,reports),
  /Missing\/unsupported fixed source|Not all source scope/);
 const second=syntheticReports();
 second[0].contextRows[0]=second[0].contextRows[1];
 assert.throws(()=>join.analyze(manifest,second),/missing or malformed/);
 const third=syntheticReports();
 const front=third.find(x=>x.scenario==='noFront');
 const row=structuredClone(front.contextRows[0]);
 row.style='Nige';row.runners=2;
 front.contextRows.push(row);front.observedRows++;
 assert.throws(()=>join.analyze(manifest,third),/Wrong source roster count|Scenario context is missing or malformed/);
});
test('a genuine tied model rank is held as an interval rather than scored as zero',()=>{
 const reports=syntheticReports();
 const noFront=reports.find(r=>r.scenario==='noFront');
 const row=noFront.contextRows.find(r=>r.surface==='turf'&&
  r.fieldSize===12&&r.style==='Sasi'&&r.courseId===10502&&
  r.timing==='phase_laterhalf_random:0'&&r.bandId==='top50');
 assert(row);
 row.validRunners--;
 row.unresolvedRunners++;
 row.unresolvedReasons={'held-tied-position':1};
 row.status='held-unresolved-rank-trajectory';
 row.opportunityLowerBoundPercent=Number((70*(row.runners-1)/row.runners).toFixed(6));
 row.opportunityUpperBoundPercent=Number(
  ((70*(row.runners-1)+100)/row.runners).toFixed(6));
 row.opportunityPercent=null;
 row.pointOccupancyPercent=null;
 noFront.unresolvedRunnerWindows++;
 noFront.heldContextCells++;
 const result=join.analyze(manifest,reports);
 const p=result.profiles.find(x=>x.sourceNumericId==='200681'&&
  x.style==='Sasi'&&x.fieldSize===12);
 assert(p);
 assert.equal(p.scenarios.noFront.status,'held-ambiguous-source-rank-trajectory');
 assert.equal(p.scenarios.noFront.opportunityPercent,null);
 assert(p.scenarios.noFront.lowerBoundPercent<
  p.scenarios.noFront.upperBoundPercent);
 assert.equal(p.heldScenarioCount,1);
 assert.equal(p.rangeAcrossScenariosPoints,null);
 assert(result.summary.all.heldByUnresolvedTrajectory>0);
 assert(result.rawUncertainty.byScenario.noFront.unresolvedRunnerWindows===1);
});
test('candidate boundaries keep the middle region and never become product decisions',()=>{
 assert.equal(join.classify(19.99,20,80),'low');
 assert.equal(join.classify(20,20,80),'middle');
 assert.equal(join.classify(80,20,80),'high');
 assert.equal(join.BOUNDARIES.length,3);
});
