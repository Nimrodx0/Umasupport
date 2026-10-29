'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {discoverNewCards,stageNewCardEvents,appendApprovedNewCards}=
 require('../src/new_card_event_incremental.cjs');
const {stageDerivedGitHubNewCards}=
 require('../src/derived_github_staging_bridge.cjs');
const {planDerivedNewCardIntake}=
 require('../src/derived_github_new_card_source_plan.cjs');
const {blobSha}=require('../src/derived_github_card_event_preflight.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const registry=()=>JSON.stringify([
 {id:'200532',name:'Independent numeric skill',rarity:'normal',group:20053},
 ...Array.from({length:102},(_,i)=>({id:String(400000+i),
  name:'Synthetic '+i,rarity:'normal',group:40000+i}))
]);
const doc=(id,kind='skill_hint')=>JSON.stringify({
 kind:'support',id:Number(id),events_ja:{
  'Source prose must never escape':{section:'random',id:100,
   name:'Proprietary source heading',choices:[{
    label:'Proprietary option label',effects:kind==='skill_hint'?
     [{type:'skill_hint',skill_id:200532,value:'+2'}]:
     [{type:'unknown_effect'}]}]}
 }
});
function setup(){
 const catalog={schemaVersion:1,cards:[{cardId:'30001',events:[]}]};
 const discovery=discoverNewCards({
  previousRosterIds:['30001'],
  currentRosterIds:['30001','10016','30030','30322']
 });
 const d1=doc('10016'),d2=doc('30030','bad');
 const sourceTree={sha:'a'.repeat(40),truncated:false,tree:[
  {path:'server/data/events/gametora/support_10016.json',type:'blob',sha:blobSha(d1)},
  {path:'server/data/events/gametora/support_30030.json',type:'blob',sha:blobSha(d2)}
 ]};
 const sourcePlan=planDerivedNewCardIntake({discovery,existingCatalog:catalog,
  sourceTree,sourceCommit:'b'.repeat(40)});
 return {discovery,existingCatalog:catalog,sourcePlan,
  sourceDocuments:{10016:d1,30030:d2},skillText:registry()};
}
test('real Git blob-bound candidate goes into review staging, missing and incomplete cards stay pending',()=>{
 const x=setup(),before=JSON.stringify(x.existingCatalog);
 const out=stageDerivedGitHubNewCards(x);
 assert.deepEqual(out.newlyModeledCardIds,['10016']);
 assert.deepEqual(out.carryForwardPendingIds,['10016','30030','30322']);
 assert.deepEqual(out.stage.pending.map(x=>[x.cardId,x.reason]),[
  ['30030','derived-github-source-unresolved'],
  ['30322','derived-github-json-not-yet-published']
 ]);
 assert.equal(out.stage.ready[0].events.length,1);
 assert.equal(out.stage.ready[0].events[0].sourceKind,'derived-github-unreviewed');
 assert.equal(out.stage.ready[0].events[0].choices[0].rewards[0].level,2);
 assert.equal(out.publicationApproved,false);
 assert.equal(out.existingDatabaseUnchanged,true);
 assert.equal(JSON.stringify(x.existingCatalog),before);
 for(const phrase of ['Source prose must never escape',
   'Proprietary source heading','Proprietary option label'])
  assert.ok(!JSON.stringify(out).includes(phrase));
});
test('tampered one-card blob remains pending without affecting unrelated modelable card',()=>{
 const x=setup();
 x.sourceDocuments[30030]=x.sourceDocuments[30030]+' ';
 const out=stageDerivedGitHubNewCards(x);
 assert.deepEqual(out.newlyModeledCardIds,['10016']);
 assert.equal(out.stage.pending[0].reason,'derived-github-card-validation-failed');
 assert.equal(out.stage.pending[1].reason,'derived-github-json-not-yet-published');
});
test('missing downloaded blob is separate from GitHub JSON missing',()=>{
 const x=setup();delete x.sourceDocuments[10016];
 const out=stageDerivedGitHubNewCards(x);
 assert.deepEqual(out.newlyModeledCardIds,[]);
 assert.equal(out.stage.pending[0].reason,'derived-github-source-not-fetched');
});
test('reject substituted plan and out-of-scope or already imported document',()=>{
 const x=setup();
 x.sourcePlan.results.find(r=>r.cardId==='10016').sourceBlobSha='0'.repeat(40);
 assert.equal(stageDerivedGitHubNewCards(x).stage.pending[0].reason,
  'derived-github-card-validation-failed');
 const y=setup();y.sourceDocuments[99999]=doc('99999');
 assert.throws(()=>stageDerivedGitHubNewCards(y),/document-outside-eligible-pinned-source/);
 const z=setup();z.sourcePlan.detectedNewCardIds=[];
 assert.throws(()=>stageDerivedGitHubNewCards(z),/discovery-does-not-match-source-plan/);
});
test('stage requires Git SHA provenance and cannot relabel source as original site',()=>{
 const x=setup();
 const ready=stageDerivedGitHubNewCards(x).stage.ready[0];
 const fake={source:'GameTora-derived-GitHub',cardId:'10016',
  sourceRevision:'b'.repeat(40),sourceBlobSha:'0'.repeat(40),
  sourcePath:'server/data/events/gametora/support_10016.json',
  sourceSiteTextCopied:false,publicationApproved:false,appEventSchemaAdoptable:false,
  sourceEventCount:1,convertedEventCount:1,unresolvedEventCount:0,
  events:ready.events};
 assert.throws(()=>stageNewCardEvents({
  discovery:x.discovery,existingCatalog:x.existingCatalog,candidates:[fake],
  derivedSourcePlan:x.sourcePlan}),/固定GitHub出典/);
 assert.throws(()=>stageNewCardEvents({
  discovery:x.discovery,existingCatalog:x.existingCatalog,candidates:[fake]
 }),/固定GitHub出典/);
});
test('even a fully projected derived GitHub stage cannot bypass human release approval',()=>{
 const x=setup(),out=stageDerivedGitHubNewCards(x);
 const row=x.sourcePlan.results.find(r=>r.cardId==='10016');
 const fake={source:'GameTora-derived-GitHub',cardId:'10016',
  sourceRevision:x.sourcePlan.primarySourceCommit,sourceBlobSha:row.sourceBlobSha,
  sourcePath:row.sourcePath,sourceSiteTextCopied:false,publicationApproved:false,
  appEventSchemaAdoptable:false,sourceEventCount:1,convertedEventCount:1,
  unresolvedEventCount:0,events:out.stage.ready[0].events};
 const ev=fake.events[0],approvals={schemaVersion:1,entries:[{
  cardId:'10016',eventId:ev.id,eventSha256:digest(ev),
  reviewer:'test',reviewedAt:'2026-10-29',
  checks:Object.fromEntries(['card','event','choices','outcomes','dependencies',
   'publication'].map(k=>[k,true])),
  evidence:Object.fromEntries(['card','event','choices','outcomes','dependencies',
   'publication'].map(k=>[k,['https://example.org/test']])),
  publicationBasis:{kind:'original-factual-description',reason:'synthetic-only'}
 }]};
 const model={cards:[{id:'30001'},{id:'10016'}],
  cardById:{30001:{id:'30001'},10016:{id:'10016'}},
  skillById:{}};
 assert.throws(()=>appendApprovedNewCards({discovery:x.discovery,
  existingCatalog:x.existingCatalog,candidates:[fake],
  existingApprovals:{schemaVersion:1,entries:[]},newApprovals:approvals,
  model,skillText:registry(),derivedSourcePlan:x.sourcePlan}),
  /未照合報酬の草稿は公開できません/);
});
