'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {discoverNewCards}=require('../src/new_card_event_incremental.cjs');
const {planDerivedNewCardIntake}=require('../src/derived_github_new_card_source_plan.cjs');
const {stageDerivedGitHubNewCards}=require('../src/derived_github_staging_bridge.cjs');
const {emptyLedger,verifyLedger,reconcilePendingLedger}=
 require('../src/derived_github_pending_ledger.cjs');
const {blobSha}=require('../src/derived_github_card_event_preflight.cjs');
const {pendingTargetIds}=require('../src/derived_github_pending_refresh.cjs');
function skillText(){return JSON.stringify([
 {id:'200532',name:'Independent numeric skill',rarity:'normal',group:20053},
 ...Array.from({length:105},(_,i)=>({id:String(400000+i),
  name:'Other '+i,rarity:'normal',group:40000+i}))
]);}
function doc(cardId,malformed=false){
 return JSON.stringify({kind:'support',id:Number(cardId),events_ja:{
  first:{section:'arrows',name:'NEVER LEAK THIRD PARTY EVENT NAME',
   choices:[{label:'DO NOT STORE PRIVATE OPTION',effects:[
    {type:'skill_hint',skill_id:200532,value:'+1'}]}]},
  second:{section:'arrows',name:'DO NOT STORE SOURCE',
   choices:[{label:'',effects:[{type:malformed?'unknown_effect':'skill_hint',skill_id:200532,value:'+2'}]}]}
 }});
}
const sha=x=>x.repeat(40);
function simulate({prev=emptyLedger(),current=['30001','30322','30323'],
  inserted=['30322'],complete=['30322'],imported=[],tamper=false,reused=[],
  skillRegistryBlobSha=sha('d')}={}){
 const original={schemaVersion:1,cards:imported.map(cardId=>({cardId,events:[]}))};
 const discovery=discoverNewCards({
  previousRosterIds:['30001',...(prev.cards.length?['30322','30323']:[])],
  currentRosterIds:current
 });
 const docs=Object.fromEntries(inserted.map(id=>[id,doc(id,tamper&&id==='30322')]));
 const sourceTree={sha:sha('a'),truncated:false,tree:[
  {type:'blob',path:'server/data/events/gametora/support_30001.json',sha:sha('1')},
  ...inserted.map(id=>({type:'blob',
   path:'server/data/events/gametora/support_'+id+'.json',sha:blobSha(docs[id])}))
 ]};
 const plan=planDerivedNewCardIntake({discovery,existingCatalog:original,
  pendingCardIds:prev.cards.map(x=>x.cardId),
  sourceTree,sourceCommit:sha('b')});
 const sourceDocuments=Object.fromEntries(complete.map(id=>[id,docs[id]])
  .filter(([id,text])=>typeof text==='string'&&plan.candidateIds.includes(id)));
 const stage=stageDerivedGitHubNewCards({discovery,existingCatalog:original,
  sourcePlan:plan,sourceDocuments,pendingCardIds:prev.cards.map(x=>x.cardId),
  skillText:skillText(),skillRevision:sha('c')});
 const ledger=reconcilePendingLedger({previous:prev,discovery,sourcePlan:plan,
  stage,existingCatalog:original,reusedUnchangedCardIds:reused,
  skillRegistryBlobSha});
 return {ledger,discovery,plan,stage,original};
}
test('metadata-only ledger survives a second run with no fresh added cards',()=>{
 const first=simulate();
 assert.deepEqual(first.ledger.cards.map(x=>[x.cardId,x.status]),[
  ['30322','awaiting-review'],['30323','awaiting-source-json']]);
 assert.equal(first.ledger.cards[0].sourceEvents,2);
 assert.equal(first.ledger.cards[0].modeledEvents,2);
 assert.equal(first.ledger.cards[0].excludedEvents,0);
 for(const prohibited of ['NEVER LEAK','DO NOT STORE','skillId','verifiedSkillName'])
  assert.ok(!JSON.stringify(first.ledger).includes(prohibited));
 const next=simulate({prev:first.ledger,current:['30001','30322','30323']});
 assert.deepEqual(next.ledger,first.ledger);
 assert.equal(next.discovery.addedCardIds.length,0);
 assert.equal(next.stage.carryForwardPendingIds.length,2);
});
test('one ambiguous card stays pending while another advances and prior imported card disappears',()=>{
 const first=simulate();
 const changed=simulate({prev:first.ledger,inserted:['30322','30323'],
  complete:['30322','30323'],tamper:true});
 assert.equal(changed.ledger.cards[0].status,'awaiting-source-resolution');
 assert.equal(changed.ledger.cards[0].excludedEvents,1);
 assert.equal(changed.ledger.cards[0].modeledEvents,1);
 assert.equal(changed.stage.partialDrafts.length,1);
 assert.equal(changed.stage.partialDrafts[0].modeledEvents.length,1);
 assert.equal(changed.stage.partialDrafts[0].pendingEvents.length,1);
 assert.equal(changed.stage.partialDrafts[0].publicationApproved,false);
 assert.equal(changed.ledger.cards[1].status,'awaiting-review');
 assert.ok(changed.ledger.cards[0].reviewItems.length>0);
 const after=simulate({prev:changed.ledger,inserted:['30322','30323'],
  complete:['30322','30323'],imported:['30323'],tamper:true});
 assert.deepEqual(after.ledger.cards.map(x=>x.cardId),['30322']);
 assert.equal(JSON.stringify(after.original),JSON.stringify({schemaVersion:1,
  cards:[{cardId:'30323',events:[]}]}));
});
test('unfetched Git blob is distinct from JSON absent, and later retry restores review stage',()=>{
 const first=simulate({complete:[]});
 assert.equal(first.ledger.cards[0].status,'awaiting-source-download');
 assert.equal(first.ledger.cards[1].status,'awaiting-source-json');
 const next=simulate({prev:first.ledger});
 assert.equal(next.ledger.cards[0].status,'awaiting-review');
});
test('ledger rejects arbitrary source text, fake approvals, duplicates and out-of-scope issues',()=>{
 const first=simulate(),base=first.ledger;
 const variants=[
  {...base,publicationApproved:true},
  {...base,cards:[...base.cards,{...base.cards[1]}]},
  {...base,cards:base.cards.map((x,i)=>i===0?{...x,sourceTitle:'COPY'}:x)},
  {...base,cards:base.cards.map((x,i)=>i===0?{...x,reviewItems:[
   {sourceOrdinal:1,reason:'VALID',origin:'source-normalization',prose:'PROPRIETARY'}]}:x)},
  {...base,cards:base.cards.map((x,i)=>i===0?{...x,sourceEvents:99}:x)}
 ];
 for(const v of variants)assert.throws(()=>verifyLedger(v),/台帳/);
 const stage={...first.stage,reviewItems:[{cardId:'30001',sourceOrdinal:1,
  reason:'SUSPICIOUS',origin:'source-normalization'}]};
 assert.throws(()=>reconcilePendingLedger({...first,stage,previous:emptyLedger(),
  existingCatalog:first.original,sourcePlan:first.plan,
  skillRegistryBlobSha:sha('d')}),/追加対象外/);
});

test('UmaSim-first: do not even query third-party events when every new ID is already imported',()=>{
 const d={dataKind:'new-umamusume-support-card-ids',schemaVersion:1,
  publicationApproved:false,addedCardIds:[],existingCardIds:['30001','30322']};
 assert.deepEqual(pendingTargetIds({discovery:d,existingCatalog:{
  schemaVersion:1,cards:[{cardId:'30001',events:[]}]}}),[]);
 assert.deepEqual(pendingTargetIds({discovery:{...d,addedCardIds:['30323'],
  existingCardIds:['30001','30322']},existingCatalog:{
   schemaVersion:1,cards:[{cardId:'30001'},{cardId:'30323'}]}}),[]);
 assert.deepEqual(pendingTargetIds({discovery:{...d,addedCardIds:['30323'],
  existingCardIds:['30001','30322']},existingCatalog:{
   schemaVersion:1,cards:[{cardId:'30001'}]}}),['30323']);
});
test('same checked source blob retains converted event count and review reasons without download',()=>{
 const first=simulate();
 const repeat=simulate({prev:first.ledger,complete:[],reused:['30322']});
 assert.deepEqual(repeat.ledger.cards[0],first.ledger.cards[0]);
 assert.equal(repeat.ledger.cards[0].status,'awaiting-review');
 assert.equal(repeat.stage.stage.pending[0].reason,'derived-github-source-not-fetched');
 assert.throws(()=>simulate({prev:first.ledger,complete:[],
  reused:['30322'],tamper:true}),/元ファイル履歴・保留状態/);
 const unresolved=simulate({prev:first.ledger,tamper:true,
  inserted:['30322','30323'],complete:['30322','30323']});
 const repeated=simulate({prev:unresolved.ledger,inserted:['30322','30323'],
  complete:[],tamper:true,reused:['30322','30323']});
 assert.deepEqual(repeated.ledger,unresolved.ledger);
 assert.equal(repeated.ledger.cards[0].status,'awaiting-source-resolution');
 assert.equal(repeated.ledger.cards[0].reviewItems.length>0,true);
});
test('reject unchanged reuse when pending state was never successfully converted',()=>{
 const first=simulate({complete:[]});
 assert.throws(()=>simulate({prev:first.ledger,complete:[],
  reused:['30322']}),/元ファイル履歴・保留状態/);
});

test('skill registry changes also invalidate event conversion cache',()=>{
 const first=simulate();
 assert.throws(()=>simulate({prev:first.ledger,complete:[],
  reused:['30322'],skillRegistryBlobSha:sha('e')}),
  /元ファイル履歴・保留状態/);
 const changed=simulate({prev:first.ledger,skillRegistryBlobSha:sha('e')});
 assert.equal(changed.ledger.cards[0].skillRegistryBlobSha,sha('e'));
 assert.notDeepEqual(changed.ledger.cards[0],first.ledger.cards[0]);
});
