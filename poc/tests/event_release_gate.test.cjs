const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verifyRelease,digest}=require('../src/event_release_gate.cjs');
const event=()=>({id:'fake:choice',name:'架空イベント',type:'choice',
 choices:[{id:'up',label:'上',outcomes:[
  {id:'success',label:'成功',rewards:[{skillId:'fake:skill',level:1}]},
  {id:'great',label:'大成功',rewards:[{skillId:'fake:skill',level:5}]}
 ]}]});
const catalog=()=>({schemaVersion:1,cards:[{cardId:'fake:card',
 coverageStatus:'partial',events:[event()]}]});
const entry=e=>({
 cardId:'fake:card',eventId:e.id,eventSha256:digest(e),reviewer:'Test reviewer',
 reviewedAt:'2026-10-18',checks:{
  card:true,event:true,choices:true,outcomes:true,dependencies:true,publication:true
 },
 evidence:{
  card:['https://example.org/cards'],event:['https://example.org/events'],
  choices:['https://example.org/branches'],outcomes:['https://example.org/results'],
  dependencies:['https://example.org/chain'],publication:['https://example.org/terms']
 },
 publicationBasis:{kind:'original-factual-description',reason:'Synthetic facts only'}
});
const approved=()=>({schemaVersion:1,entries:[entry(event())]});
test('empty public database passes only alongside empty approval ledger',()=>{
 const empty={schemaVersion:1,cards:[]};
 assert.deepEqual(verifyRelease(empty,{schemaVersion:1,entries:[]}),
  {publicCards:0,publicEvents:0,reviewedEvents:0});
 assert.throws(()=>verifyRelease(empty,approved()),/存在しないレビュー/);
});
test('complete fictional review binds to the exact canonical event content',()=>{
 const c=catalog(),a=approved();
 assert.equal(verifyRelease(c,a).reviewedEvents,1);
 // Reordering object keys does not alter reviewed facts.
 c.cards[0].events[0]={type:'choice',choices:c.cards[0].events[0].choices,
                        name:'架空イベント',id:'fake:choice'};
 assert.equal(verifyRelease(c,a).reviewedEvents,1);
 // Changing levels must invalidate prior approval.
 c.cards[0].events[0].choices[0].outcomes[1].rewards[0].level=6;
 assert.throws(()=>verifyRelease(c,a),/SHA不一致/);
});
test('missing review, incomplete categories, rights decision and bad URLs fail closed',()=>{
 const c=catalog();
 assert.throws(()=>verifyRelease(c,{schemaVersion:1,entries:[]}),/承認証跡/);
 const a=approved();delete a.entries[0].checks.outcomes;
 assert.throws(()=>verifyRelease(c,a),/人手承認/);
 a.entries[0].checks.outcomes=true;a.entries[0].evidence.publication=[];
 assert.throws(()=>verifyRelease(c,a),/根拠URL/);
 a.entries[0].evidence.publication=['http://example.org'];
 assert.throws(()=>verifyRelease(c,a),/根拠URL/);
 a.entries[0].evidence.publication=['https://example.org/terms'];
 a.entries[0].publicationBasis.reason='';
 assert.throws(()=>verifyRelease(c,a),/公開利用の根拠/);
});
test('duplicate approvals, stale approvals and unproven completeness fail closed',()=>{
 const c=catalog(),a=approved();
 a.entries.push({...a.entries[0]});
 assert.throws(()=>verifyRelease(c,a),/レビューの重複/);
 a.entries.pop();a.entries[0].eventId='fake:old';
 assert.throws(()=>verifyRelease(c,a),/存在しないレビュー/);
 a.entries[0].eventId='fake:choice';
 c.cards[0].coverageStatus='complete';
 assert.throws(()=>verifyRelease(c,a),/全件性/);
});
test('two cards with same event ID require separate card-scoped approvals',()=>{
 const c=catalog(),a=approved();
 c.cards.push({cardId:'fake:card2',events:[event()]});
 assert.throws(()=>verifyRelease(c,a),/承認証跡/);
 a.entries.push({...entry(event()),cardId:'fake:card2'});
 assert.equal(verifyRelease(c,a).reviewedEvents,2);
});


test('a complete approval SHA cannot launder pending draft-only skill metadata into public JSON',()=>{
 const c=catalog(),e=c.cards[0].events[0];
 e.choices[0].outcomes[0].unresolvedRewards=[{skillName:'匿名',level:1}];
 const a=approved();
 a.entries[0].eventSha256=digest(e);
 assert.throws(()=>verifyRelease(c,a),/未照合報酬の草稿は公開できません/);
});


test('editorial-quarantine markers cannot be laundered by valid SHA and six checked boxes',()=>{
 for(const [area,field,value] of [
  ['event','noAutomaticRuntimeAdoption',true],
  ['event','publicationApproved',false],
  ['event','game2026Verified',false],
  ['choice','manualStageAssertionOnly',true],
  ['choice','possibleOnly',true],
  ['outcome','sourceKind','UNADJUDICATED_U_TOOLS_SINGLE_EDITORIAL_SOURCE'],
  ['event','chainPrerequisitesVerified',false],
  ['event','unresolvedRequiredFacts',['CHAIN_TOPOLOGY']]
 ]){
  const c=catalog(),e=c.cards[0].events[0];
  const target=area==='event'?e:area==='choice'?e.choices[0]:e.choices[0].outcomes[0];
  target[field]=value;
  const a=approved();a.entries[0].eventSha256=digest(e);
  assert.throws(()=>verifyRelease(c,a),/未照合報酬の草稿は公開できません/,
   area+'/'+field);
 }
});
