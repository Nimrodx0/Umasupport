'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_rank_distribution.cjs');
const source=require('../tools/rank_source_distribution.cjs');
const expanded=require('../tools/globalsim_position_expanded.cjs');
function frame(t,positions){
 return {t,horses:positions.map(p=>({pos:p}))};
}
const cond=(type,operator,value)=>({type,operator,value});
function sample(r){
 const rows=[r],obs=[];
 for(const [runnerIndex,style] of r.strategies.entries())
  for(const phase of m.PHASES){
   const histogram=Array(r.fieldSize).fill(0);
   histogram[runnerIndex]=1;
   obs.push({courseId:r.course.id,fieldSize:r.fieldSize,
    scenario:r.scenario,mode:r.mode,rep:r.rep,runnerIndex,
    style,seed:r.seed,phase:phase.phase,status:'estimate',rankFractions:histogram});
  }
 return {rows,obs};
}
test('rank-distance integration splits exact linear overtake and partitions rank 1..n',()=>{
 const f=[frame(0,[0,10]),frame(1,[10,0])];
 const a=m.histogram(f,0,10,0,1);
 assert.equal(a.status,'estimate');
 assert.deepEqual(a.rankFractions,[0.5,0.5]);
 assert.equal(a.observedDistance,10);
 assert.throws(()=>m.histogram(f,1,10,0,1),/position goes backwards/);
});
test('the 50% total matches the existing frame-interpolated rank-band implementation',()=>{
 const old=require('../tools/globalsim_dense_window_validation.cjs');
 const f=[frame(0,[0,4,12]),frame(1,[10,9,22])];
 const h=m.histogram(f,0,10,0,1);
 const matched=h.rankFractions.slice(0,2).reduce((a,b)=>a+b,0);
 const original=old.integrateDense(f,0,10,0,1);
 assert.equal(h.status,'estimate');
 assert.equal(original.status,'estimate');
 assert(Math.abs(matched-original.pTopHalf)<1e-10);
 assert(Math.abs(matched-0.2)<1e-10);
});

test('persistently tied, missing replay and malformed rank inputs are withheld',()=>{
 const tied=m.histogram([frame(0,[0,0]),frame(1,[10,10])],0,10,0,1);
 assert.equal(tied.status,'ambiguous-ties');
 assert.equal(tied.rankFractions,null);
 const bad=m.histogram([frame(0,[0,3]),frame(1,[5,3])],0,10,0,1);
 assert.equal(bad.status,'incomplete-replay');
 assert.throws(()=>m.histogram([frame(0,[0,3]),frame(1,[5,3])],
 0,10,.9,.1),/Invalid rank/);
});
test('all four source-defined phase boundaries cover the complete race without overlap',()=>{
 assert.equal(m.PHASES.length,4);
 assert.equal(m.PHASES[0].startRate,0);
 assert.equal(m.PHASES[3].endRate,1);
 for(let i=1;i<4;i++)
  assert(Math.abs(m.PHASES[i-1].endRate-m.PHASES[i].startRate)<1e-7);
});
test('source code frequency preserves multiple operators and de-duplicates skill counts',()=>{
 const input=[
  {id:'1',invokes:[{conditions:[[cond('order_rate','<=',40),
   cond('phase_random','==',1)]],preConditions:[[cond('order_rate','<=',40)]]}]},
  {id:'2',invokes:[{conditions:[[cond('order_rate','>=',40),
   cond('phase_random','==',2)],[cond('order_rate','<=',50)]]}]}
 ];
 const r=source.audit(input);
 assert.equal(r.skillsWithRank,2);
 assert.equal(r.rankTerms,4);
 assert.equal(r.byValue.find(x=>x.code==='40').uniqueSkills,2);
 assert.equal(r.byOperatorValue.find(x=>x.code==='<=40').uniqueSkills,1);
 assert.equal(r.rankBranchesWithTiming.phase_random,2);
 assert.throws(()=>source.audit([input[0],input[0]]),/duplicate skill/);
});
test('model observations are counted per runner, not as independent race draws',()=>{
 const plan=m.plans(1)[0];
 const {rows,obs}=sample(plan);
 const out=m.analyze(rows,obs,[40,50]);
 assert.equal(out.raceCount,1);
 assert.equal(out.observationCount,plan.fieldSize*4);
 assert.equal(out.comparisonCells,4*2);
 assert.equal(out.totalStylePhaseCells,16);
 assert.equal(out.byPhaseCutoff.length,8);
 assert(out.samples.filter(s=>s.status==='estimate').length===16);
 assert(out.samples.every(s=>s.runners>0));
 assert.equal(out.phaseDefinitions[0].phaseName,'序盤');
 const broken=obs.map(o=>({...o}));
 broken[0]={...broken[0],status:'ambiguous-ties',rankFractions:null};
 const held=m.analyze(rows,broken,[50]);
 assert.equal(held.heldStylePhaseCells,1);
 assert(held.samples.some(s=>s.status==='held-unresolved-runners'));
 assert(held.byPhaseCutoff.some(s=>s.unresolved>0));
});
test('when no front runner starts, Nige is absent rather than a zero estimate',()=>{
 const plan=m.plans(1).find(x=>x.scenario==='noFront');
 assert(plan);
 const {rows,obs}=sample(plan);
 const out=m.analyze(rows,obs,[50]);
 assert(out.samples.filter(s=>s.style==='Nige')
  .every(s=>s.status==='no-style-runner-observations'));
 assert.equal(out.emptyStylePhaseCells,4);
 assert.equal(out.byPhaseCutoff[0].contexts,1);
});
test('runner histogram rejects population duplication, missing entries and wrong seed',()=>{
 const {rows,obs}=sample(m.plans(1)[0]);
 assert.throws(()=>m.analyze(rows,obs.slice(1)),/Unexpected observation population/);
 const dup=[...obs];dup[0]=dup[1];
 assert.throws(()=>m.analyze(rows,dup),/Repeated or unmatched/);
 const wrong=obs.map(x=>({...x}));wrong[0].seed=0;
 assert.throws(()=>m.analyze(rows,wrong),/Repeated or unmatched/);
 const invalid=obs.map(x=>({...x}));invalid[0].rankFractions=[1,0];
 assert.throws(()=>m.analyze(rows,invalid),/Invalid per-runner/);
});
test('thresholds are chosen from the pinned skill inventory, with 50 percent control',()=>{
 const x={status:'fixed-UmaSim-original-order-rate-condition-frequency',
  byValue:[{code:'20'},{code:'70'},{code:'40'},{code:'99'}]};
 assert.deepEqual(m.thresholdsFromSource(x),[20,40,50,70,99]);
 assert.throws(()=>m.thresholdsFromSource({}),/Unverified source/);
});
