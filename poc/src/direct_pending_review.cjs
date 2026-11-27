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
// D069: determine exact queued targets from the current verified ledger.
// This stage is intentionally network-free. Access conditions have not
// yet been established; a queue entry is not authority to visit a site.
function partitionBatches(ids,limit=2){
 assert(Array.isArray(ids)&&ids.length<=1000&&ids.every(id=>typeof id==='string'&&/^[1-9]\\d{4}$/.test(id))&&new Set(ids).size===ids.length,'Invalid batch IDs');
 assert(Number.isSafeInteger(limit)&&limit>=1&&limit<=2,'Invalid batch limit');
 const batches=[];
 for(let i=0;i<ids.length;i+=limit)batches.push(ids.slice(i,i+limit));
 return batches;
}
function planEventDrivenIntake({previous,next,review,sourcePin,policy}={}){
 const {verifyLedger}=require('./derived_github_pending_ledger.cjs');
 verifyLedger(previous);
 const rows=describePending(next,review);
 assert(sourcePin&&Object.keys(sourcePin).sort().join(',')==='cardBlob,commit'&&
  [sourcePin.commit,sourcePin.cardBlob].every(x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x)),
  'Invalid immutable UmaSim roster coordinates');
 assert(policy?.decision==='D-067'&&policy.sourceVisitLimitPerInvocation===2&&
  policy.automaticScheduledSiteAccessAllowed===false&&policy.automaticPublicationAllowed===false,
  'D069 unattended access/publication gate not established');
 const priorIds=new Set(previous.cards.map(x=>x.cardId));
 const newlyQueuedIds=rows.filter(r=>!priorIds.has(r.cardId)).map(r=>r.cardId);
 const heldIds=rows.filter(r=>r.currentStatus==='direct-review-held').map(r=>r.cardId);
 const eligibleIds=rows.filter(r=>r.currentStatus==='awaiting-direct-source-review').map(r=>r.cardId);
 return {dataKind:'d069-event-driven-intake-plan',schemaVersion:1,
  sourcePin:{...sourcePin},newlyQueuedIds,heldIds,eligibleIds,
  batches:partitionBatches(eligibleIds,policy.sourceVisitLimitPerInvocation),
  nextBatchIds:eligibleIds.slice(0,2),remainingIds:eligibleIds.slice(2),
  status:eligibleIds.length?'blocked-access-conditions':'no-eligible-cards',
  siteAccessAuthorized:false,publicationApproved:false};
}
// Transport-independent controller. A caller must separately establish
// authority to use a real observer; the daily planner never invokes this.
async function runSequentialBatches({ids,observeBatch}={}){
 const batches=partitionBatches(ids);
 assert(typeof observeBatch==='function','Missing batch observer');
 const completed=[],held=[],unattempted=ids.slice();
 let stopReason=null,uncertainIds=[];
 for(const batch of batches){
  let result;
  try{
   result=await observeBatch(batch.slice());
   assert(result?.publicationApproved===false&&result.existingDatabaseUnchanged===true&&
    result.sourceSiteTextCopied===false&&Array.isArray(result.selectedCardIds)&&
    JSON.stringify(result.selectedCardIds)===JSON.stringify(batch)&&Array.isArray(result.results)&&
    result.results.length===batch.length,'Unexpected observation');
   for(let i=0;i<batch.length;i++){
    const r=result.results[i];
    assert(r?.cardId===batch[i]&&r.publicationApproved===false&&
     ['private-schema-only','not-listed-yet','unrecognized-event-layout'].includes(r.status),
     'Unexpected observation status');
   }
  }catch{
   // A thrown transport/layout error might follow a partial visit. Do not
   // assert that any member of this batch was unvisited or safely retry it.
   stopReason='batch-observation-failed';uncertainIds=batch.slice();
   unattempted.splice(0,batch.length);break;
  }
  for(const r of result.results){
   if(r.status==='private-schema-only')completed.push(r.cardId);
   else held.push({cardId:r.cardId,status:r.status});
  }
  unattempted.splice(0,batch.length);
  // Unrecognized structure may indicate a site-wide change; stop further
  // batches. A single absent listing does not block unrelated cards.
  if(result.results.some(r=>r.status==='unrecognized-event-layout')){
   stopReason='source-structure-unresolved';break;
  }
 }
 return {dataKind:'d069-sequential-observation-report',schemaVersion:1,
  observedIds:completed,held,uncertainIds,unattemptedIds:unattempted,stopReason,
  publicationApproved:false};
}
module.exports={verifyDirectReview,describePending,planEventDrivenIntake,partitionBatches,runSequentialBatches};
