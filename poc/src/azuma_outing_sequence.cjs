'use strict';
/*
 * SSR30323 outing progression: editorially supported order, not a public
 * event catalog and not proof of in-game choice-conditioned continuation.
 * The old GameTora derived snapshot does not contain this card.
 */
const {textContainsFingerprint}=require('./official_gametora_azuma_outing_evidence.cjs');
const {validateOutingUnlockEvidence}=require('./friend_outing_access_gate.cjs');
const fail=s=>{throw Error('吾妻の5段階お出かけ証拠: '+s);};
function validateSequenceLedger(ledger){
 if(ledger?.schemaVersion!==1||ledger.cardId!=='30323'||ledger.gender!=='male'||
  ledger.openingEventSiteOrdinal!==8||
  JSON.stringify(ledger.openingChoiceOrdinals)!=='[1,2]'||
  !Array.isArray(ledger.stages)||ledger.stages.length!==5||
  ledger.stages.some((s,i)=>s.stageOrdinal!==i+1||
   s.siteEventOrdinal!==i+2||s.siteChoiceGroups!==(i===2?2:1))||
  ledger.stageOrderEvidence!=='wiki-consecutive-outings-list-plus-game8-explicit-stage-five'||
  ledger.completionCriterion!=='five-outing-stages-completed'||
  ledger.endingBranches?.source!=='wiki-completed-versus-incomplete'||
  ledger.endingBranches.whenFiveCompleted!=='completed'||
  ledger.endingBranches.otherwise!=='incomplete'||
  !Array.isArray(ledger.endingTitles)||ledger.endingTitles.length!==2||
  ledger.endingTitles.some((t,i)=>t.gameWithListOrdinal!==i+1||
   t.meaningCandidate!==(i===0?'completed':'incomplete')||
   !Number.isSafeInteger(t.normalizedCodePointLength)||t.normalizedCodePointLength<1||
   !/^[a-f0-9]{64}$/.test(t.titleSha256))||
  ledger.endingLabelMappingEvidence!=='editorial-order-correspondence-not-unique-stage-effect-proof'||
  ledger.earlyTerminationByStageChoices!=='not-explicitly-specified'||
  ledger.gamePlayIndependentlyVerified!==false||
  ledger.textOrTitlesIncluded!==false||ledger.autoPublishAllowed!==false)
  fail('出典固定台帳に無根拠な後続または公開情報');
 return ledger;
}
function correlateSequenceEvidence(ledger,outingEvidence,siteEvents){
 validateSequenceLedger(ledger);
 if(outingEvidence?.cardId!=='30323'||
  outingEvidence.siteMatchingHeadingsUniqueAndDistinct!==true||
  outingEvidence.siteMatchingEventHeadings!==6||
  outingEvidence.editorialChoiceCountCorroborated!==6||
  outingEvidence.siteOutingHeadingsFormContiguousList!==true||
  outingEvidence.bothOriginalSiteChoiceGroupsExplicitlyUnlock!==true||
  !Array.isArray(outingEvidence.headingMatches)||outingEvidence.headingMatches.length!==6||
  outingEvidence.headingMatches.some((x,i)=>
   x.editorialOutingOrdinal!==i+1||
   x.matchedSiteEventOrdinal!==(i===0?8:i+1)||
   x.observedChoiceGroups!==(i===0?2:i===3?2:1))||
  !Array.isArray(siteEvents)||siteEvents.length!==12||
  siteEvents.some(e=>!e||typeof e.title!=='string'||e.title.length>2000||
   !Number.isSafeInteger(e.choiceGroups)||e.choiceGroups<0||e.choiceGroups>30))
  fail('直接画面と6見出しの根拠が不足');
 const endingMatches=ledger.endingTitles.map(t=>{
  const locations=siteEvents.flatMap((e,i)=>
   textContainsFingerprint(e.title,{length:t.normalizedCodePointLength,sha256:t.titleSha256})?[i+1]:[]);
  return {meaningCandidate:t.meaningCandidate,sourceEventOrdinal:locations.length===1?locations[0]:null,
   uniqueTitleMatch:locations.length===1,matchCount:locations.length};
 });
 const endLocations=endingMatches.map(x=>x.sourceEventOrdinal).filter(Number.isInteger);
 const twoDistinctEndings=endLocations.length===2&&new Set(endLocations).size===2;
 return {
  cardId:'30323',fixedGender:'male',
  openingEventSiteOrdinal:8,
  stageCount:5,
  stageSiteEventOrdinals:ledger.stages.map(x=>x.siteEventOrdinal),
  stageChoiceCounts:ledger.stages.map(x=>x.siteChoiceGroups),
  headingCountMatched:6,
  finalStageExplicitlyNumberedFiveInEditorialSource:true,
  orderedOutingSeriesEditoriallySupported:true,
  endingHeadings:endingMatches,
  endingTitlePositionsVerified:twoDistinctEndings,
  completeVsIncompleteEndingDistinctionEditoriallySupported:true,
  // Articles list endings in the same order but do not independently
  // demonstrate their exact in-game triggering condition per heading.
  endingTitleToCompletionBranchIndependentlyVerified:false,
  earlyStopChoiceRulesVerified:false,
  stageThreeChoicesBothContinueVerified:false,
  actualGamePlayVerified:false,
  publicationApproved:false,
  sourceTextIncluded:false
 };
}
function evaluateSequenceCandidate(ledger,opening,completedStages,selectedThirdStageChoice=null){
 validateSequenceLedger(ledger);
 validateOutingUnlockEvidence(opening);
 if(opening.cardId!=='30323'||opening.siteEventOrdinal!==8||
   JSON.stringify(opening.choiceOrdinals)!=='[1,2]')
  fail('解放イベントと進行候補が一致しない');
 if(!Array.isArray(completedStages)||completedStages.length>5||
  completedStages.some((n,i)=>n!==i+1)||
  selectedThirdStageChoice!==null&&![1,2].includes(selectedThirdStageChoice)||
  completedStages.length>=3&&selectedThirdStageChoice===null||
  completedStages.length<3&&selectedThirdStageChoice!==null)
  fail('進行済みのお出かけに飛び・重複・未確定の3段階目選択肢');
 const n=completedStages.length,complete=n===5;
 const next=n<5?ledger.stages[n].stageOrdinal:null;
 return {
  cardId:'30323',observedStageCompletionPrefix:completedStages.slice(),
  fiveStageEditorialSequence:true,
  outingSeriesState:complete?'five-stage-series-completed':
   n===0?'unstarted':'partially-completed',
  nextStageOrdinalCandidate:next,
  nextStageSiteEventOrdinal:next?ledger.stages[n].siteEventOrdinal:null,
  nextStageAccessStatus:complete?'no-additional-outing-stage-listed':
    n>=3?'conditional-choice-continuation-not-independently-verified':
    'requires-prior-stages-and-unlock',
  trainingEndBranchEditorialCandidate:complete?'completed':'incomplete',
  endingBranchPerTitleIndependentlyVerified:false,
  thirdStageChoiceContinuationProven:false,
  earlyTerminationStatus:'unverified',
  sourceHeadingIsNotProofOfGameTrigger:true,
  automaticRuntimeRequiresGenerated:false,
  terminalFlagGenerated:false,
  publicationApproved:false
 };
}
module.exports={validateSequenceLedger,correlateSequenceEvidence,evaluateSequenceCandidate};
