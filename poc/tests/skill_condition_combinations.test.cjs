'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {examine}=require('../src/skill_condition_combinations.cjs');
const c=(type,operator,value)=>({type,operator,value});
const i=(conds,pre=[],index=0)=>({index,conditions:conds,preConditions:pre,effects:[]});
const s=(id,invokes)=>({id:String(id),name:'検証スキル'+id,rarity:'normal',invokes});
const k='order_rate + phase_random';
test('same AND and same invoke across OR branches remain distinct',()=>{
 const r=examine([
  s(1,[i([[c('order_rate','<=',40),c('phase_random','==',1)]])]),
  s(2,[i([[c('order_rate','<=',40)],[c('phase_random','==',1)]])]),
  s(3,[i([[c('phase_random','==',1)]],[[c('order_rate','<=',40)]])])
 ]);
 assert.equal(r.skills,3);
 assert.equal(r.focused[k].sameAnd.skills,1);
 assert.equal(r.focused[k].sameInvokeOnly.skills,2);
 assert.equal(r.focused[k].sameAnd.examples[0].id,'1');
 assert.equal(r.rankWithPhase['order_rate<=40 & phase_random==1'].skills,1);
 assert.equal(r.positionWithoutTrackedPhase,2);
 assert.equal(r.cases['rank-in-OR-alternatives'].skills,1);
 assert.equal(r.focused[k].sameAnd.examples[0].clause[0],'order_rate<=40');
});
test('multiple invokes cannot be flattened into an AND, and preserves context',()=>{
 const r=examine([s(4,[i([[c('order_rate','<=',40)]],[],0),
  i([[c('phase_random','==',1)]],[],1)])]);
 assert.equal(r.multiInvokeRank,1);
 assert.equal(r.focused[k].sameAnd.skills,0);
 assert.equal(r.focused[k].sameInvokeOnly.skills,0);
 assert.equal(r.cases['rank-in-multiple-Invoke'].skills,1);
});
test('repeated predicate across branches counts distinct skills vs occurrences',()=>{
 const r=examine([s(5,[i([
  [c('order_rate','<=',40),c('phase_random','==',1)],
  [c('order_rate','<=',40),c('phase_random','==',1)]
 ])])]);
 assert.equal(r.focused[k].sameAnd.skills,1);
 assert.equal(r.focused[k].sameAnd.occurrences,2);
 assert.equal(r.rankWithPhase['order_rate<=40 & phase_random==1'].occurrences,2);
});
test('counterexample pairing overtaking and rank only counted if in same AND',()=>{
 const r=examine([s(6,[i([[c('order_rate','>=',60),c('is_overtake','==',1)]])]),
 s(7,[i([[c('order_rate','<=',40)],[c('is_overtake','==',1)]])])]);
 const got=r.focused['is_overtake + order_rate'];
 assert.equal(got.sameAnd.skills,1);
 assert.equal(got.sameInvokeOnly.skills,1);
 assert.equal(r.cases['rank-and-overtake-in-same-AND'].skills,1);
 assert.equal(r.cases['position:>=60'].skills,1);
});
test('invalid source envelope is not interpreted as no conditions',()=>{
 assert.throws(()=>examine([{id:'9',invokes:null}]),/Invalid skill invokes/);
});
