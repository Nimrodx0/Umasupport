'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {classify}=require('../tools/audit_p3_style_rank_paths.cjs');
const {phaseCandidate,shortCandidate,restrictedEquivalent}=require('../tools/audit_p3_practical_label_candidates.cjs');
const p=(type,value,operator='==')=>({type,value,operator});
const rec=(conditions,preConditions=[])=>({invokes:[{conditions,preConditions}]});
const review=r=>evaluate(r,'running_style');
const phase=r=>phaseCandidate(r,review(r),classify(r,review(r)));
test('exact middle-phase rank has strong direction, not a W rate or within-group equivalence',()=>{
 const q=phase(rec([[p('order_rate',50,'<='),p('phase_random',1)]]));
 a.equal(q.state,'phase-direction-candidate');a.deepEqual(q.styles,[1,2]);
 a.equal(q.marginSensitivity[10],true);a.equal(q.notWindowW,true);
 a.equal(q.withinPreferredGroupEquivalence,false);
 a.deepEqual(phase(rec([[p('order_rate',40,'>='),p('phase_random',1)]])).styles,[3,4]);
});
test('narrow middle band, late phase, dirt, restricted styles and extra history are not promoted',()=>{
 a.equal(phase(rec([[p('order_rate',40,'>='),p('order_rate',80,'<='),p('phase_random',1)]])).state,'held-direction-mixed');
 a.equal(phase(rec([[p('order_rate',50,'<='),p('phase_random',3)]])).state,'held-direction-mixed');
 a.equal(phase(rec([[p('order_rate',50,'<='),p('phase_random',1),p('ground_type',2)]])).state,'held-no-four-style-measured-context');
 a.equal(phase(rec([[p('order_rate',50,'<='),p('phase_random',1),p('running_style',2,'>=')]])).state,'held-no-four-style-measured-context');
 a.equal(phase(rec([[p('order_rate',50,'<='),p('phase_random',1)]],[[p('weather',1)]])).state,'held-source-path');
});
test('identical residual logic in style-exclusive OR is neutral only inside its explicit scope',()=>{
 const r=rec([[p('running_style',2),p('phase_random',1)],[p('running_style',3),p('phase_random',1)]]);
 const q=restrictedEquivalent(r,review(r));a.equal(q.state,'restricted-same-logic-candidate');
 a(q.contexts.every(c=>JSON.stringify(c.styles)==='[2,3]'));
 const diff=rec([[p('running_style',2),p('phase_random',1)],[p('running_style',3),p('phase_random',2)]]);
 a.equal(restrictedEquivalent(diff,review(diff)),null);
 const h=rec([[p('phase_random',1)]],[[p('running_style',2)],[p('running_style',3)]]);
 a.equal(restrictedEquivalent(h,review(h)).state,'restricted-same-logic-candidate');
});
test('short window reuse refuses missing donor and does not borrow whole-phase metrics',()=>{
 const r=rec([[p('order_rate',50,'<='),p('phase_laterhalf_random',1)]]);
 a.equal(shortCandidate(r,review(r),classify(r,review(r)),{items:[]}).state,'held-no-exact-short-window-donor');
});
