'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{review}=require('../src/p2_omission_candidate_review.cjs');
const g=new Set(['always','straight_random']),c=new Set(['random_lot']);
const p=(type,value=1,operator='==')=>({type,value,operator});
const run=(conditions,preConditions=[])=>review([{conditions,preConditions}],g,c);
test('geometry alone is a candidate, not approved or an unconditional rate',()=>{
 const x=run([[p('straight_random'),p('running_style')]]);
 a.equal(x.status,'geometry-and-static-only-logic-candidate');
 a.equal(x.explicitStyleRestrictionPresent,true);a.equal(x.formalLabel,null);a.equal(x.actualOmissions,0);
});
test('different OR or Invoke cannot erase dynamic conditions',()=>{
 a.equal(run([[p('straight_random')],[p('order_rate')]]).status,'retain-mixed-condition-research');
 a.equal(review([{conditions:[[p('straight_random')]]},{conditions:[[p('hp_per')]]}],g,c).status,'retain-mixed-condition-research');
 a.equal(run([[p('straight_random')]],[[p('always')]]).status,'hold-history-or-empty-alternative');
 a.equal(run([[p('straight_random')],[]]).status,'hold-history-or-empty-alternative');
});
test('scope exclusions and unsupported always values do not prove source truth',()=>{
 a.equal(run([[p('straight_random'),p('weather')]]).status,'context-policy-dependent-logic-candidate');
 a.equal(run([[p('random_lot')]]).status,'context-policy-dependent-logic-candidate');
 a.equal(run([[p('always',2)]]).status,'retain-mixed-condition-research');
});
