'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_subphase_rank_fit.cjs');
const source=require('../src/skill_rank_timing.js');
const rank=require('../tools/globalsim_rank_distribution.cjs');
function fixture(n=2){
 const plans=m.plans(n),observations=[];
 for(const p of plans)for(let runnerIndex=0;runnerIndex<p.fieldSize;runnerIndex++)
  for(const window of m.WINDOWS){
   const style=p.strategies[runnerIndex];
   const vals=Array(p.fieldSize).fill(0);
   vals[['Nige','Senkou'].includes(style)?0:p.fieldSize-1]=1;
   observations.push({courseId:p.course.id,fieldSize:p.fieldSize,
    scenario:p.scenario,mode:p.mode,rep:p.rep,seed:p.seed,
    runnerIndex,style,windowId:window.id,status:'estimate',
    rankFractions:vals});
  }
 return {plans,observations};
}
test('all subphases are source-defined windows, disjoint and partition their full phase',()=>{
 const w=m.WINDOWS;
 assert.equal(w.length,3);
 for(const item of w){
  const original=source.timing(item.sourceCondition);
  assert.equal(item.startRate,original.windows[0].startRate);
  assert.equal(item.endRate,original.windows[0].endRate);
 }
 assert.equal(w[0].sourceCondition.type,'phase_laterhalf_random');
 assert.equal(w[0].sourceCondition.value,0);
 assert.equal(w[1].phase,1);
 assert.equal(w[2].phase,1);
 assert(Math.abs(w[1].endRate-w[2].startRate)<1e-7);
 assert(Math.abs((w[1].endRate-w[1].startRate)-
  (w[2].endRate-w[2].startRate))<1e-7);
 const mid=source.timing({type:'phase_random',operator:'==',value:1});
 assert.equal(mid.windows[0].startRate,w[1].startRate);
 assert.equal(mid.windows[0].endRate,w[2].endRate);
});
test('all-recorded interpolation respects crossing at an internal subphase point',()=>{
 const f=[{t:0,horses:[{pos:0},{pos:3}]},
  {t:1,horses:[{pos:10},{pos:8}]}];
 const a=rank.histogram(f,0,60,5/60,10/60);
 assert.equal(a.status,'estimate');
 assert(Math.abs(a.rankFractions[0]-.8)<1e-9);
 assert(Math.abs(a.rankFractions[1]-.2)<1e-9);
 const first=rank.histogram(f,0,60,0,5/60);
 assert.equal(first.status,'estimate');
 assert.equal(first.rankFractions[0],0);
 assert.equal(first.rankFractions[1],1);
 const full=rank.histogram(f,0,60,0,10/60);
 assert.equal(full.status,'estimate');
 assert(Math.abs(full.rankFractions[0]-.4)<1e-9);
 assert(Math.abs(full.rankFractions[0]-
  (first.rankFractions[0]+a.rankFractions[0])/2)<1e-9);
});
test('split strata include both fixed balanced, absent Nige and sampled observed marginal scenario',()=>{
 const p=m.plans(3);
 assert.equal(p.length,6*2*3*2*3);
 assert.deepEqual([...new Set(p.map(x=>x.scenario))].sort(),
  [...m.SCENARIOS].sort());
 assert(p.filter(x=>x.scenario==='noFront').every(x=>x.counts[0]===0));
 assert(p.filter(x=>x.scenario==='balanced').every(x=>x.counts[0]>0));
 assert(p.filter(x=>x.scenario==='jan2026').length>0);
});
test('synthetic rank positioning produces complete front-bias comparisons where all styles observed',()=>{
 const {plans,observations}=fixture(2);
 const output=m.summarize(plans,observations);
 assert.equal(output.races,6*2*3*2*2);
 assert.equal(output.contextCount,6*2*3*2*3);
 assert.equal(output.observations,plans.reduce((n,p)=>n+3*p.fieldSize,0));
 assert.equal(output.byWindow.length,3);
 assert(output.byWindow.every(x=>x.contexts===72));
 assert(output.byWindow.every(x=>x.frontAhead>0));
 assert(output.comparisons.filter(c=>c.status==='comparable')
  .every(x=>x.direction==='front-ahead'));
 assert(output.comparisons.filter(c=>c.scenario==='noFront')
  .every(x=>x.styleStats.Nige.status==='absent-style'&&
   x.styleStats.Nige.topHalfFraction===null));
 assert(output.comparisons.filter(c=>c.scenario==='balanced')
  .every(x=>x.frontMinusRearPoints===100));
 assert(output.byWindow.every(x=>x.directionGate==='withheld-counterexample-or-insufficient-evidence'));
});
test('the seed-half direction test detects a reversal invisible in pooled means',()=>{
 const {plans,observations}=fixture(4);
 const modified=observations.map(x=>({...x}));
 // Flip one synthetic balanced course+size Nige runner in last half.
 for(const o of modified){
  if(o.courseId!==10501||o.fieldSize!==9||o.scenario!=='balanced'||
   o.mode!=='equal'||o.rep<2||o.style!=='Nige'||
   o.windowId!=='early-latter')continue;
  const vals=Array(o.fieldSize).fill(0);vals[o.fieldSize-1]=1;
  o.rankFractions=vals;
 }
 const out=m.summarize(plans,modified);
 const c=out.comparisons.find(x=>x.courseId===10501&&
  x.fieldSize===9&&x.scenario==='balanced'&&x.mode==='equal'&&
  x.windowId==='early-latter');
 assert(c);
 assert.equal(c.direction,'front-ahead'); // Senkou remains ahead, Nige pooled 50%.
 assert.equal(c.splitLastDirection,'tie'); // In the final half, Nige rear-occupant.
 assert.equal(out.byWindow[0].directionGate,
  'withheld-counterexample-or-insufficient-evidence');
});
test('unknown runners, duplicate, missing population and invalid histogram cannot certify a gate',()=>{
 const {plans,observations}=fixture(2);
 assert.throws(()=>m.summarize(plans,observations.slice(1)),/Partial runner-subphase/);
 const dup=observations.map(x=>({...x}));
 dup[0]={...dup[1]};
 assert.throws(()=>m.summarize(plans,dup),/Unmatched source runner/);
 const bad=observations.map(x=>({...x}));
 bad[0].rankFractions=[1,0];
 assert.throws(()=>m.summarize(plans,bad),/Invalid source rank histogram/);
 const held=observations.map(x=>({...x}));
 held[0].status='ambiguous-ties';held[0].rankFractions=null;
 const out=m.summarize(plans,held);
 assert(out.byWindow.some(x=>x.unresolved>0));
 assert(out.comparisons.some(x=>x.status==='unresolved-model-data'));
});
