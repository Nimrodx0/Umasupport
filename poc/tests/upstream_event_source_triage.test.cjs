'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decide,checkPolicy}=require('../src/upstream_event_source_triage.cjs');
const cardId='30322';
const official=status=>({
 status,url:'https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun',
 checkedAt:'2026-10-27',
 ...(status==='partial'?{unresolvedFields:['outcomes','dependencies']}: {})
});
const triage=(ageDays,mirrorStatus='missing',site={status:'not-checked'},rest={})=>
 decide({cardId,ageDays,mirrorStatus,site,...rest});
test('contract pins GitHub mirror -> original GameTora -> GameWith and forbids auto publication',()=>{
 assert.doesNotThrow(checkPolicy);
 const r=triage(0);
 assert.deepEqual(r.sourceOrder,['GameTora-derived','gametora.com','GameWith']);
 assert.equal(r.automaticPinPromotion,false);
 assert.equal(r.editorialFactsApproved,false);
 assert.equal(r.publicationApproved,false);
});
test('mirror arriving immediately takes priority without arbitrary waiting',()=>{
 for(const status of ['available','modified']){
  const r=triage(0,status);
  assert.equal(r.action,'preflight-derived-snapshot');
  assert.equal(r.allowGameWithLookup,false);
 }
});
test('no mirror in early period waits; after grace period checks official site FIRST',()=>{
 assert.equal(triage(0).action,'wait-for-derived-snapshot');
 assert.equal(triage(6).action,'wait-for-derived-snapshot');
 assert.equal(triage(7).action,'check-official-gametora-card');
 assert.equal(triage(21).action,'check-official-gametora-card');
 assert.equal(triage(50).allowGameWithLookup,false);
 assert.equal(triage(0,'disputed').action,'check-official-gametora-card');
});
test('having only a GameTora card page never proves event details',()=>{
 const r=triage(10,'missing',official('card-only'));
 assert.equal(r.action,'wait-for-official-event-details');
 assert.equal(r.allowGameWithLookup,false);
 const later=triage(21,'missing',official('card-only'));
 assert.equal(later.action,'check-gamewith-only-for-gaps');
 assert.equal(later.allowGameWithLookup,true);
 assert.equal(later.publicationApproved,false);
});
test('reviewed official event facts skip GameWith even after long delays',()=>{
 const r=triage(45,'missing',official('event-detail-reviewed'));
 assert.equal(r.action,'review-official-site-event-facts');
 assert.equal(r.allowGameWithLookup,false);
 assert.equal(r.editorialFactsApproved,false);
});
test('only unresolved fields can advance to GameWith after official check',()=>{
 const partial=triage(25,'missing',official('partial'));
 assert.equal(partial.action,'check-gamewith-only-for-gaps');
 assert.deepEqual(partial.unresolvedOfficialFields,['outcomes','dependencies']);
 const after=triage(25,'missing',official('partial'),{gameWithChecked:true});
 assert.equal(after.action,'review-gamewith-only-for-gaps');
 assert.equal(after.allowGameWithLookup,false);
 assert.equal(triage(12,'missing',official('partial')).allowGameWithLookup,false);
});
test('unavailable official site is a retry, not permission to skip it',()=>{
 const r=triage(45,'missing',official('unavailable'));
 assert.equal(r.action,'retry-official-site');
 assert.equal(r.allowGameWithLookup,false);
});
test('reject mismatched card URL, guessed completion and GameWith before official',()=>{
 assert.throws(()=>triage(12,'missing',{status:'not-checked'},
  {gameWithChecked:true}),/公式サイト/);
 assert.throws(()=>triage(30,'missing',{
  ...official('partial'),unresolvedFields:[]}),/不足項目/);
 assert.throws(()=>triage(30,'missing',{
  ...official('event-detail-reviewed'),unresolvedFields:['choices']}),/不足項目/);
 assert.throws(()=>triage(30,'missing',{
  ...official('card-only'),url:'https://gametora.com/ja/umamusume/supports/30323-azuma'
 }),/確認記録/);
 assert.throws(()=>triage(-1),/不正/);
});
