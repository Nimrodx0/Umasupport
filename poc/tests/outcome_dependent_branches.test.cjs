'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const core=require('../src/core.js'),schema=require('../src/event_schema.js'),model=require('../src/demo_data.js');
const reward=skillId=>({skillId,level:1});
const events=[
 {id:'first',name:'連続1',type:'choice',choices:[
  {id:'upper',label:'上',outcomes:[
   {id:'success',label:'成功',rewards:[reward('tail')]},
   {id:'failure',label:'失敗',terminal:true,rewards:[reward('step')]}]},
  {id:'lower',label:'下',terminal:true,rewards:[reward('umazuki')]}]},
 {id:'second',name:'連続2',type:'choice',requires:{all:[{eventId:'first',choiceId:'upper',outcomeId:'success'}]},
  choices:[{id:'advance',label:'次へ',rewards:[reward('last')]},{id:'stop',label:'打ち切り',terminal:true}]},
 {id:'third',name:'連続3',type:'auto',requires:{all:[{eventId:'second',choiceId:'advance'}]},
  outcomes:[{id:'great',label:'大成功',rewards:[reward('kunrin')]},{id:'normal',label:'成功',rewards:[reward('straight')]}]}
];
const card={...model.cardById.A,hints:[],hintsByStage:undefined,events};
const routes=(choices,outcomes={})=>core.directRoutes(card,{stage:4,choices,outcomes}).filter(x=>x.source==='event');
const skills=(choices,outcomes={})=>routes(choices,outcomes).map(x=>x.skillId);
const status=(eid,choices,outcomes={})=>core.reachability(events.find(x=>x.id===eid),choices,events,outcomes).status;
const validate=arr=>schema.validateCatalog({schemaVersion:1,cards:[{cardId:'A',events:arr}]},model);

test('success/failure continuation is outcome-dependent, not stage-dependent',()=>{
 a.equal(validate(events).eventsWithRecords,3);
 a.equal(status('second',{first:'upper'}),'conditional');
 a.equal(status('third',{first:'upper'}),'blocked');
 a.equal(core.isReachable(events[1],{first:'upper'},events),false);
 a.equal(status('second',{first:'upper'},{first:'success'}),'reachable');
 a.equal(status('second',{first:'upper'},{first:'failure'}),'blocked');
 a.equal(status('second',{first:'lower'},{first:'success'}),'blocked');
});
test('unknown result creates only conditional potential skill routes',()=>{
 const rs=routes({first:'upper',second:'advance'});
 a.deepEqual(rs.map(x=>x.skillId),['tail','step','last','kunrin','straight']);
 a.ok(rs.every(x=>x.conditional));
 a.match(rs.find(x=>x.skillId==='last').condition,/成功時/);
});
test('failure or early quit cuts off all unreachable rewards',()=>{
 a.deepEqual(skills({first:'upper',second:'advance'},{first:'failure'}),['step']);
 a.deepEqual(skills({first:'lower',second:'advance'},{first:'success'}),['umazuki']);
 a.deepEqual(skills({first:'upper',second:'stop'},{first:'success'}),['tail']);
 a.deepEqual(skills({first:'upper',second:'advance'},{first:'success',third:'normal'}),['tail','last','straight']);
});
test('changing prior outcome clears all descendant choices/results',()=>{
 const next=core.clearDependentState(card,{first:'upper',second:'advance',third:'stale'},
  {first:'success',second:'stale',third:'great'},'first');
 a.deepEqual(next.choices,{first:'upper'});a.deepEqual(next.outcomes,{});
 a.deepEqual(skills(next.choices,{first:'failure'}),['step']);
});
test('validator rejects invalid outcomes and termination dependencies',()=>{
 const clone=()=>JSON.parse(JSON.stringify(events));
 let x=clone();x[1].requires.all[0].outcomeId='absent';
 a.throws(()=>validate(x),/親結果IDが未登録/);
 x=clone();x[1].requires.all[0].outcomeId='failure';
 a.throws(()=>validate(x),/打ち切り結果/);
 x=clone();x[0].choices[0].outcomes[1].terminal='yes';
 a.throws(()=>validate(x),/結果が不正/);
 x=clone();delete x[1].requires.all[0].choiceId;
 a.throws(()=>validate(x),/choiceIdが必要/);
});
test('automatic event can gate its successor on its own outcome',()=>{
 const xs=[{id:'roll',name:'結果',type:'auto',outcomes:[
   {id:'good',label:'成功',rewards:[]},{id:'bad',label:'失敗',terminal:true,rewards:[]}]},
   {id:'after',name:'後',type:'auto',requires:{all:[{eventId:'roll',outcomeId:'good'}]},rewards:[reward('tail')]}];
 validate(xs);const c={...card,events:xs};
 a.equal(core.reachability(xs[1],{},xs).status,'conditional');
 a.equal(core.directRoutes(c,{choices:{}})[0].conditional,true);
 a.deepEqual(core.directRoutes(c,{choices:{},outcomes:{roll:'bad'}}).map(r=>r.skillId),[]);
 a.deepEqual(core.directRoutes(c,{choices:{},outcomes:{roll:'good'}}).map(r=>r.skillId),['tail']);
});


test('same downstream event can expose different selectable options based on preceding choice',()=>{
 const xs=[
  {id:'first',name:'選択1',type:'choice',choices:[{id:'A',label:'A'},{id:'B',label:'B'}]},
  {id:'shared',name:'共有される後続',type:'choice',requires:{all:[{eventId:'first'}]},choices:[
   {id:'aOnly',label:'Aだけ',requires:{all:[{eventId:'first',choiceId:'A'}]},rewards:[reward('tail')]},
   {id:'bOnly',label:'Bだけ',requires:{all:[{eventId:'first',choiceId:'B'}]},rewards:[reward('kunrin')]}
  ]}
 ];
 validate(xs);
 const c={...card,events:xs},opt=xs[1].choices;
 a.equal(core.choiceReachability(opt[0],xs[1],{first:'A'},xs).status,'reachable');
 a.equal(core.choiceReachability(opt[1],xs[1],{first:'A'},xs).status,'blocked');
 a.equal(core.choiceReachability(opt[0],xs[1],{first:'B'},xs).status,'blocked');
 a.deepEqual(core.directRoutes(c,{choices:{first:'B',shared:'aOnly'}}).map(r=>r.skillId),[]);
 a.deepEqual(core.directRoutes(c,{choices:{first:'B',shared:'bOnly'}}).map(r=>r.skillId),['kunrin']);
 const changed=core.clearDependentState(c,{first:'A',shared:'aOnly'}, {},'first');
 a.deepEqual(changed.choices,{first:'A'});
});

test('same-event option conditional on previous result cannot be guaranteed',()=>{
 const xs=[
  {id:'roll',name:'前段',type:'auto',outcomes:[
   {id:'good',label:'成功',rewards:[]},{id:'bad',label:'失敗',rewards:[]}]},
  {id:'shared',name:'後段',type:'choice',requires:{all:[{eventId:'roll'}]},choices:[
   {id:'best',label:'成功専用',requires:{all:[{eventId:'roll',outcomeId:'good'}]},rewards:[reward('tail')]},
   {id:'ordinary',label:'共通',rewards:[reward('step')]}
  ]}
 ];
 validate(xs);
 const c={...card,events:xs};
 a.equal(core.choiceReachability(xs[1].choices[0],xs[1],{},xs).status,'conditional');
 a.equal(core.choiceReachability(xs[1].choices[0],xs[1],{},xs,{roll:'bad'}).status,'blocked');
 a.deepEqual(core.directRoutes(c,{choices:{shared:'best'}}).map(r=>[r.skillId,r.conditional]),[['tail',true]]);
 a.deepEqual(core.directRoutes(c,{choices:{shared:'best'},outcomes:{roll:'bad'}}).map(r=>r.skillId),[]);
 a.deepEqual(core.directRoutes(c,{choices:{shared:'ordinary'},outcomes:{roll:'bad'}}).map(r=>r.skillId),['step']);
});
test('choice option dependency cycles and self-reference reject entire catalog',()=>{
 const x=[
  {id:'first',name:'前',type:'choice',choices:[{id:'go',label:'go'}]},
  {id:'other',name:'次',type:'choice',choices:[
   {id:'a',label:'a',requires:{all:[{eventId:'first',choiceId:'go'}]}}]}
 ];
 validate(x);
 const invalid=JSON.parse(JSON.stringify(x));
 invalid[1].choices[0].requires.all[0].eventId='other';
 a.throws(()=>validate(invalid),/自己参照/);
 const cycle=JSON.parse(JSON.stringify(x));
 cycle[0].choices[0].requires={all:[{eventId:'other',choiceId:'a'}]};
 a.throws(()=>validate(cycle),/循環/);
});
