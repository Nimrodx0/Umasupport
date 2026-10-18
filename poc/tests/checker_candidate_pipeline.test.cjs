const {test}=require('node:test');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const pipeline=require('../src/checker_candidate_pipeline.cjs');
const core=require('../src/core.js');
const model={
 cards:[
  {id:'30001',name:'[架空]トレーナーA',rarity:'SSR'},
  {id:'30002',name:'[架空]トレーナーB',rarity:'SSR'},
  {id:'20001',name:'[夢]トレーナーC',rarity:'SR'}
 ],
 cardById:{
  30001:{id:'30001',name:'[架空]トレーナーA',rarity:'SSR'},
  30002:{id:'30002',name:'[架空]トレーナーB',rarity:'SSR'},
  20001:{id:'20001',name:'[夢]トレーナーC',rarity:'SR'}
 },
 skillById:{'hint:架空速度':{id:'hint:架空速度',name:'架空速度'}}
};
const makeSource=()=>({Skills:{
 SSR:{
  '［架空］トレーナーA':{Events:[
   {'架空イベント1':[{Title:'選択肢甲',Effect:'架空速度のヒントLv+1'},{Title:'選択肢乙',Effect:'イベント終了'}]},
   {'架空イベント2':[{Title:'',Effect:'成功時に架空速度のヒントLv+2'}]}
  ]},
  '［名称相違］トレーナーB':{Events:[{'架空イベント3':[{Title:'',Effect:'体力+1'}]}]}
 },
 SR:{'［夢］トレーナーC':{Events:[]}},
 R:{'［テスト］R':{Events:[]}}
}});
function makeInventory(aliases={}){
 return pipeline.inventory({source:makeSource(),model,aliases});
}
test('inventory records strict names, no R, unresolved aliases and zero-event records',()=>{
 const inv=makeInventory();
 assert.equal(inv.stats.modelCards,3);
 assert.equal(inv.stats.sourceCards,3);
 assert.equal(inv.stats.strictMatchedCards,2);
 assert.equal(inv.stats.matchedCards,2);
 assert.equal(inv.stats.eventCount,2);
 assert.equal(inv.stats.optionCount,3);
 assert.equal(inv.stats.emptyCards,1);
 assert.deepEqual(inv.unmatchedModelIds,['30002']);
 assert.equal(JSON.stringify(inv).includes('ヒントLv'),false);
 assert.equal(JSON.stringify(inv).includes('架空イベント1'),false);
 assert.match(inv.cards.find(c=>c.cardId==='30001').events[0].sourceKey,/^checker:30001:[a-f0-9]{20}$/);
 const hash='sha256:'+crypto.createHash('sha256').update('架空イベント1').digest('hex');
 assert.equal(inv.cards.find(c=>c.cardId==='30001').events[0].titleFingerprint,hash);
 assert.equal(inv.cards.find(c=>c.cardId==='30001').events[0].typographicFingerprint,hash);
 assert.equal(JSON.stringify(inv).includes('架空イベント2'),false);
});
test('typographic fingerprint strips punctuation only in separate audit field',()=>{
 const s=makeSource();
 s.Skills.SSR['［架空］トレーナーA'].Events[0]={'『架空・イベント１！』':[{Title:'架空',Effect:'1'}]};
 const a=pipeline.inventory({source:s,model});
 const one=a.cards.find(c=>c.cardId==='30001').events[0];
 const expected='sha256:'+crypto.createHash('sha256').update('架空イベント1').digest('hex');
 assert.equal(one.typographicFingerprint,expected);
 assert.notEqual(one.titleFingerprint,one.typographicFingerprint);
 assert.equal(JSON.stringify(a).includes('『架空・イベント１！』'),false);
});
test('an explicit unique alias can join one card without guessing from similar names',()=>{
 const inv=makeInventory({'30002':'［名称相違］トレーナーB'});
 assert.equal(inv.stats.matchedCards,3);
 assert.equal(inv.stats.reviewedAliases,1);
 assert.equal(inv.stats.eventCount,3);
 assert.equal(inv.stats.emptyCards,1);
 assert.deepEqual(inv.unmatchedModelIds,[]);
 assert.throws(()=>makeInventory({'30001':'［名称相違］トレーナーB'}),/エイリアス指定/);
 assert.throws(()=>makeInventory({'30002':'［夢］トレーナーC'}),/不明または重複/);
});
test('source mutation changes digest, but stable title has same candidate key',()=>{
 const s=makeSource(),a=pipeline.inventory({source:s,model});
 s.Skills.SSR['［架空］トレーナーA'].Events[0]['架空イベント1'][0].Effect='イベント終了';
 const b=pipeline.inventory({source:s,model});
 assert.equal(a.cards[1].cardId,'30001');
 assert.equal(a.cards[1].events[0].sourceKey,b.cards[1].events[0].sourceKey);
 assert.notEqual(a.cards[1].events[0].sourceDigest,b.cards[1].events[0].sourceDigest);
 assert.equal(a.cards[1].events[0].titleFingerprint,b.cards[1].events[0].titleFingerprint);
});
test('malformed rows are rejected and duplicate event titles remain distinct review candidates',()=>{
 const s=makeSource();
 s.Skills.SSR['［架空］トレーナーA'].Events[0]['架空イベント1'][0].Effect=null;
 assert.throws(()=>pipeline.inventory({source:s,model}),/選択肢が不正/);
 const q=makeSource();q.Skills.SSR['［架空］トレーナーA'].Events.push(q.Skills.SSR['［架空］トレーナーA'].Events[0]);
 const inv=pipeline.inventory({source:q,model});
 assert.equal(inv.stats.duplicateTitleRecords,2);
 const events=inv.cards.find(c=>c.cardId==='30001').events;
 assert.notEqual(events[0].sourceKey,events[2].sourceKey);
 assert.ok(events[0].duplicateTitle&&events[2].duplicateTitle);
});
function manifest(){
 const inv=makeInventory();
 const card=inv.cards.find(c=>c.cardId==='30001');
 const [a,b]=card.events;
 const base=(row,cardId,event)=>({
  sourceKey:row.sourceKey,sourceDigest:row.sourceDigest,cardId,
  chainVerified:true,rewardSemanticsVerified:true,
  selectionSemanticsVerified:true,publicationReviewed:true,
  event:{id:row.sourceKey,...event}
 });
 return {inv,a,b,review:{schemaVersion:1,events:[
  base(a,'30001',{name:'架空の選択イベント',type:'choice',choices:[
    {id:'go',label:'続ける',rewards:[{skillId:'hint:架空速度',level:1}]},
    {id:'stop',label:'やめる',terminal:true,rewards:[]}
  ]}),
  base(b,'30001',{name:'架空の結末',type:'auto',
   requires:{all:[{eventId:a.sourceKey,choiceId:'go'}]},
   outcomes:[
    {id:'success',label:'成功',rewards:[{skillId:'hint:架空速度',level:2}]},
    {id:'failure',label:'失敗',rewards:[]}
   ]})
 ]}};
}
test('reviewed facts compile to public schema and conditional routes without copying raw effects',()=>{
 const {inv,review,a}=manifest();
 const got=pipeline.publishReviewed({candidate:inv,review,model});
 assert.equal(got.summary.eventsWithRecords,2);
 assert.equal(got.catalog.cards[0].coverageStatus,'partial');
 assert.equal(JSON.stringify(got.catalog).includes('ヒントLv'),false);
 const card={events:got.catalog.cards[0].events,hints:[]};
 assert.deepEqual(core.directRoutes(card,{choices:{}}),[]);
 assert.deepEqual(core.directRoutes(card,{choices:{[a.sourceKey]:'stop'}}),[]);
 const routes=core.directRoutes(card,{choices:{[a.sourceKey]:'go'}});
 assert.equal(routes.length,2);
 assert.equal(routes[1].conditional,true);
});
test('source changes, unapproved publication and unknown skills are blocked',()=>{
 const {inv,review}=manifest();
 review.events[0].publicationReviewed=false;
 assert.throws(()=>pipeline.publishReviewed({candidate:inv,review,model}),/承認が不足/);
 review.events[0].publicationReviewed=true;
 review.events[0].sourceDigest='sha256:stale';
 assert.throws(()=>pipeline.publishReviewed({candidate:inv,review,model}),/更新済み/);
 review.events[0].sourceDigest=inv.cards.find(c=>c.cardId==='30001').events[0].sourceDigest;
 review.events[0].event.choices[0].rewards[0].skillId='unknown';
 assert.throws(()=>pipeline.publishReviewed({candidate:inv,review,model}),/未収録スキルID/);
});
test('not reviewed means an empty catalog, not a claim of completeness',()=>{
 const inv=makeInventory();
 const got=pipeline.publishReviewed({candidate:inv,review:{schemaVersion:1,events:[]},model});
 assert.deepEqual(got.catalog,{schemaVersion:1,cards:[]});
 assert.equal(got.summary.eventsWithRecords,0);
});

test('candidate with multiple recorded options cannot be flattened to guaranteed auto',()=>{
 const x=manifest();
 const item=x.review.events[0];
 item.event={id:item.sourceKey,name:'架空の自動計上',type:'auto',
             rewards:[{skillId:'hint:架空速度',level:1}]};
 assert.throws(()=>pipeline.publishReviewed({candidate:x.inv,review:x.review,model}),/選択肢件数/);
});
test('incomplete choice positions or unreviewed selection semantics are rejected',()=>{
 const x=manifest();
 x.review.events[0].event.choices=x.review.events[0].event.choices.slice(0,1);
 assert.throws(()=>pipeline.publishReviewed({candidate:x.inv,review:x.review,model}),/選択肢件数/);
 const y=manifest();
 delete y.review.events[0].selectionSemanticsVerified;
 assert.throws(()=>pipeline.publishReviewed({candidate:y.inv,review:y.review,model}),/承認が不足/);
});
test('source optionCount metadata is required to justify candidate choice coverage',()=>{
 const x=manifest();
 const c=x.inv.cards.find(c=>c.cardId==='30001');
 delete c.events[0].optionCount;
 assert.throws(()=>pipeline.publishReviewed({candidate:x.inv,review:x.review,model}),/選択肢件数が不正/);
});
test('reviewed outcomes on each selected source option stay conditional',()=>{
 const x=manifest();const e=x.review.events[0].event;
 e.choices[0]={id:'go',label:'続ける',outcomes:[
  {id:'success',label:'成功',rewards:[{skillId:'hint:架空速度',level:1}]},
  {id:'great',label:'大成功',rewards:[{skillId:'hint:架空速度',level:5}]}
 ]};
 const output=pipeline.publishReviewed({candidate:x.inv,review:x.review,model});
 const routes=core.directRoutes({hints:[],events:output.catalog.cards[0].events},
   {choices:{[x.a.sourceKey]:'go'}}).filter(z=>z.eventId===x.a.sourceKey);
 assert.deepEqual(routes.map(r=>r.level),[1,5]);
 assert.ok(routes.every(r=>r.conditional));
 assert.deepEqual(core.directRoutes({hints:[],events:output.catalog.cards[0].events},
   {choices:{}}),[]);
});
