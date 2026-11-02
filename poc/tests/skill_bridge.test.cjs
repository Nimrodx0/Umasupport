const {test}=require('node:test');
const assert=require('node:assert/strict');
const bridge=require('../src/skill_bridge.js');
const publicEvents=require('../src/public_event_catalog.js');
const core=require('../src/core.js');
const skills=()=>JSON.stringify([
  {id:'100',name:' 尻尾上がり ',rarity:'normal',group:10},
  {id:'200',name:'架空の金スキル',rarity:'rare',group:20},
  {id:'300',name:'重複名',rarity:'normal',group:30},
  {id:'301',name:'重複名',rarity:'normal',group:31},
  ...Array.from({length:120},(_,i)=>({id:String(400+i),name:'無関係'+i,rarity:'normal',group:400+i}))
]);
function fixture(){
 const c={id:'30001',hints:['hint:尻尾上がり'],events:[]};
 const s={id:'hint:尻尾上がり',name:'尻尾上がり',tier:'unknown',lowerId:null};
 return {cards:[c],skills:[s],cardById:{30001:c},skillById:{[s.id]:s},meta:{}};
}
const catalog=(reward)=>({schemaVersion:1,cards:[{cardId:'30001',events:[
 {id:'e1',name:'架空イベント',type:'auto',rewards:reward}
]}]});
const ref=(id,name)=>({skillId:'skill:'+id,verifiedSkillName:name,level:1});

test('numeric event reward merges into the existing normal hint and counts one provider',()=>{
 const model=fixture();
 const result=publicEvents.attach(model,catalog([ref('100','尻尾上がり')]),{skillText:skills()});
 assert.equal(result.eventsWithRecords,1);
 assert.equal(model.cardById['30001'].events[0].rewards[0].skillId,'hint:尻尾上がり');
 assert.equal(model.skills.length,1);
 const deck={slots:[{cardId:'30001',stage:4,choices:{}}]};
 const routes=core.aggregate(deck,model)['hint:尻尾上がり'];
 assert.equal(routes.count,1);
 assert.equal(routes.providers[0].routes.length,2);
});
test('event-only rare skill is registered by numeric ID, with no inferred lower skill',()=>{
 const model=fixture();
 publicEvents.attach(model,catalog([ref('200','架空の金スキル')]),{skillText:skills()});
 const skill=model.skillById['skill:200'];
 assert.equal(skill.tier,'gold');assert.equal(skill.lowerId,null);
 assert.equal(model.cards[0].events[0].rewards[0].skillId,'skill:200');
});
test('duplicated source names are never silently merged into ordinary hints',()=>{
 const model=fixture();
 model.skillById['hint:重複名']={id:'hint:重複名',name:'重複名'};
 const prepared=bridge.prepare(model,catalog([ref('300','重複名')]),skills());
 assert.equal(prepared.catalog.cards[0].events[0].rewards[0].skillId,'skill:300');
 assert.equal(prepared.skills.length,1);
});
test('outcome rewards are independently resolved without asserting outcome probability',()=>{
 const model=fixture();
 const c={schemaVersion:1,cards:[{cardId:'30001',events:[{
   id:'e1',name:'架空イベント',type:'auto',outcomes:[
     {id:'good',label:'成功',rewards:[ref('200','架空の金スキル')]},
     {id:'bad',label:'失敗',rewards:[]}
   ]
 }]}]};
 publicEvents.attach(model,c,{skillText:skills()});
 const routes=core.directRoutes(model.cards[0],{stage:4,choices:{}});
 assert.equal(routes.find(r=>r.skillId==='skill:200').conditional,true);
});
test('failed dictionary validation and invalid catalogs are atomic',()=>{
 for(const reward of [[ref('200','名前を変えた')],[{skillId:'skill:200',level:1}],[ref('999','不明')],[ref('200','架空の金スキル'),{skillId:'missing'}]]){
  const model=fixture(),json=catalog(reward),original=JSON.stringify(json);
  assert.throws(()=>publicEvents.attach(model,json,{skillText:skills()}));
  assert.equal(JSON.stringify(json),original);
  assert.equal(model.cards[0].events.length,0);
  assert.equal(model.skills.length,1);
  assert.equal(Object.hasOwn(model.skillById,'skill:200'),false);
 }
});
test('parser rejects duplicate IDs and truncated JSON',()=>{
 assert.throws(()=>bridge.parseSource('[]'),/少なすぎ/);
 const arr=JSON.parse(skills());arr[1].id=arr[0].id;
 assert.throws(()=>bridge.parseSource(JSON.stringify(arr)),/重複/);
});
test('cache retains the last validated dictionary after an invalid update or offline fetch',async()=>{
 let record=null;const store={get:async()=>record,put:async value=>{record=value}};
 const first=await bridge.load({store,fetchImpl:async()=>({ok:true,text:async()=>skills()}),now:()=>'test'});
 assert.equal(first.mode,'online');assert.equal(record.sourceUrl,bridge.SOURCE_URL);
 const bad=await bridge.load({store,fetchImpl:async()=>({ok:true,text:async()=>'{invalid'})});
 assert.equal(bad.mode,'cached');assert.equal(record.text,skills());
 const offline=await bridge.load({store,fetchImpl:async()=>{throw Error('offline')}});
 assert.equal(offline.mode,'cached');
 await assert.rejects(bridge.load({store:{get:async()=>null},fetchImpl:async()=>{throw Error('offline')}}),/検証済みキャッシュもありません/);
});

test('historical numeric event reward survives a moving registry without guessing a live hint ID',()=>{
 const current=skills();
 const historical=JSON.stringify([
  ...JSON.parse(current),
  {id:'200801',name:'過去のイベント専用スキル',rarity:'rare',group:20080}
 ]);
 const model=fixture();
 model.skillById['hint:過去のイベント専用スキル']={
  id:'hint:過去のイベント専用スキル',name:'過去のイベント専用スキル'};
 const approved=catalog([ref('200801','過去のイベント専用スキル')]);
 assert.throws(()=>publicEvents.preflight(model,approved,{skillText:current,fullRegistry:true}),
  /未照合/);
 const summary=publicEvents.attach(model,approved,{
  skillText:current,pinnedSkillText:historical,fullRegistry:true});
 assert.equal(summary.eventsWithRecords,1);
 const eventReward=model.cardById['30001'].events[0].rewards[0];
 assert.equal(eventReward.skillId,'skill:200801',
  'Missing live ID must not merge into a same-name live hint');
 assert.equal(model.skillById['skill:200801'].sourceStatus,'umasim-pinned-event-reward');
 assert.equal(model.skillById['skill:200801'].name,'過去のイベント専用スキル');
 assert.equal(model.meta.skillHierarchy.totalRare,1,'Live hierarchy must exclude pinned-only rewards');
 const broken=catalog([ref('200801','誤った名称')]);
 assert.throws(()=>publicEvents.preflight(fixture(),broken,{
  skillText:current,pinnedSkillText:historical,fullRegistry:true}),/名称照合が失敗/);
});

test('pinned skill download validates exact immutable bytes and never trusts corrupt cache',async()=>{
 const {webcrypto,createHash}=require('node:crypto');
 const text=skills(),sha=createHash('sha256').update(text).digest('hex');
 const url='https://example.org/version-pinned/skill_data.txt';
 let record=null,calls=0;
 const store={get:async()=>record,put:async item=>{record=item}};
 const args={store,sourceUrl:url,expectedSha256:sha,subtle:webcrypto.subtle};
 const fetchImpl=async()=>{
  calls++;
  return {ok:true,text:async()=>text};
 };
 const first=await bridge.loadPinned({...args,fetchImpl,now:()=>'fixed-time'});
 assert.equal(first.mode,'online');
 assert.equal(record.sourceUrl,url);
 assert.equal(record.fetchedAt,'fixed-time');
 assert.equal((await bridge.loadPinned({...args,fetchImpl:async()=>{throw Error('unexpected network')}})).mode,'cached');
 assert.equal(calls,1);
 record={...record,text:record.text+' '};
 await assert.rejects(bridge.loadPinned({...args,fetchImpl:async()=>{throw Error('offline')}}),/offline/);
 record=null;
 await assert.rejects(bridge.loadPinned({...args,fetchImpl:async()=>({ok:true,text:async()=>text+' '})}),/SHA-256/);
 assert.equal(record,null,'Bad upstream bytes must not poison cache');
 const stateless=await bridge.loadPinned({...args,store:{get:async()=>{throw Error('denied')},put:async()=>{throw Error('denied')}},fetchImpl});
 assert.equal(stateless.mode,'online');
});

test('exact GT2487 released historical skill whitelist is complete and preserves ID/name pairs',()=>{
 const publicCatalog=require('../data/reviewed_events.v1.json');
 const expected=bridge.REVIEWED_LEGACY_SKILL_NAMES;
 assert.equal(Object.keys(expected).length,30);
 const approved=new Map();
 const scan=part=>{
  if(!part||typeof part!=='object')return;
  if(Array.isArray(part)){part.forEach(scan);return;}
  const id=typeof part.skillId==='string'&&part.skillId.startsWith('skill:')
    ?part.skillId.slice(6):null;
  if(id&&Object.hasOwn(expected,id)){
   const previous=approved.get(id);
   assert.ok(!previous||previous===part.verifiedSkillName,
    'Published historical ID has conflicting names: '+id);
   approved.set(id,part.verifiedSkillName);
  }
  for(const child of Object.values(part))if(typeof child==='object')scan(child);
 };
 for(const card of publicCatalog.cards)for(const event of card.events)scan(event);
 assert.deepEqual(Object.fromEntries([...approved].sort()),
  Object.fromEntries(Object.entries(expected).sort()));
 const model=fixture();
 model.skillById['hint:先行駆け引き']={id:'hint:先行駆け引き',name:'先行駆け引き'};
 const approvedEvent=catalog([ref('200801','先行駆け引き')]);
 assert.throws(()=>publicEvents.preflight(fixture(),approvedEvent,
  {skillText:skills(),fullRegistry:true}),/未照合/,
  'Unapproved or private previews must never inherit the released legacy exception');
 const count=publicEvents.attach(model,approvedEvent,{skillText:skills(),fullRegistry:true,allowReviewedLegacy:true});
 assert.equal(count.eventsWithRecords,1);
 assert.equal(model.cardById['30001'].events[0].rewards[0].skillId,'skill:200801');
 assert.equal(model.skillById['skill:200801'].tier,'unknown');
 assert.equal(model.skillById['skill:200801'].sourceStatus,'reviewed-legacy-master-id-only');
 assert.throws(()=>publicEvents.attach(fixture(),catalog([ref('200801','他の名前')]),
  {skillText:skills(),allowReviewedLegacy:true}),/未照合/);
 assert.throws(()=>publicEvents.attach(fixture(),catalog([ref('999999','未知のスキル')]),
  {skillText:skills()}),/未照合/);
});
