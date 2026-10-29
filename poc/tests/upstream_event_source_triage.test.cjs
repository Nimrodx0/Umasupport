'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decide,checkPolicy}=require('../src/upstream_event_source_triage.cjs');
const cardId='30322';
const site=status=>({status,
 url:'https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun',
 checkedAt:'2026-10-27',...(status==='partial'?{unresolvedFields:['outcomes','dependencies']}: {})});
const triage=(ageDays,mirrorStatus='missing',site={status:'not-checked'},rest={})=>
 decide({cardId,ageDays,mirrorStatus,site,...rest});
test('primary is derived GitHub JSON; direct site HTML adapter paused, no auto release',()=>{
 assert.doesNotThrow(checkPolicy);
 const r=triage(0);
 assert.deepEqual(r.sourceOrder,['GameTora-derived-GitHub','GameWith-exceptions']);
 assert.equal(r.directWebsiteAdapterPaused,true);
 assert.equal(r.automaticPinPromotion,false);
 assert.equal(r.editorialFactsApproved,false);
 assert.equal(r.publicationApproved,false);
});
test('present and changed derived JSON enters existing preflight immediately',()=>{
 for(const st of ['available','modified']){
  const r=triage(0,st);
  assert.equal(r.action,'preflight-derived-snapshot');
  assert.equal(r.allowGameWithLookup,false);
 }
});
test('missing derived JSON waits regardless of age; never auto-start HTML crawling',()=>{
 for(const days of [0,7,21,365]){
  const r=triage(days);
  assert.equal(r.action,'wait-for-derived-snapshot');
  assert.equal(r.allowGameWithLookup,false);
  assert.equal(r.manualExceptionOnly,true);
 }
 const dispute=triage(30,'disputed');
 assert.equal(dispute.action,'queue-derived-source-dispute');
});
test('card-specific manual exception review is separate and never automatic',()=>{
 const pending=triage(35,'missing',site('partial'));
 assert.equal(pending.action,'wait-for-derived-snapshot');
 const manual=triage(35,'missing',site('partial'),{manualExceptionReview:true});
 assert.equal(manual.action,'check-gamewith-only-for-gaps');
 assert.equal(manual.allowGameWithLookup,true);
 assert.deepEqual(manual.unresolvedOfficialFields,['outcomes','dependencies']);
 const reviewed=triage(35,'missing',site('partial'),
  {manualExceptionReview:true,gameWithChecked:true});
 assert.equal(reviewed.action,'review-gamewith-only-for-gaps');
 assert.equal(reviewed.allowGameWithLookup,false);
 const sourceReviewed=triage(22,'missing',site('event-detail-reviewed'),
  {manualExceptionReview:true});
 assert.equal(sourceReviewed.action,'review-manual-source-facts');
});
test('reject invalid IDs, contradictory status and blanket GameWith lookups',()=>{
 assert.throws(()=>triage(12,'missing',{status:'not-checked'},
  {gameWithChecked:true}),/個別例外/);
 assert.throws(()=>triage(30,'missing',{
  ...site('partial'),unresolvedFields:[]}),/不足項目/);
 assert.throws(()=>triage(30,'missing',{
  ...site('event-detail-reviewed'),unresolvedFields:['choices']}),/不足項目/);
 assert.throws(()=>triage(30,'missing',{
  ...site('card-only'),url:'https://gametora.com/ja/umamusume/supports/30323-azuma'
 }),/確認記録/);
 assert.throws(()=>triage(-1),/不正/);
});
