const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const schema=require('../src/event_schema.js');
const model=require('../src/demo_data.js');
const reward=(skillId,condition)=>({skillId,level:1,...(condition?{condition}:{})});
const config=choices=>({stage:4,choices:choices||{}});
const validate=events=>schema.validateCatalog({schemaVersion:1,cards:[{cardId:'A',events}]},model);
const card=events=>({...model.cardById.A,hints:[],hintsByStage:undefined,events});
const chain=()=>[
 {id:'start',name:'第一話',type:'choice',choices:[
  {id:'go',label:'継続',rewards:[reward('tail')]},
  {id:'stop',label:'打ち切り',terminal:true,rewards:[reward('umazuki')]}]},
 {id:'middle',name:'第二話',type:'auto',requires:{all:[{eventId:'start',choiceId:'go'}]},rewards:[reward('last')]},
 {id:'end',name:'最終話',type:'auto',requires:{all:[{eventId:'middle'}]},
  outcomes:[{id:'success',label:'成功',rewards:[reward('kunrin')]},
    {id:'failure',label:'失敗',rewards:[reward('step')]}]}
];
test('unselected branch never unlocks a chained auto event',()=>{
 const events=chain();validate(events);
 assert.deepEqual(core.directRoutes(card(events),config()).map(r=>r.skillId),[]);
 assert.equal(core.isReachable(events[2],{},events),false);
});
test('terminal path removes later routes even with stale downstream state',()=>{
 const events=chain();
 const routes=core.directRoutes(card(events),config({start:'stop',middle:'stale'}));
 assert.deepEqual(routes.map(r=>r.skillId),['umazuki']);
 assert.equal(core.isReachable(events[2],{start:'stop'},events),false);
});
test('valid continuation reaches nested automatic stages and marks both outcome rewards conditional',()=>{
 const routes=core.directRoutes(card(chain()),config({start:'go'}));
 assert.deepEqual(routes.map(r=>r.skillId),['tail','last','kunrin','step']);
 assert.equal(routes.find(r=>r.skillId==='last').conditional,false);
 assert.ok(routes.filter(r=>['kunrin','step'].includes(r.skillId)).every(r=>r.conditional));
 assert.match(routes.find(r=>r.skillId==='kunrin').condition,/成功時/);
 assert.match(routes.find(r=>r.skillId==='step').condition,/失敗時/);
});
test('outcomes on a selected choice remain conditional',()=>{
 const events=[{id:'risk',name:'賭け',type:'choice',choices:[{id:'do',label:'挑戦',outcomes:[
   {id:'success',label:'成功',rewards:[reward('kunrin')]},
   {id:'failure',label:'失敗',rewards:[reward('step')]}]}]}];
 validate(events);
 const routes=core.directRoutes(card(events),config({risk:'do'}));
 assert.equal(routes.length,2);
 assert.ok(routes.every(r=>r.conditional));
});
test('AND prerequisites cannot be bypassed; dependent selections clear recursively',()=>{
 const events=chain();
 events.push({id:'bonus',name:'追加',type:'auto',rewards:[reward('straight')],requires:{all:[
   {eventId:'end'},{eventId:'start',choiceId:'go'}]}});
 validate(events);
 assert.equal(core.isReachable(events[3],{start:'go'},events),true);
 assert.equal(core.isReachable(events[3],{},events),false);
 assert.deepEqual(core.clearDescendants({events},{start:'go',middle:'x',end:'y',bonus:'z'},'start'),{start:'go'});
});
test('the validator fails closed on invalid IDs, cycles and dependencies',()=>{
 assert.throws(()=>schema.validateCatalog({schemaVersion:1,cards:[{cardId:'unknown',events:[]}]},model),/実カードIDが未照合/);
 assert.throws(()=>validate([{id:'a',name:'A',type:'auto',rewards:[reward('unknown')]}]),/未収録スキルID/);
 assert.throws(()=>validate([{id:'a',name:'A',type:'auto'},{id:'a',name:'B',type:'auto'}]),/重複/);
 assert.throws(()=>validate([{id:'b',name:'B',type:'auto',requires:{all:[{eventId:'ghost'}]}}]),/親イベントが未登録/);
 assert.throws(()=>validate([{id:'a',name:'A',type:'auto',requires:{all:[{eventId:'b'}]}},
   {id:'b',name:'B',type:'auto',requires:{all:[{eventId:'a'}]}}]),/循環/);
 assert.throws(()=>validate([{id:'a',name:'A',type:'choice',choices:[{id:'stop',label:'終了',terminal:true}]},
   {id:'b',name:'B',type:'auto',requires:{all:[{eventId:'a',choiceId:'stop'}]}}]),/打ち切りルート/);
 assert.throws(()=>validate([{id:'a',name:'A',type:'auto',requires:{all:[{eventId:'a',outcomeId:'success'}]}}]),/到達条件が不正/);
});
test('record counts are not claimed as completeness of actual game events',()=>{
 const r=validate(chain());
 assert.equal(r.totalModelCards,model.cards.length);
 assert.equal(r.cardsWithRecords,1);
 assert.equal(r.eventsWithRecords,3);
 assert.deepEqual(r.perCard.A,{eventCount:3,coverageStatus:'partial'});
});
test('legacy fixture maintains direct routes and conditional outcomes',()=>{
 const events=model.cardById.A.events;
 assert.equal(validate(events).eventsWithRecords,3);
 const routes=core.directRoutes(model.cardById.A,config({'a-start':'continue'}));
 assert.ok(routes.some(r=>r.skillId==='kunrin'&&r.conditional));
 assert.equal(core.isReachable(events[2],{'a-start':'stop'},events),false);
});


test('any selected nonterminal choice allows a chain to continue, but never an unselected or terminal route',()=>{
 const events=[
  {id:'begin',name:'開始',type:'choice',choices:[
   {id:'upper',label:'上'}, {id:'lower',label:'下'}, {id:'quit',label:'打ち切り',terminal:true}
  ]},
  {id:'middle',name:'中間',type:'auto',requires:{all:[{eventId:'begin'}]}},
  {id:'end',name:'終わり',type:'auto',requires:{all:[{eventId:'middle'}]},rewards:[reward('last')]}
 ];
 validate(events);
 for(const selected of ['upper','lower']){
  assert.deepEqual(core.directRoutes(card(events),config({begin:selected})).map(r=>r.skillId),['last']);
 }
 assert.deepEqual(core.directRoutes(card(events),config({})).map(r=>r.skillId),[]);
 assert.deepEqual(core.directRoutes(card(events),config({begin:'quit'})).map(r=>r.skillId),[]);
});
test('a chain cannot continue if every parent option is terminal',()=>{
 assert.throws(()=>validate([
  {id:'end',name:'終了',type:'choice',choices:[{id:'a',label:'打ち切り',terminal:true}]},
  {id:'next',name:'後続',type:'auto',requires:{all:[{eventId:'end'}]}}
 ]),/全分岐打ち切り/);
});
