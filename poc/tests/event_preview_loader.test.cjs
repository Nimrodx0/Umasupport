const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const preview=require('../src/event_preview_loader.js');
const compiler=require('../src/efforia30311_review_preview.cjs');
const DATA=path.join(__dirname,'../data/preview/efforia30311.v1.json');
const JSON_CATALOG=JSON.parse(fs.readFileSync(DATA,'utf8'));
const skillRows=Object.entries(compiler.SKILLS);
function registry(){
 return JSON.stringify([
  ...skillRows.map(([id,name],i)=>({id,name,rarity:'normal',group:40000+i})),
  ...Array.from({length:110},(_,i)=>({id:String(700000+i),name:'架空'+i,rarity:'normal',group:70000+i}))
 ]);
}
function model(){
 const card={id:'30311',events:[],hints:['hint:架空']};
 const hint={id:'hint:架空',name:'架空',tier:'white'};
 return {cards:[card],cardById:{30311:card},skills:[hint],skillById:{[hint.id]:hint},
  meta:{eventStatus:'reviewed-empty',reviewedEventRecords:0,reviewedEventCards:0,
   runtimeSources:{events:{mode:'reviewed',url:'./data/reviewed_events.v1.json'}}}};
}
const fetcher=async()=>({ok:true,json:async()=>JSON.parse(JSON.stringify(JSON_CATALOG))});
test('preview JSON remains byte-independent but structurally identical to reviewed-in-memory candidate builder',()=>{
 assert.deepEqual(JSON_CATALOG,compiler.buildUnpublishedPreview());
});
test('strict opt-in URL and no arbitrary preview URL construction',()=>{
 assert.equal(preview.requested(''),null);
 assert.equal(preview.requested('?eventPreview=30311'),'30311');
 assert.equal(preview.previewURL('30311'),'./data/preview/efforia30311.v1.json');
 assert.equal(preview.previewURL('../../reviewed_events.v1.json'),null);
 assert.equal(preview.previewURL('30001'),null);
});
test('opt-in preview attaches five actual candidate events while preserving reviewed count ZERO',async()=>{
 const m=model();const before=m.cards[0].hints.slice();
 const result=await preview.activate(m,{cardId:'30311',skillText:registry(),fetchImpl:fetcher});
 assert.deepEqual(result,{cardId:'30311',url:preview.previewURL('30311'),records:5,reviewedRecords:0});
 assert.equal(m.cardById['30311'].events.length,5);
 assert.deepEqual(m.cards[0].hints,before);
 assert.equal(m.meta.runtimeSources.events.mode,'preview');
 assert.equal(m.meta.reviewedEventRecords,0);
 assert.equal(m.meta.reviewedEventCards,0);
 assert.equal(m.meta.previewEvents.records,5);
});
test('preview rejects arbitrary IDs, actual-reviewed DBs, broken source and wrong skill names without side effects',async()=>{
 const m=model();const before=JSON.stringify(m);
 await assert.rejects(()=>preview.activate(m,{cardId:'30312',skillText:registry(),fetchImpl:fetcher}),/対象外/);
 assert.equal(JSON.stringify(m),before);
 const active=model();active.meta.reviewedEventRecords=1;
 await assert.rejects(()=>preview.activate(active,{cardId:'30311',skillText:registry(),fetchImpl:fetcher}),/正常かつ空/);
 const offline=model();
 await assert.rejects(()=>preview.activate(offline,{cardId:'30311',skillText:'',fetchImpl:fetcher}),/数値スキル辞書/);
 await assert.rejects(()=>preview.activate(offline,{cardId:'30311',skillText:registry(),
   fetchImpl:async()=>({ok:false,status:503})}),/503/);
 assert.equal(offline.cards[0].events.length,0);
 const broken=JSON.parse(registry());broken[0].name='別のスキル';
 const changed=model();const previous=JSON.stringify(changed);
 await assert.rejects(()=>preview.activate(changed,{cardId:'30311',
   skillText:JSON.stringify(broken),fetchImpl:fetcher}),/名称照合/);
 assert.equal(JSON.stringify(changed),previous);
});
