'use strict';
/*
 * 30240 only: U-tools card-specific numeric EVENT reports for three chain
 * stages absent from BOTH fixed GT JSON and fixed Checker Events source.
 * Nonpublishing, non-game-verified editorial evidence, NOT a game master.
 * Never infer selection from lack of listed labels, event probabilities,
 * success gates, adjacency, or a skill grant available to users.
 */
const crypto=require('node:crypto');
const fail=m=>{throw Error('Phase2 30240独立連続3段階の数値候補: '+m);};
const PIN=Object.freeze({
 gt:'6e38b54af4fad397ff4491e63007a90705a4fe67',
 checker:'8cf9fcb3cc7239041161be75c84daf9f8f22d29f',
 skills:'0cacbb1aaf9dca10283d5b9ea20b205b9d204535'
});
const FROZEN={
 cardId:'30240',externalSource:
  'https://xn--gck1f423k.xn--1bvt37a.tools/supports/30240/event',
 // U-tools is one independent publication family, not multiple witnesses.
 editorialSourceFamilies:1,
 fixedRandomEventIds:[167,168],
 fixedGTOrdinals:[1,2],
 independentNumericalStages:[
  {ordinal:1,statTypes:{stamina:15,bond:5},hint:[]},
  {ordinal:2,statTypes:{stamina:15,bond:5},hint:[]},
  {ordinal:3,statTypes:{stamina:15,bond:5},hint:[[200591,1]]}
 ],
 skillNameId:200591,skillNameHash:
  'sha256:8490265b0806092d9775891c357625c06c16846e0fdc81ae21554028915b482d',
 // Separate the GT's old random event hint from the missing chain hint.
 gtRandomSkillId:202422,gtRandomSkillLevel:1
};
const hashedName=x=>'sha256:'+crypto.createHash('sha256').update(
 String(x).normalize('NFKC').replace(/\s+/g,' ').trim()
).digest('hex');
function make(index,coverage,exceptions,numeric,independentSkills,{strict=true}={}){
 if(index?.sourcePins?.checker!==PIN.checker||
    index.sourcePins?.gameToraDerived!==PIN.gt||
    index.gameVerified!==false||index.publicationApproval!==false||
    index.rawSourceContentIncluded!==false||
    coverage?.sourcePins?.checker!==PIN.checker||
    coverage.sourcePins?.gt!==PIN.gt||
    coverage.currentGameplayVerified!==false||
    coverage.publicationApproved!==false||
    coverage.sourceProseIncluded!==false||
    exceptions?.sourcePins?.checker!==PIN.checker||
    exceptions.sourcePins?.gameToraDerived!==PIN.gt||
    exceptions.publicationApproved!==false||exceptions.gameVerified!==false||
    numeric?.sourcePins?.checkerIndex!==PIN.checker||
    numeric.sourcePins?.gameToraDerived!==PIN.gt||
    numeric.gameVerified!==false||numeric.releaseApproved!==false||
    !Array.isArray(index.cards)||!Array.isArray(coverage.cards)||
    !Array.isArray(exceptions.supplementalMissingGTChainReviews)||
    !Array.isArray(numeric.cards)||!Array.isArray(independentSkills))
   fail('版固定入力・未承認状態の形が不正');
 const indexRows=index.cards.filter(c=>c.cardId==='30240'),
  priorityRows=coverage.cards.filter(c=>c.cardId==='30240'),
  exceptionRows=exceptions.supplementalMissingGTChainReviews.filter(
   c=>c.cardId==='30240'),
  sourceRows=numeric.cards.filter(c=>c.cardId==='30240');
 if(indexRows.length!==1||priorityRows.length!==1||
    exceptionRows.length!==1||sourceRows.length!==1)
   fail('カードIDを一意に解決できない');
 const [ix]=indexRows,[p]=priorityRows,[e]=exceptionRows,[n]=sourceRows;
 if(ix.rarity!=='SSR'||ix.checkerMissing!==false||
    ix.sourceMissing!==false||ix.gameToraObservedCount!==2||
    ix.checkerObservedCount!==0||ix.unmatchedCheckerCount!==0||
    ix.unmatchedGameToraCount!==2||ix.pairs.length!==0||
    ix.checkerOnly.length!==0||ix.gameToraOnly.length!==2||
    ix.gameToraOnly.some((x,i)=>
     x.sourceOrdinal!==FROZEN.fixedGTOrdinals[i]||
     x.sourceLocalEventId!==FROZEN.fixedRandomEventIds[i]||
     x.section!=='random')||
    p.classification!=='PLAIN_ZERO_CHAIN'||
    p.reviewerStatus!=='THREE_CHAIN_STAGES_MISSING_BOTH_FIXED_SOURCES'||
    p.editorialExpectedChainStages!==3||p.editorialShortfallStages!==3||
    p.absentBothFixedSources!==3||p.alreadyCountedInCheckerOnly!==0||
    p.gtChainStageCount!==0||p.gtObservedEventCount!==2||
    p.checkerObservedEventCount!==0||
    p.game2026Verified!==false||p.publicationApproved!==false||
    p.noAutomaticRuntimeAdoption!==true||
    e.reviewStatus!=='PINNED_GT_HAS_NO_CHAIN_STAGES'||
    e.checkerRecordedChainStageRows!==0||
    e.fixedGTRecordedChainStages!==0||
    e.additionalIndependentExpectedEventsNotInNeitherPinnedSource!==3||
    e.noAutomaticRuntimeAdoption!==true||e.publicationApproved!==false||
    !e.referenceUrls.includes(FROZEN.externalSource)||
    n.sourceEventCount!==2||n.sourceChainCount!==0||
    n.sourceRandomCount!==2||n.sourceOtherCount!==0||
    n.events.length!==2||
    n.events.some((x,i)=>x.sourceOrdinal!==i+1||
     x.sourceLocalEventId!==FROZEN.fixedRandomEventIds[i]||
     x.section!=='random'||x.choices.length!==2)||
    n.numericParsedHintMentions!==1)
  fail('既存2通常イベントと両出典欠損の一意形状が変化');
 // Strictly protect source random skill ID and level. It is NOT the gold
 // skill reported for the *missing* chain third stage.
 const randomHints=n.events.flatMap(x=>x.choices.flatMap(c=>
   c.routes.flatMap(y=>y.numericHintFacts||[])));
 if(randomHints.length!==1||
    randomHints[0].skillNumericId!==String(FROZEN.gtRandomSkillId)||
    randomHints[0].level!==FROZEN.gtRandomSkillLevel||
    randomHints[0].numericFactParsed!==true)
  fail('固定GT通常イベントのヒント数値が変化');
 const skills=independentSkills.filter(x=>x.id===FROZEN.skillNameId);
 const prev=independentSkills.filter(x=>x.id===FROZEN.gtRandomSkillId);
 if(skills.length!==1||prev.length!==1||
    hashedName(skills[0].name)!==FROZEN.skillNameHash||
    skills[0].rarity!==2)
   fail('固定2026スキルIDと日本語名称ハッシュが変化');
 const stageRows=FROZEN.independentNumericalStages.map(s=>({
  editorialStageOrdinal:s.ordinal,
  sourceStageIsMissingFromBothFixedEventSources:true,
  reportedEffectTypes:['stamina','bond',...(s.hint.length?['skill_hint']:[])],
  reportedNumericEffects:[{kind:'stamina',value:s.statTypes.stamina},
   {kind:'bond',value:s.statTypes.bond}],
  reportedSkillHintCandidates:s.hint.map(([skillNumericId,hintLevel])=>({
   skillNumericId,hintLevel,
   conditionVerified:false,actualGrantVerified:false,
   game2026Verified:false,publicationApproved:false
  })),
  playerChoicesVerified:false,
  sourceShowsSelectableOptionLabels:false,
  gameOutcomeSemanticsVerified:false,
  chainStopOrPriorBranchVerified:false,
  stageOccurrenceProbabilityVerified:false,
  game2026Verified:false,publicationApproved:false
 }));
 const report={schemaVersion:1,
  dataKind:'nonpublishing-single-editorial-source-missing-chain-numeric-draft',
  cardId:FROZEN.cardId,rarity:'SSR',pins:{...PIN},
  evidenceUrl:FROZEN.externalSource,externalEditorialSourceFamilies:1,
  editorialPublishedChainStages:3,
  fixedGTChainStages:0,fixedCheckerChainStages:0,
  gtPinnedRandomEventIds:[...FROZEN.fixedRandomEventIds],
  sourceRandomSkillHintId:FROZEN.gtRandomSkillId,
  sourceRandomSkillHintLevel:FROZEN.gtRandomSkillLevel,
  externallyReportedFinalSkillId:FROZEN.skillNameId,
  externalFinalSkill2026DictionaryNameHash:FROZEN.skillNameHash,
  externalFinalSkillHintLevel:1,
  stageRows,
  thirdPartyEventTextIncluded:false,thirdPartySelectionTextIncluded:false,
  externalArticleDirectlyVerified:true,externalProvenanceFullyIndependent:false,
  actualGameplayEventCompletenessVerified:false,
  selectedChoiceTopologyVerified:false,
  actualSkillGrantVerified:false,
  game2026Verified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true};
 if(strict&&(report.editorialPublishedChainStages!==3||
   report.stageRows.length!==3||
   report.stageRows.flatMap(x=>x.reportedSkillHintCandidates).length!==1))
  fail('数値候補の限定件数に変化');
 return report;
}
module.exports={make,hashedName,FROZEN};
