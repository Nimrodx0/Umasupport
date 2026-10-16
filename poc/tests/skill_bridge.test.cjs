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
