'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {build,verify}=require('../src/checker_result_review_queue.cjs');
const db=require('../data/candidates/checker_event_hints.v1.json');
const source=require('../data/candidates/checker_explicit_result_facts.v1.json');
const queue=require('../data/candidates/checker_explicit_result_review_queue.v1.json');
test('entire committed result table and derived review queue match fixed numeric candidates',()=>{
 const s=verify(db,source,queue);
 a.equal(s.eventCandidates,2109);
 a.equal(Object.values(s.priorityTotals).reduce((x,y)=>x+y,0),2109);
 a.ok(s.priorityTotals.P0>0);
 a.equal(source.stats.choicePositions,3458);
 a.equal(source.stats.numericHintMentions,1406);
 a.equal(source.stats.unresolvedHintMentions,98);
 a.equal(source.stats.rangedHintChoices,4);
 a.equal(source.stats.explicitOutcomeChoices,203);
 a.equal(source.stats.observedTerminations,73);
});
test('no outcome-annotated row is falsely approved to grant skills',()=>{
 a.equal(source.forSkillGrant,false);
 a.ok(source.cards.every(c=>c.events.every(e=>
   e.chainRouteVerified===false&&e.choices.every(ch=>ch.routeReviewRequired===true))));
 a.ok(queue.rows.every(e=>e.requiresIndependentReview===true&&e.productionApproval===false));
});
test('edited source labels, hints, or incorrect queue priority trigger strict failure',()=>{
 const corrupted=JSON.parse(JSON.stringify(queue));corrupted.rows[0].priority='P2';
 a.throws(()=>verify(db,source,corrupted),/一致しません/);
 const changed=JSON.parse(JSON.stringify(source));changed.cards[0].events[0].choices[0].results[0].skillHints.push({skillId:'1',level:1});
 a.throws(()=>build(db,changed),/元候補のヒント/);
});
