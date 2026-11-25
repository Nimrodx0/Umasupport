'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {addition}=require('../src/p3_d056_approved_natural_spurt.cjs');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const p=(type,value=1,operator='==')=>({type,value,operator});
const rec=(conditions,preConditions=[])=>({invokes:[{conditions,preConditions}]});
test('approved exact natural-spurt state and supported windows are general under standard-build premise',()=>{
 for(const type of ['phase_random','phase_firsthalf_random']){
  const r=rec([[p('is_lastspurt'),p(type,3)]]);
  a.equal(evaluate(r,'running_style').state,'held');
  const q=addition(r);a.equal(q.state,'general');a.equal(q.scope.assumption,'adequate-stamina-standard-build');a.equal(q.scope.contexts.length,32);
 }
});
test('keep explicit distance/surface scope, but not another axis suitability',()=>{
 const q=addition(rec([[p('is_lastspurt'),p('phase_random',3),p('distance_type',3),p('ground_type',1)]]));
 a.equal(q.scope.contexts.length,4);a(q.scope.contexts.every(c=>c.distance_type===3&&c.ground_type===1));
});
test('rank, dynamic conditions, unsupported windows, history and distinct style paths are not promoted',()=>{
 for(const r of [
 rec([[p('is_lastspurt'),p('phase_random',3),p('order_rate',50,'<=')]]),
 rec([[p('is_lastspurt'),p('phase_random',3),p('is_overtake')]]),
 rec([[p('lastspurt'),p('phase_random',3)]]),
 rec([[p('is_lastspurt'),p('phase_random',2)]]),
 rec([[p('is_lastspurt',0),p('phase_random',3)]]),
 rec([[p('phase_random',3)]],[[p('is_lastspurt')]]),
 rec([[p('is_lastspurt'),p('phase_random',3),p('running_style',2)]]),
 rec([[p('is_lastspurt'),p('phase_random',3),p('running_style',2,'<=')],[p('is_lastspurt'),p('phase_random',3),p('running_style',2,'>')]])
 ])a.equal(addition(r),null);
});
