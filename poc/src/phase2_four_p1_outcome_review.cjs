'use strict';
/* Checker P1 conditions are not automatically skill/flag gaps.
 * Only the specifically checked Group-support event has a card-scoped
 * GameWith adjudication; all other rows remain source-identity pending.
 * No source option prose or numeric unsupported rewards in output.
 */
const {validate}=require('./checker_candidate_database.cjs');
const fail=s=>{throw Error('Phase2 Checker P1条件結果監査: '+s);};
const TARGETS=[
 {cardId:'30067',ordinal:10,conditional:3,
  sourceUrl:'https://gamewith.jp/uma-musume/article/show/352660',
  cardUrl:'https://gametora.com/ja/umamusume/supports/30067-the-thrones-assemblage',
  editorialName:'鍛えよ共に(温かなメッセージ)',
  checkedFamily:'THREE_PLAYER_OPTIONS_EACH_WITH_SUCCESS_FAILURE_NONSKILL_REWARDS',
  stageType:'FRIEND_REPEATED_EVENT_NOT_CHAIN'},
 {cardId:'30081',ordinal:12,conditional:3},
 {cardId:'30137',ordinal:10,conditional:3},
 {cardId:'30160',ordinal:10,conditional:1}
];
function inspect({priority,checker},{strict=false}={}){
 if(priority?.dataKind!=='phase2-16-remaining-checker-skill-priority'||
    priority.publicationApproved!==false||
    priority.checkerCandidatesNotForSkillGrant!==true||
    priority.summary?.openCheckerPositions!==16||
    priority.summary?.P1!==4||
    !Array.isArray(priority.rows)||
    checker?.dataKind!=='support-event-hint-candidates'||
    checker.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||
    checker.forSkillGrant!==false||
    checker.sourcePins?.checker?.revision!==priority.sourcePins?.checkerIndex)
  fail('固定出典P1優先順位・未承認候補の整合性が不正');
 const verified=validate(checker);
 if(strict&&verified.events!==2109)fail('固定Checker全2109イベントの母集団が不一致');
 const rows=priority.rows.filter(x=>x.priority==='P1');
 if(rows.length!==4)fail('条件分岐未対4位置の母数が変化');
 const result=[];
 for(const target of TARGETS){
  const found=rows.find(x=>x.cardId===target.cardId&&
   x.checkerOrdinal===target.ordinal);
  const c=checker.cards.find(x=>x.cardId===target.cardId);
  const src=c?.events?.[target.ordinal-1];
  if(!found||!src||src.ordinal!==target.ordinal||
     src.sourceKey!==found.sourceKey||
     src.sourceDigest!==found.sourceDigest||
     found.publicationApproved!==false||
     found.missingActualEventVerified!==false||
     found.identityPairVerified!==false||
     found.manualResultReviewChoices!==target.conditional||
     found.unparsedHintChoices!==0||
     found.unresolvedNameOnlyHintMentions!==0||
     found.candidateNumericHintMentions!==0||
     found.candidateSkillIdsAlreadyInGTEventCatalog?.length!==0||
     found.candidateSkillIdsAbsentFromGTEventCatalog?.length!==0||
     !Array.isArray(src.choices)||
     src.choices.filter(x=>x.needsManualResultReview).length!==target.conditional||
     src.choices.some(x=>x.unparsedHintSyntax||x.observedHints?.length!==0))
   fail('条件付きソース位置・digest・数値ヒントの不在が不一致: '+target.cardId);
  const isEditorial=target.cardId==='30067';
  result.push({
   cardId:target.cardId,checkerOrdinal:target.ordinal,
   sourceKey:src.sourceKey,sourceDigest:src.sourceDigest,
   conditionalChoiceRows:target.conditional,
   numericSkillHintsInCheckerRow:0,
   skillGrantAdded:false,chainFlagChanged:false,
   eventIdentityPaired:false,
   status:isEditorial?'EDITORIAL_FACT_SKILL_NEUTRAL_CONDITIONAL_RESULTS':
    'CONDITIONAL_RESULTS_REQUIRE_CARD_SCOPED_EDITORIAL_REVIEW',
   ...(isEditorial?{specificFactAdopted:{
    eventName:target.editorialName,
    gameWithUrl:target.sourceUrl,
    gameToraUrl:target.cardUrl,
    resultFamily:target.checkedFamily,
    eventKind:target.stageType,
    allSuccessFailureRowsWithoutSkillHints:true,
    noExplicitChainTerminationInThisNonchainEvent:true
   }}:{}),
   publicationApproved:false
  });
 }
 if(result.length!==4||new Set(result.map(x=>x.sourceKey)).size!==4)
  fail('原文を持たない4位置の一意性が不正');
 return {
  dataKind:'phase2-checker-four-p1-conditional-review',
  publicationApproved:false,sourceNarrativeOrChoiceProseIncluded:false,
  sourcePins:{checkerRevision:checker.sourcePins.checker.revision},
  summary:{conditionalPositions:4,
   skillNeutralExplicitlyReviewed:1,
   individualEventIdentitiesStillUnpaired:4,
   remainingCardScopedResultReviews:3,
   numericSkillHintsInTheseRows:0,
   skillGrantsAdded:0,chainFlagsChanged:0},
  rows:result
 };
}
module.exports={inspect};
