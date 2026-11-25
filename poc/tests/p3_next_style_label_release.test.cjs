'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {sourceLogic}=require('../src/p3_next_style_label_release.cjs');
const p=(type,value,operator='==')=>({type,value,operator});
const rec=(conditions,preConditions=[])=>({invokes:[{conditions,preConditions}]});
const probe=r=>sourceLogic(r,evaluate(r,'running_style'));
test('fixed weather and distance-only phase conditions are general',()=>{
 a.equal(probe(rec([[p('weather',1)]])).label.state,'general');
 const q=probe(rec([[p('distance_type',3),p('phase_firsthalf_random',1)]]));
 a.equal(q.kind,'full-source-logic');a(q.label.scope.contexts.every(c=>c.distance_type===3));
});
test('ability predicates and dynamic conditions are not inferred from effect scaling',()=>{
 for(const row of [[p('base_stamina',1200,'>=')],[p('order_rate',50,'<='),p('phase_random',1)],[p('is_lastspurt',1)]])a.equal(probe(rec([row])),null);
});
test('restricted equivalent OR paths retain exact eligible styles',()=>{
 const q=probe(rec([[p('running_style',2),p('phase_random',1)],[p('running_style',3),p('phase_random',1)]]));
 a.equal(q.kind,'restricted-source-logic');a(q.label.scope.contexts.every(c=>JSON.stringify(c.running_styles)==='[2,3]'));
 a.equal(probe(rec([[p('running_style',2),p('phase_random',1)],[p('running_style',3),p('phase_random',2)]])),null);
 a.equal(probe(rec([[p('running_style',2),p('phase_random',1)]])),null);
});

test('restricted general label resolves only inside the explicit style scope, with no extra UI note',()=>{
 const r=rec([[p('running_style',2),p('phase_random',1)],[p('running_style',3),p('phase_random',1)]]);
 const row={label:probe(r).label};const fit=require('../src/skill_suitability.js'),cat=require('../src/skill_catalog.js');
 for(const running_style of [2,3]){a.equal(fit.resolve(row,{running_style}).state,'general');a.deepEqual(cat.evidence(row,{running_style}),{state:'general',styles:[],text:'汎用'});}
 for(const running_style of [1,4]){a.equal(fit.resolve(row,{running_style}).state,'undetermined');a.equal(cat.evidence(row,{running_style}).state,'undetermined');}
 a.equal(cat.evidence(row,{}).text,'汎用');
});

test('D057 admits only reviewed ability predicates at 1200, without discarding other gates',()=>{
 const make=(name,conditions,pre=[])=>({...rec(conditions,pre),name});
 for(const name of ['あふれる活力','気丈夫']){
  const q=probe(make(name,[[p('base_stamina',1200,'>='),p('distance_type',3)]]));
  a.equal(q.kind,'approved-standard-build-ability');a.equal(q.label.state,'general');a(q.label.scope.contexts.every(c=>c.distance_type===3));
  a.equal(probe(make(name,[[p('base_stamina',1600,'>=')]])),null);
  a.equal(probe(make(name,[[p('base_stamina',1200,'>='),p('order_rate',50,'<=')]])),null);
 }
 const play={name:'遊び心',invokes:[{conditions:[[p('base_speed',1200,'>='),p('base_wiz',1200,'>=')]],preConditions:[]},{conditions:[[p('base_speed',1200,'>='),p('base_wiz',1200,'<')]],preConditions:[]}]};
 a.equal(probe(play).kind,'approved-standard-build-ability');
 a.equal(probe({...play,name:'未承認スキル'}),null);
});
