'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cohort}=require('../src/skill_rank_timing_audit.cjs');
const c=(type,operator,value)=>({type,operator,value});
const skill=(id,conditions,pre=[])=>({id:String(id),name:'合成'+id,invokes:[
 {index:0,conditions,preConditions:pre,effects:[]} ]});
test('cohort counts all branch pairs independently, not just 1 representative skill',()=>{
 const records=[
  skill(1,[[c('phase_random','==',1),c('order_rate','<=',50),c('distance_type','==',2)]]),
  skill(2,[[c('phase_random','==',1),c('order_rate','<=',50),c('is_overtake','==',1)],
   [c('phase','==',2),c('order_rate','>',50)]]),
  skill(3,[[c('running_style','==',2)]]),
  skill(4,[[c('phase_random','==',1),c('order_rate','<=',50)]],
   [[c('running_style','==',1)]])
 ];
 const r=cohort(records);
 assert.deepEqual([r.totalRecords,r.withRankTimePair,r.withoutRankTimePair],[4,3,1]);
 assert.equal(r.totalPairs,4);
 assert.equal(r.isolatedPairs,1);
 assert.equal(r.needsReviewPairs,3);
 assert.equal(r.isolatedWithoutExplicitStyle,1);
 assert.equal(r.reviewReasons['additional-opportunity-conditions'],1);
 assert.equal(r.reviewReasons['or-alternative-exists'],2);
 assert.equal(r.reviewReasons['preconditions-not-interpreted'],1);
 assert.equal(r.byTimeCode.phase_random,3);
 assert.equal(r.byTimeCode.phase,1);
 assert.equal(r.byPhase['1'],3);
 assert.equal(r.byPair['phase_random==1 | order_rate<=50'].pairs,3);
 assert.equal(r.byPair['phase_random==1 | order_rate<=50'].isolated,1);
 assert.equal(r.samples.isolatedNoExplicitStyle[0].id,'1');
});
test('cohort rejects source arrays containing missing activation structure',()=>{
 assert.throws(()=>cohort([{id:'999'}]),/expected valid/);
});
