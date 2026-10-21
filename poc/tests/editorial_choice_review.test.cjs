'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../data/candidates/checker_event_hints.v1.json');
const cls=require('../data/candidates/checker_route_classification.v1.json');
const stages=require('../data/candidates/checker_chain_stage_audit.v1.json');
const cross=require('../data/candidates/checker_first_pass_numeric_crosscheck.v1.json');
const base=require('../data/candidates/editorial_choice_review.v1.json');
const {verify}=require('../src/editorial_choice_review.cjs');
const clone=x=>structuredClone(x);
const run=review=>verify(db,cls,stages,cross,review);
test('3 source-backed event candidates, 6 choice positions, 11 numerical hint mentions and 2 guide discrepancies',()=>{
 assert.deepEqual(run(base),{
  reviewedEventKeys:3,reviewedChoicePositions:6,numericHintMentions:11,
  unresolvedNonSkillDiscrepancies:2,currentGameOutcomeTiersConfirmed:0,
  verifiedAcquisitionRoutes:0
 });
 assert.equal(base.records.every(x=>x.pageReferences.gameWith&&x.pageReferences.game8),true);
});
test('never upgrade editorial agreement to game reward, branching, or redistributable status',()=>{
 for(const mutate of [
  x=>x.approvalState='APPROVED',
  x=>x.forSkillGrant=true,
  x=>x.reviewGates.gameRewardClaimsApproved=1,
  x=>x.sourceCaveat.game8IndependentExtractionUnverified=false,
  x=>x.records[0].gameRewardVerified=true,
  x=>x.records[1].chainTerminationVerified=true,
  x=>x.records[2].publishedOutcomeTiersCompared=true,
  x=>x.records[0].observations[0].bothEditorialPagesListSameNumericHints=false
 ]){
  const d=clone(base);mutate(d);assert.throws(()=>run(d));
 }
});
test('cross-source numeric pairs and option ordinals are immutable and tied to source key',()=>{
 for(const mutate of [
  x=>x.records[0].sourceKey='checker:30256:'+'0'.repeat(20),
  x=>x.records[0].sourceDigest='sha256:'+'0'.repeat(64),
  x=>x.records[1].observations[0].choiceOrdinal=2,
  x=>x.records[2].observations[1].numericHints[0].level=4,
  x=>x.records[2].observations[0].numericHints[0].skillId='0',
  x=>x.records.push(x.records[2]),
  x=>x.records[0].observations[0].rawArticleText='copyright prose',
  x=>x.records[2].pageReferences.gameWith='https://malicious.test/example'
 ]){
  const d=clone(base);mutate(d);assert.throws(()=>run(d));
 }
});
test('known bond gauge conflict retains both publishers and GameWith exception adjudication value',()=>{
 const d=clone(base);
 d.records[0].nonSkillSourceDifferences[0].chosenProvisional=5;
 assert.throws(()=>run(d),/GameWith/);
 const a=clone(base);
 a.records[0].nonSkillSourceDifferences[0].game8=7;
 assert.throws(()=>run(a),/GameWith/);
 const b=clone(base);
 b.records[0].nonSkillSourceDifferences[0].quantity='gameplaySuccessChance';
 assert.throws(()=>run(b),/GameWith/);
});
