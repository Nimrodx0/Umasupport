'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const s=require('../tools/skill_context_margin_sensitivity.cjs');
const SCENARIOS=['balanced','frontHeavy','backHeavy','noFront'];
const sample=(dir,margin)=>dir==='missing'?{
 status:'held-absent-style',minimumCertifiedLeadPoints:null}:
 dir==='held'?{status:'held-overlap-or-context-mixed',
 minimumCertifiedLeadPoints:null}:{
 status:dir==='first'?'first-strict-all-matched-contexts':
  'second-strict-all-matched-contexts',
 minimumCertifiedLeadPoints:margin
};
function data({absent=false,reversal=false,held=false}={}){
 const conditions=[9,12].map(n=>({
  sourceNumericId:'202072',surface:'turf',distanceScope:'mile',
  timing:'phase_random:1',bandId:'top50',fieldSize:n,
  pairwise:[{first:'Nige',second:'Senkou',
   byScenario:Object.fromEntries(SCENARIOS.map((scenario,i)=>[
    scenario,sample(
     absent&&scenario==='noFront'?'missing':
     reversal&&n===12&&scenario==='backHeavy'?'second':
     held&&n===12&&scenario==='frontHeavy'?'held':'first',
     n===9?[4,0.05,9,3][i]:[2,5,7,12][i]
    )]))}]
 }));
 const result=reversal?'observed-context-direction-reversal':
  held?'held-not-all-observed-contexts-strict':
  absent?'consistent-in-observed-contexts-missing-style-scenario':
  'consistent-in-all-tested-contexts';
 const row={sourceNumericId:'202072',surface:'turf',distanceScope:'mile',
  timing:'phase_random:1',bandId:'top50',
  first:'Nige',second:'Senkou',result,
  observedDirection:reversal||held?null:'first',
  comparableScenarioHeadcounts:absent?6:8,
  missingStyleScenarioHeadcounts:absent?2:0};
 return {conditions,rows:[row]};
}
test('8-context strict agreement stores weakest source interval gap, not the average',()=>{
 const f=data(),before=JSON.stringify(f);
 const rows=s.crossContextMargins(f.conditions,f.rows);
 assert.equal(JSON.stringify(f),before);
 assert.equal(rows.length,1);
 assert.equal(rows[0].smallestIntervalCertifiedWGapPoints,0.05);
 assert.equal(rows[0].experimentalGapRequirements['0.1'],false);
 assert.equal(rows[0].experimentalGapRequirements['1'],false);
 assert.equal(rows[0].comparableCells,8);
 assert.equal(rows[0].heldOrTiedCells,0);
 const t=s.sensitivity(rows);
 assert.equal(t[0].fullEightContextComparisons,0);
 assert.equal(t[0].eligibleButBelowTrialGap,1);
 assert.equal(t[0].alreadyReversedOrHeld,0);
});
test('all measured rows can exceed 1 point while absent Nige stays missing',()=>{
 const f=data({absent:true});
 // Keep all six actually present scenarios at minimum 2 points.
 f.conditions[0].pairwise[0].byScenario.frontHeavy.minimumCertifiedLeadPoints=3;
 const rows=s.crossContextMargins(f.conditions,f.rows);
 assert.equal(rows[0].smallestIntervalCertifiedWGapPoints,2);
 assert.equal(rows[0].absentStyleCells,2);
 assert.equal(rows[0].comparableCells,6);
 const trial=s.sensitivity(rows);
 assert.equal(trial[0].fullEightContextComparisons,0);
 assert.equal(trial[0].observedOnlyComparisonsWithAbsentStyle,1);
 assert.equal(trial[1].observedOnlyComparisonsWithAbsentStyle,1);
 assert.equal(trial[2].observedOnlyComparisonsWithAbsentStyle,0);
});
test('context reversal and tied evidence cannot acquire a certified cross-context gap',()=>{
 for(const options of [{reversal:true},{held:true}]){
  const f=data(options);
  const [row]=s.crossContextMargins(f.conditions,f.rows);
  assert.equal(row.smallestIntervalCertifiedWGapPoints,null);
  assert.equal(row.experimentalGapRequirements,null);
  assert.equal(s.sensitivity([row])[0].alreadyReversedOrHeld,1);
 }
});
test('fail closed on silent margin forgery, absent-style zero, direction drift and lost headcount',()=>{
 const a=data();a.conditions[0].pairwise[0].byScenario.balanced.minimumCertifiedLeadPoints=0;
 assert.throws(()=>s.crossContextMargins(a.conditions,a.rows),/without certified gap/);
 const b=data({absent:true});b.conditions[0].pairwise[0].byScenario.noFront.minimumCertifiedLeadPoints=0;
 assert.throws(()=>s.crossContextMargins(b.conditions,b.rows),/cannot claim certified gap/);
 const c=data();c.rows[0].observedDirection='second';
 assert.throws(()=>s.crossContextMargins(c.conditions,c.rows),/direction drift/);
 const d=data();d.conditions.pop();
 assert.throws(()=>s.crossContextMargins(d.conditions,d.rows),/missing original 9\/12 pair/);
 const e=data({absent:true});
 e.rows[0].result='consistent-in-all-tested-contexts';
 assert.throws(()=>s.crossContextMargins(e.conditions,e.rows),/inconsistent strict-coverage/);
});
test('margin sensitivity is monotone and thresholds remain unadopted examples',()=>{
 const f=data();const [a]=s.crossContextMargins(f.conditions,f.rows);
 const g=data({absent:true});g.conditions.forEach(x=>{
  for(const [name,row] of Object.entries(x.pairwise[0].byScenario))
   if(name!=='noFront')row.minimumCertifiedLeadPoints=5;
 });
 const [b]=s.crossContextMargins(g.conditions,g.rows);
 const counts=s.sensitivity([a,b]);
 assert.deepEqual(counts.map(x=>x.allComparableConsistent),[1,1,1,0]);
 assert(counts.every(x=>x.candidateNotAdopted===true));
});
