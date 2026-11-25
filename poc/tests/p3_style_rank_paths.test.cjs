'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {ranks,shape,classify}=require('../tools/audit_p3_style_rank_paths.cjs');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const p=(type,value,operator='==')=>({type,value,operator});
const record=(conditions,preConditions=[])=>({invokes:[{conditions,preConditions}]});
const group=r=>classify(r,evaluate(r,'running_style')).group;
test('original percentage and absolute predicates are intersected in both fields',()=>{
 const row=[p('order_rate',50,'<='),p('order',2,'>=')];
 a.deepEqual(ranks(row,9),[2,3,4,5]);a.deepEqual(ranks(row,12),[2,3,4,5,6]);
 a.equal(shape([p('order_rate',50,'<='),p('phase_firsthalf_random',1)]).bands.includes('top50'),true);
 a.equal(shape([p('order_rate',1,'>=')]).r9,null);
});
test('distinguish exact short windows, phase occupancy, tautology and additional state',()=>{
 a.equal(group(record([[p('order_rate',50,'<='),p('phase_firsthalf_random',1)]])),'existing-short-band-window-review');
 a.equal(group(record([[p('order_rate',50,'<='),p('phase_random',1)]])),'existing-phase-rank-point-evidence-review');
 a.equal(group(record([[p('order_rate',100,'<='),p('phase_random',1)]])),'rank-all-positions-in-reference-fields');
 a.equal(group(record([[p('order_rate',50,'<='),p('is_lastspurt',1)]])),'rank-plus-other-condition');
});
test('rank history and multiple OR paths must not be pooled into one rank band',()=>{
 a.equal(group(record([[p('phase_random',1)]],[[p('order_rate',50,'<=')]])),'complex-path-or-history');
 a.equal(group(record([[p('order_rate',50,'<=')],[p('order_rate',50,'>')]])),'complex-path-or-history');
});
