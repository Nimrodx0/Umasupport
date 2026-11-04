'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inventory,tagsOf}=require('../src/skill_condition_inventory.cjs');
const c=(type,operator,value)=>({type,operator,value});
const x=(id,invokes=[],info=[])=>({id:String(id),name:'架空'+id,rarity:'normal',invokes,info});
const invocation=(preConditions,conditions,effects=[])=>({preConditions,conditions,effects});
test('P0 inventory preserves and counts OR groups, nested AND and condition roles',()=>{
 const records=[x(10,[invocation(
  [[c('running_style','==',1),c('phase','==',1)],[c('ground_type','!=',2)]],
  [[c('distance_type','==',3)],[c('order_rate','<=',50)]],
  [{type:'targetSpeed'}])],['説明＜先行＞＜中距離＞','追加詳細']),
 x(20,[invocation([],[]),invocation([],[[c('phase','>=',2)]])],['<芝>'])];
 const got=inventory(records);
 assert.equal(got.total,2);
 assert.equal(got.shape.invalid,0);
 assert.equal(got.shape.withPreconditions,1);
 assert.equal(got.shape.withConditions,2);
 assert.equal(got.shape.multipleInvokes,1);
 assert.equal(got.shape.invokes,3);
 assert.equal(got.counts.distinctConditionTypes,5);
 assert.equal(got.counts.byType.running_style.sides.preConditions,1);
 assert.deepEqual(got.counts.byType.order_rate.operators,{'<=':1});
 assert.equal(got.counts.byType.ground_type.category,'candidate-explicit');
 assert.equal(got.counts.byType.order_rate.category,'review-required');
 assert.equal(got.counts.tags['先行'],1);
 assert.equal(got.counts.tags['中距離'],1);
 assert.equal(got.counts.tags['芝'],1);
 assert.equal(got.counts.effects.targetSpeed,1);
 assert.equal(got.counts.matrixShapes['preConditions:2-OR-groups'],1);
});
test('bracket parsing is bounded and excludes ordinary mathematical comparisons',()=>{
 assert.deepEqual(tagsOf(['＜作戦・逃げ＞','<中距離>','速さが>30になる','＜ ＞','<=10、順位<20、距離割合>40>']),
  ['作戦・逃げ','中距離']);
 assert.deepEqual(tagsOf(null),[]);
});
test('invalid AST is reported as unknown rather than as zero-condition universal skill',()=>{
 const results=inventory([x(11,[invocation([],[])]),
 x(12,[{preConditions:[],conditions:[[c('phase','~=',1)]],effects:[]}]),
 x(13,[invocation([],[[{type:'phase',operator:'==',value:'1'}]])])]);
 assert.equal(results.shape.valid,1);
 assert.equal(results.shape.invalid,2);
 assert.equal(results.shape.withoutInvoke,0);
 assert.equal(results.counts.occurrences,0);
});
test('omitted optional condition and effect arrays inherit the UmaSim empty-list defaults',()=>{
 const r=inventory([x(4,[{conditions:[[c('distance_type','==',2)]]}]),
  x(5,[{preConditions:[[c('running_style','==',1)]]}])]);
 assert.equal(r.shape.valid,2);
 assert.equal(r.shape.invalid,0);
 assert.equal(r.counts.byType.distance_type.occurrences,1);
 assert.equal(r.counts.byType.running_style.occurrences,1);
});
test('empty invoke and empty AND group remain structurally distinguishable',()=>{
 const r=inventory([x(1,[]),x(2,[invocation([],[[]])])]);
 assert.equal(r.shape.withoutInvoke,1);
 assert.equal(r.counts.matrixShapes['conditions:1-OR-groups'],1);
 assert.equal(r.counts.matrixShapes['conditions:0-AND-terms'],1);
});
