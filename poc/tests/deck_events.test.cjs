'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const api=require('../src/deck_events.js');
const choice=(id,name,choices,requires)=>({id,name,type:'choice',choices,...(requires?{requires}:{})});
const auto=(id,name,requires,outcomes)=>({id,name,type:'auto',...(requires?{requires}:{}),
 ...(outcomes?{outcomes}:{rewards:[{skillId:'hint:a'}]})});
const cards={
 A:{id:'A',hints:[],events:[
  choice('start','開始',[{id:'continue',label:'進む',rewards:[{skillId:'hint:a'}]},{id:'quit',label:'終了',terminal:true}]),
  auto('next','後編',{all:[{eventId:'start',choiceId:'continue'}]},[
   {id:'success',label:'成功',rewards:[{skillId:'hint:b'}]},
   {id:'failure',label:'失敗',rewards:[]}
  ])
 ]},
 B:{id:'B',hints:[],events:[choice('independent','別の選択',[{id:'ok',label:'選択'}])]},
 C:{id:'C',hints:[],events:[]}
};
const deck=(one={},two={})=>({slots:[
 {cardId:'A',stage:4,choices:one},
 {cardId:'B',stage:0,choices:two},
 {cardId:'C',stage:4,choices:{}},
 {cardId:null,stage:4,choices:{}},
 {cardId:null,stage:4,choices:{}},
 {cardId:null,stage:4,choices:{}}
]});
const data={cardById:cards};
test('unselected chain distinguishes pending, blocked, unknown and empty slots',()=>{
 const s=api.summarize(deck(),data,core);
 assert.deepEqual(s.cards[0].events.map(e=>e.status),['pending','blocked']);
 assert.equal(s.totals.pending,2);
 assert.equal(s.totals.blocked,1);
 assert.equal(s.totals.unknown,1);
 assert.equal(s.totals.empty,3);
 assert.equal(s.totals.activeEventRoutes,0);
 assert.equal(s.cards[2].known,0);
 assert.equal(s.cards[2].unknown,true);
});
test('selected valid branch reaches automatic outcome and marks conditional routes',()=>{
 const s=api.summarize(deck({start:'continue'},{independent:'ok'}),data,core);
 assert.equal(s.totals.configured,2);
 assert.equal(s.totals.automatic,1);
 assert.equal(s.totals.blocked,0);
 assert.equal(s.totals.conditionalRoutes,1);
 assert.equal(s.totals.activeEventRoutes,2);
 assert.deepEqual(s.cards[0].events.map(e=>e.status),['configured','automatic']);
});
test('terminal branch does not report unreachable automatic rewards',()=>{
 const s=api.summarize(deck({start:'quit',next:'stale'}),data,core);
 assert.equal(s.totals.blocked,1);
 assert.equal(s.totals.automatic,0);
 assert.equal(s.totals.activeEventRoutes,0);
 assert.deepEqual(s.cards[0].events.map(e=>e.status),['configured','blocked']);
});
test('slot-only clear preserves other selections, cards, stage and deck identity',()=>{
 const d=deck({start:'continue'},{independent:'ok'}),other=deck({start:'quit'});
 const before=JSON.stringify(other);
 assert.equal(api.clearSlot(d,0),1);
 assert.deepEqual(d.slots[0].choices,{});
 assert.deepEqual(d.slots[1].choices,{independent:'ok'});
 assert.equal(d.slots[0].stage,4);
 assert.equal(d.slots[0].cardId,'A');
 assert.equal(JSON.stringify(other),before);
 assert.equal(api.clearSlot(d,0),0);
});
test('all-six clear only touches event choices, never card IDs or stages',()=>{
 const d=deck({start:'continue'},{independent:'ok'});
 const before=d.slots.map(({cardId,stage})=>({cardId,stage}));
 assert.equal(api.clearDeck(d),2);
 assert.deepEqual(d.slots.map(s=>({cardId:s.cardId,stage:s.stage})),before);
 assert.ok(d.slots.every(s=>Object.keys(s.choices).length===0));
 assert.equal(api.clearDeck(d),0);
});
test('invalid clear never partially modifies state',()=>{
 const d=deck({start:'continue'},{independent:'ok'}),original=JSON.stringify(d);
 d.slots[5].choices=null;
 const broken=JSON.stringify(d);
 assert.throws(()=>api.clearDeck(d),/Invalid event deck/);
 assert.equal(JSON.stringify(d),broken);
 assert.throws(()=>api.clearSlot(d,10),/Invalid event slot/);
 assert.equal(JSON.stringify(d.slots[0].choices),JSON.stringify({start:'continue'}));
 assert.notEqual(JSON.stringify(d),original);
});
