const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../src/event_source_audit.js');
const model={
 cards:[{id:'30242',name:'[架空]カードA'},{id:'30311',name:'[架空]カードB'}],
 cardById:{'30242':{id:'30242',name:'[架空]カードA'},'30311':{id:'30311',name:'[架空]カードB'}},
 skillById:{'hint:直線巧者':{id:'hint:直線巧者',name:'直線巧者'}}
};
const supports=[
 {id:30242,name:'[架空]カードA',eventIds:[]},
 {id:30311,name:'[架空]カードB',eventIds:[]}
];
const skill=(id,skillName,hintLevel=2)=>({skillId:id,skillName,hintLevel});
const source={version:2,events:[
 {id:'evt_30242_123',label:'架空イベントA',selection:'auto',skills:[skill(2001,'直線巧者')]},
 {id:'evt_30311_456',label:'架空イベントB',selection:'single',defaultChoiceId:'c1',choices:[
  {id:'c1',label:'選択1',skills:[skill(2002,'架空未収録スキル')]},
  {id:'c2',label:'選択2',skills:[skill(2001,'直線巧者')]}
 ]},
 {id:'evt_special_unmatched',label:'IDのない特例',selection:'auto',skills:[skill(2003,'架空')]}
]};
test('audit joins card IDs and exact names, without converting event records into rewards',()=>{
 const r=A.audit({supports,eventsDocument:source,model});
 assert.equal(r.matchedSupports,2);
 assert.equal(r.assignedEvents,2);
 assert.equal(r.quarantinedEvents,1);
 assert.equal(r.choiceEvents,1);
 assert.equal(r.autoEvents,1);
 assert.equal(r.uniqueSourceSkills,2);
 assert.equal(r.exactHintNameCandidates,1);
 assert.equal(r.unresolvedSkills,1);
 assert.equal(r.eventChainVerified,0);
 assert.deepEqual(r.issues.map(x=>x.kind),['non-numeric-event-id']);
 assert.equal(r.perCard['30242'].sourceEventCount,1);
 assert.equal(model.cards[0].events,undefined);
});
test('never fall back to matching on a title alone',()=>{
 const r=A.audit({supports:[{id:30242,name:'[架空]カードB'}],eventsDocument:{events:[source.events[0]]},model});
 assert.equal(r.matchedSupports,0);
 assert.equal(r.assignedEvents,0);
 assert.ok(r.issues.some(x=>x.kind==='card-name-mismatch'));
 assert.ok(r.issues.some(x=>x.kind==='event-support-unmatched'));
});
test('unsupported event selection and broken source choices stay quarantined',()=>{
 const events=[
 {...source.events[0],selection:'random'},
 {...source.events[1],defaultChoiceId:'nonexistent'}
 ];
 const r=A.audit({supports,eventsDocument:{events},model});
 assert.equal(r.assignedEvents,0);
 assert.deepEqual(r.issues.map(x=>x.kind),['unsupported-selection','invalid-default-choice']);
});
test('source skill IDs with conflicting names cannot silently be unified',()=>{
 const events=[
 source.events[0],
 {...source.events[1],choices:[{id:'x',label:'違う名前',skills:[skill(2001,'別のスキル名')]}],defaultChoiceId:'x'}
 ];
 const r=A.audit({supports,eventsDocument:{events},model});
 assert.equal(r.assignedEvents,1);
 assert.equal(r.quarantinedEvents,1);
 assert.equal(r.issues[0].kind,'conflicting-skill-names');
});
test('strict input structure and duplicate support IDs are rejected',()=>{
 assert.throws(()=>A.audit({supports:{},eventsDocument:source,model}),/不正/);
 assert.throws(()=>A.audit({supports:[supports[0],supports[0]],eventsDocument:source,model}),/重複/);
});
