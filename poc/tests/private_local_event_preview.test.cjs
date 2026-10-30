'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {fixture}=require('./private_local_2512_fixture.cjs');
const {verifyBundle,activate}=require('../src/private_local_event_preview.js');
const core=require('../src/core.js');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const input=f=>JSON.stringify(f.bundle);
test('bulk local file validates exact 563 / 2512, attaches through production loader, but never claims public approval',async()=>{
 const f=fixture(),before=JSON.stringify(f.bundle);
 const verified=await verifyBundle(input(f),f.model,f.skillText);
 assert.equal(verified.events,2512);
 assert.equal(verified.cards,563);
 assert.equal(verified.catalogSha256,f.bundle.catalogSha256);
 assert.equal(f.model.cards[0].events.length,0);
 const result=await activate(f.model,{text:input(f),skillText:f.skillText});
 assert.equal(result.publicationApproved,false);
 assert.equal(f.model.cardById['30001'].events.length,5);
 assert.equal(f.model.cardById['30001'].events[0].choices[0].rewards[0].skillId,
  'hint:架空ヒント');
 assert.equal(f.model.meta.reviewedEventRecords,0);
 assert.equal(f.model.meta.reviewedEventCards,0);
 assert.equal(f.model.meta.eventStatus,'preview-only');
 assert.equal(f.model.meta.runtimeSources.events.localOnly,true);
 assert.equal(f.model.meta.previewEvents.records,2512);
 assert.equal(JSON.stringify(f.bundle),before,'input data unchanged');
 const selected=core.directRoutes(f.model.cardById['30001'],{
  stage:4,choices:{'synthetic-30001-event-0':'option1'},outcomes:{}
 }).filter(x=>x.source==='event');
 assert.deepEqual(selected.map(r=>[r.skillId,r.level]),[['hint:架空ヒント',2]]);
 assert.equal(core.directRoutes(f.model.cardById['30001'],{
  stage:4,choices:{},outcomes:{}
 }).filter(x=>x.source==='event').length,0);
});
test('hash, source revision, counts, draft flags, card mismatch and already published content fail closed',async()=>{
 const actions=[
  f=>{f.bundle.catalogSha256='0'.repeat(64);},
  f=>{f.bundle.sourceRevision='other';},
  f=>{f.bundle.publicationApproved=true;},
  f=>{f.bundle.sourceNarrativeOrChoiceProseIncluded=true;},
  f=>{f.bundle.summary.events=2500;},
  f=>{f.bundle.catalog.cards.pop();f.bundle.catalogSha256=sha(f.bundle.catalog);},
  f=>{f.bundle.catalog.cards[0].events.pop();f.bundle.catalogSha256=sha(f.bundle.catalog);},
  f=>{f.bundle.catalog.cards[0].events[0].choices[0].rewards[0].verifiedSkillName='違う';f.bundle.catalogSha256=sha(f.bundle.catalog);},
  f=>{f.bundle.catalog.cards[0].cardId='99999';f.bundle.catalogSha256=sha(f.bundle.catalog);},
  f=>{f.model.meta.reviewedEventRecords=1;},
  f=>{f.model.meta.runtimeSources.events.mode='failed';},
  f=>{f.skillText='';},
  f=>{f.bundle.unknownApprovalKey=true;}
 ];
 for(const edit of actions){
  const f=fixture();edit(f);
  const before=JSON.stringify(f.model);
  await assert.rejects(activate(f.model,{text:input(f),skillText:f.skillText}),
    /ローカル読込|数値スキルID/,edit.toString());
  assert.equal(JSON.stringify(f.model),before,'rejected import must not touch live model');
 }
});
test('reject unstructured catalogs or malformed inputs without touching runtime model',async()=>{
 const f=fixture(),before=JSON.stringify(f.model);
 for(const text of ['{','null','{}','',JSON.stringify({catalog:f.bundle.catalog})]){
  await assert.rejects(activate(f.model,{text,skillText:f.skillText}),
   /ローカル読込/);
 }
 assert.equal(JSON.stringify(f.model),before);
});
