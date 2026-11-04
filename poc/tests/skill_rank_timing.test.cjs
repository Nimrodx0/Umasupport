'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze,timing,rankRange,PHASE_BOUNDARIES}=require('../src/skill_rank_timing.js');
const c=(type,operator,value)=>({type,operator,value});
const skill=(id,conditions,pre=[],extra=[])=>({id:String(id),name:'検証スキル'+id,
 invokes:[{index:0,conditions,preConditions:pre},...extra]});
test('gear-shift-like case gives a factual middle-race, top-half window without suggesting style',()=>{
 const x=analyze(skill(201052,[[c('distance_type','==',2),c('phase_random','==',1),
  c('order_rate','<=',50)]]));
 assert.equal(x.status,'source-structure');
 assert.equal(x.pairs.length,1);
 const p=x.pairs[0];
 assert.equal(p.status,'isolated-factual-pair');
 assert.deepEqual(p.reviewReasons,[]);
 assert.equal(p.rank.upperInclusive,50);
 assert.equal(p.rank.lowerInclusive,null);
 assert.equal(p.rank.domain,'integer-condition-thresholds-not-race-ranks');
 assert.equal(p.timing[0].kind,'random-within-phase');
 assert.deepEqual(p.timing[0].phaseIndexes,[1]);
 assert.equal(p.timing[0].randomWindow,true);
 assert.deepEqual(p.timing[0].windows[0],
  {phase:1,phaseName:'中盤',startRate:0.16666667,endRate:0.66666667});
 assert.deepEqual(p.explicitRestrictions,[c('distance_type','==',2)]);
 assert.equal(p.hasAnyExplicitStyleConstraint,false);
 assert.equal(Object.hasOwn(p,'inferredStyles'),false);
});
test('later than 50 is not silently converted to a fixed 9 or 12 horse rank',()=>{
 const x=analyze(skill(200702,[[c('distance_type','==',2),c('phase_random','==',2),
 c('order_rate','>',50)]]));
 assert.equal(x.pairs[0].status,'isolated-factual-pair');
 assert.equal(x.pairs[0].rank.lowerInclusive,51);
 assert.equal(x.pairs[0].rank.upperInclusive,null);
 assert.equal(x.pairs[0].timing[0].windows[0].phaseName,'終盤前半');
 assert.equal(x.pairs[0].timing[0].windows[0].startRate,0.66666667);
 assert.equal(x.pairs[0].timing[0].windows[0].endRate,0.83333333);
});
test('exact early and latter half of each phase are derived within phase boundaries',()=>{
 const early=timing(c('phase_firsthalf_random','==',2));
 assert.equal(early.windows[0].startRate,0.66666667);
 assert.equal(early.windows[0].endRate,0.75);
 const late=timing(c('phase_laterhalf_random','==',0));
 assert.equal(late.windows[0].startRate,0.08333333);
 assert.equal(late.windows[0].endRate,0.16666667);
 assert.deepEqual(PHASE_BOUNDARIES,[0,1/6,2/3,5/6,1]);
});
test('phase inequality is not treated as one discrete phase',()=>{
 const x=timing(c('phase','>=',2));
 assert.deepEqual(x.phaseIndexes,[2,3]);
 assert.equal(x.windows.length,2);
 assert.equal(x.randomWindow,false);
 assert.equal(timing(c('phase_random','>=',1)).status,'unresolved');
});
test('AND numerical rank-band intersection respects strict and exclusion operators',()=>{
 const r=rankRange([c('order_rate','>=',30),c('order_rate','<=',80),
 c('order_rate','!=',50)]);
 assert.deepEqual({lo:r.lowerInclusive,hi:r.upperInclusive,exclude:r.excluded,empty:r.empty},
  {lo:30,hi:80,exclude:[50],empty:false});
 assert.equal(rankRange([c('order_rate','>',50),c('order_rate','<=',50)]).empty,true);
 assert.equal(rankRange([c('order_rate','==',50),c('order_rate','!=',50)]).empty,true);
});
test('context conditions, overtaking and OR alternatives are never turned into simple pairs',()=>{
 const x=analyze(skill(202401,[
  [c('distance_type','==',1),c('phase','>=',2),c('order_rate','>=',40),
   c('is_overtake','==',1)],
  [c('distance_type','==',2),c('phase','>=',2),c('order_rate','>=',40),
   c('is_overtake','==',1)]
 ]));
 assert.equal(x.pairs.length,2);
 assert.deepEqual(x.pairs[0].reviewReasons,
 ['additional-opportunity-conditions','or-alternative-exists']);
 assert.equal(x.pairs[0].additionalConditions[0].type,'is_overtake');
 assert.equal(x.pairs[0].orIndex,0);
 assert.equal(x.pairs[1].orIndex,1);
 assert.deepEqual(x.pairs[1].sourceConditionRow[0],c('distance_type','==',2));
});
test('explicit style constraints in preConditions are visible even for ordinary rank clauses',()=>{
 const x=analyze(skill(8,[
  [c('phase_random','==',1),c('order_rate','<=',50)]],
  [[c('running_style','==',1)],[c('running_style','==',2)]]));
 assert.equal(x.pairs[0].hasAnyExplicitStyleConstraint,true);
 assert(x.pairs[0].reviewReasons.includes('preconditions-not-interpreted'));
 assert(x.pairs[0].reviewReasons.includes('explicit-running-style-restrictions'));
 assert.equal(x.pairs[0].preConditions.length,2);
});
test('two invokes remain independent, and unknown source is not general-purpose',()=>{
 const x=analyze(skill(9,[[c('order_rate','<=',50),c('phase_random','==',1)]],[],
 [{index:1,conditions:[[c('phase_random','==',2)]],preConditions:[]}]));
 assert.equal(x.pairs.length,1);
 assert(x.pairs[0].reviewReasons.includes('multiple-invokes'));
 const missing=analyze({id:'10',name:'未収録'});
 assert.equal(missing.status,'unavailable');
 assert.equal(missing.pairs.length,0);
});
