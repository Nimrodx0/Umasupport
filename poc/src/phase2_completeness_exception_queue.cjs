'use strict';
/*
 * Review-first discrepancy inventory. Two different sources can record
 * multiple outcomes as "choices": never infer missing game choices from count.
 * All contents are source positions / hashes only, not source prose.
 */
const fail=s=>{throw Error('Phase2完全性例外台帳: '+s);};
const gtRev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const checkerRev='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
// Fixed, narrowly scoped independent editorial source checks.
// Checker can itself derive from GameWith: this is NOT a third independent
// evidence family and never promotes in-game correctness or publication.
const editorialEvidence=[
 {cardId:'30006',sourceOrdinal:5,checkerOrdinal:3,
  checkerChoices:2,gameToraChoices:1,sourceSection:'arrows',
  sourceEvidenceKind:'TWO_RANDOM_OUTCOMES',expectedRows:2,
  sourceUrl:'https://gamewith.jp/uma-musume/article/show/257455',
  conclusion:'ONE_UNSELECTABLE_EVENT_WITH_TWO_RESULT_ROUTES'},
 {cardId:'30010',sourceOrdinal:5,checkerOrdinal:3,
  checkerChoices:2,gameToraChoices:1,sourceSection:'arrows',
  sourceEvidenceKind:'ONE_SKILL_HINT_OR_WITH_LEVEL_RANGE',expectedRows:2,
  sourceUrl:'https://gamewith.jp/uma-musume/article/show/257451',
  independentEditorialUrl:'https://game8.jp/umamusume/372306',
  conclusion:'NO_PLAYER_SELECTION_TWO_HINT_RESULT_FAMILIES'},
 {cardId:'30052',sourceOrdinal:2,checkerOrdinal:9,
  checkerChoices:2,gameToraChoices:1,sourceSection:'special',
  sourceEvidenceKind:'SCENARIO_CONTEXT_NOT_PLAYER_CHOICE',expectedRows:2,
  sourceUrl:'https://gamewith.jp/uma-musume/article/show/359859',
  independentEditorialUrl:'https://game8.jp/umamusume/473490',
  conclusion:'SCENARIO_CONTEXT_ROWS_NOT_PLAYER_CHOICES'},
 {cardId:'30108',sourceOrdinal:5,checkerOrdinal:3,
  checkerChoices:2,gameToraChoices:1,sourceSection:'arrows',
  sourceEvidenceKind:'FOUR_OUTCOMES_BY_PRIOR_STAGE',expectedRows:4,
  sourceUrl:'https://gamewith.jp/uma-musume/article/show/353830',
  conclusion:'CURRENT_STAGE_HAS_NO_CHOICES_PRIOR_STAGE_TWO_CHOICES'},
 {cardId:'30207',sourceOrdinal:2,checkerOrdinal:9,
  checkerChoices:3,gameToraChoices:1,sourceSection:'special',
  sourceEvidenceKind:'THREE_YEAR_CLASS_CONDITIONS',expectedRows:3,
  sourceUrl:'https://gamewith.jp/uma-musume/article/show/454997',
  conclusion:'YEAR_CLASS_CONDITIONS_NOT_USER_CHOICES'}
];
// Unlike the harmless presentation-only rows above, this position contains
// three independently documented PLAYER CHOICES that the pinned GT snapshot
// collapses into one non-selectable effect row. This cannot be adopted as-is.
const sourceChoiceGaps=[{
 cardId:'30080',sourceOrdinal:6,checkerOrdinal:5,
 checkerChoices:3,gameToraChoices:1,gameToraLocalEventId:1392,
 sourceSection:'special',hintSkillId:201591,hintValue:'+3',
 sourceUrl:'https://gamewith.jp/uma-musume/article/show/315701',
 independentEditorialUrl:'https://game8.jp/umamusume/421771',
 conclusion:'THREE_REAL_PLAYER_CHOICES_COLLAPSED_IN_FIXED_GT',
 // These are three separately selectable paths in the editorial reports,
 // not one source option with 3 random outcomes. Preserve positions only.
 editorialNumericChoices:[[1,201591,3],[2,201591,3],[3,201591,3]]
}];
// Three apparently missing Checker rows are NOT evidence for deleting GT choices.
// Independently rendered event pages show two selectable options for each.
// Freeze the GT choice/effect topology; never publish copied option wording.
const checkerPartialChoices=[
 {cardId:'30191',sourceOrdinal:1,checkerOrdinal:4,localEventId:179,
  effectKinds:[['mood','speed','bond'],['stamina','bond']],
  hints:[[],[]],
  references:['https://gamewith.jp/uma-musume/article/show/426313',
   'https://game8.jp/umamusume/577815']},
 {cardId:'30249',sourceOrdinal:1,checkerOrdinal:4,localEventId:231,
  effectKinds:[['power','bond'],['skill_hint','bond']],
  hints:[[],[[201682,'+1']]],
  references:['https://gamewith.jp/uma-musume/article/show/495653',
   'https://xn--gck1f423k.xn--1bvt37a.tools/supports/30249/event']},
 {cardId:'30255',sourceOrdinal:2,checkerOrdinal:5,localEventId:236,
  effectKinds:[['skill_points','bond'],['skill_hint','bond']],
  hints:[[],[[200602,'+1']]],
  references:['https://xn--gck1f423k.xn--1bvt37a.tools/supports/30255/event',
   'https://wikiwiki.jp/sppenpen/サポカ選択肢']}
];
function checkerPartialMatches(sourceEvent,paired,signature){
 if(sourceEvent?.id!==signature.localEventId||
    sourceEvent.section!=='random'||!Array.isArray(sourceEvent.choices)||
    sourceEvent.choices.length!==2||paired.sourceChoiceCount!==2||
    paired.checkerChoiceCount!==1) return false;
 const [a,b]=sourceEvent.choices;
 if(![a,b].every(c=>typeof c?.label==='string'&&c.label.trim().length>0&&
    c.random_either===false&&c.outcomes===undefined&&c.segments===undefined&&
    Array.isArray(c.effects))||a.label===b.label) return false;
 const types=sourceEvent.choices.map(c=>c.effects.map(e=>e.type));
 const hints=sourceEvent.choices.map(c=>c.effects.filter(e=>e.type==='skill_hint')
  .map(e=>[e.skill_id,e.value]));
 return JSON.stringify(types)===JSON.stringify(signature.effectKinds)&&
    JSON.stringify(hints)===JSON.stringify(signature.hints);
}
function makePrivateChoiceRepairDraft(signature, sourceEvent){
 // No text, probabilities, art, or unverified game behavior can be exported.
 const paths=signature.editorialNumericChoices;
 if(paths.length!==signature.checkerChoices||
    paths.some((entry,i)=>!Array.isArray(entry)||entry.length!==3||
      entry[0]!==i+1||entry[1]!==signature.hintSkillId||
      entry[2]!==3)||sourceEvent.choices.length!==1)
   fail('未承認3択の事実候補が固定資料と合わない');
 return {
  dataKind:'nonpublishing-conditional-choice-numeric-repair-draft',
  cardId:signature.cardId,sourceEventOrdinal:signature.sourceOrdinal,
  checkerEventOrdinal:signature.checkerOrdinal,
  gameToraSourceLocalEventId:signature.gameToraLocalEventId,
  sourceGameToraStoredChoiceCount:sourceEvent.choices.length,
  editorialSelectablePathCount:paths.length,
  choiceNumericCandidates:paths.map(([ordinal,skillNumericId,hintLevel])=>({
    sourceEditorialChoiceOrdinal:ordinal,skillNumericId,hintLevel,
    outcomeConditionVerified:false,game2026Verified:false,
    publicationApproved:false
  })),
  editorialProofUrls:[signature.sourceUrl,signature.independentEditorialUrl],
  sourceOptionTextIncluded:false,game2026Verified:false,
  exactGameSelectionWordingVerified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true
 };
}
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
  choiceCountConfirmedSourceGaps:0,choiceCountCheckerPartial:0,choiceCountPending:0,
  unresolvedItems:0,needsTargetedSourceReview:0
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
      event.sourceOrdinal>gt.length||
      (gt[event.sourceOrdinal-1]?.id||null)!==event.sourceLocalEventId||
      gt[event.sourceOrdinal-1]?.section!==event.section)
    fail('GameTora候補位置／ローカルID／セクションの整合不良');
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
      (g.id||null)!==paired.sourceLocalEventId||
      paired.checkerChoiceCount===paired.sourceChoiceCount)
    fail('同名イベントの選択肢数差分が固定ソースと不一致');
   const signature=editorialEvidence.find(x=>card.cardId===x.cardId&&
     paired.sourceOrdinal===x.sourceOrdinal&&
     paired.checkerOrdinal===x.checkerOrdinal);
   const illustrative=!!signature;
   const checkerPartial=checkerPartialChoices.find(x=>card.cardId===x.cardId&&
     paired.sourceOrdinal===x.sourceOrdinal&&
     paired.checkerOrdinal===x.checkerOrdinal);
   if(checkerPartial&&!checkerPartialMatches(g,paired,checkerPartial))
    fail('Checkerの掲載欠損として裁定した2択の固定GameTora構造が変更');
   const sourceGap=sourceChoiceGaps.find(x=>card.cardId===x.cardId&&
     paired.sourceOrdinal===x.sourceOrdinal&&
     paired.checkerOrdinal===x.checkerOrdinal);
   if([!!signature,!!sourceGap,!!checkerPartial].filter(Boolean).length>1)
    fail('相反する差異裁定が存在します');
   if(sourceGap){
    const first=g.choices[0];
    if(g.id!==sourceGap.gameToraLocalEventId||
       g.section!==sourceGap.sourceSection||
       g.choices.length!==sourceGap.gameToraChoices||
       paired.checkerChoiceCount!==sourceGap.checkerChoices||
       first?.label!==''||first.random_either!==false||
       first.outcomes!==undefined||!Array.isArray(first.effects)||
       first.effects.filter(e=>e.type==='skill_hint').length!==1||
       !first.effects.some(e=>e.type==='skill_hint'&&
         e.skill_id===sourceGap.hintSkillId&&e.value===sourceGap.hintValue))
      fail('3択欠落の固定GT形状が変化しました。再審査が必要');
   }
   if(illustrative){
    const first=g.choices[0];
    const common=g.section===signature.sourceSection&&
      g.choices.length===signature.gameToraChoices&&
      paired.checkerChoiceCount===signature.checkerChoices&&
      first?.label==='';
    const shape=signature.sourceEvidenceKind==='TWO_RANDOM_OUTCOMES'?
       first.random_either===true&&first.outcomes?.length===2:
      signature.sourceEvidenceKind==='ONE_SKILL_HINT_OR_WITH_LEVEL_RANGE'?
       g.id===500&&first.random_either===false&&first.outcomes===undefined&&
       Array.isArray(first.effects)&&
       first.effects.filter(e=>e.type==='skill_hint_or').length===1&&
       JSON.stringify(first.effects.find(e=>e.type==='skill_hint_or').options)===
       JSON.stringify([{skill_id:200581,value:'+1/+3'},
         {skill_id:200582,value:'+1'}]):
      signature.sourceEvidenceKind==='SCENARIO_CONTEXT_NOT_PLAYER_CHOICE'?
       g.id===1399&&first.random_either===true&&first.outcomes?.length===2:
      signature.sourceEvidenceKind==='FOUR_OUTCOMES_BY_PRIOR_STAGE'?
       first.random_either===true&&first.outcomes?.length===4&&
       gt[paired.sourceOrdinal-2]?.choices?.length===2:
      signature.sourceEvidenceKind==='THREE_YEAR_CLASS_CONDITIONS'?
       first.segments?.length===3&&first.segments.every((segment,i)=>
        segment.when?.length===1&&
        segment.when[0]?.kind==='scripted'&&
        segment.when[0]?.value?.[0]==='class'&&
        segment.when[0].value[1]===i+1):false;
    if(!common||!shape)
     fail('個別照合済みの選択肢／結果の基準条件が変化');
   }
   stats.choiceCountDisagreements++;
   if(illustrative)stats.choiceCountExplainedRepresentations++;
   else if(checkerPartial)stats.choiceCountCheckerPartial++;
   else if(sourceGap)stats.choiceCountConfirmedSourceGaps++;
   else stats.choiceCountPending++;
   add({cardId:card.cardId,rarity:card.rarity,type:'CHOICE_COUNT_DIFFERENCE',
    priority:illustrative||checkerPartial?'REVIEWED_REPRESENTATION':'P1',
    checkerOrdinal:paired.checkerOrdinal,sourceOrdinal:paired.sourceOrdinal,
    sourceLocalEventId:paired.sourceLocalEventId,
    checkerChoiceCount:paired.checkerChoiceCount,
    gameToraChoiceCount:paired.sourceChoiceCount,
    gameToraFirstChoiceOutcomeCount:g.choices[0]?.outcomes?.length||0,
    gameToraFirstChoiceConditionSegments:g.choices[0]?.segments?.length||0,
    gameToraFirstChoiceRandomEither:g.choices[0]?.random_either===true,
    status:illustrative?'SOURCE_REPRESENTATION_EXPLAINED':
      checkerPartial?'CHECKER_PARTIAL_CHOICE_ROWS':
      sourceGap?'FIXED_SOURCE_CHOICE_TOPOLOGY_INCOMPLETE':'NEEDS_TARGETED_REVIEW',
    ...(illustrative?{reviewEvidence:{
      url:signature.sourceUrl,reviewedOn:signature.reviewedOn,
      conclusion:signature.conclusion,
      gameToraEvidenceCategory:signature.sourceEvidenceKind,
      conditionalOrOutcomeRows:signature.expectedRows}}:{}),
    ...(checkerPartial?{checkerPartialEvidence:{
      referenceUrls:checkerPartial.references,
      sourceHasTwoSelectableChoices:true,checkerRecordedRows:1,
      sourceSkillHintRows:checkerPartial.hints,
      checkerRawTextRedistributed:false,game2026Verified:false}}:{}),
    ...(sourceGap?{sourceChoiceGapEvidence:{
      sourceUrl:sourceGap.sourceUrl,independentEditorialUrl:sourceGap.independentEditorialUrl,
      conclusion:sourceGap.conclusion,expectedPlayerChoiceCount:sourceGap.checkerChoices,
      missingSelectableChoicesRequireRepair:true,game2026Verified:false,
      privateNumericRepairDraft:makePrivateChoiceRepairDraft(sourceGap,g)}}:{}),
    gameWithEditorialCorroborated:illustrative||!!sourceGap,
    otherEditorialCorroborated:!!checkerPartial,
    sourceIndependentlyVerified:false,gameVerified:false,publicationApproved:false});
   if(illustrative)proof.push({cardId:card.cardId,sourceOrdinal:paired.sourceOrdinal,
     evidenceUrl:signature.sourceUrl});
   if(checkerPartial)proof.push({cardId:card.cardId,
     sourceOrdinal:paired.sourceOrdinal,
     evidenceUrl:checkerPartial.references[0],
     conclusion:'CHECKER_PARTIAL_CHOICE_ROWS'});
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
  stats.gameToraOnlyR+stats.gameToraOnlyNonR+
  stats.choiceCountConfirmedSourceGaps+stats.choiceCountPending;
 // R cards are not covered by Checker, so 395 GT-only R rows are
 // NOT 395 genuine source disagreements. Keep them as scope metadata.
 stats.needsTargetedSourceReview=stats.checkerOnlyEvents+
  stats.gameToraOnlyNonR+
  stats.choiceCountConfirmedSourceGaps+stats.choiceCountPending;
 if(strict&&(stats.rosterCards!==563||stats.gameToraCards!==559||
    stats.missingGameToraCards!==4||stats.checkerOnlyEvents!==55||
    stats.checkerOnlyOnMissingCards!==20||
    stats.checkerOnlyWithGameToraCard!==35||
    stats.checkerOnlyP0!==0||stats.gameToraOnlyR!==395||
    stats.gameToraOnlyNonR!==39||stats.choiceCountDisagreements!==9||
    stats.choiceCountExplainedRepresentations!==5||
    stats.choiceCountCheckerPartial!==3||
    stats.choiceCountConfirmedSourceGaps!==1||
    stats.choiceCountPending!==0||stats.unresolvedItems!==490||
    stats.needsTargetedSourceReview!==95))
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
