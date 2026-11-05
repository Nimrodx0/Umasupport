'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_roster_only_intervention.cjs');
const expanded=require('../tools/globalsim_position_expanded.cjs');
const phases=require('../tools/globalsim_rank_distribution.cjs').PHASES;
const fakeTemplate=()=>({courseId:10504,skillData:{},
 horses:Array.from({length:9},(_,i)=>({
  speed:1000+i*3,stamina:900+i*2,power:850,guts:800,wisdom:790,
  strategy:'Senkou',gateIndex:i,skills:[1001]}))});
function fixture(seeds=2){
 const rows=m.plans(seeds),observations=[];
 for(const p of rows)for(const phase of phases){
  const ranks=Array(p.fieldSize).fill(0);
  ranks[p.pressure==='frontHeavy'?p.fieldSize-1:0]=1;
  observations.push({courseId:p.course.id,fieldSize:p.fieldSize,
   focalStyle:p.focalStyle,mode:p.mode,rep:p.rep,
   phase:phase.phase,pressure:p.pressure,seed:p.seed,
   status:'estimate',rankFractions:ranks});
 }
 return {rows,observations};
}
test('only opponent strategies vary; focal runner, gate, stats and seed are identical',()=>{
 const rows=m.plans(2),groups=new Map();
 assert.equal(rows.length,6*2*4*2*2*3);
 for(const p of rows){
  const k=[p.course.id,p.fieldSize,p.focalStyle,p.mode,p.rep].join('|');
  if(!groups.has(k))groups.set(k,[]);
  groups.get(k).push(p);
  assert.equal(p.strategies[0],p.focalStyle);
  assert.equal(p.strategies.length,p.fieldSize);
  assert.equal(p.counts.reduce((a,b)=>a+b,0),p.fieldSize);
 }
 for(const group of groups.values()){
  assert.deepEqual(group.map(x=>x.pressure),m.PRESSURES);
  assert(group.every(x=>x.seed===group[0].seed));
  const actual=group.map(p=>expanded.makeRace(fakeTemplate(),p));
  for(let i=1;i<actual.length;i++){
   assert.deepEqual(actual[i].horses[0],actual[0].horses[0]);
   assert.deepEqual(actual[i].horses.map(h=>({...h,strategy:null})),
    actual[0].horses.map(h=>({...h,strategy:null})));
  }
 }
});
test('matched inputs are held constant also across different course distances',()=>{
 const rows=m.plans(2).filter(p=>p.fieldSize===9&&p.focalStyle==='Sasi'&&
  p.mode==='jitter10'&&p.rep===1&&p.pressure==='balanced');
 assert.equal(rows.length,6);
 const races=rows.map(p=>expanded.makeRace(fakeTemplate(),p));
 assert.equal(new Set(races.map(x=>x.seed)).size,1);
 assert(races.every(r=>JSON.stringify(r.horses)===JSON.stringify(races[0].horses)));
});
test('synthetic clear opponent-pressure intervention has negative signed effect',()=>{
 const {rows,observations}=fixture(2),out=m.analyze(rows,observations,{strict:true});
 assert.equal(out.simulatedRaceCount,576);
 assert.equal(out.focalPhaseObservationCount,2304);
 assert.equal(out.contextComparisons,6*2*4*2*4*7*2);
 assert.equal(out.heldComparisons,0);
 assert(out.byPhaseCutoff.every(x=>x.contexts===6*2*4*2));
 const example=out.comparisons.find(x=>x.fieldSize===9&&
  x.focalStyle==='Nige'&&x.phase===3&&x.cutoffPercent===50&&
  x.pressure==='frontHeavy');
 assert.equal(example.pairedRaces,2);
 assert.equal(example.treatmentMinusBalancedPoints,-100);
 assert.equal(example.firstHalfPoints,-100);
 assert.equal(example.lastHalfPoints,-100);
 assert(out.comparisons.filter(x=>x.pressure==='rearHeavy')
  .every(x=>x.treatmentMinusBalancedPoints===0));
 assert(out.byPhaseCutoff.some(x=>x.phase===3&&x.cutoffPercent===50&&
  x.pressure==='frontHeavy'&&x.treatmentDecreases===96));
 assert.match(out.status,/not-game-activation/);
});
test('one unresolved treatment runner is not treated as 0% and only its pairs withheld',()=>{
 const {rows,observations}=fixture(2),changed=observations.map(x=>({...x}));
 const o=changed.find(x=>x.pressure==='rearHeavy'&&x.courseId===10501&&
  x.fieldSize===9&&x.focalStyle==='Nige'&&x.mode==='equal'&&
  x.rep===0&&x.phase===3);
 assert(o);o.status='ambiguous-ties';o.rankFractions=null;
 const out=m.analyze(rows,changed,{strict:true});
 assert.equal(out.heldComparisons,7);
 const s=out.comparisons.find(x=>x.courseId===10501&&x.fieldSize===9&&
  x.focalStyle==='Nige'&&x.mode==='equal'&&x.phase===3&&
  x.cutoffPercent===50&&x.pressure==='rearHeavy');
 assert.equal(s.pairedRaces,1);
 assert.equal(s.withheldPairs,1);
 assert.equal(s.status,'partial-or-missing');
 assert.equal(s.treatmentMinusBalancedPoints,0);
 assert(out.byPhaseCutoff.find(x=>x.phase===3&&x.cutoffPercent===50&&
  x.pressure==='rearHeavy').held>0);
});
test('duplicate, inconsistent source, and malformed fractions fail closed',()=>{
 const {rows,observations}=fixture(2);
 assert.throws(()=>m.analyze(rows,observations.slice(1)),/Incorrect focal observation/);
 const duplicate=observations.map(x=>({...x}));
 duplicate[0]={...duplicate[1]};
 assert.throws(()=>m.analyze(rows,duplicate),/duplicated or mismatched/);
 const seed=observations.map(x=>({...x}));
 seed[0].seed=9999;
 assert.throws(()=>m.analyze(rows,seed),/duplicated or mismatched/);
 const bad=observations.map(x=>({...x}));
 bad[0].rankFractions=[1,0];
 assert.throws(()=>m.analyze(rows,bad),/Invalid rank distribution/);
 const mutated=rows.map(x=>({...x}));
 mutated[0].strategies=['Sasi',...mutated[0].strategies.slice(1)];
 assert.throws(()=>m.analyze(mutated,observations),/Invalid fixed-focal plan/);
});
