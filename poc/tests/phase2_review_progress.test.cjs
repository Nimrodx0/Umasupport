'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {build,query}=require('../src/phase2_review_progress.cjs');
const args={
 queue:require('../data/candidates/checker_explicit_result_review_queue.v1.json'),
 index:require('../data/candidates/event_coverage_index.v1.json'),
 candidate:require('../data/candidates/checker_event_hints.v1.json'),
 facts:require('../data/candidates/checker_explicit_result_facts.v1.json'),
 audit:require('../data/candidates/editorial_branch_crosscheck.v1.json')
};
test('563-card ledger preserves 2109 candidate events and only four reviewed transitions',()=>{
 const x=build(args);
 a.equal(x.totals.populationCards,563);
 a.equal(x.totals.candidateCards,417);
 a.equal(x.totals.candidates,2109);
 a.equal(x.totals.publisherCorroborated,4);
 a.equal(x.totals.corroboratedTransitions,10);
 a.equal(x.totals.recordedAwardChecks,8);
 a.equal(x.totals.openPublisherDisagreements,2);
 a.ok(x.rows.every(r=>!r.routeVerifiedInGame&&!r.approvedForProduction));
 a.equal(x.cards.reduce((n,c)=>n+c.candidateEvents,0),2109);
});
test('a corroborated event is not equal to verified 2026 game or publishable event',()=>{
 const x=build(args),review=query(x,{status:'publisher-corroborated'});
 a.equal(review.total,4);
 a.ok(review.rows.every(e=>!e.routeVerifiedInGame&&!e.approvedForProduction));
 a.ok(x.cards.some(c=>c.cardId==='30026'&&c.corroboratedEvents===2));
 a.equal(query(x,{cardId:'10001'}).total,0);
});
test('corrupt publisher audit cannot elevate unreviewed evidence',()=>{
 const mutated=structuredClone(args.audit);
 mutated.publicationApproval=true;
 a.throws(()=>build({...args,audit:mutated}),/未承認/);
 const mismatch=structuredClone(args.audit);
 mismatch.cards[0].transitionStages[0].branches.pop();
 a.throws(()=>build({...args,audit:mismatch}),/網羅/);
});
