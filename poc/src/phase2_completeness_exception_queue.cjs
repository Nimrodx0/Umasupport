'use strict';
/*
 * Review-first discrepancy inventory. Two different sources can record
 * multiple outcomes as "choices": never infer missing game choices from count.
 * All contents are source positions / hashes only, not source prose.
 */
const fail=s=>{throw Error('Phase2完全性例外台帳: '+s);};
const gtRev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const checkerRev='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const verifiedIllustration={
 cardId:'30006',sourceOrdinal:5,checkerOrdinal:3,
 checkerChoices:2,gameToraChoices:1,gameToraOutcomes:2,
 sourceSection:'arrows',
 sourceUrl:'https://gamewith.jp/uma-musume/article/show/257455',
 reviewedOn:'2026-10-22',
 reason:'independent article describes no selection and two alternative results'
};
function build(index,docs,{strict=true}={}){
 if(index?.schemaVersion!==1||
    index.dataKind!=='umasupport-whole-event-provisional-index'||
    index.sourcePins?.gameToraDerived!==gtRev||
    index.sourcePins?.checker!==checkerRev||
    index.gameVerified!==false||index.publicationApproval!==false||
    index.rawSourceContentIncluded!==false||
    !Array.isArray(index.cards)||!Array.isArray(docs)||
    !Array.isArray(index.attention?.choiceCountConflicts)||
    !Array.isArray(index.attention?.p0Unmatched))
  fail('固定出典・索引・未承認状態が不正');
 const source=new Map(), seenCards=new Set();
 for(const d of docs){
  if(d?.kind!=='support'||!Number.isSafeInteger(d.id)||
     source.has(String(d.id))||
     (!d.events_ja&&!d.events))fail('GameTora出典カードが不正');
  source.set(String(d.id),Object.values(d.events_ja&&Object.keys(d.events_ja).length?d.events_ja:d.events));
 }
 const p0=new Set(index.attention.p0Unmatched.map(x=>JSON.stringify([x.cardId,x.sourceKey,x.checkerOrdinal])));
 const queue=[],proof=[],stats={
  rosterCards:0,gameToraCards:0,missingGameToraCards:0,
  checkerOnlyEvents:0,checkerOnlyOnMissingCards:0,checkerOnlyWithGameToraCard:0,
  checkerOnlyP0:0,gameToraOnlyR:0,gameToraOnlyNonR:0,
  choiceCountDisagreements:0,choiceCountExplainedRepresentations:0,
  choiceCountPending:0,unresolvedItems:0
 };
 const keySet=new Set();
 function add(row){
  const key=JSON.stringify([row.type,row.cardId,row.checkerOrdinal||0,row.sourceOrdinal||0]);
  if(keySet.has(key))fail('例外の一意性が壊れています '+key);
  keySet.add(key);queue.push(row);
 }
 for(const card of index.cards){
  if(!/^[1-9]\d*$/.test(card.cardId||'')||seenCards.has(card.cardId)||
     !['R','SR','SSR'].includes(card.rarity)||
     !Array.isArray(card.checkerOnly)||!Array.isArray(card.gameToraOnly)||
     !Array.isArray(card.pairs))
   fail('カードID重複・候補形式異常');
  seenCards.add(card.cardId);stats.rosterCards++;
  const gt=source.get(card.cardId);
  if((!gt)!==card.sourceMissing||card.gameToraObservedCount!==(gt?.length||0)||
     card.checkerOnly.length!==card.unmatchedCheckerCount||
     card.gameToraOnly.length!==card.unmatchedGameToraCount)
   fail('GameTora固定版とのカード枚数・欠落状態の差異');
  if(gt)stats.gameToraCards++;else stats.missingGameToraCards++;
  for(const event of card.checkerOnly){
   if(typeof event.sourceKey!=='string'||
      !Number.isSafeInteger(event.checkerOrdinal)||event.checkerOrdinal<1)
    fail('Checker候補の一意位置が不正');
   stats.checkerOnlyEvents++;
   const missing=!gt, isP0=p0.has(JSON.stringify([card.cardId,event.sourceKey,event.checkerOrdinal]));
   if(missing)stats.checkerOnlyOnMissingCards++;else stats.checkerOnlyWithGameToraCard++;
   if(isP0)stats.checkerOnlyP0++;
   add({cardId:card.cardId,rarity:card.rarity,type:'CHECKER_ONLY',
    priority:isP0?'P0':missing?'P1':'P2',
    reason:missing?'NO_GAMETORA_CARD':'EVENT_IDENTITY_NOT_PAIRED',
    checkerOrdinal:event.checkerOrdinal,sourceKey:event.sourceKey,
    highPriorityNumericalCandidate:isP0,
    sourceIndependentlyVerified:false,gameVerified:false,publicationApproved:false});
  }
  for(const event of card.gameToraOnly){
   if(!gt||!Number.isSafeInteger(event.sourceOrdinal)||event.sourceOrdinal<1||
      event.sourceOrdinal>gt.length)fail('GameTora候補位置の整合不良');
   if(card.rarity==='R')stats.gameToraOnlyR++;else stats.gameToraOnlyNonR++;
   add({cardId:card.cardId,rarity:card.rarity,type:'GAMETORA_ONLY',
    priority:card.rarity==='R'?'P3':'P2',
    reason:card.rarity==='R'?'CHECKER_R_COVERAGE_ABSENT':'EVENT_IDENTITY_NOT_PAIRED',
    sourceOrdinal:event.sourceOrdinal,sourceLocalEventId:event.sourceLocalEventId,
    section:event.section,sourceChainOrdinal:event.sourceChainOrdinal,
    sourceIndependentlyVerified:false,gameVerified:false,publicationApproved:false});
  }
  for(const paired of card.pairs){
   if(paired.choiceCountAgreement)continue;
   const g=gt?.[paired.sourceOrdinal-1];
   if(!g||!Array.isArray(g.choices)||g.choices.length!==paired.sourceChoiceCount||
      paired.checkerChoiceCount===paired.sourceChoiceCount)
    fail('同名イベントの選択肢数差分が固定ソースと不一致');
   const signature=verifiedIllustration;
   const illustrative=card.cardId===signature.cardId&&
     paired.sourceOrdinal===signature.sourceOrdinal&&
     paired.checkerOrdinal===signature.checkerOrdinal&&
     paired.checkerChoiceCount===signature.checkerChoices&&
     paired.sourceChoiceCount===signature.gameToraChoices;
   if(illustrative && !(g.section===signature.sourceSection&&
      g.choices.length===1&&g.choices[0]?.label===''&&
      g.choices[0].random_either===true&&
      g.choices[0].outcomes?.length===signature.gameToraOutcomes))
    fail('承認済み選択肢と結果の区別の基準データが変化');
   stats.choiceCountDisagreements++;
   if(illustrative)stats.choiceCountExplainedRepresentations++;
   else stats.choiceCountPending++;
   add({cardId:card.cardId,rarity:card.rarity,type:'CHOICE_COUNT_DIFFERENCE',
    priority:illustrative?'REVIEWED_REPRESENTATION':'P1',
    checkerOrdinal:paired.checkerOrdinal,sourceOrdinal:paired.sourceOrdinal,
    sourceLocalEventId:paired.sourceLocalEventId,
    checkerChoiceCount:paired.checkerChoiceCount,
    gameToraChoiceCount:paired.sourceChoiceCount,
    gameToraFirstChoiceOutcomeCount:g.choices[0]?.outcomes?.length||0,
    gameToraFirstChoiceConditionSegments:g.choices[0]?.segments?.length||0,
    gameToraFirstChoiceRandomEither:g.choices[0]?.random_either===true,
    status:illustrative?'SOURCE_REPRESENTATION_EXPLAINED':'NEEDS_TARGETED_REVIEW',
    ...(illustrative?{reviewEvidence:{
      url:signature.sourceUrl,reviewedOn:signature.reviewedOn,
      conclusion:'ONE_UNSELECTABLE_EVENT_WITH_TWO_RESULT_ROUTES',
      gameToraResultRoutes:signature.gameToraOutcomes}}:{}),
    sourceIndependentlyVerified:illustrative,
    gameVerified:false,publicationApproved:false});
   if(illustrative)proof.push({cardId:card.cardId,sourceOrdinal:paired.sourceOrdinal,
     evidenceUrl:signature.sourceUrl});
  }
 }
 const expected=index.stats;
 if(stats.rosterCards!==expected.rosterCards||stats.gameToraCards!==expected.gameToraCards||
    stats.checkerOnlyEvents!==expected.checkerUnmatchedEvents||
    stats.gameToraOnlyR+stats.gameToraOnlyNonR!==expected.gameToraUnmatchedEvents||
    stats.choiceCountDisagreements!==expected.pairedChoiceCountConflict||
    stats.checkerOnlyP0!==index.attention.p0Unmatched.length)
  fail('固定元照合件数の保存則違反');
 stats.unresolvedItems=stats.checkerOnlyEvents+
  stats.gameToraOnlyR+stats.gameToraOnlyNonR+stats.choiceCountPending;
 if(strict&&(stats.rosterCards!==563||stats.gameToraCards!==559||
    stats.missingGameToraCards!==4||stats.checkerOnlyEvents!==70||
    stats.checkerOnlyOnMissingCards!==20||
    stats.checkerOnlyWithGameToraCard!==50||
    stats.checkerOnlyP0!==2||stats.gameToraOnlyR!==395||
    stats.gameToraOnlyNonR!==54||stats.choiceCountDisagreements!==9||
    stats.choiceCountExplainedRepresentations!==1||
    stats.choiceCountPending!==8||stats.unresolvedItems!==527))
  fail('固定全件母集団が変更されました。新しい版として調査が必要');
 queue.sort((a,b)=>({P0:0,P1:1,P2:2,P3:3,REVIEWED_REPRESENTATION:4}[a.priority]-
  {P0:0,P1:1,P2:2,P3:3,REVIEWED_REPRESENTATION:4}[b.priority])||
  Number(a.cardId)-Number(b.cardId)||
  (a.checkerOrdinal||a.sourceOrdinal)-(b.checkerOrdinal||b.sourceOrdinal));
 return {schemaVersion:1,dataKind:'phase2-fixed-source-completeness-exceptions',
  sourcePins:{gameToraDerived:gtRev,checker:checkerRev},
  sourceDocumentsNotRedistributed:true,gameVerified:false,
  allEventsComplete:false,publicationApproved:false,
  stats,reviewedRepresentationExamples:proof,queue};
}
module.exports={build};
