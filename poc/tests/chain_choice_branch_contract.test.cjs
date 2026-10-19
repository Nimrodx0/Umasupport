'use strict';
/*
 * Acceptance contract: external event appearance triggers need not be modeled,
 * but inside a continuous support-card event, earlier choices MUST govern
 * available later choices and skill candidates (including termination).
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const schema=require('../src/event_schema.js');
const deckEvents=require('../src/deck_events.js');
const demo=require('../src/demo_data.js');
const reward=id=>({skillId:id,level:1});
const card=()=>({
 ...demo.cardById.A,
 hints:[],hintsByStage:undefined,
 events:[
  {id:'step1',name:'連続1',type:'choice',choices:[
   {id:'A',label:'Aルート',rewards:[reward('tail')]},
   {id:'B',label:'Bルート',rewards:[reward('umazuki')]},
   {id:'quit',label:'終了する',terminal:true,rewards:[reward('straight')]}
  ]},
  {id:'step2A',name:'A専用の連続2',type:'choice',requires:{all:[{eventId:'step1',choiceId:'A'}]},
   choices:[
    {id:'go',label:'さらに継続',rewards:[reward('last')]},
    {id:'stop',label:'ここで終了',terminal:true,rewards:[reward('step')]}
   ]},
  {id:'step2B',name:'B専用の連続2',type:'choice',requires:{all:[{eventId:'step1',choiceId:'B'}]},
   choices:[
    {id:'go',label:'Bから継続',rewards:[reward('kunrin')]},
    {id:'stop',label:'Bで終了',terminal:true}
   ]},
  {id:'step3A',name:'Aだけの連続3',type:'choice',
   requires:{all:[{eventId:'step2A',choiceId:'go'}]},
   choices:[{id:'a',label:'Aの報酬',rewards:[reward('kunrin')]}]},
  {id:'step3B',name:'Bだけの連続3',type:'choice',
   requires:{all:[{eventId:'step2B',choiceId:'go'}]},
   choices:[{id:'b',label:'Bの報酬',rewards:[reward('last')]}]}
 ]});
function routes(c,choices){return core.directRoutes(c,{stage:4,choices})
 .filter(r=>r.source==='event').map(r=>r.skillId);}
function accessible(c,choices){return c.events.filter(e=>core.isReachable(e,choices,c.events)).map(e=>e.id);}
function summary(c,choices){return deckEvents.cardSummary(c,{stage:4,choices},core);}
test('the schema accepts choice-dependent, alternative continuation and termination without external appearance triggers',()=>{
 const c=card();
 const v=schema.validateCatalog({schemaVersion:1,cards:[{cardId:'A',events:c.events}]},demo);
 assert.equal(v.eventsWithRecords,5);
 assert.ok(c.events.every(e=>e.externalTrigger===undefined));
 assert.deepEqual(accessible(c,{}),['step1']);
 assert.equal(summary(c,{}).blocked,4);
 assert.deepEqual(routes(c,{}),[]);
});
test('A route cannot offer B-only continuation, selectable options, or later skills',()=>{
 const c=card();
 const choices={step1:'A',step2A:'go',step3A:'a',step2B:'go',step3B:'b'};
 assert.deepEqual(accessible(c,choices),['step1','step2A','step3A']);
 assert.deepEqual(routes(c,choices),['tail','last','kunrin']);
 const all=summary(c,choices);
 assert.equal(all.blocked,2);
 assert.equal(all.events.find(e=>e.id==='step2B').reachable,false);
 assert.equal(all.events.find(e=>e.id==='step3B').reachable,false);
});
test('B route cannot offer A-only continuation or its skill rewards, including stale selections',()=>{
 const c=card();
 const choices={step1:'B',step2B:'go',step3B:'b',step2A:'go',step3A:'a'};
 assert.deepEqual(accessible(c,choices),['step1','step2B','step3B']);
 assert.deepEqual(routes(c,choices),['umazuki','kunrin','last']);
 const all=summary(c,choices);
 assert.equal(all.events.find(e=>e.id==='step2A').status,'blocked');
 assert.equal(all.events.find(e=>e.id==='step3A').status,'blocked');
});
test('early termination or terminal choice at an intermediate stage blocks all downstream skill rewards',()=>{
 const c=card();
 assert.deepEqual(accessible(c,{step1:'quit'}),['step1']);
 assert.deepEqual(routes(c,{step1:'quit',step2A:'go',step3A:'a',
  step2B:'go',step3B:'b'}),['straight']);
 assert.deepEqual(accessible(c,{step1:'A',step2A:'stop'}),['step1','step2A']);
 assert.deepEqual(routes(c,{step1:'A',step2A:'stop',step3A:'a'}),['tail','step']);
});
test('changing the earlier choice clears both descendants recursively before recomputing the reachable paths',()=>{
 const c=card();
 const old={step1:'A',step2A:'go',step3A:'a',step2B:'go',step3B:'b'};
 const cleared=core.clearDescendants(c,old,'step1');
 assert.deepEqual(cleared,{step1:'A'});
 const changed={...cleared,step1:'B'};
 assert.deepEqual(accessible(c,changed),['step1','step2B']);
 assert.deepEqual(routes(c,changed),['umazuki']);
 assert.equal(summary(c,changed).pending,1);
});
test('changing a middle-stage choice clears the dependent last stage while preserving sibling branches',()=>{
 const c=card();
 const old={step1:'A',step2A:'go',step3A:'a'};
 const cleared=core.clearDescendants(c,old,'step2A');
 assert.deepEqual(cleared,{step1:'A',step2A:'go'});
 const changed={...cleared,step2A:'stop'};
 assert.deepEqual(routes(c,changed),['tail','step']);
 assert.equal(core.isReachable(c.events.find(e=>e.id==='step3A'),changed,c.events),false);
});
