'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {filterApproved,select}=require('../src/phase2_gt2487_release.cjs');
const {verifyRelease}=require('../src/event_release_gate.cjs');
const review=require('../config/event-release-approvals.gt2487.v2.json');
const fixture=()=>({schemaVersion:1,cards:[
 {cardId:'30080',coverageStatus:'partial',events:[
  {id:'gt-30080-event-001',name:'架空イベント',type:'choice',choices:[
   {id:'choice-01',label:'選択肢1（仮）',rewards:[]}
  ]},
  {id:'gt-30080-event-006',name:'GameWith補正対象',type:'auto',rewards:[]},
  {id:'usl:30080:editorial:001',name:'後発の記事由来',type:'auto',rewards:[]}
 ]},
 {cardId:'30081',coverageStatus:'partial',events:[
  {id:'gt-30081-event-001',name:'別の架空イベント',type:'auto',rewards:[]}
 ]},
 {cardId:'30082',coverageStatus:'partial',events:[
  {id:'usl:30082:editorial:001',name:'追加のみ',type:'auto',rewards:[]}
 ]}
]});
const selector={eventIdPrefix:'gt-',excludedEventKeys:[
 {cardId:'30080',eventId:'gt-30080-event-006'}
]};
test('only fixed GT source cohort survives: skip 25 exception pattern and empty cards',()=>{
 const inCatalog=fixture(),before=JSON.stringify(inCatalog);
 const c=filterApproved(inCatalog,selector);
 assert.equal(c.cards.length,2);
 assert.deepEqual(c.cards.map(x=>x.events.length),[1,1]);
 assert.equal(c.cards.flatMap(x=>x.events).length,2);
 assert.equal(c.cards.some(x=>x.events.some(y=>y.id.startsWith('usl:'))),false);
 assert.equal(c.cards[0].coverageStatus,'partial');
 assert.equal(JSON.stringify(inCatalog),before);
});
test('no arbitrary exclusion is silently applied',()=>{
 const x=fixture();
 assert.throws(()=>filterApproved(x,{eventIdPrefix:'gt-',excludedEventKeys:[
  {cardId:'30081',eventId:'gt-30080-event-006'}
 ]}),/保留対象/);
 assert.throws(()=>filterApproved(x,{eventIdPrefix:'usl:',excludedEventKeys:[]}),/選択範囲/);
});
test('dangling nested choice/outcome prerequisites fail closed when one event is removed',()=>{
 const x=fixture();
 x.cards[0].events[0].choices[0].outcomes=[
  {id:'route-1',label:'結果1（仮）',requires:{
    all:[{eventId:'gt-30080-event-006'}]},rewards:[]}
 ];
 assert.throws(()=>filterApproved(x,selector),/先行条件/);
 const z=fixture();z.cards[0].events[0].requires={
  all:[{eventId:'gt-30080-event-006'}]};
 assert.throws(()=>filterApproved(z,selector),/先行条件/);
});
test('a copied v2 review cannot be abused to approve unrelated 2-event sample',()=>{
 const x=fixture();
 assert.throws(()=>verifyRelease(filterApproved(x,selector),review),/コホート数|不一致|除外対象/);
 assert.throws(()=>select({catalog:x,lineage:{}},{strict:true}),/系譜|例外/);
});
test('review states original factual description, not invented licensing',()=>{
 assert.equal(review.cohorts.length,1);
 assert.equal(review.cohorts[0].expectedEvents,2487);
 assert.deepEqual(review.cohorts[0].selector,{eventIdPrefix:'gt-'});
 assert.equal(review.cohorts[0].review.publicationBasis.kind,'original-factual-description');
 assert.equal(review.cohorts[0].review.sourceRevision,
  '6e38b54af4fad397ff4491e63007a90705a4fe67');
 assert.equal(review.entries.length,0);
});
