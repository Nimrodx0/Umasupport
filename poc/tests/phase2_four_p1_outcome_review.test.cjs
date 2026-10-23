'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../data/candidates/checker_event_hints.v1.json');
const {inspect}=require('../src/phase2_four_p1_outcome_review.cjs');
const target=[['30067',10,3],['30081',12,3],
 ['30137',10,3],['30160',10,1]];
function fixture(){
 const rows=target.map(([cardId,ordinal,conditional])=>{
  const event=db.cards.find(c=>c.cardId===cardId).events[ordinal-1];
  return {cardId,checkerOrdinal:ordinal,priority:'P1',
   sourceKey:event.sourceKey,sourceDigest:event.sourceDigest,
   manualResultReviewChoices:conditional,
   unparsedHintChoices:0,unresolvedNameOnlyHintMentions:0,
   candidateNumericHintMentions:0,
   candidateSkillIdsAlreadyInGTEventCatalog:[],
   candidateSkillIdsAbsentFromGTEventCatalog:[],
   publicationApproved:false,missingActualEventVerified:false,
   identityPairVerified:false};
 });
 return {priority:{dataKind:'phase2-16-remaining-checker-skill-priority',
  checkerCandidatesNotForSkillGrant:true,publicationApproved:false,
  sourcePins:{checkerIndex:db.sourcePins.checker.revision},
  summary:{openCheckerPositions:16,P1:4},
  rows},checker:db};
}
test('all four P1 conditional positions have no skill hints in the fixed candidate source',()=>{
 const x=inspect(fixture(),{strict:true});
 assert.equal(x.summary.conditionalPositions,4);
 assert.equal(x.summary.skillNeutralExplicitlyReviewed,1);
 assert.equal(x.summary.remainingCardScopedResultReviews,3);
 assert.equal(x.summary.individualEventIdentitiesStillUnpaired,4);
 assert.equal(x.summary.numericSkillHintsInTheseRows,0);
 assert.equal(x.summary.skillGrantsAdded,0);
 assert.equal(x.summary.chainFlagsChanged,0);
 assert.equal(x.rows.length,4);
 assert.deepEqual(x.rows.map(r=>[r.cardId,r.checkerOrdinal,r.conditionalChoiceRows]),target);
 assert.equal(x.rows[0].status,'EDITORIAL_FACT_SKILL_NEUTRAL_CONDITIONAL_RESULTS');
 assert.equal(x.rows[0].specificFactAdopted.eventName,'鍛えよ共に(温かなメッセージ)');
 assert.equal(x.rows[0].specificFactAdopted.allSuccessFailureRowsWithoutSkillHints,true);
 assert.ok(x.rows.slice(1).every(r=>r.specificFactAdopted===undefined));
 assert.ok(x.rows.every(r=>r.eventIdentityPaired===false&&
  r.publicationApproved===false&&!r.skillGrantAdded&&!r.chainFlagChanged));
});
test('exact candidate digest, source ordinal and result condition marker changes fail closed',()=>{
 const edits=[
  x=>{x.priority.rows[0].checkerOrdinal=9},
  x=>{x.priority.rows[1].sourceKey='checker:30081:fake'},
  x=>{x.priority.rows[2].sourceDigest='sha256:'+'0'.repeat(64)},
  x=>{x.priority.rows[3].manualResultReviewChoices=0},
  x=>{x.priority.rows[1].candidateNumericHintMentions=1},
  x=>{x.priority.rows[0].candidateSkillIdsAbsentFromGTEventCatalog=['200332']},
  x=>{x.priority.rows[0].identityPairVerified=true},
  x=>{x.priority.publicationApproved=true},
  x=>{x.priority.sourcePins.checkerIndex='a'.repeat(40)}
 ];
 for(const edit of edits){const f=fixture();edit(f);assert.throws(()=>inspect(f));}
});
test('published event and approval registries stay untouched',()=>{
 assert.deepEqual(require('../data/reviewed_events.v1.json'),{schemaVersion:1,cards:[]});
 assert.deepEqual(require('../config/event-release-approvals.v1.json'),{schemaVersion:1,entries:[]});
});
