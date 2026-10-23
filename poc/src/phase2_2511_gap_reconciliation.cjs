'use strict';
/*
 * Reconcile pinned GT/Checker DIFFERENCES (65 positions) against the actual
 * 2511-event private catalog after reviewed missing-card and chain patches.
 *
 * Coverage by CARD is not an exact GT-to-Checker event identity match.
 * GT-only does not mean missing in GT. No reports authorize publication.
 */
const crypto=require('node:crypto');
const gap=require('../data/curation/adjudicated/30240_gamewith_gap.v1.json');
const fail=s=>{throw Error('Phase2全2511件と65出典差異の照合: '+s);};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const missing=['30318','30319','30320','30321'];
const gt=(id,n)=>'gt-'+id+'-event-'+String(n).padStart(3,'0');
function reconcile({triage,integrated},{strict=false}={}){
 if(triage?.dataKind!=='phase2-cross-source-publication-triage'||
    triage.publicReleaseApproved!==false||
    triage.sourceNarrativeOrChoiceProseIncluded!==false||
    !Array.isArray(triage.unmatchedCheckerRows)||!Array.isArray(triage.rows)||
    triage.summary?.approvedEvents!==0||
    integrated?.dataKind!=='phase2-2511-nonpublishing-gt-and-curated-chain-runtime'||
    integrated.publicationApproved!==false||
    integrated.reviewedEventsPublished!==0||
    integrated.noAutomaticRuntimeAdoption!==true||
    integrated.sourceNarrativeOrChoiceProseIncluded!==false||
    integrated.catalog?.schemaVersion!==1||
    !Array.isArray(integrated.catalog.cards)||
    integrated.summary?.catalogSha256!==hash(integrated.catalog))
  fail('未承認の固定出典監査・SHA付き非公開イベント全件が必要');
 const byCard=new Map();
 for(const card of integrated.catalog.cards){
  if(byCard.has(card.cardId)||!/^[0-9]{5}$/.test(card.cardId)||
     !Array.isArray(card.events))fail('カタログ内カードID不正・重複');
  const ids=new Set();
  for(const e of card.events){
   if(!e.id||ids.has(e.id))fail('イベントID重複');
   ids.add(e.id);
  }
  byCard.set(card.cardId,{ids,events:card.events});
 }
 let coveredAtCardScope=0,coveredOnGTCard=0,remainingCheckerOnGT=0;
 const checkerUnpaired=[],checkerIds=new Set(),gtOnlyKeys=new Set();
 const perMissing=new Map(missing.map(id=>[id,0]));
 for(const entry of triage.unmatchedCheckerRows){
  const {cardId,checkerOrdinal,sourceKey,triageCode}=entry;
  const key=JSON.stringify([cardId,checkerOrdinal]);
  if(checkerIds.has(key)||!Number.isInteger(checkerOrdinal)||
     checkerOrdinal<1||typeof sourceKey!=='string'||!sourceKey)
   fail('Checker側のカード／イベント位置が重複');
  checkerIds.add(key);
  if(triageCode==='SOURCE_CARD_NOT_IN_FIXED_GT'){
   if(!perMissing.has(cardId))fail('収録済みGT欠損4SSR以外を無断解決');
   perMissing.set(cardId,perMissing.get(cardId)+1);
   const c=byCard.get(cardId);
   // 2 originally absent random events + 3 originally absent chain stages.
   if(!c||!['4','5'].every(k=>c.ids.has('usl:'+cardId+':random:'+k))||
      ![1,2,3].every(i=>c.ids.has('usl:'+cardId+':chain:'+i)))
    fail('4SSRの通常2件＋連続3件が統合モデルにありません');
   coveredAtCardScope++;
  }else if(triageCode==='UNMATCHED_CHECKER_EVENT_IDENTITY'){
   const c=byCard.get(cardId);
   if(!c)fail('GT収録カードに対するChecker未対位置のカードが存在しない');
   if(cardId==='30221'){
    if(![1,2,3].every(i=>c.ids.has('usl:30221:chain:'+i))||
       checkerOrdinal<1)fail('30221の補完連続段階と元照合が不正');
    coveredOnGTCard++;
   }else{
    remainingCheckerOnGT++;
    checkerUnpaired.push({cardId,checkerOrdinal,sourceKey,
     priority:typeof entry.priority==='string'?entry.priority:null,
     status:'UNPAIRED_IDENTITY_NOT_PROVEN_MISSING',
     action:cardId==='20075'?'REVIEW_REPORTED_NO_SKILL_CHAIN_FIRST_STAGE':
      'CHECK_CARD_SCOPED_EVENT_IDENTITY_AND_SKILL_ROUTE'});
   }
  }else fail('未分類の出典差異を解決済みにしない');
 }
 if([...perMissing.values()].some(x=>x!==5)||
    coveredAtCardScope!==20||coveredOnGTCard!==3||
    remainingCheckerOnGT!==17||
    checkerIds.size!==triage.summary.unmatchedCheckerRows||
    triage.summary.checkerOnlyOnMissingGTCards!==20||
    triage.summary.checkerOnlyOnGTCards!==20)
  fail('Checker-only40件の補修母数不一致');
 let gtOnlyAlreadyPresent=0,gtChoiceFixed=0;
 for(const entry of triage.rows){
  if(!Array.isArray(entry.crossSourceFlags))fail('元GTの例外フラグ不正');
  for(const flag of entry.crossSourceFlags){
   if(flag==='NON_R_GT_EVENT_NOT_PAIRED_IN_CHECKER'){
    const id=gt(entry.cardId,entry.sourceOrdinal),c=byCard.get(entry.cardId);
    if(!c?.ids.has(id))fail('GT-only元位置が非公開カタログ内にない');
    const key=JSON.stringify([entry.cardId,entry.sourceOrdinal]);
    if(gtOnlyKeys.has(key))fail('GT-only元位置重複');
    gtOnlyKeys.add(key);gtOnlyAlreadyPresent++;
   }else if(flag==='FIXED_GT_PLAYER_CHOICE_TOPOLOGY_INCOMPLETE'){
    const c=byCard.get(entry.cardId);
    const x=c?.events.find(e=>e.id===entry.eventId);
    if(entry.cardId!=='30080'||entry.sourceOrdinal!==6||
       !x||x.type!=='choice'||x.choices?.length!==3||
       x.availabilityKind!=='special-trigger')
     fail('30080/6の3択補正が維持されていません');
    gtChoiceFixed++;
   }else fail('出典差異フラグが未分類: '+flag);
  }
 }
 if(gtOnlyAlreadyPresent!==24||gtChoiceFixed!==1||
    triage.summary.gtOnlyNonR!==24||
    triage.summary.sourceChoiceTopologyIncomplete!==1||
    triage.summary.missingBothPinnedGTAndCheckerChainStages!==3)
  fail('GT-only24・操作3択1・両固定元欠落3の照合母数が不一致');
 const c30240=byCard.get('30240');
 if(!c30240||c30240.events.length!==2||
    c30240.events.some(e=>e.id.startsWith('usl:30240:chain:')))
  fail('30240の両固定元欠落3段階を誤って採用');
 if(gap.cardId!=='30240'||gap.publicationApproved!==false||
    gap.noAutomaticRuntimeAdoption!==true||
    gap.gameWith?.factStatus!=='NOT_LISTED')
  fail('SSR30240の未掲載資料の採用状況が変化');
 const unmatchedByCard={};
 for(const x of checkerUnpaired)
  unmatchedByCard[x.cardId]=(unmatchedByCard[x.cardId]||0)+1;
 const sortedUnmatchedByCard=Object.fromEntries(
  Object.entries(unmatchedByCard).sort(([a],[b])=>a.localeCompare(b)));
 if(Object.values(sortedUnmatchedByCard).reduce((n,v)=>n+v,0)!==remainingCheckerOnGT)
  fail('イベント同定のカード別残件集計が不一致');
 const unresolvedBothSources=3;
 // GT-only 24 are already IN THE APP BASELINE. The 20 missing GT card
 // locations are covered at card scope, not necessarily exact paired IDs.
 const summary={
  fixedSourceExceptionPositions:65,
  checkerOnlyOriginal:40,gtOnlyNonROriginal:24,choiceTopologyOriginal:1,
  checkerMissingGTCardScopeCovered:coveredAtCardScope,
  checkerOnGTCardScopeCovered:coveredOnGTCard,
  gtOnlyAlreadyInBaseline:gtOnlyAlreadyPresent,
  sourceChoiceTopologyPatched:gtChoiceFixed,
  checkerOnGTCardIdentityUnpaired:remainingCheckerOnGT,
  checkerOnGTCardsNeedingIdentityAudit:Object.keys(sortedUnmatchedByCard).length,
  missingFromBothFixedSources:unresolvedBothSources,
  stillRequireIndividualInvestigation:remainingCheckerOnGT+unresolvedBothSources,
  confirmedNewMissingEventsFromThisAudit:0,
  publicationApprovedEvents:0
 };
 if(strict&&(integrated.summary.rosterCards!==563||
    integrated.summary.totalCandidateEvents!==2511||
    integrated.summary.appendedChainStages!==15||
    triage.summary.sourceEvents!==2488))
  fail('固定563カード2511イベントの全件保存則と一致しない');
 return {
  schemaVersion:1,dataKind:'phase2-2511-reconciled-65-source-positions',
  sourceNarrativeOrChoiceProseIncluded:false,publicationApproved:false,
  sourcePins:structuredClone(triage.sourcePins),
  summary,
  openQueue:[
   ...checkerUnpaired,
   {cardId:'30240',count:3,
    status:'MISSING_IN_BOTH_PINNED_SOURCES_UTOOLS_STAGE_AND_HINT_REPORTED',
    action:'GAMEWITH_CARD_EVENT_TABLE_NOT_REPORTED;DO_NOT_INFER_HINT_LEVEL_OR_RESULTS'}
  ],
  unpairedCheckerOnGTPositionsByCard:sortedUnmatchedByCard,
  coveredCheckerMissingGTCardCounts:Object.fromEntries(perMissing),
  coveredCheckerOnGTCardIds:['30221']
 };
}
module.exports={reconcile};
