'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {extraNeutral,absoluteBand}=require('../tools/audit_p3_final_held.cjs');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {allowed}=require('../tools/skill_p3_remaining_absolute_rank_observer.cjs');
const p=(type,value,operator='==')=>({type,operator,value});
const mk=(id,one,two,pre=[])=>({id,invokes:[{skillId:id,index:1,conditions:one,preConditions:pre,effects:[{type:'targetSpeed',value:2500}],duration:2.4},{skillId:id,index:2,conditions:two,preConditions:pre,effects:[{type:'targetSpeed',value:1500}],duration:2.4}]});
test('D054: only an additional amount condition does not change baseline trigger scope',()=>{
 const q=mk('204322',[[p('same_skill_horse_count',2,'>='),p('phase_random',1)]],[[p('phase_random',1)]],[[p('distance_type',2)],[p('distance_type',3)]]);
 const label=extraNeutral(q);a.equal(label.state,'general');a(label.scope.contexts.every(c=>[2,3].includes(c.distance_type)));
 q.invokes[1].effects[0].type='acceleration';a.equal(extraNeutral(q),null);
});
test('own activation history is derived from prior exact phase, not arbitrary history',()=>{
 const q=mk('203171',[[p('distance_type',3),p('phase_laterhalf_random',0)]],[[p('is_activate_other_skill_detail',1),p('phase_firsthalf_random',2)]]);
 const label=extraNeutral(q);a.equal(label.state,'general');a(label.scope.contexts.every(c=>c.distance_type===3));
 q.invokes[1].conditions[0].push(p('order_rate',50,'<='));a.equal(extraNeutral(q),null);
});
test('absolute order and order-rate are distinct for both reference field sizes',()=>{
 const q={invokes:[{conditions:[[p('distance_type',3),p('phase_random',1),p('order',3,'<=')]]}]};
 const b=absoluteBand(q,evaluate(q,'running_style'));a.equal(b.id,'absolute-top3');a.deepEqual([...allowed(b,9)],[1,2,3]);a.deepEqual([...allowed(b,12)],[1,2,3]);
 q.invokes[0].conditions[0].push(p('order_rate',50,'<='));a.equal(absoluteBand(q,evaluate(q,'running_style')),null);
});
