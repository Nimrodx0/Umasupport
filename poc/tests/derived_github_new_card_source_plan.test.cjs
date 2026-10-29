'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planDerivedNewCardIntake,SOURCE_REPO}=
 require('../src/derived_github_new_card_source_plan.cjs');
const sha=x=>String(x).repeat(40);
const discovery=(added=['30322','30323'])=>({
 dataKind:'new-umamusume-support-card-ids',schemaVersion:1,
 publicationApproved:false,addedCardIds:added,existingCardIds:['30001','30030']
});
const catalog=()=>({schemaVersion:1,cards:[{cardId:'30001',events:[{id:'x'}]}]});
const tree=(present=['30322'])=>({
 sha:sha('a'),truncated:false,tree:[
  {path:'README.md',type:'blob',sha:sha('b')},
  {path:'server/data/events/gametora/support_30001.json',
   type:'blob',sha:sha('c')},
  ...present.map((id,i)=>({
   path:'server/data/events/gametora/support_'+id+'.json',
   type:'blob',sha:i?sha('d'):sha('e')
  }))
 ]
});
const plan=(extra={})=>planDerivedNewCardIntake({
 discovery:discovery(),existingCatalog:catalog(),
 sourceTree:tree(),sourceCommit:sha('f'),...extra
});
test('prefer structured GitHub source; missing new JSON remains in pending queue',()=>{
 const existing=catalog(),copy=JSON.stringify(existing);
 const got=plan({existingCatalog:existing});
 assert.equal(got.primarySourceRepository,SOURCE_REPO);
 assert.deepEqual(got.candidateIds,['30322']);
 assert.deepEqual(got.waitingIds,['30323']);
 assert.deepEqual(got.carryForwardPendingIds,['30322','30323']);
 assert.deepEqual(got.results.map(x=>x.status),[
  'source-blob-present-needs-validation','await-derived-github-json']);
 assert.equal(got.results[0].sourcePath,
  'server/data/events/gametora/support_30322.json');
 assert.equal(got.results[0].sourceBlobSha,sha('e'));
 assert.equal(got.allSourceEventsValidated,false);
 assert.equal(got.publicationApproved,false);
 assert.equal(got.existingDatabaseUnchanged,true);
 assert.equal(JSON.stringify(existing),copy);
});
test('next day can retry pending even with no new roster delta',()=>{
 const first=plan();
 const second=plan({
  discovery:{...discovery([]),existingCardIds:['30001','30030','30322','30323']},
  pendingCardIds:first.carryForwardPendingIds,
  sourceTree:tree(['30322','30323'])
 });
 assert.deepEqual(second.waitingIds,[]);
 assert.deepEqual(second.candidateIds,['30322','30323']);
 assert.equal(second.carryForwardPendingIds.length,2);
});
test('already imported card is skipped and not reintroduced',()=>{
 const got=plan({
  existingCatalog:{schemaVersion:1,cards:[
   {cardId:'30001',events:[]},{cardId:'30322',events:[]}
  ]}
 });
 assert.deepEqual(got.candidateIds,[]);
 assert.deepEqual(got.carryForwardPendingIds,['30323']);
 assert.equal(got.results[0].status,'already-in-catalog');
});
test('partial Git tree and unsafe source metadata are never interpreted as missing',()=>{
 for(const bad of [
  {...tree(),truncated:true},
  {...tree(),sha:'not-a-sha'},
  {...tree(),tree:[]},
  {...tree(),tree:[...tree().tree,tree().tree[0]]},
  {...tree(),tree:tree().tree.map(x=>x.path.includes('30322')?{...x,type:'tree'}:x)}
 ])assert.throws(()=>plan({sourceTree:bad}),/GitHub派生イベント新カード計画/);
 assert.throws(()=>plan({sourceCommit:'HEAD'}),/完全なtree/);
});
test('reject attempts to overwrite imported cards or use wrong population',()=>{
 assert.throws(()=>plan({
  pendingCardIds:['30399']
 }),/名簿/);
 assert.throws(()=>plan({
  discovery:{...discovery(),addedCardIds:['30001']}
 }),/名簿/);
 assert.throws(()=>plan({
  existingCatalog:{schemaVersion:1,cards:[{cardId:'30500'}]}
 }),/名簿/);
 assert.throws(()=>plan({
  discovery:{...discovery(),publicationApproved:true}
 }),/不正/);
});
test('presence of a GitHub JSON blob never grants a completed application event',()=>{
 const got=plan({sourceTree:tree(['30322','30323'])});
 assert.deepEqual(got.candidateIds,['30322','30323']);
 assert.equal(got.allRequiredSkillIdsChecked,false);
 assert.equal(got.chainDependenciesVerified,false);
 assert.equal(got.allSourceDocumentsFetched,false);
 assert.equal(got.autoPublish,false);
 assert.equal(got.publicationApproved,false);
 assert.equal(Object.hasOwn(got,'events'),false);
});
