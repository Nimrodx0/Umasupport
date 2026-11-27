'use strict';
const assert=require('node:assert/strict');
const reasons=new Set(['rarity-reward-conflict','outing-unlock-sequence-gap','ending-event-coverage-gap','external-condition-unresolved','stage-effect-scaling-unresolved','source-structure-unresolved','numeric-id-unresolved','source-access-unavailable']);
function verifyDirectReview(x){
 assert(x&&x.schemaVersion===1&&x.dataKind==='direct-event-pending-review'&&x.publicationApproved===false&&x.sourceProseIncluded===false&&Array.isArray(x.cards),'Invalid direct review metadata');
 assert.deepEqual(Object.keys(x).sort(),['cards','dataKind','publicationApproved','schemaVersion','sourceProseIncluded']);
 let prev='';
 for(const r of x.cards){
  assert.deepEqual(Object.keys(r).sort(),['cardId','observedAt','observedEvents','reasonCodes','runId']);
  assert(typeof r.cardId==='string'&&/^[1-9]\d{4}$/.test(r.cardId)&&r.cardId>prev,'Invalid direct review ID/order');
  assert(typeof r.observedAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.observedAt)&&new Date(r.observedAt).toISOString().slice(0,10)===r.observedAt,'Invalid observed date');
  assert(Number.isSafeInteger(r.observedEvents)&&r.observedEvents>=0&&Number.isSafeInteger(r.runId)&&r.runId>0,'Invalid observed counts/run');
  assert(Array.isArray(r.reasonCodes)&&r.reasonCodes.length>0&&new Set(r.reasonCodes).size===r.reasonCodes.length&&r.reasonCodes.every(s=>reasons.has(s)),'Invalid review reason');
  prev=r.cardId;
 }
 return x;
}
function describePending(ledger,review){
 require('./derived_github_pending_ledger.cjs').verifyLedger(ledger);
 verifyDirectReview(review);
 const byId=new Map(review.cards.map(x=>[x.cardId,x]));
 return ledger.cards.map(row=>{
  const observation=byId.get(row.cardId);
  return {cardId:row.cardId,currentStatus:observation?'direct-review-held':'awaiting-direct-source-review',observedEvents:observation?.observedEvents??null,observedAt:observation?.observedAt??null,runId:observation?.runId??null,reasonCodes:observation?[...observation.reasonCodes]:[],historicalStatus:row.status};
 });
}
module.exports={verifyDirectReview,describePending};
