'use strict';
/*
 * Strict targeted GT-first editorial adjudication of the 30301 Checker-only
 * chain-looking hint row. Do NOT invent another event for a support hint.
 * The GameWith page and current GT page visibly disagree about this row.
 */
const E=require('../data/curation/adjudicated/30301_checker_hint_event_conflict.v1.json');
const fail=s=>{throw Error('SSR30301固定出典カード別裁定: '+s);};
function evaluate({entry,card,sourcePins,gtOnlySourceRow}){
 if(E.schemaVersion!==1||
    E.dataKind!=='phase2-card-30301-source-identity-editorial-resolution'||
    E.cardId!=='30301'||E.checkerOrdinal!==1||
    E.checkerSourceKey!=='checker:30301:3b1cb9d61ef50cb538c9'||
    E.fixedGameToraRevision!=='6e38b54af4fad397ff4491e63007a90705a4fe67'||
    E.fixedCheckerRevision!=='8cf9fcb3cc7239041161be75c84daf9f8f22d29f'||
    E.gameTora?.url!=='https://gametora.com/ja/umamusume/supports/30301-gran-alegria'||
    E.gameWith?.url!=='https://gamewith.jp/uma-musume/article/show/561921'||
    E.corroboratingPresentation?.url!=='https://game8.jp/umamusume/785657'||
    E.gameTora.supportsHintName!=='足任せ'||
    E.gameWith.listedSkill!=='足任せ'||
    E.gameWith.listedHintLevel!==4||
    E.gameWith.articleListsItUnderChains!==true||
    E.gameWith.articleOmitsGTMiddleChainStage!==true||
    E.gameTora.observedChainStages!==3||
    E.gameTora.observedRandomEvents!==2||
    E.gameTora.disputedSourceOrdinal!==4||
    E.gameTora.disputedSourceLocalEventId!==1294||
    E.gameTora.disputedSourcePlayerChoiceCount!==2||
    E.gameTora.lowerOptionSkillNumericId!==203352||
    E.gameTora.lowerOptionHintLevel!==1||
    E.corroboratingPresentation.reportedMiddleChain!=='勝利へのマイルストーン'||
    E.corroboratingPresentation.reportedMiddleHintName!=='ハイピッチ'||
    E.corroboratingPresentation.reportedMiddleHintLevel!==1||
    E.editorialDecision!=='KEEP_GAMETORA_THREE_CHAIN_EVENTS_NO_CHECKER_EXTRA'||
    E.checkerRowDecision!=='DO_NOT_ADD_AS_EVENT_SOURCE_PRESENTATION_CONFLICT'||
    E.independentProofOfExtraEvent!==false||
    E.publicationApproved!==false||
    E.sourceNarrativeOrChoiceProseIncluded!==false)
  fail('裁定根拠が固定のGT/GameWith相互矛盾・3段階事実と一致しません');
 if(sourcePins?.gameToraDerived!==E.fixedGameToraRevision||
    sourcePins?.checkerIndex!==E.fixedCheckerRevision||
    entry?.cardId!==E.cardId||
    entry.checkerOrdinal!==E.checkerOrdinal||
    entry.sourceKey!==E.checkerSourceKey||
    entry.triageCode!=='UNMATCHED_CHECKER_EVENT_IDENTITY')
  fail('固定ソースの正確なChecker位置と版が異なります');
 if(gtOnlySourceRow?.cardId!=='30301'||
    gtOnlySourceRow.sourceOrdinal!==4||
    gtOnlySourceRow.eventId!=='gt-30301-event-004'||
    !gtOnlySourceRow.crossSourceFlags?.includes('NON_R_GT_EVENT_NOT_PAIRED_IN_CHECKER'))
  fail('当該GT連続段階をChecker側の追加イベントと誤対応していませんか');
 if(!Array.isArray(card?.events)||card.events.length!==5||
    !Array.isArray(E.gameTora.eventNames)||E.gameTora.eventNames.length!==3)
  fail('30301の元GT3連続＋2通常イベントが未充足');
 const expected=['gt-30301-event-003','gt-30301-event-004','gt-30301-event-005'];
 const chain=card.events.filter(x=>expected.includes(x.id));
 if(chain.length!==3||chain.some((e,i)=>
    e.id!==expected[i]||e.name!==E.gameTora.eventNames[i]))
  fail('3連続段階のIDとGameTora側の正式なイベント名が一致しません');
 const mid=chain[1];
 if(mid.type!=='choice'||mid.choices?.length!==2||
    !Array.isArray(mid.choices[1].rewards)||
    !mid.choices[1].rewards.some(x=>x.skillId==='skill:203352'&&x.level===1))
  fail('GameTora側の別イベント「勝利へのマイルストーン」とハイピッチLv1が欠落');
 return {
  cardId:'30301',checkerOrdinal:1,
  sourceKey:E.checkerSourceKey,
  status:'EDITORIAL_ADJUDICATED_GT_FIRST_NO_ADDITIONAL_EVENT',
  checkerExtraSourceRowAdopted:false,
  originalGTChainStagesPreserved:3,
  originalGTRandomEventsPreserved:2,
  checkerExtraSkillHintAdded:false,
  sourceDisagreementRecorded:true,
  publicationApproved:false
 };
}
module.exports={evaluate};
