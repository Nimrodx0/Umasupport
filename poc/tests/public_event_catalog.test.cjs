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
