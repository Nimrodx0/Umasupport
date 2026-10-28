'use strict';
/*
 * Visible flow markers scoped to explicitly separated original-site result
 * roots. These are OBSERVATIONS, not inferred next-event edges, probabilities,
 * or publishable event-schema conditions. No historical event tree is input.
 */
const fail=code=>{throw Error('GameTora画面内進行マーカー候補: '+code);};
const CHAIN_STOP=/(?:連続(?:.*)?イベント|イベントチェーン|連続イベ).{0,14}(?:打ち切り|中断|終了|発生しない)|(?:打ち切り|中断|終了).{0,14}(?:連続(?:.*)?イベント|イベントチェーン|連続イベ)/;
const OUTING_UNLOCK=/(?:お出かけ|おでかけ).{0,16}(?:できるようになる|可能になる|解放される|可能|解放)/;
const OUTING_STOP=/(?:お出かけ|おでかけ).{0,16}(?:打ち切り|終了|中断)|(?:打ち切り|終了|中断).{0,16}(?:お出かけ|おでかけ)/;
function routeFlowCandidates({cardId,siteEventOrdinal,routes}={}){
 if(!/^\d{4,7}$/.test(String(cardId??''))||
  !Number.isSafeInteger(siteEventOrdinal)||siteEventOrdinal<1||siteEventOrdinal>100||
  !Array.isArray(routes)||routes.length>150)
  fail('invalid-scope');
 const keys=new Set();let visible=0,unlocated=0;
 const entries=routes.map(r=>{
  if(!Number.isSafeInteger(r?.choiceGroupOrdinal)||r.choiceGroupOrdinal<1||
   !Number.isSafeInteger(r.resultOrdinal)||r.resultOrdinal<1||
   !Array.isArray(r.flowOwnTexts)||r.flowOwnTexts.length>80||
   r.flowOwnTexts.some(t=>typeof t!=='string'||t.length>300)||
   typeof r.unresolvedOr!=='boolean')
   fail('invalid-site-route');
  const key=r.choiceGroupOrdinal+':'+r.resultOrdinal;
  if(keys.has(key))fail('duplicate-site-route');
  keys.add(key);
  const markers=[];
  for(const t of r.flowOwnTexts){
   if(CHAIN_STOP.test(t))markers.push('explicit-chain-stop');
   if(OUTING_UNLOCK.test(t))markers.push('explicit-outing-unlock');
   if(OUTING_STOP.test(t))markers.push('explicit-outing-stop');
  }
  const unique=[...new Set(markers)].sort();
  visible+=unique.length;
  if(r.unresolvedOr)unlocated+=unique.length;
  return {choiceGroupOrdinal:r.choiceGroupOrdinal,resultOrdinal:r.resultOrdinal,
   visibleMarkerKinds:unique,
   safelyAttributedToResult:!r.unresolvedOr,
   // Absence of an explicit stop is not proof of game continuation.
   nextEventReachabilityVerified:false,
   gameOutcomeBranchSemanticsVerified:false};
 });
 return {dataKind:'official-gametora-visible-flow-draft',version:1,
  cardId:String(cardId),siteEventOrdinal,
  resultRoutesInspected:entries.length,visibleMarkerKinds:visible,
  locatedVisibleMarkerKinds:visible-unlocated,unlocatedVisibleMarkerKinds:unlocated,
  routes:entries,
  siteDisplayScope:'result-own-text-only',
  everyContinuationAndDependencyVerified:false,
  missingMarkersMeanContinuation:false,
  appEventSchemaAdoptable:false,publicationApproved:false,sourceTextExported:false};
}
function summarizeFlowDraft(draft){
 if(draft?.dataKind!=='official-gametora-visible-flow-draft'||
  draft.appEventSchemaAdoptable!==false||draft.publicationApproved!==false)
  fail('not-a-provisional-flow-draft');
 const counts={};
 for(const r of draft.routes)for(const marker of r.visibleMarkerKinds)
  counts[marker]=(counts[marker]||0)+1;
 return {
  cardId:draft.cardId,siteEventOrdinal:draft.siteEventOrdinal,
  routes:draft.resultRoutesInspected,markerCounts:counts,
  locatedMarkerKinds:draft.locatedVisibleMarkerKinds,
  unlocatedMarkerKinds:draft.unlocatedVisibleMarkerKinds,
  allContinuationVerified:false,
  appEventSchemaAdoptable:false,publicationApproved:false};
}
module.exports={routeFlowCandidates,summarizeFlowDraft};
