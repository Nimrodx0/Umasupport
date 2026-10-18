const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildReviewedCatalog}=require('../src/event_review_compiler.js');
const core=require('../src/core.js');
const model={
 cards:[{id:'30242',name:'[架空]カードA'}],
 cardById:{'30242':{id:'30242',name:'[架空]カードA'}},
 skillById:{
  'hint:直線巧者':{id:'hint:直線巧者',name:'直線巧者'},
  'gold:架空':{id:'gold:架空',name:'架空の金スキル'}
 }
};
const supports=[{id:30242,name:'[架空]カードA'}];
const skill=(skillId,skillName,hintLevel=2)=>({skillId,skillName,hintLevel});
const eventsDocument={version:2,events:[
 {id:'evt_30242_1',label:'架空分岐',selection:'single',defaultChoiceId:'go',choices:[
  {id:'go',label:'続行',skills:[skill(2001,'直線巧者')]},
  {id:'stop',label:'打ち切り',skills:[]}
 ]},
 {id:'evt_30242_2',label:'架空結末',selection:'auto',
  skills:[skill(2002,'架空の金スキル')]}
]};
const config=()=>({
 supports,eventsDocument,model,review:{
  events:[
   {sourceEventId:'evt_30242_1',cardId:'30242',chainVerified:true,rewardSemanticsVerified:true,
    selectionSemanticsVerified:true,publicationReviewed:true,terminalChoiceIds:['stop']},
   {sourceEventId:'evt_30242_2',cardId:'30242',chainVerified:true,rewardSemanticsVerified:true,
    selectionSemanticsVerified:true,publicationReviewed:true,
    requires:{all:[{eventId:'evt_30242_1',choiceId:'go'}]}}
  ],
  skillMap:{'2001':'hint:直線巧者','2002':'gold:架空'}
 }
});
test('explicitly reviewed choices and dependencies compile to v1 without pre-selecting source default',()=>{
 const compiled=buildReviewedCatalog(config());
 assert.equal(compiled.coverage.cardsWithRecords,1);
 assert.equal(compiled.coverage.eventsWithRecords,2);
 const card={hints:[],events:compiled.catalog.cards[0].events};
 assert.deepEqual(core.directRoutes(card,{choices:{}}),[]);
 assert.deepEqual(core.directRoutes(card,{choices:{'evt_30242_1':'stop'}}),[]);
 assert.deepEqual(core.directRoutes(card,{choices:{'evt_30242_1':'go'}}).map(r=>r.skillId),
  ['hint:直線巧者','gold:架空']);
 assert.equal(card.events[0].choices[1].terminal,true);
});
test('no event can compile without individual chain review',()=>{
 const x=config();x.review.events[0].chainVerified=false;
 assert.throws(()=>buildReviewedCatalog(x),/未承認/);
});
test('unknown skill mapping cannot be guessed by matching names',()=>{
 const x=config();delete x.review.skillMap['2002'];
 assert.throws(()=>buildReviewedCatalog(x),/承認されていないスキルID/);
});
test('name mismatch is not silently accepted as an alias',()=>{
 const x=config();x.review.skillMap['2002']='hint:直線巧者';
 assert.throws(()=>buildReviewedCatalog(x),/スキル名が不一致/);
});
test('unreviewed or inconsistent card mapping is refused',()=>{
 const x=config();x.review.events[0].cardId='30311';
 assert.throws(()=>buildReviewedCatalog(x),/照合が失敗/);
});
test('terminal choices must exist in the external event choices',()=>{
 const x=config();x.review.events[0].terminalChoiceIds=['ghost'];
 assert.throws(()=>buildReviewedCatalog(x),/打ち切り選択肢/);
});
test('events dependent on unreviewed parents cannot be compiled',()=>{
 const x=config();x.review.events=x.review.events.slice(1);
 assert.throws(()=>buildReviewedCatalog(x),/親イベントが未登録/);
});

test('unverified success or failure reward semantics cannot be compiled as unconditional',()=>{
 const x=config();x.review.events[1].rewardSemanticsVerified=false;
 assert.throws(()=>buildReviewedCatalog(x),/未承認/);
});

test('individual reviewed choice outcome tiers compile as conditional routes without source-default rewards',()=>{
 const x=config();
 x.review.events[0].choiceOutcomeReviews={
  go:[
   {id:'success',label:'成功',skills:[skill(2001,'直線巧者',1)]},
   {id:'great',label:'大成功',skills:[skill(2001,'直線巧者',5)]}
  ],
  stop:[
   {id:'success',label:'成功',skills:[]},
   {id:'great',label:'大成功',skills:[]}
  ]
 };
 const compiled=buildReviewedCatalog(x);
 const event=compiled.catalog.cards[0].events[0];
 assert.equal(event.choices[0].rewards,undefined);
 assert.equal(event.choices[0].outcomes.length,2);
 assert.deepEqual(event.choices[0].outcomes.map(v=>v.rewards[0].level),[1,5]);
 const card={hints:[],events:compiled.catalog.cards[0].events};
 assert.deepEqual(core.directRoutes(card,{choices:{}}),[]);
 const routes=core.directRoutes(card,{choices:{'evt_30242_1':'go'}})
   .filter(v=>v.eventId==='evt_30242_1');
 assert.equal(routes.length,2);
 assert.deepEqual(routes.map(v=>v.level),[1,5]);
 assert.ok(routes.every(v=>v.conditional));
 assert.match(routes[0].condition,/成功時/);
 assert.match(routes[1].condition,/大成功時/);
 assert.deepEqual(core.directRoutes(card,{choices:{'evt_30242_1':'stop'}}),[]);
});
test('outcome review must cover exactly every source choice and at least two valid outcomes',()=>{
 const x=config();
 const tiers=[
  {id:'success',label:'成功',skills:[skill(2001,'直線巧者',1)]},
  {id:'great',label:'大成功',skills:[skill(2001,'直線巧者',5)]}
 ];
 x.review.events[0].choiceOutcomeReviews={go:tiers};
 assert.throws(()=>buildReviewedCatalog(x),/全選択肢/);
 x.review.events[0].choiceOutcomeReviews={go:tiers,stop:tiers,ghost:tiers};
 assert.throws(()=>buildReviewedCatalog(x),/全選択肢/);
 x.review.events[0].choiceOutcomeReviews={go:tiers,stop:[tiers[0]]};
 assert.throws(()=>buildReviewedCatalog(x),/2つ以上/);
 x.review.events[0].choiceOutcomeReviews={go:[tiers[0],tiers[0]],stop:tiers};
 assert.throws(()=>buildReviewedCatalog(x),/重複または不正/);
 x.review.events[0].choiceOutcomeReviews={
  go:[tiers[0],{...tiers[1],skills:[skill(9999,'未知のスキル',5)]}],stop:tiers};
 assert.throws(()=>buildReviewedCatalog(x),/承認されていないスキルID/);
});
test('publication rights and selection semantics are separately required before any event compiles',()=>{
 const x=config();
 delete x.review.events[0].publicationReviewed;
 assert.throws(()=>buildReviewedCatalog(x),/未承認/);
 x.review.events[0].publicationReviewed=true;
 delete x.review.events[0].selectionSemanticsVerified;
 assert.throws(()=>buildReviewedCatalog(x),/未承認/);
 x.review.events[0].selectionSemanticsVerified=true;
 x.review.events[1].choiceOutcomeReviews={x:[{id:'a',label:'A',skills:[]},{id:'b',label:'B',skills:[]}]};
 assert.throws(()=>buildReviewedCatalog(x),/選択肢のない候補/);
});
