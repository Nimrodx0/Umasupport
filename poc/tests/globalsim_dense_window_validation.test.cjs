'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_dense_window_validation.cjs');
const pilot=require('../tools/globalsim_position_pilot.cjs');

const frames=(a,b)=>[{t:0,horses:a.map(pos=>({pos}))},
 {t:1,horses:b.map(pos=>({pos}))}];

test('a single overtake is integrated at its exact linear crossing location',()=>{
 // Runner 0 goes 0->10, opponent goes 4->6; they tie at runner metre 5.
 // With two runners, rank 1 is the front half; 5/10 metres are front.
 const f=frames([0,4],[10,6]);
 let x=m.integrateDense(f,0,10,0,1);
 assert.equal(x.status,'estimate');
 assert(Math.abs(x.pTopHalf-.5)<1e-12);
 assert(Math.abs(x.pBackHalf-.5)<1e-12);
 assert(Math.abs(x.observedDistance-10)<1e-12);
 x=m.integrateDense(f,0,10,.2,.8);
 assert.equal(x.status,'estimate');
 assert(Math.abs(x.pTopHalf-.5)<1e-12);
});
test('more than one pass and tied instants do not become a missing broad interval',()=>{
 const f=frames([0,2,8],[12,10,2]);
 // Runner 0 overtakes #1 at one point; #2 also changes ordering.
 const x=m.integrateDense(f,0,12,0,1);
 assert.equal(x.status,'estimate');
 assert(x.pTopHalf>0&&x.pTopHalf<1);
 assert(Math.abs(x.pTopHalf+x.pBackHalf-1)<1e-12);
});
test('persistent ties and incomplete replay are excluded instead of zero',()=>{
 assert.equal(m.integrateDense(frames([0,0],[10,10]),0,10,0,1).status,
  'ambiguous-ties');
 const short=m.integrateDense(frames([0,3],[5,8]),0,10,0,1);
 assert.equal(short.status,'incomplete-replay');
 assert.equal(short.pTopHalf,null);
 assert.equal(short.expectedDistance,10);
});
test('invalid source/range and backward motion fail closed',()=>{
 const normal=frames([0,3],[10,13]);
 assert.throws(()=>m.integrateDense(normal,0,0,0,1),/Invalid dense/);
 assert.throws(()=>m.integrateDense(normal,2,10,0,1),/Invalid dense/);
 assert.throws(()=>m.integrateDense(normal,0,10,.8,.2),/Invalid dense/);
 assert.throws(()=>m.integrateDense(frames([9,3],[3,6]),0,10,0,1),
  /backwards/);
 assert.throws(()=>m.integrateDense([{t:0,horses:[{pos:0},{pos:2}]}],
  0,10,0,1),/Missing dense replay frames/);
});
test('replay validation plans are pinned subsets, not changed style labels',()=>{
 const plans=m.plansFor(3);
 assert.equal(plans.length,3*2*2*2*3);
 assert.deepEqual(new Set(plans.map(p=>p.course.id)),new Set([10501,10504,10506]));
 assert.deepEqual(new Set(plans.map(p=>p.fieldSize)),new Set([9,12]));
 assert.deepEqual(new Set(plans.map(p=>p.scenario)),new Set(['balanced','jan2026']));
 assert.deepEqual(new Set(plans.map(p=>p.mode)),new Set(['equal','jitter10']));
 assert(plans.every(p=>p.seed===require('../tools/globalsim_position_expanded.cjs')
  .seedFor(p.course.id,p.fieldSize,p.scenario,p.rep)));
 assert.throws(()=>m.plansFor(0),/1..20/);
 assert.throws(()=>m.plansFor(21),/1..20/);
});
// A compact synthetic summary tests nonmatching population veto for a
// numerical comparison without requiring the external GlobalSim executable.
test('comparison refuses to mix population sizes or unresolved frames',()=>{
 const plans=[{course:{id:10504,distance:2000},fieldSize:9,
  scenario:'balanced',mode:'equal',rep:0,seed:10,strategies:
  ['Nige','Nige','Senkou','Senkou','Sasi','Sasi','Sasi','Oikomi','Oikomi']}];
 const samples=new Map(),dense=new Map();
 for(const style of ['Nige','Senkou','Sasi','Oikomi']){
  for(const fraction of pilot.POINTS){
   const key='10504|9|balanced|equal|'+style+'|'+fraction;
   samples.set(key,{courseId:10504,courseDistance:2000,fieldSize:9,
    scenario:'balanced',mode:'equal',style,fraction,n:2,unknown:0,
    front:1,back:1,rankSum:9});
  }
  for(const window of require('../tools/globalsim_window_profile.cjs').WINDOWS){
   const k='10504|9|balanced|equal|'+style+'|'+window.id;
   dense.set(k,{courseId:10504,fieldSize:9,scenario:'balanced',
    mode:'equal',style,windowId:window.id,valid:2,unknown:0,
    sumTop:1.5,sumBack:.5,statusReasons:{}});
  }
 }
 const report=m.reportFrom(plans,samples,dense,1);
 assert.equal(report.counts.comparable,16);
 assert.equal(report.counts.withheld,0);
 assert.equal(report.absoluteErrorPercentagePoints.maximum,25);
 const key='10504|9|balanced|equal|Sasi|final-full';
 dense.get(key).unknown=1;dense.get(key).valid=1;
 const revised=m.reportFrom(plans,samples,dense,1);
 assert.equal(revised.counts.comparable,15);
 assert.equal(revised.counts.withheld,1);
 assert.equal(revised.pairs.find(p=>p.style==='Sasi'&&
  p.windowId==='final-full').differencePercentagePoints,null);
});
