'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_paired_rank_controls.cjs');
const phases=require('../tools/globalsim_rank_distribution.cjs').PHASES;

function fixture(seedCount=2){
 const plans=m.plans(seedCount),observations=[];
 for(const p of plans)
  for(const [runnerIndex,style] of p.strategies.entries())
   for(const phase of phases){
    const ranks=Array(p.fieldSize).fill(0);ranks[runnerIndex]=1;
    observations.push({courseId:p.course.id,fieldSize:p.fieldSize,
     scenario:p.scenario,mode:p.mode,rep:p.rep,seed:p.seed,
     runnerIndex,style,phase:phase.phase,
     status:'estimate',rankFractions:ranks});
   }
 return {plans,observations};
}
test('all six courses share the identical seed, roster, gate positions and artificial stats per stratum',()=>{
 const all=m.plans(3);
 assert.equal(all.length,6*2*2*2*3);
 const groups=new Map();
 for(const p of all){
  const id=[p.fieldSize,p.scenario,p.mode,p.rep].join('|');
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(p);
  if(p.scenario==='noFront')
   assert.equal(p.counts[0],0);
 }
 for(const group of groups.values()){
  assert.equal(group.length,6);
  const [first]=group;
  assert(group.every(p=>p.seed===first.seed&&
   JSON.stringify(p.strategies)===JSON.stringify(first.strategies)));
 }
});
test('fixed matching enables fully paired identical simulations with zero course difference',()=>{
 const {plans,observations}=fixture(2);
 const x=m.compare(plans,observations,{thresholds:[50],strict:true});
 assert.equal(x.raceCount,96);
 assert.equal(x.counts.contextComparisons,6*2*2*2*4);
 assert.equal(x.counts.matchedCourseDifferences,5*2*2*4*(4+3));
 assert.equal(x.counts.held,0);
 assert.equal(x.counts.rearCounterexamples>=0,true);
 assert(x.pairedCourseContrasts.every(z=>z.pairedRaces===2&&
  z.meanAminusBPoints===0));
 assert(x.modelComparisons.every(z=>z.styleStats.Nige.percent===null||
  z.styleStats.Nige.runners>0));
});
test('the no-front scenario means no observations, never 0% for Nige',()=>{
 const {plans,observations}=fixture(2);
 const x=m.compare(plans,observations,{thresholds:[50]});
 const noFront=x.modelComparisons.filter(c=>c.scenario==='noFront');
 assert(noFront.every(c=>c.styleStats.Nige.percent===null&&
  c.styleStats.Nige.runners===0&&
  c.status==='comparable'));
 assert(x.pairedCourseContrasts.filter(x=>x.scenario==='noFront')
  .every(x=>x.style!=='Nige'));
});
test('pair-wise course differences are signed and preserve the race-level pairing',()=>{
 const {plans,observations}=fixture(2);
 for(const o of observations){
  if(o.courseId!==10304||o.style!=='Senkou')continue;
  const old=o.rankFractions.findIndex(v=>v===1);
  if(old===0)continue;
  o.rankFractions=Array(o.fieldSize).fill(0);
  o.rankFractions[0]=1;
 }
 const x=m.compare(plans,observations,{thresholds:[20]});
 const paired=x.pairedCourseContrasts.find(y=>y.comparison==='1600m-course-geometry'&&
  y.fieldSize===9&&y.scenario==='balanced'&&y.mode==='equal'&&
  y.phase===1&&y.style==='Senkou');
 assert.equal(paired.pairedRaces,2);
 assert(paired.meanAminusBPoints<0);
 assert.equal(paired.meanAminusBPoints,
  Math.round(paired.meanAminusBPoints*1e6)/1e6);
 assert.equal(paired.firstHalfPoints!==null,true);
});
test('unresolved runner, wrong seed, duplicate and truncated cohorts fail safely',()=>{
 const {plans,observations}=fixture(2);
 const changed=observations.map(x=>({...x}));
 changed[0]={...changed[0],status:'ambiguous-ties',rankFractions:null};
 const out=m.compare(plans,changed,{thresholds:[50],strict:true});
 assert(out.counts.held>0);
 assert(out.modelComparisons.some(c=>c.status==='held-incomplete'));
 assert.throws(()=>m.compare(plans,observations.slice(1)),/Incomplete observations/);
 const dup=observations.map(x=>({...x}));dup[0]={...dup[1]};
 assert.throws(()=>m.compare(plans,dup),/Duplicate runner observation/);
 const wrong=observations.map(x=>({...x}));wrong[0].seed=12345;
 assert.throws(()=>m.compare(plans,wrong),/Observation does not match/);
 const bad=observations.map(x=>({...x}));bad[0].rankFractions=[1,0];
 assert.throws(()=>m.compare(plans,bad),/Invalid rank occupation/);
});
