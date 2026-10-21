const {test}=require('node:test');
const assert=require('node:assert/strict');
const publicCatalog=require('../src/public_event_catalog.js');
function fixture(){
 const card={id:'30001',events:[],hints:['hint:架空']};
 return {cards:[card],cardById:{30001:card},
  skillById:{'hint:架空':{id:'hint:架空',name:'架空'}},
  meta:{eventStatus:'not-loaded'}};
}
test('empty reviewed catalog leaves normal hints intact',()=>{
 const model=fixture();
 const r=publicCatalog.attach(model,{schemaVersion:1,cards:[]});
 assert.equal(r.eventsWithRecords,0);
 assert.deepEqual(model.cards[0].hints,['hint:架空']);
 assert.deepEqual(model.cards[0].events,[]);
 assert.equal(model.meta.eventStatus,'reviewed-empty');
});
test('valid public event catalog is linked by game card ID',()=>{
 const model=fixture();
 const catalog={schemaVersion:1,cards:[{cardId:'30001',events:[
   {id:'approved:1',name:'架空イベント',type:'auto',rewards:[{skillId:'hint:架空',level:2}]}
 ]}]};
 const s=publicCatalog.attach(model,catalog);
 assert.equal(s.eventsWithRecords,1);
 assert.equal(model.cardById['30001'].events[0].name,'架空イベント');
 assert.equal(model.meta.eventStatus,'reviewed-partial');
 catalog.cards[0].events[0].name='変更';
 assert.notEqual(model.cardById['30001'].events[0].name,'変更');
});
test('invalid updates do not corrupt previously valid cards',()=>{
 const model=fixture();
 model.cards[0].events=[{id:'old',name:'架空旧イベント',type:'auto',rewards:[]}];
 const bad={schemaVersion:1,cards:[{cardId:'30001',events:[
  {id:'new',name:'新',type:'auto',rewards:[{skillId:'does-not-exist',level:1}]}
 ]}]};
 assert.throws(()=>publicCatalog.attach(model,bad),/未収録スキルID/);
 assert.equal(model.cardById['30001'].events[0].id,'old');
 assert.equal(model.meta.eventStatus,'not-loaded');
});
test('fetch is local, with no special cross-origin permissions or silent 404 acceptance',async()=>{
 const got=await publicCatalog.load({fetchImpl:async (url,opts)=>{
  assert.equal(url,'./data/reviewed_events.v1.json');
  assert.equal(opts.cache,'no-store');
  return {ok:true,json:async()=>({schemaVersion:1,cards:[]})};
 }});
 assert.deepEqual(got.cards,[]);
 await assert.rejects(()=>publicCatalog.load({fetchImpl:async()=>({ok:false,status:404})}),/404/);
});

test('mixed unconditional and result-dependent rewards reject atomically',()=>{
 const model=fixture();
 model.cards[0].events=[{id:'old',name:'以前の承認済み',type:'auto',rewards:[]}];
 const oldMeta=JSON.stringify(model.meta);
 const bad={schemaVersion:1,cards:[{cardId:'30001',events:[{
  id:'new',name:'不適切な混在',type:'choice',choices:[{
   id:'go',label:'進む',rewards:[{skillId:'hint:架空',level:5}],
   outcomes:[
    {id:'success',label:'成功',rewards:[{skillId:'hint:架空',level:1}]},
    {id:'great',label:'大成功',rewards:[{skillId:'hint:架空',level:5}]}
   ]
  }]
 }]}]};
 assert.throws(()=>publicCatalog.attach(model,bad),/rewardsとoutcomesは同時指定できません/);
 assert.equal(model.cards[0].events[0].id,'old');
 assert.equal(JSON.stringify(model.meta),oldMeta);
});


test('F-08: validated online event catalog is saved then restored after outage',async()=>{
 const model=fixture();
 let stored=null,writes=0;
 const store={get:async()=>stored,put:async x=>{stored=x;writes++;}};
 const payload={schemaVersion:1,cards:[{cardId:'30001',events:[
  {id:'approved:1',name:'独自の架空イベント',type:'auto',rewards:[{skillId:'hint:架空',level:1}]}
 ]}]};
 const now=()=> '2026-10-22T00:00:00.000Z';
 const online=await publicCatalog.loadVerified({model,store,now,
  fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(payload)})});
 assert.equal(online.mode,'online');assert.equal(writes,1);
 assert.equal(stored.sourceUrl,publicCatalog.URL);
 assert.equal(stored.fetchedAt,now());
 assert.deepEqual(online.catalog,payload);
 const cached=await publicCatalog.loadVerified({model,store,now,
  fetchImpl:async()=>{throw Error('network offline');}});
 assert.equal(cached.mode,'cached');
 assert.deepEqual(cached.catalog,payload);
 assert.equal(writes,1,'cache recovery must never overwrite the stored verified payload');
 assert.match(cached.reason,/offline/);
 const result=publicCatalog.attach(model,cached.catalog);
 assert.equal(result.eventsWithRecords,1);
 assert.equal(model.cardById['30001'].events[0].id,'approved:1');
});
test('F-08: malformed or semantically invalid network update never poisons last good cache',async()=>{
 const model=fixture();
 let stored=null,writes=0;
 const store={get:async()=>stored,put:async x=>{stored=x;writes++;}};
 const clean={schemaVersion:1,cards:[{cardId:'30001',events:[{
  id:'original',name:'独自架空',type:'auto',rewards:[{skillId:'hint:架空'}]
 }]}]};
 await publicCatalog.loadVerified({model,store,fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(clean)})});
 const unchanged=JSON.stringify(stored);
 for(const text of ['{ invalid json',
  JSON.stringify({schemaVersion:1,cards:[{cardId:'wrong-card',events:[]}]}),
  JSON.stringify({schemaVersion:1,cards:[{cardId:'30001',events:[{
   id:'bad',name:'無承認の不正スキル',type:'auto',rewards:[{skillId:'hint:unmapped'}]
  }]}]})]){
  const recovery=await publicCatalog.loadVerified({model,store,
   fetchImpl:async()=>({ok:true,text:async()=>text})});
  assert.equal(recovery.mode,'cached');
  assert.deepEqual(recovery.catalog,clean);
  assert.equal(JSON.stringify(stored),unchanged);
 }
 assert.equal(writes,1);
});
test('F-08: cached malformed, mismatched publisher, and missing cache fail closed',async()=>{
 const model=fixture(),valid={schemaVersion:1,cards:[]};
 for(const item of [null,
  {text:JSON.stringify(valid),sourceUrl:'https://hostile.invalid/catalog'},
  {text:'{}',sourceUrl:publicCatalog.URL},
  {text:JSON.stringify({schemaVersion:1,cards:[{cardId:'not-model',events:[]}]}),sourceUrl:publicCatalog.URL}]){
  await assert.rejects(()=>publicCatalog.loadVerified({
   model,store:{get:async()=>item,put:async()=>{}},
   fetchImpl:async()=>({ok:false,status:503})
  }),/検証済みキャッシュもありません/);
 }
});
test('F-08: online valid catalog works without private-mode IndexedDB',async()=>{
 const model=fixture();
 const got=await publicCatalog.loadVerified({model,store:{
  get:async()=>{throw Error('storage denied');},
  put:async()=>{throw Error('storage denied');}
 },fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({schemaVersion:1,cards:[]})})});
 assert.equal(got.mode,'online');
 assert.equal(got.catalog.cards.length,0);
});
