'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const x=require('../src/p2_context_logic_review.cjs');
const p=(type,operator='==',value=1)=>({type,operator,value});
const run=(conditions,preConditions=[])=>x.sourceLogic([{conditions,preConditions}]);
test('only exact always can support unconditional source-condition neutrality candidate',()=>{
 a.equal(run([[p('always')]]).disposition,'style-independent-always-only-candidate');
 a.equal(run([[p('always','==',2)]]).disposition,'hold-other-source-logic');
 a.equal(run([[p('always')]]).formalLabel,null);
});
test('fixed motivation and base ability are conditional context, not unconditional label',()=>{
 const r=run([[p('motivation'),p('base_power','>=',600)],[p('track_id')]]);
 a.equal(r.disposition,'style-independent-conditional-context-candidate');
 a.deepEqual(r.contextTypes,['base_power','motivation','track_id']);
 a.equal(r.absoluteOpportunity,null);
});
test('weather, style restriction, dynamic AND, precondition and empty alternative fail closed',()=>{
 for(const type of ['weather','running_style','order_rate','hp_per'])
  a.equal(run([[p('always'),p(type)]]).disposition,'hold-other-source-logic');
 a.equal(run([[p('always')]],[[p('motivation')]]).disposition,'hold-other-source-logic');
 a.equal(run([[]]).disposition,'hold-other-source-logic');
 a.equal(run([[p('always')],[p('order_rate')]]).disposition,'hold-other-source-logic');
});
