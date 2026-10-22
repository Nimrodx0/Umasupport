'use strict';
/*
 * Phase 2: ALL 563 card coverage-risk triage across frozen source snapshots.
 *
 * This is a discovery queue, NOT an event inventory or a game verification.
 * Most zero-chain SSRs are friend/scenario/outing cards. One-stage SSRs also
 * genuinely exist, so neither zero nor one chain step proves missing events.
 * No third-party prose, artwork, automatic skill grants or release approvals.
 */
const fail=s=>{throw Error('Phase2独立網羅性: '+s);};
const PINS=Object.freeze({
 checker:'8cf9fcb3cc7239041161be75c84daf9f8f22d29f',
 gt:'6e38b54af4fad397ff4491e63007a90705a4fe67'
});
// Fixed GT numeric local ids and independent editorial corroboration.
// These source reports do NOT establish actual current-game correctness.
const FOCAL={
 '20075':{kind:'EDITORIAL_MISSING_FIRST_SR_STAGE',gtLastStageId:416,
  checkerMissingOrdinal:1,
  checkerMissingSourceKey:'checker:20075:8fd4b0e1da2eeb063087',
  checkerLastStageOrdinal:2,gtLastStageOrdinal:3,
  editorialChainStages:2,
  referenceUrls:['https://game8.jp/umamusume/600213'],
  numericRewardDisagreementUnresolved:true,
  sourceLastStageNumericSkillId:202462},
 '30221':{kind:'GT_CHAIN_STAGES_MISSING_CHECKER_HAS_THREE',
  editorialChainStages:3,
  referenceUrls:['https://game8.jp/umamusume/636307',
   'https://xn--gck1f423k.xn--1bvt37a.tools/supports/30221/event']},
 '30240':{kind:'THREE_CHAIN_STAGES_MISSING_BOTH_FIXED_SOURCES',
  editorialChainStages:3,
  referenceUrls:['https://xn--gck1f423k.xn--1bvt37a.tools/supports/30240/event']},
 '30244':{kind:'EDITORIAL_SINGLE_STAGE_INTENTIONAL',
  gtLastStageId:1143,
  referenceUrls:['https://game8.jp/umamusume/675743']},
 '30286':{kind:'EDITORIAL_SINGLE_STAGE_INTENTIONAL',
  gtLastStageId:1255,
  referenceUrls:['https://game8.jp/umamusume/758987']}
};
const TIER={SOURCE_MISSING:1,PLAIN_ZERO_CHAIN:0,
 SHORT_CHAIN:2,NONSTANDARD_ZERO_CHAIN:3,
 NORMAL_CHAIN_SHAPE:4,R_NOT_SUBJECT_TO_CHAIN:5};
function build(index,topology,numeric,exceptions,{strict=true}={}){
 if(index?.sourcePins?.checker!==PINS.checker||
    index.sourcePins.gameToraDerived!==PINS.gt||
    topology?.sourcePins?.checker!==PINS.checker||
    topology.sourcePins.gameToraDerived!==PINS.gt||
    numeric?.sourcePins?.gameToraDerived!==PINS.gt||
    numeric.sourcePins.checkerIndex!==PINS.checker||
    exceptions?.sourcePins?.checker!==PINS.checker||
    exceptions.sourcePins.gameToraDerived!==PINS.gt||
    index.gameVerified!==false||
    topology.gameVerified!==false||
    numeric.gameVerified!==false||
    exceptions.gameVerified!==false||
    exceptions.publicationApproved!==false||
    !Array.isArray(index.cards)||
    !Array.isArray(topology.cards)||
    !Array.isArray(numeric.cards)||
    !Array.isArray(exceptions.supplementalMissingGTChainReviews))
  fail('版固定ソース・公開状態または監査入力が不正');
 const tMap=new Map(topology.cards.map(x=>[x.cardId,x]));
 const nMap=new Map(numeric.cards.map(x=>[x.cardId,x]));
 const eMap=new Map(exceptions.supplementalMissingGTChainReviews.map(x=>[x.cardId,x]));
 if(index.cards.length!==tMap.size||index.cards.length!==nMap.size||
    new Set(index.cards.map(x=>x.cardId)).size!==index.cards.length||
    tMap.size!==topology.cards.length||nMap.size!==numeric.cards.length)
  fail('全カードIDの対応が一対一になっていません');
 const cards=[],counts={R_NOT_SUBJECT_TO_CHAIN:0,SOURCE_MISSING:0,
  PLAIN_ZERO_CHAIN:0,SHORT_CHAIN:0,NONSTANDARD_ZERO_CHAIN:0,
  NORMAL_CHAIN_SHAPE:0,
  editorialShortChainCorroborated:0,
  editorialMissingChainStageCandidates:0,
  editorialMissingStagesAlreadyCheckerOnly:0,
  editorialMissingStagesOutsideBothFixedSources:0,
  pendingShortChainCards:0,priorityReviewCards:0};
 for(const c of index.cards){
  const t=tMap.get(c.cardId),n=nMap.get(c.cardId);
  if(!t||!n||!Array.isArray(c.checkerOnly)||!Array.isArray(c.gameToraOnly)||
     !Array.isArray(c.pairs)||
     c.checkerOnly.length!==c.unmatchedCheckerCount||
     c.gameToraOnly.length!==c.unmatchedGameToraCount||
     c.sourceMissing!==t.sourceMissing||
     t.sourceEventCount!==c.gameToraObservedCount||
     n.sourceEventCount!==c.gameToraObservedCount||
     !['R','SR','SSR'].includes(c.rarity)||
     t.rarity!==c.rarity||
     (n.sourceChainCount||0)!==t.chainEventCount||
     (!c.sourceMissing&&
      n.sourceChainCount+n.sourceRandomCount+n.sourceOtherCount!==
      c.gameToraObservedCount))
    fail('カード区分・イベント数・連続構造の保存則違反: '+c.cardId);
  const ch=t.chainEventCount,ev=c.gameToraObservedCount,other=n.sourceOtherCount||0;
  let classification;
  if(c.rarity==='R')classification='R_NOT_SUBJECT_TO_CHAIN';
  else if(c.sourceMissing)classification='SOURCE_MISSING';
  else if(ch===0&&other>0)classification='NONSTANDARD_ZERO_CHAIN';
  else if(ch===0&&ev<=2&&other===0)classification='PLAIN_ZERO_CHAIN';
  else if((c.rarity==='SSR'&&ch>0&&ch<3)||
          (c.rarity==='SR'&&ch===1))classification='SHORT_CHAIN';
  else if((c.rarity==='SSR'&&ch===3)||(c.rarity==='SR'&&ch===2))
    classification='NORMAL_CHAIN_SHAPE';
  else fail('未分類のカード区分・連続段階数: '+c.cardId);
  const proof=FOCAL[c.cardId]||null;
  let reviewerStatus='SOURCE_PATTERN_ONLY',editorialExpectedChainStages=null,
   editorialShortfallStages=0,externalBothSourceGap=0,alreadyCheckerOnly=0;
  if(proof){
   if(c.rarity==='R')fail('Rに専用の連続証拠が入りました');
   if(proof.kind==='EDITORIAL_SINGLE_STAGE_INTENTIONAL'){
    if(classification!=='SHORT_CHAIN'||ch!==1||
       t.stages?.length!==1||
       t.stages[0].sourceLocalEventId!==proof.gtLastStageId)
      fail('単発SSRの根拠と固定元が不一致: '+c.cardId);
    reviewerStatus=proof.kind;
    counts.editorialShortChainCorroborated++;
   }else if(proof.kind==='EDITORIAL_MISSING_FIRST_SR_STAGE'){
    const gt=t.stages?.[0];
    if(c.rarity!=='SR'||classification!=='SHORT_CHAIN'||
       ch!==1||gt?.sourceLocalEventId!==proof.gtLastStageId||
       c.checkerObservedCount!==4||c.gameToraObservedCount!==3||
       c.checkerOnly.length!==1||
       c.checkerOnly[0].checkerOrdinal!==proof.checkerMissingOrdinal||
       c.checkerOnly[0].sourceKey!==proof.checkerMissingSourceKey||
       !c.pairs.some(p=>p.checkerOrdinal===proof.checkerLastStageOrdinal&&
        p.sourceOrdinal===proof.gtLastStageOrdinal&&
        p.sourceLocalEventId===proof.gtLastStageId))
      fail('SR初段階欠損の元データが変化: '+c.cardId);
    reviewerStatus=proof.kind;
    editorialExpectedChainStages=proof.editorialChainStages;
    alreadyCheckerOnly=1;
    editorialShortfallStages=1;
   }else if(proof.kind.startsWith('GT_CHAIN_')||
            proof.kind==='THREE_CHAIN_STAGES_MISSING_BOTH_FIXED_SOURCES'){
    const review=eMap.get(c.cardId);
    if(classification!=='PLAIN_ZERO_CHAIN'||ch!==0||other!==0||ev!==2||
       !review||
       review.reviewStatus!=='PINNED_GT_HAS_NO_CHAIN_STAGES'||
       review.expectedEditorialChainStages!==proof.editorialChainStages||
       review.fixedGTRecordedChainStages!==0||
       review.publicationApproved!==false||
       review.noAutomaticRuntimeAdoption!==true)
      fail('連続欠損の独立出典審査・固定元が変化: '+c.cardId);
    reviewerStatus=proof.kind;
    editorialExpectedChainStages=proof.editorialChainStages;
    editorialShortfallStages=proof.editorialChainStages;
    alreadyCheckerOnly=review.checkerRecordedChainStageRows;
    externalBothSourceGap=review.additionalIndependentExpectedEventsNotInNeitherPinnedSource;
    if(alreadyCheckerOnly+externalBothSourceGap!==editorialShortfallStages)
      fail('両出典の外にある段階数の保存則違反');
   }else fail('未対応の独立編集証拠');
   if(!Array.isArray(proof.referenceUrls)||!proof.referenceUrls.length)
    fail('独立編集証拠の出典なし');
  }
  counts[classification]++;
  counts.editorialMissingChainStageCandidates+=editorialShortfallStages;
  counts.editorialMissingStagesAlreadyCheckerOnly+=alreadyCheckerOnly;
  counts.editorialMissingStagesOutsideBothFixedSources+=externalBothSourceGap;
  if(classification==='SHORT_CHAIN'&&!proof)counts.pendingShortChainCards++;
  const tier=TIER[classification];
  const priority=(reviewerStatus==='EDITORIAL_MISSING_FIRST_SR_STAGE'||
   classification==='PLAIN_ZERO_CHAIN')?0:tier;
  if(priority<=2)counts.priorityReviewCards++;
  cards.push({cardId:c.cardId,rarity:c.rarity,
   gtObservedEventCount:ev,checkerObservedEventCount:c.checkerObservedCount,
   gtChainStageCount:ch,gtNonstandardSectionCount:other,
   gtNumericHintMentions:n.numericParsedHintMentions||0,
   unmatchedCheckerEvents:c.unmatchedCheckerCount,
   unmatchedGtEvents:c.unmatchedGameToraCount,
   classification,reviewPriority:priority,
   reviewerStatus,
   ...(proof?{editorialReferenceUrls:proof.referenceUrls}:{}),
   ...(editorialExpectedChainStages!==null?
    {editorialExpectedChainStages,editorialShortfallStages,
     alreadyCountedInCheckerOnly:alreadyCheckerOnly,
     absentBothFixedSources:externalBothSourceGap}:{}),
   ...(proof?.numericRewardDisagreementUnresolved?
    {numericRewardDisagreementUnresolved:true,
     gtLastStageNumericHintId:proof.sourceLastStageNumericSkillId}:{}),
   actualEventCompletenessVerified:false,
   game2026Verified:false,publicationApproved:false,
   noAutomaticRuntimeAdoption:true});
 }
 for(const id of Object.keys(FOCAL))
  if(!cards.some(c=>c.cardId===id))fail('審査したカードが母集団にない: '+id);
 const order=(a,b)=>a.reviewPriority-b.reviewPriority||
  // Skill impact signal is NOT a claim of unobserved reward.
  b.unmatchedCheckerEvents-a.unmatchedCheckerEvents||
  b.gtNumericHintMentions-a.gtNumericHintMentions||
  Number(a.cardId)-Number(b.cardId);
 cards.sort(order);
 if(strict&&(cards.length!==563||counts.R_NOT_SUBJECT_TO_CHAIN!==146||
    counts.SOURCE_MISSING!==4||counts.PLAIN_ZERO_CHAIN!==2||
    counts.NONSTANDARD_ZERO_CHAIN!==17||counts.SHORT_CHAIN!==7||
    counts.NORMAL_CHAIN_SHAPE!==387||
    counts.editorialShortChainCorroborated!==2||
    counts.pendingShortChainCards!==4||
    counts.editorialMissingChainStageCandidates!==7||
    counts.editorialMissingStagesAlreadyCheckerOnly!==4||
    counts.editorialMissingStagesOutsideBothFixedSources!==3||
    counts.priorityReviewCards!==13))
   fail('固定母集団の段階別集計が想定と異なります');
 return {schemaVersion:1,dataKind:'nonpublishing-cross-source-independent-event-coverage-triage',
  sourcePins:{...PINS},cardTotal:cards.length,summary:counts,
  auditScope:'ALL_FIXED_SUPPORT_CARDS',
  priorityIsNotEvidenceOfMissingEvents:true,
  scoreUsesObservedHintsOnlyNotPotentialMissingRewards:true,
  currentGameplayVerified:false,sourceIsNotAllCurrentEvents:true,
  publicationApproved:false,sourceProseIncluded:false,
  cards};
}
module.exports={build};
