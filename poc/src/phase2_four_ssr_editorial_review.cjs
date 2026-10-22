'use strict';
/*
 * Numerically bounded, non-publishing editorial review of four SSRs absent
 * from the PINNED GameTora JSON. 2026 GameTora live and editorial sites may
 * be newer; this module makes NO claim of an independently acquired GT JSON.
 *
 * GameWith underlies Checker; never treat them as independent witnesses.
 * Store ONLY card IDs, source positions, skill IDs, hint levels and links.
 */
const fail=s=>{throw Error('Phase2未収録4SSRのイベント別照合: '+s);};
const {evaluateException}=require('./event_exception_adjudication.cjs');
const GT='6e38b54af4fad397ff4491e63007a90705a4fe67';
const CHECKER='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const SKILLS='0cacbb1aaf9dca10283d5b9ea20b205b9d204535';
const as=(event,option,id,level)=>[event,option,id,level];
const REVIEW=Object.freeze([
 {cardId:'30318',optionRows:[2,2,1,2,2],
  eventShape:['SELECTION','SELECTION','NO_SELECTION','SELECTION','SELECTION'],
  hints:[as(3,1,201323,1),as(5,2,200152,1)],
  references:{gameTora:'https://gametora.com/ja/umamusume/supports/30318-rice-shower',
   gameWith:'https://gamewith.jp/uma-musume/article/show/578814',
   game8:'https://game8.jp/umamusume/818871'},
  liveGameToraEvidence:'EVENT_LIST_3_CHAIN_2_RANDOM'},
 {cardId:'30319',optionRows:[2,2,1,2,2],
  eventShape:['SELECTION','SELECTION','NO_SELECTION','SELECTION','EDITORIAL_TWO_CHOICES_CORROBORATED'],
  sharedEventEvidence:{checkerOrdinal:5,
   independentGameWithEvent:'https://gamewith.jp/uma-musume/article/show/289111',
   independentEditor:'https://game8.jp/umamusume/818831',
   playerChoiceCountReported:2,
   hintOnReportedChoiceOrdinal:2,
   hintSkillNumericId:201641,hintLevel:1},
  hints:[as(2,1,204412,1),as(3,1,202371,1),as(3,1,204151,2),as(5,2,201641,1)],
  references:{gameTora:'https://gametora.com/ja/umamusume/supports/30319-narita-brian',
   gameWith:'https://gamewith.jp/uma-musume/article/show/578819',
   game8:'https://game8.jp/umamusume/818831'},
  liveGameToraEvidence:'EVENT_LIST_3_CHAIN_2_RANDOM'},
 {cardId:'30320',optionRows:[2,2,1,2,2],
  eventShape:['SELECTION','SELECTION','NO_SELECTION','SELECTION','SELECTION'],
  hints:[as(2,1,201651,1),as(3,1,203801,2),as(3,1,204721,1),as(5,1,202082,1)],
  references:{gameTora:'https://gametora.com/ja/umamusume/supports/30320-admire-groove',
   gameWith:'https://gamewith.jp/uma-musume/article/show/578818',
   game8:'https://game8.jp/umamusume/818830'},
  liveGameToraEvidence:'CARD_DETAIL_METADATA_ONLY'},
 {cardId:'30321',optionRows:[2,1,1,2,2],
  eventShape:['SELECTION','GAMEWITH_ADJUDICATED_NO_SELECTION',
   'GAMEWITH_ADJUDICATED_NO_SELECTION','SELECTION','SELECTION'],
  gameWithAdjudications:[
   {checkerOrdinal:2,sourceRow:1,playerChoiceCountReported:0,
    reportedRewardFacts:[['mood',1],['power',10],['bond',5]],
    reportedHintFacts:[]},
   {checkerOrdinal:3,sourceRow:1,playerChoiceCountReported:0,
    reportedRewardFacts:[['power',15],['bond',5]],
    reportedHintFacts:[[201463,1]]}
  ],
  hints:[as(3,1,201463,1),as(5,2,202602,1)],
  references:{gameTora:'https://gametora.com/ja/umamusume/supports/30321-duramente',
   gameWith:'https://gamewith.jp/uma-musume/article/show/578817',
   game8:'https://game8.jp/umamusume/818829'},
  liveGameToraEvidence:'EVENT_LIST_3_CHAIN_2_RANDOM'}
]);
function review(candidate,{strict=true}={}){
 if(candidate?.schemaVersion!==1||
    candidate.dataKind!=='missing-gt-four-ssr-numeric-skill-candidate-backfill'||
    candidate.publicationApproved!==false||
    candidate.currentGameVerified!==false||
    candidate.noAutomaticRuntimeAdoption!==true||
    candidate.sourceProseIncluded!==false||
    candidate.sourcePins?.gameToraDerived!==GT||
    candidate.sourcePins?.checker!==CHECKER||
    candidate.sourcePins?.independentSkills!==SKILLS||
    !Array.isArray(candidate.cards))
  fail('固定の未承認数値候補の形と出典が不正');
 const byId=new Map();
 for(const c of candidate.cards){
  if(byId.has(c.cardId)||!REVIEW.some(r=>r.cardId===c.cardId))fail('想定外カードか重複カード');
  byId.set(c.cardId,c);
 }
 const totals={reviewedCards:0,reviewedCandidateEvents:0,reviewedSourceRows:0,
  checkedNumericHintMentions:0,editorialShapeAlignedEvents:0,
  editorialTwoChoiceCorroboratedEvents:0,
  gameWithAdjudicatedNoSelectionEvents:0,
  presentationUnresolvedEvents:0,reviewedChainPositionCandidates:0,
  reviewedRandomPositionCandidates:0,gameToraLiveEventListCards:0,
  gameToraLiveDetailMetadataOnlyCards:0,
  gameToraLiveRosterOnlyCards:0};
 const cards=[];
 for(const expected of REVIEW){
  const c=byId.get(expected.cardId);
  if(!c||c.rarity!=='SSR'||c.sourceCardMissing!==true||
     c.currentGameVerified!==false||c.publicationApproved!==false||
     !Array.isArray(c.events)||c.events.length!==5)
   fail('4SSRのカード・5イベント候補の構造が不正');
  totals.reviewedCards++;
  if(expected.liveGameToraEvidence==='EVENT_LIST_3_CHAIN_2_RANDOM')
   totals.gameToraLiveEventListCards++;
  else if(expected.liveGameToraEvidence==='CARD_DETAIL_METADATA_ONLY')
   totals.gameToraLiveDetailMetadataOnlyCards++;
  else totals.gameToraLiveRosterOnlyCards++;
  const hints=[];
  const events=c.events.map((e,i)=>{
   if(!e||e.checkerOrdinal!==i+1||
      !/^checker:\d+:[0-9a-f]{20}$/.test(e.sourceKey||'')||
      !/^sha256:[0-9a-f]{64}$/.test(e.sourceDigest||'')||
      !/^sha256:[0-9a-f]{64}$/.test(e.titleFingerprint||'')||
      e.checkerChoiceRows!==expected.optionRows[i]||
      e.orderingHypothesis!==(i<3?'CHAIN_STAGE_CANDIDATE':'RANDOM_EVENT_CANDIDATE')||
      e.sourceEffectAlternativesUnverified!==true||
      e.actualGameplaySelectionVerified!==false||
      e.currentGameVerified!==false||
      e.publicationApproved!==false||!Array.isArray(e.hintMentions))
    fail('Checker候補の行・指紋・連続位置が固定資料と一致しない '+expected.cardId+':'+(i+1));
   totals.reviewedCandidateEvents++;totals.reviewedSourceRows+=e.checkerChoiceRows;
   if(i<3)totals.reviewedChainPositionCandidates++;
   else totals.reviewedRandomPositionCandidates++;
   const shape=expected.eventShape[i];
   if(shape==='EDITORIAL_PRESENTATION_UNRESOLVED')totals.presentationUnresolvedEvents++;
   else totals.editorialShapeAlignedEvents++;
   if(shape==='EDITORIAL_TWO_CHOICES_CORROBORATED'){
    if(i+1!==expected.sharedEventEvidence?.checkerOrdinal||
       e.checkerChoiceRows!==expected.sharedEventEvidence.playerChoiceCountReported||
       !e.hintMentions.some(m=>
        m.checkerOptionOrdinal===expected.sharedEventEvidence.hintOnReportedChoiceOrdinal&&
        m.skillNumericId===expected.sharedEventEvidence.hintSkillNumericId&&
        m.hintLevel===expected.sharedEventEvidence.hintLevel))
     fail('30319通常イベントの限定的2択資料とヒント配置が不一致');
    totals.editorialTwoChoiceCorroboratedEvents++;
   }
   let gameWithNoSelection=null;
   if(shape==='GAMEWITH_ADJUDICATED_NO_SELECTION'){
    gameWithNoSelection=expected.gameWithAdjudications?.find(x=>
      x.checkerOrdinal===i+1);
    if(c.cardId!=='30321'||!gameWithNoSelection||
       expected.references.gameWith!==
         'https://gamewith.jp/uma-musume/article/show/578817'||
       gameWithNoSelection.sourceRow!==1||
       gameWithNoSelection.playerChoiceCountReported!==0||
       e.checkerChoiceRows!==1||
       (i===1?JSON.stringify(gameWithNoSelection.reportedRewardFacts)!==
         JSON.stringify([['mood',1],['power',10],['bond',5]]):
         i===2?JSON.stringify(gameWithNoSelection.reportedRewardFacts)!==
         JSON.stringify([['power',15],['bond',5]]):true)||
       JSON.stringify(gameWithNoSelection.reportedHintFacts)!==
         JSON.stringify(i===2?[[201463,1]]:[])||
       JSON.stringify(e.hintMentions.map(m=>
        [m.skillNumericId,m.hintLevel]))!==
         JSON.stringify(gameWithNoSelection.reportedHintFacts))
      fail('30321連続2・3のGameWith裁定とChecker数値候補に不一致');
    totals.gameWithAdjudicatedNoSelectionEvents++;
   }
   // The project's common decision engine forbids a second-editorial-source
   // or gameplay recheck as a prerequisite once GameWith supplies the fact.
   // Current live GT has an event list, but no pinned JSON for this card.
   const policyDecision=gameWithNoSelection?evaluateException({
    cardId:c.cardId,sourceEventOrdinal:i+1,baseline:'MISSING',
    gtWebsite:{url:expected.references.gameTora,
     checkedAt:'2026-10-22',status:'EVENT_LIST'},
    gameWith:{url:expected.references.gameWith,checkedAt:'2026-10-22',
     factStatus:'EXPLICIT',facts:{
      playerSelectableChoiceCount:gameWithNoSelection.playerChoiceCountReported,
      reportedEffects:gameWithNoSelection.reportedRewardFacts.map(
       ([kind,value])=>({kind,value})),
      reportedSkillHints:gameWithNoSelection.reportedHintFacts.map(
       ([skillNumericId,hintLevel])=>({skillNumericId,hintLevel}))
     }},
    proposedDecision:'ADOPT'
   }):null;
   if(policyDecision&&
      (policyDecision.status!=='GAMEWITH_ADJUDICATED_GT_GAP'||
       !policyDecision.editorialDecisionComplete||
       policyDecision.publicationApproved!==false))
    fail('GameWith例外採用を実ゲームの検証・公開と誤認');
   for(const m of e.hintMentions){
    if(!Number.isSafeInteger(m.checkerOptionOrdinal)||m.checkerOptionOrdinal<1||
       m.checkerOptionOrdinal>e.checkerChoiceRows||
       !Number.isSafeInteger(m.skillNumericId)||
       !Number.isSafeInteger(m.hintLevel)||
       m.rewardConditionVerified!==false||
       m.choiceIsPlayerSelectableVerified!==false)
     fail('ヒント位置／条件の未確認フラグが不正');
    hints.push([i+1,m.checkerOptionOrdinal,m.skillNumericId,m.hintLevel]);
    totals.checkedNumericHintMentions++;
   }
   return {checkerOrdinal:i+1,sourceKey:e.sourceKey,
    sourceDigest:e.sourceDigest,sourceTitleFingerprint:e.titleFingerprint,
    sourceEffectRows:e.checkerChoiceRows,
    sourceSectionHypothesis:i<3?'CHAIN_STAGE':'RANDOM',
    editorialPresentation:shape,
    ...(shape==='EDITORIAL_TWO_CHOICES_CORROBORATED'?{
      editorialTwoChoiceEvidence:{
       reportCount:expected.sharedEventEvidence.playerChoiceCountReported,
       referenceUrls:[expected.sharedEventEvidence.independentGameWithEvent,
        expected.sharedEventEvidence.independentEditor],
       sourceLabelAmbiguityResolvedForEditorialUse:true,
       evidenceIsIndependentGameplayVerification:false
      }
     }:{}),
    ...(gameWithNoSelection?{
      policyAdjudication:policyDecision,
      gameWithAdjudication:{
       status:'GAMEWITH_NO_SELECTION_AND_NUMERIC_REWARDS_ADOPTED',
       authority:'PROJECT_DESIGNATED_GAMEWITH_ADJUDICATOR',
       cardId:c.cardId,checkerOrdinal:i+1,
       sourceRow:gameWithNoSelection.sourceRow,
       sourceUrl:expected.references.gameWith,
       sourceArticleLastUpdated:'2026-10-12',
       decisionReviewedOn:'2026-10-22',
       playerChoiceCountReported:0,
       reportedSingleResult:true,
       reportedNumericEffects:gameWithNoSelection.reportedRewardFacts.map(
        ([kind,value])=>({kind,value})),
       reportedSkillHints:gameWithNoSelection.reportedHintFacts.map(
        ([skillNumericId,hintLevel])=>({skillNumericId,hintLevel,
          sourceRow:1})),
       editorialChoiceAndRewardFactsAdopted:true,
       actualCurrentGameTested:false,
       priorStageTerminationConditionVerified:false,
       publicationApproved:false,
       noAutomaticRuntimeAdoption:true
      }
     }:{}),
    actualChoiceSemanticsVerified:false,
    hintGrantConditionVerified:false,
    game2026Verified:false,publicationApproved:false};
  });
  const sorted=x=>[...x].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if(JSON.stringify(sorted(hints))!==JSON.stringify(sorted(expected.hints)))
   fail('スキル数値ID・Lv・出典イベントと行位置が独立記事の照合値と不一致: '+c.cardId);
  cards.push({cardId:c.cardId,liveGameToraCoverage:expected.liveGameToraEvidence,
    referenceUrls:expected.references,editorialSkillHintLocations:hints.length,
    events,game2026Verified:false,publicationApproved:false});
 }
 if(strict&&(totals.reviewedCards!==4||totals.reviewedCandidateEvents!==20||
    totals.reviewedSourceRows!==35||totals.checkedNumericHintMentions!==12||
    totals.editorialShapeAlignedEvents!==20||
    totals.editorialTwoChoiceCorroboratedEvents!==1||
    totals.gameWithAdjudicatedNoSelectionEvents!==2||
    totals.presentationUnresolvedEvents!==0||
    totals.reviewedChainPositionCandidates!==12||
    totals.reviewedRandomPositionCandidates!==8||
    totals.gameToraLiveEventListCards!==3||
    totals.gameToraLiveDetailMetadataOnlyCards!==1||
    totals.gameToraLiveRosterOnlyCards!==0))
  fail('カード・ヒント・選択肢の固定全件数が変化');
 return {schemaVersion:1,
  dataKind:'phase2-four-ssr-editorial-numeric-provisional-review',
  provenance:{gameToraOldSnapshot:GT,checker:CHECKER,skillMetadata:SKILLS},
  totals,cards,
  // Two editorial websites do not independently confirm game behavior.
  editorialChecksAreNotGameplayVerification:true,
  game2026Verified:false,allGameEventsVerified:false,
  selectionSemanticsVerified:false,sourceProseIncluded:false,
  publicationApproved:false,noAutomaticRuntimeAdoption:true};
}
module.exports={review,REVIEW};
