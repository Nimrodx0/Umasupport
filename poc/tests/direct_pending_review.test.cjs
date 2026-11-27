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
