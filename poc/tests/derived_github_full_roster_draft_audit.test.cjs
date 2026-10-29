'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {auditDerivedRoster}=require('../src/derived_github_full_roster_draft_audit.cjs');
const {blobSha}=require('../src/derived_github_card_event_preflight.cjs');
const skillText=()=>JSON.stringify([
 {id:'200532',name:'Test skill',rarity:'normal',group:20053},
 ...Array.from({length:105},(_,i)=>({id:String(400000+i),
  name:'Other'+i,rarity:'normal',group:40000+i}))
]);
const doc=(cardId,effects)=>JSON.stringify({
 kind:'support',id:Number(cardId),events_ja:{
  'Copyrighted title hidden':{name:'Private event prose',section:'random',choices:[
   {label:'Private option prose',effects}]}
 }
});
const records=()=>[
 {cardId:'10016',sourceText:doc('10016',[
  {type:'skill_hint',skill_id:200532,value:'+2'}])},
 {cardId:'30030',sourceText:doc('30030',[
  {type:'unmapped_kind_name'}])}
];
const fixture=(rs=records())=>({
 records:rs,skillText:skillText(),sourceCommit:'f'.repeat(40),
 sourceTree:{sha:'a'.repeat(40),truncated:false,tree:rs.map(r=>({
  type:'blob',path:'server/data/events/gametora/support_'+r.cardId+'.json',
  sha:blobSha(r.sourceText)}))}
});
test('audit all pinned source cards, preserve failures and emit only numeric reasons',()=>{
 const res=auditDerivedRoster(fixture());
 assert.equal(res.totals.sourceCards,2);
 assert.equal(res.totals.sourceEvents,2);
 assert.equal(res.totals.modeledEvents,1);
 assert.equal(res.totals.pendingEvents,1);
 assert.equal(res.totals.cardsFullyModeledInSourceSnapshot,1);
 assert.equal(res.totals.cardsWithPendingEvents,1);
 assert.equal(res.totals.modeledSkillMentions,1);
 assert.deepEqual(res.reasonCounts,{UNSUPPORTED_EFFECT_KIND:1});
 assert.deepEqual(res.cards.map(x=>x.cardId),['10016','30030']);
 assert.equal(res.historicAllCardsAsNewIsSyntheticAuditFixture,true);
 assert.equal(res.gameWideCompletenessVerified,false);
 assert.equal(res.publicationApproved,false);
 assert.equal(res.privateRuntimeEventsExposed,false);
 const text=JSON.stringify(res);
 for(const x of ['Copyrighted title hidden','Private option prose',
  'Private event prose','Test skill'])
  assert.ok(!text.includes(x));
});
test('duplicate card, missing tree blob, altered bytes fail closed',()=>{
 const source=fixture();
 assert.throws(()=>auditDerivedRoster({...source,
  records:[...source.records,source.records[0]]}),/duplicate-or-invalid-card-entry/);
 const absent=fixture();
 absent.sourceTree.tree.pop();
 assert.throws(()=>auditDerivedRoster(absent),/some-historical-card-json-not-present/);
 const changed=fixture();
 changed.records[0].sourceText+=' ';
 assert.throws(()=>auditDerivedRoster(changed),/source-blob-content-not-identical/);
});
test('reordered source input never changes card ordering or totals',()=>{
 const source=fixture();
 const a=auditDerivedRoster(source);
 const b=auditDerivedRoster({...source,records:[...source.records].reverse()});
 assert.deepEqual(a.totals,b.totals);
 assert.deepEqual(a.cards,b.cards);
});
