'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_seed_stability.cjs');
const dense=require('../tools/globalsim_dense_window_validation.cjs');
const pilot=require('../tools/globalsim_position_pilot.cjs');
const windows=require('../tools/globalsim_window_profile.cjs');

function fixture(n=3,fn=()=>0.5){
 const plans=dense.plansFor(n),observations=[];
 for(const p of plans)
  for(const [runnerIndex,style] of p.strategies.entries())
   for(const w of windows.WINDOWS){
    observations.push({courseId:p.course.id,fieldSize:p.fieldSize,
     scenario:p.scenario,mode:p.mode,rep:p.rep,seed:p.seed,
     runnerIndex,style,windowId:w.id,status:'estimate',
     pTopHalf:fn({plan:p,runnerIndex,style,windowId:w.id})});
   }
 return {schemaVersion:1,status:m.sourceStatus,sourceRevision:pilot.PIN,
  seedsPerCell:n,raceCount:plans.length,observations};
}
test('all expected runner positions and all four source-defined random windows reconcile',()=>{
 const source=fixture(3),r=m.analyze(source);
 assert.equal(r.raceCount,72);
 assert.equal(r.observedRunnerWindows,source.observations.length);
 assert.equal(r.totalCells,384);
 assert.equal(r.coverage.withEstimates,384);
 assert.equal(r.coverage.held,0);
 // A running style can be absent from one of the disjoint batches.
 // Such comparisons must be missing rather than assigned a false 0%.
 assert(r.coverage.splitHalfComparisons>0);
 assert(r.coverage.splitHalfComparisons<384);
 assert.equal(r.status,'GlobalSim-seed-sensitivity-not-game-skill-activation-rate');
 assert(r.assumptions.some(s=>s.includes('race is the resampling unit')));
 assert(r.rows.every(row=>row.sourceRaceCount===3&&row.topHalfPercent===50));
 assert.deepEqual(r.rows[0].prefixes.map(p=>p.seeds),[3]);
 assert.equal(r.descriptiveVariation.absoluteSplitHalfDeltaMaximumPercentagePoints,0);
});
test('seed prefixes 3, 10, 15, independent halves and bootstrap are deterministic',()=>{
 const source=fixture(15),a=m.analyze(source),b=m.analyze(source);
 assert.deepEqual(a,b);
 assert.equal(a.raceCount,360);
 assert.equal(a.totalCells,384);
 assert(a.rows.every(row=>row.prefixes.map(p=>p.seeds).join(',')==='3,10,15'));
 assert(a.rows.every(row=>row.splitHalves.first.seeds===7&&
  row.splitHalves.second.seeds===8));
 const row=a.rows.find(x=>x.fieldSize===9&&x.scenario==='balanced'&&
  x.mode==='equal'&&x.style==='Nige'&&x.windowId==='final-full');
 assert.equal(row.bootstrap95.status,'descriptive-race-block-bootstrap-interval');
 assert.equal(row.bootstrap95.lowerPercent,50);
 assert.equal(row.bootstrap95.upperPercent,50);
 assert.equal(row.bootstrap95.definedDraws,400);
 assert.equal(row.racesWithStyle,15);
 assert.equal(row.runnerObservations,30);
});
test('unequal seed batches reveal 60-point drift without imposing a suitability cutoff',()=>{
 const x=m.analyze(fixture(15,({plan})=>plan.rep<7?0.2:0.8));
 const row=x.rows.find(x=>x.fieldSize===9&&x.scenario==='balanced'&&
  x.mode==='equal'&&x.style==='Senkou'&&x.windowId==='final-full');
 assert.equal(row.prefixes[0].topHalfPercent,20);
 assert.equal(row.prefixes[1].topHalfPercent,38);
 assert.equal(row.topHalfPercent,52);
 assert.equal(row.splitHalves.first.topHalfPercent,20);
 assert.equal(row.splitHalves.second.topHalfPercent,80);
 assert.equal(row.splitHalves.secondMinusFirstPercentagePoints,60);
 assert(row.bootstrap95.widthPercentagePoints>0);
});
test('missing running style is absent, not a zero probability',()=>{
 const x=m.analyze(fixture(3));
 // Samples may omit Nige in some observed-prior races; report retains actual
 // per-replicate style counts instead of dividing by all entrants.
 const observed=x.rows.find(r=>r.scenario==='jan2026'&&r.style==='Nige'&&
  r.fieldSize===9&&r.mode==='equal'&&r.windowId==='middle-full');
 assert(observed.racesWithStyle<=3);
 assert(observed.runnerObservations>=observed.racesWithStyle);
 // Fail-closed: any runner with unknown rank makes its cell unresolved.
 const data=fixture(3);
 const chosen=data.observations.find(o=>o.style==='Sasi'&&
  o.scenario==='balanced'&&o.mode==='equal'&&o.windowId==='final-full');
 chosen.status='ambiguous-ties';chosen.pTopHalf=null;
 const y=m.analyze(data);
 const held=y.rows.find(r=>r.fieldSize===chosen.fieldSize&&
  r.courseId===chosen.courseId&&r.style==='Sasi'&&
  r.scenario==='balanced'&&r.mode==='equal'&&r.windowId==='final-full');
 assert.equal(held.status,'held-unresolved-runners');
 assert.equal(held.topHalfPercent,null);
 assert.equal(held.bootstrap95.lowerPercent,null);
 assert.equal(held.invalidRunnerObservations,1);
});
test('wrong seed, duplicated runner, wrong style and missing data are rejected',()=>{
 const original=fixture(3);
 assert.throws(()=>m.analyze({...original,sourceRevision:'latest'}),/Expected pinned/);
 assert.throws(()=>m.analyze({...original,raceCount:10}),/Race count/);
 assert.throws(()=>m.analyze({...original,
  observations:original.observations.slice(1)}),/Incomplete runner/);
 const bad=fixture(3);
 bad.observations[0]={...bad.observations[0],seed:123};
 assert.throws(()=>m.analyze(bad),/wrongly seeded/);
 const bad2=fixture(3);
 bad2.observations[0]={...bad2.observations[1]};
 assert.throws(()=>m.analyze(bad2),/Duplicate/);
 const bad3=fixture(3);
 bad3.observations[0]={...bad3.observations[0],style:'Oonige'};
 assert.throws(()=>m.analyze(bad3),/unexpected/);
 const bad4=fixture(3);
 bad4.observations[0]={...bad4.observations[0],pTopHalf:1.2};
 assert.throws(()=>m.analyze(bad4),/Invalid runner observation probability/);
});
