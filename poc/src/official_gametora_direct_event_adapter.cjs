'use strict';
/*
 * Generic, source-neutral interim adapter for bounded GameTora-rendered event
 * facts. It deliberately does NOT output a public_event_catalog schema.
 *
 * No heading, choice label, HTML, or copyrighted prose enters this API.
 * Never infer event type (auto/choice), chain order, game probabilities,
 * direct skill acquisition, or empty rewards from visual DOM grouping.
 */
const {summarizeCandidateRouteHints}=require('./official_gametora_new_card_route_hints.cjs');
const fail=s=>{throw Error('GameTora本体の共通イベント候補変換: '+s);};
const keysOnly=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).every(key=>allowed.includes(key));
const positive=x=>Number.isSafeInteger(x)&&x>0;
function validateRenderedEvent(event){
 if(!keysOnly(event,['siteEventOrdinal','visibleOrSeparatorCount','globalHints','routes'])||
  !positive(event.siteEventOrdinal)||event.siteEventOrdinal>30||
  !Number.isSafeInteger(event.visibleOrSeparatorCount)||
  event.visibleOrSeparatorCount<0||event.visibleOrSeparatorCount>30||
  !Array.isArray(event.globalHints)||event.globalHints.length>60||
  !Array.isArray(event.routes)||event.routes.length>40)
  fail('元サイトのイベント母数と観測形状が不正');
 const pair=x=>keysOnly(x,['status','numericId','rarity','level'])&&
  typeof x.status==='string'&&x.status.length<=80&&
  (x.numericId===undefined||typeof x.numericId==='string')&&
  (x.level===null||x.level===undefined||Number.isSafeInteger(x.level));
 if(!event.globalHints.every(pair)||event.routes.some(r=>
   !keysOnly(r,['choiceOrdinal','outcomeOrdinal','unresolvedOr','hints'])||
   !positive(r.choiceOrdinal)||r.choiceOrdinal>30||
   !positive(r.outcomeOrdinal)||r.outcomeOrdinal>30||
   typeof r.unresolvedOr!=='boolean'||
   !Array.isArray(r.hints)||r.hints.length>60||!r.hints.every(pair)))
  fail('経路と数値スキル候補の構造が不正');
 const ordinals=new Map();
 for(const r of event.routes){
  let outcomes=ordinals.get(r.choiceOrdinal);
  if(!outcomes)ordinals.set(r.choiceOrdinal,outcomes=new Set());
  if(outcomes.has(r.outcomeOrdinal))fail('経路の座標が重複');
  outcomes.add(r.outcomeOrdinal);
 }
 const choices=[...ordinals.keys()].sort((a,b)=>a-b);
 if(choices.some((v,i)=>v!==i+1))fail('選択肢候補に欠番がある');
 let splitChoices=0;
 for(const set of ordinals.values()){
  const ids=[...set].sort((a,b)=>a-b);
  if(ids.some((v,i)=>v!==i+1))fail('結果候補に欠番がある');
  if(ids.length>1)splitChoices++;
 }
 if(splitChoices!==event.visibleOrSeparatorCount)
  fail('画面上のOR区切り数と結果候補分割数が異なる');
 return {choices:choices.length,splitChoices};
}
function normalizeLiveEventObservation(event){
 const {choices:choiceCount,splitChoices}=validateRenderedEvent(event);
 // The independent whole-panel vs route-local ID+Lv multiset cross-check.
 const check=summarizeCandidateRouteHints([{globalHints:event.globalHints,
   routes:event.routes}]);
 const paired=choiceCount>0&&check.allCandidateHintIdLevelPairsAssigned&&
  check.missingNormalizedPairs===0&&check.extraNormalizedPairs===0;
 const groups=[];
 for(let c=1;c<=choiceCount;c++){
  const routes=event.routes.filter(x=>x.choiceOrdinal===c).sort((a,b)=>a.outcomeOrdinal-b.outcomeOrdinal);
  groups.push({
   sourceChoiceOrdinal:c,
   choiceLabelStatus:'male-source-not-provided',
   visualGroupRole:'choice-or-auto-not-adjudicated',
   alternatives:routes.map(route=>({
    sourceOutcomeOrdinal:route.outcomeOrdinal,
    origin:'rendered-group',
    skillHintCandidates:route.hints.flatMap(x=>x.status==='unique-verified-name'&&
     /^\d+$/.test(x.numericId)&&positive(x.level)&&x.level<=10?
     [{numericSkillId:x.numericId,hintLevel:x.level}]:[]),
    unknownHintCandidateCount:route.hints.filter(x=>x.status!=='unique-verified-name'||
      !/^\d+$/.test(String(x.numericId||''))||!positive(x.level)||x.level>10).length,
    resultLabelStatus:'unverified',
    terminalStatus:'unverified',
    nonSkillEffectsStatus:'not-ingested'
   }))
  });
 }
 const cause=choiceCount===0?'no-visible-route-groups':
  !paired?'hint-pairing-unresolved':
  'requires-event-role-and-choice-label-review';
 return {
  siteEventOrdinal:event.siteEventOrdinal,
  classification:'candidate-choice-or-auto',
  eventTitleStatus:'unverified-not-ingested',
  sourceChoiceGroupCount:choiceCount,
  explicitOrSeparators:splitChoices,
  sourceRouteCandidateCount:event.routes.length,
  allVisibleHintIdLevelPairsAssigned:paired,
  wholePanelHintCandidateCount:event.globalHints.length,
  routeAssignedHintCandidateCount:check.hintIdLevelCandidatesBoundToRoute,
  unresolvedReason:cause,
  grouping:groups,
  eventRoleVerified:false,
  chainPreconditionsVerified:false,
  outingStagePreconditionsVerified:false,
  // These fields intentionally prohibit confusing this artifact with a
  // runtime schema or claiming that any absent non-skill effects are zero.
  canPromoteToRuntimeEvent:false,
  eligibleForAutomaticPublishing:false
 };
}
function buildLiveCardIntake(cardId,observations){
 if(!/^\d{5}$/.test(String(cardId))||!Array.isArray(observations)||
  !observations.length||observations.length>20)
  fail('カードIDかイベント集合が不正');
 const seen=new Set();
 const events=observations.map(e=>{
  if(seen.has(e?.siteEventOrdinal))fail('イベント位置が重複');
  seen.add(e.siteEventOrdinal);
  return normalizeLiveEventObservation(e);
 });
 const all=events.slice().sort((a,b)=>a.siteEventOrdinal-b.siteEventOrdinal);
 if(all.some((e,i)=>e.siteEventOrdinal!==i+1))
  fail('元ページのイベント位置に欠番がある');
 return {
  schemaVersion:0,
  format:'gametora-live-nonpublishing-intake',
  cardId:String(cardId),
  source:'GameTora-original-site-rendered-DOM',
  genderForFutureChoiceLabels:'male',
  scope:'visible-event-candidates-not-game-complete',
  events:all,
  evidence:{
   panelsObserved:all.length,
   candidateRouteGroups:all.reduce((v,e)=>v+e.sourceRouteCandidateCount,0),
   hintPairsAssignedToRoute:all.reduce((v,e)=>v+e.routeAssignedHintCandidateCount,0),
   panelsWithVerifiedNumericPairing:all.filter(x=>x.allVisibleHintIdLevelPairsAssigned).length,
   panelsWithoutVisualRoutes:all.filter(x=>x.unresolvedReason==='no-visible-route-groups').length
  },
  publicCatalogCompatible:false,
  noSourceTextIncluded:true,
  publicationApproved:false
 };
}
module.exports={validateRenderedEvent,normalizeLiveEventObservation,buildLiveCardIntake};
