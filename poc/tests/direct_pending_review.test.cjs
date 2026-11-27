'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {emptyLedger}=require('../src/derived_github_pending_ledger.cjs');
const {verifyDirectReview,describePending}=require('../src/direct_pending_review.cjs');
const review=require('../config/direct-event-pending-review.v1.json');
const row=cardId=>({cardId,status:'awaiting-source-json',sourceBlobSha:null,sourceCommit:null,sourceEvents:null,modeledEvents:null,excludedEvents:null,reviewItems:[],skillRegistryBlobSha:null});
test('D067 current view preserves historical rows; observed counts are not release counts',()=>{
 const ledger={...emptyLedger(),cards:['10149','30323','39999'].map(row)},before=JSON.stringify(ledger);
 const rows=describePending(ledger,review);
 a.deepEqual(rows.map(r=>[r.cardId,r.currentStatus,r.observedEvents]),[['10149','direct-review-held',11],['30323','direct-review-held',11],['39999','awaiting-direct-source-review',null]]);
 a.equal(JSON.stringify(ledger),before);
 a.equal(rows[0].historicalStatus,'awaiting-source-json');
 a.deepEqual(describePending({...ledger,cards:[row('39999')]},review).map(x=>x.cardId),['39999']);
 a.equal(ledger.publicationApproved,false);
});
test('metadata rejects text, unknown reasons, false publication, duplicate and invalid observations',()=>{
 a.doesNotThrow(()=>verifyDirectReview(review));
 for(const x of [{...review,publicationApproved:true},{...review,cards:[...review.cards,review.cards[0]]},...[
 {sourceText:'not allowed'},{reasonCodes:['invented prose']},{observedEvents:-1},{runId:0},{observedAt:'2026-02-30'}
 ].map(extra=>({...review,cards:[{...review.cards[0],...extra},review.cards[1]]}))])a.throws(()=>verifyDirectReview(x));
});

test('D069 plans bounded exact IDs, does not revisit held cards, and never authorizes a site visit',()=>{
 const {planEventDrivenIntake}=require('../src/direct_pending_review.cjs');
 const policy=require('../config/direct-event-intake-policy.v1.json');
 const previous={...emptyLedger(),cards:['10149','30323','39997'].map(row)};
 const next={...emptyLedger(),cards:['10149','30323','39997','39998','39999'].map(row)};
 const sourcePin={commit:'a'.repeat(40),cardBlob:'b'.repeat(40)};
 const input={previous,next,review,sourcePin,policy};
 const before=JSON.stringify(input);
 const result=planEventDrivenIntake(input);
 a.deepEqual(result.newlyQueuedIds,['39998','39999']);
 a.deepEqual(result.heldIds,['10149','30323']);
 a.deepEqual(result.nextBatchIds,['39997','39998']);
 a.deepEqual(result.remainingIds,['39999']);
 a.equal(result.status,'blocked-access-conditions');
 a.equal(result.siteAccessAuthorized,false);
 a.equal(result.publicationApproved,false);
 a.equal(JSON.stringify(input),before);
 // Repeated runs preserve the backlog without treating it as a new discovery.
 const repeat=planEventDrivenIntake({...input,previous:next});
 a.deepEqual(repeat.newlyQueuedIds,[]);
 a.deepEqual(repeat.nextBatchIds,result.nextBatchIds);
 const held=planEventDrivenIntake({...input,next:{...emptyLedger(),cards:['10149','30323'].map(row)}});
 a.equal(held.status,'no-eligible-cards');
 a.deepEqual(held.nextBatchIds,[]);
 const empty=planEventDrivenIntake({...input,next:emptyLedger()});
 a.equal(empty.status,'no-eligible-cards');
 a.deepEqual(empty.eligibleIds,[]);
 a.throws(()=>planEventDrivenIntake({...input,sourcePin:{...sourcePin,cardBlob:'latest'}}),/immutable/);
 a.throws(()=>planEventDrivenIntake({...input,policy:{...policy,automaticScheduledSiteAccessAllowed:true}}),/gate/);
 a.throws(()=>planEventDrivenIntake({...input,policy:{...policy,automaticPublicationAllowed:true}}),/gate/);
});
