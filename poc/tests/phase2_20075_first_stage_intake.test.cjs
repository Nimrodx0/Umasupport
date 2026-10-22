'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit}=require('../src/phase2_20075_first_stage_intake.cjs');
const source=require('../data/curation/adjudicated/20075_stage1.v1.json');
const copy=()=>structuredClone(source);
test('GameWith explicit +15/+15 is editorially adopted, but other unlabeled +5/+5 stays unresolved',()=>{
 const out=audit();
 assert.deepEqual(out.summary,{
  cardId:'20075',gameWithAdoptedNumericEffectFacts:2,
  observedUnlabeledNumericRows:2,independentCheckerOnlyPositions:1,
  selectableChoiceCountReportedByGameWith:0,
  verifiedOutcomeRoutes:0,verifiedChainTransitions:0,
  projectedRuntimeEvents:0,publishedEvents:0,
  publicationApproved:false,game2026Verified:false,
  noAutomaticRuntimeAdoption:true
 });
 assert.equal(out.policyDecision.status,'GAMEWITH_ADJUDICATED_GT_GAP');
 assert.equal(out.policyDecision.editorialDecisionComplete,true);
 assert.equal(out.policyDecision.publicationApproved,false);
});
test('do not invent success/failure, choice count, availability or external site consensus',()=>{
 for(const change of [
  x=>{x.cardId='20076';},
  x=>{x.fixedGameToraOnlyChainStageLocalId=415;},
  x=>{x.fixedGameToraChainStageCount=2;},
  x=>{x.checkerOnlySourceKey='checker:20075:other';},
  x=>{x.gameToraWebsite.status='EVENT_LIST';},
  x=>{x.gameWith.factStatus='NOT_LISTED';},
  x=>{x.gameWith.playerSelectableChoiceCount=2;},
  x=>{x.gameWith.reportedEffects[0].value=5;},
  x=>{x.otherOutcomeEvidence.unlabeledRewardRows[1][0].value=15;},
  x=>{x.otherOutcomeEvidence.successFailureLabelsVerified=true;},
  x=>{x.otherOutcomeEvidence.probabilityKnown=true;},
  x=>{x.exactRouteSemanticsVerified=true;},
  x=>{x.nextChainStageAvailabilityVerified=true;},
  x=>{x.game2026Verified=true;},
  x=>{x.publicationApproved=true;},
  x=>{x.sourceProseIncluded=true;},
  x=>{x.provisionalCatalog={events:[]};}
 ]){
  const d=copy();change(d);
  assert.throws(()=>audit(d),/SR20075連続初段階の数値裁定|イベント出典裁定規則/);
 }
});
test('nothing is emitted into public event or release catalogs',()=>{
 assert.deepEqual(require('../data/reviewed_events.v1.json').cards,[]);
 assert.deepEqual(require('../config/event-release-approvals.v1.json').entries,[]);
});
