'use strict';
// Explicit developer-only integration smoke against exactly two publisher files.
// Never committed source data and never run in ordinary CI.
const assert=require('node:assert/strict');
const support=require('../src/live_loader.js');
const publicCatalog=require('../src/public_event_catalog.js');
const skillBridge=require('../src/skill_bridge.js');
async function main(){
 if(process.argv[2]!=='--online')throw Error('Explicit --online is required');
 const urls=[support.SOURCE_URL,skillBridge.SOURCE_URL];
 const [supportText,skillText]=await Promise.all(urls.map(async url=>{
   const r=await fetch(url,{cache:'no-store',headers:{'User-Agent':'UmaSupportLab-Smoke/1.0'}});
   if(!r.ok)throw Error('Publisher returned '+r.status);
   return r.text();
 }));
 const model=support.buildModel(supportText);
 const catalog={schemaVersion:1,cards:[]};
 const result=publicCatalog.attach(model,catalog,{skillText,fullRegistry:true});
 assert.equal(result.eventsWithRecords,0);
 assert.equal(model.meta.skillHierarchy.totalRare,325);
 assert.equal(model.meta.skillHierarchy.linked,322);
 assert.equal(model.meta.skillHierarchy.withoutLower,3);
 assert.equal(model.meta.skillHierarchy.unresolved,0);
 assert.equal(model.skillById['skill:200014'].lowerId,'skill:200011');
 assert.equal(model.skillById['skill:200011'].lowerId,'hint:右回り○');
 assert.equal(model.skillById['skill:201582'].lowerId,'hint:登山家');
 assert.equal(model.skillById['skill:202051'].lowerId,null);
 const uniq=new Set(model.skills.map(x=>x.id));
 assert.equal(uniq.size,model.skills.length);
 console.log(JSON.stringify({verified:true,supportCards:model.cards.length,
   hints:model.meta.totalHints,skillEntries:model.skills.length,
   rare:model.meta.skillHierarchy.totalRare,sourceLinked:model.meta.skillHierarchy.linked,
   noLower:model.meta.skillHierarchy.withoutLower,
   unresolved:model.meta.skillHierarchy.unresolved,events:result.eventsWithRecords}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
