'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{review,evaluate}=require('../src/p3_axis_suitability_review.cjs');
const p=(type,value=1,operator='==')=>({type,value,operator});
const rec=(conditions,preConditions=[],effects=[])=>({invokes:[{conditions,preConditions,effects}]});
const state=(r,k)=>evaluate(r,k).state;
test('phase-only Aoharu-shaped conditions ignore effect magnitude and effect metadata',()=>{
 const x=rec([[p('phase_random',1)]]),y=rec([[p('phase_random',1)]],[],[{type:'speed',value:100,condition:'base_stamina'}]);
 for(const k of ['running_style','distance_type','ground_type'])a.equal(state(x,k),'full-neutral-candidate');
 a.deepEqual(review(x),review(y));
});
test('actual ability predicate affects distance review, not automatically style or surface',()=>{
 const x=rec([[p('base_stamina',1000,'>='),p('phase_random')]]);
 a.equal(state(x,'running_style'),'full-neutral-candidate');a.equal(state(x,'ground_type'),'full-neutral-candidate');a.equal(state(x,'distance_type'),'held');
});
test('explicit restriction is scope, not targeted; compare only common applicable context',()=>{
 const x=rec([[p('running_style',2),p('phase_random')]]);
 a.equal(state(x,'running_style'),'scope-only');a.equal(state(x,'distance_type'),'full-neutral-candidate');
 const y=rec([[p('running_style',2,'<='),p('phase_random')]]);
 a.equal(state(y,'running_style'),'restricted-neutral-candidate');
});
test('different OR branches, dynamic predicates and unknown history remain held',()=>{
 const x=rec([[p('running_style',2,'<='),p('phase_random')],[p('running_style',2,'>'),p('phase_random')]]);
 a.equal(state(x,'running_style'),'held');
 const y=rec([[p('phase_random')]],[[p('order_rate',50,'<=')]]);
 a.equal(state(y,'running_style'),'held');
 const z=rec([[p('phase_random')]],[[p('motivation',5)]]);
 a.equal(state(z,'running_style'),'full-neutral-candidate');
});
test('unknown in statically excluded path does not contaminate viable context',()=>{
 const x=rec([[p('distance_type',1),p('order_rate',50,'<=')],[p('distance_type',2),p('phase_random')]]);
 const s=evaluate(x,'running_style');
 a.equal(s.state,'context-dependent-candidate');
 a(s.cells.filter(c=>c.context.distance_type===2).every(c=>c.state==='full-neutral-candidate'));
 a(s.cells.filter(c=>c.context.distance_type===1).every(c=>c.state==='axis-dependent-or-unknown'));
});
test('malformed always, empty conditions, missing record fail closed',()=>{
 a.equal(state(rec([[p('always',2)]]),'running_style'),'held');
 a.equal(state(rec([[]]),'running_style'),'source-unavailable');
 a.equal(state(null,'running_style'),'source-unavailable');
});
