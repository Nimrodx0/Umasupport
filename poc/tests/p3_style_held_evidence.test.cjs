'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {spurtWindow}=require('../tools/audit_p3_style_held_evidence.cjs');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const p=(type,value=1,operator='==')=>({type,value,operator});
const rec=(conditions,preConditions=[])=>({invokes:[{conditions,preConditions}]});
const probe=r=>spurtWindow(r,evaluate(r,'running_style'));
test('only exact P2.55 spurt windows qualify for conditional review',()=>{
 a.equal(probe(rec([[p('is_lastspurt'),p('phase_random',3)]])),true);
 a.equal(probe(rec([[p('is_lastspurt'),p('phase_firsthalf_random',3)]])),true);
 a.equal(probe(rec([[p('is_lastspurt'),p('phase_random',2)]])),false);
 a.equal(probe(rec([[p('lastspurt'),p('phase_random',3)]])),false);
 a.equal(probe(rec([[p('is_lastspurt',0),p('phase_random',3)]])),false);
 a.equal(probe(rec([[p('is_lastspurt'),p('phase_random',3),p('order_rate',50,'<=')]])),false);
 a.equal(probe(rec([[p('phase_random',3)]],[[p('is_lastspurt')]])),false);
});
test('one incompatible spurt path cannot be hidden by a matching path',()=>{
 a.equal(probe(rec([[p('is_lastspurt'),p('phase_random',3)],[p('is_lastspurt'),p('phase_random',2)]])),false);
});
