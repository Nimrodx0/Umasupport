'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/skill_condition_mixed_cohort.cjs');
const c=(type,value=1)=>({type,operator:'==',value});
const rec=(id,invokes)=>({id:String(id),name:'case'+id,invokes});
const inv=(conditions=[],preConditions=[])=>({conditions,preConditions});
test('same-AND rank plus deferred is a blocked whole-skill evaluation',()=>{
 const got=analyze([rec(1,[inv([[c('order_rate',50),c('distance_diff_top',2),
  c('phase_random',1)]])])]);
 assert.equal(got.mixedSkills,1);
 assert.equal(got.byRelation.sameAnd,1);
 assert.equal(got.cases[0].cohort,'same-AND-conjunction');
 assert.equal(got.cases[0].paths[0].rankAndDeferredSameAnd,true);
 assert.equal(got.cases[0].disposition,'hold-whole-skill-style-suitability');
 assert.equal(got.byDeferredType.distance_diff_top,1);
 assert(!Object.hasOwn(got.cases[0],'estimatedActivationProbability'));
});
test('distinct OR rows do not become a false intersection',()=>{
 const got=analyze([rec(2,[inv([[c('order_rate',50)],
  [c('distance_diff_top',2)]])])]);
 assert.equal(got.byRelation.sameAnd,0);
 assert.equal(got.byRelation.sameInvokeOnlyWithoutSameAnd,1);
 assert.equal(got.cases[0].sameAndRows,0);
 assert.equal(got.cases[0].classification.hasRankOnlyAnd,true);
 assert.equal(got.cases[0].classification.hasDeferredOnlyAnd,true);
});
test('preconditions and conditions keep side identity; no union of different Invoke',()=>{
 const got=analyze([
  rec(3,[inv([[c('order_rate',50)]],[[c('is_used_skill_id',99)]])]),
  rec(4,[inv([[c('order_rate',50)]]),inv([[c('distance_diff_top',10)]])])
 ]);
 assert.equal(got.mixedSkills,2);
 assert.equal(got.byRelation.sameAnd,0);
 assert.equal(got.byRelation.sameInvokeOnlyWithoutSameAnd,1);
 assert.equal(got.byRelation.differentInvokeOnly,1);
 assert.equal(got.byRelation.intersectsPreconditions,1);
 assert.deepEqual(got.cases[0].paths.map(p=>p.side),['preConditions','conditions']);
});
test('pilot-only other condition does not inflate the fixed 17-kind overlap',()=>{
 const got=analyze([
  rec(1,[inv([[c('order_rate',50),c('is_overtake',1)]])]),
  rec(2,[inv([[c('order_rate',50),c('is_lastspurt',1)]])]),
  rec(3,[inv([[c('order_rate',50),c('infront_near_lane_time',1)]])])
 ]);
 assert.equal(got.mixedSkills,1);
 assert.deepEqual(got.cases.map(x=>x.sourceNumericId),['3']);
});
test('unrecognized future codes remain deferred and duplicate source identities fail',()=>{
 const a=rec(1,[inv([[c('order_rate',50),c('future_new_code',1)]])]);
 assert.deepEqual(analyze([a]).cases[0].allDeferredTypes,['future_new_code']);
 assert.throws(()=>analyze([a,a]),/duplicate/);
});
