'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit}=require('../src/skill_change_order_source_paths.cjs');
const c=(type,operator='>=',value=1)=>({type,operator,value});
const rec=(id,invokes)=>({id:String(id),name:'skill '+id,invokes});
const inv=(conditions,preConditions=[])=>({conditions,preConditions});
test('original signed operator/value and AND co-predicates are preserved',()=>{
 const got=audit([rec(1,[inv([[c('change_order_onetime','<=',-1),
  c('phase','==',1),c('running_style','==',4)]])])]);
 assert.equal(got.summary.sourceSkills,1);
 assert.equal(got.summary.sourceAndPaths,1);
 assert.deepEqual(got.paths[0].conditions,[{operator:'<=',value:-1}]);
 assert.deepEqual(got.paths[0].sameAndOtherTypes,['phase','running_style']);
 assert.equal(got.summary.extraSameAnd,1);
 assert.equal(got.paths[0].fullSkillEvaluated,false);
});
test('precondition, OR alternatives and different Invoke are not collapsed',()=>{
 const x=rec(2,[inv([[c('change_order_onetime','>=',1)],
 [c('blocked_side_continuetime','>=',1)]],[[c('change_order_onetime','<=',-1)]]),
  inv([[c('change_order_onetime','==',0),c('phase','==',2)]])]);
 const got=audit([x]);assert.equal(got.summary.sourceSkills,1);
 assert.equal(got.summary.sourceAndPaths,3);
 assert.equal(got.summary.inPreConditions,1);
 assert.equal(got.summary.inConditions,2);
 assert.equal(got.summary.alternatives,2);
 assert.equal(got.summary.withMultipleInvokes,3);
 assert.deepEqual(got.paths.map(x=>x.invokeOffset),[0,0,1]);
});
test('nonmatching pilot predicates and unrelated rank signatures are excluded',()=>{
 const got=audit([rec(3,[inv([[c('order','==',2),c('is_overtake','==',1)]])])]);
 assert.equal(got.summary.sourceSkills,0);
 assert.equal(got.summary.sourceAndPaths,0);
});
test('unknown predicate type is not discarded from the extra-AND record',()=>{
 const got=audit([rec(4,[inv([[c('change_order_onetime','>',0),
  c('future_unresearched','==',17)]])])]);
 assert.deepEqual(got.paths[0].sameAndOtherTypes,['future_unresearched']);
});
test('invalid and duplicate source identities fail closed',()=>{
 const a=rec(4,[inv([[c('change_order_onetime','>',0)]])]);
 assert.throws(()=>audit([a,a]),/duplicate/);
 assert.throws(()=>audit([{...a,invokes:[{conditions:[null]}]}]),/Invalid source AND/);
});
