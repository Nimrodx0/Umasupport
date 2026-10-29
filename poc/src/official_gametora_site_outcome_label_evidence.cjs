'use strict';
/*
 * Classify only exact, result-local DOM OWN text labels from the original
 * GameTora site. Do not transform display groups into player choices or
 * visible OR variants into game probability/continuation semantics.
 *
 * Source-language labels are inputs, never outputs. Observations cannot
 * be adopted into app event JSON without editorial route adjudication.
 */
const fail=reason=>{throw Error('GameTora結果ラベル表示根拠: '+reason);};
const LABELS=new Map([
 ['成功','success'],['成功時','success'],
 ['大成功','great-success'],['大成功時','great-success'],
 ['失敗','failure'],['失敗時','failure'],
 ['大失敗','great-failure'],['大失敗時','great-failure'],
 ['success','success'],['great success','great-success'],
 ['failure','failure'],['great failure','great-failure']
]);
function markerFromOwnText(t){
 if(typeof t!=='string'||t.length>120)fail('own-label-out-of-bounds');
 const normalized=t.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
 return LABELS.get(normalized)||null;
}
function siteOutcomeLabelEvidence({cardId,siteEventOrdinal,routes}={}){
 if(!/^[1-9]\d{3,6}$/.test(String(cardId??''))||
    !Number.isSafeInteger(siteEventOrdinal)||siteEventOrdinal<1||
    siteEventOrdinal>100||!Array.isArray(routes)||routes.length>150)
  fail('scope-invalid');
 let group=1,result=1,labels=0,ambiguous=0,unlabelled=0;
 const groups=[];
 const observations=routes.map(r=>{
  if(!r||!Number.isSafeInteger(r.choiceOrdinal)||
    !Number.isSafeInteger(r.outcomeOrdinal)||
    r.choiceOrdinal<1||r.choiceOrdinal>20||
    r.outcomeOrdinal<1||r.outcomeOrdinal>20||
    !Array.isArray(r.resultLabelOwnTexts)||r.resultLabelOwnTexts.length>40||
    typeof r.unresolvedOr!=='boolean')
   fail('route-invalid');
  if(r.choiceOrdinal===group+1&&r.outcomeOrdinal===1){
   group++;result=1;
  }
  if(r.choiceOrdinal!==group||r.outcomeOrdinal!==result)
   fail('route-location-gap-or-reorder');
  result++;
  const found=r.resultLabelOwnTexts.map(markerFromOwnText).filter(Boolean);
  const evidenceKind=r.unresolvedOr?'unlocated-or-result':
    found.length===0?'no-explicit-result-label':
    found.length===1?'explicit-result-local-label':
    'ambiguous-multiple-result-labels';
  if(evidenceKind==='no-explicit-result-label')unlabelled++;
  if(evidenceKind==='explicit-result-local-label')labels++;
  if(evidenceKind==='ambiguous-multiple-result-labels')ambiguous++;
  let g=groups[r.choiceOrdinal-1];
  if(!g){
   g={visibleGroupOrdinal:r.choiceOrdinal,visibleRouteCount:0,
    resultEvidence:[]};
   groups.push(g);
  }
  g.visibleRouteCount++;
  const record={
   choiceGroupOrdinal:r.choiceOrdinal,resultOrdinal:r.outcomeOrdinal,
   observedLabelKind:evidenceKind,
   normalizedResultLabel:evidenceKind==='explicit-result-local-label'?
    found[0]:null,
   // Even a success/failure label is a site observation, not proof of
   // player selection, random trigger, odds, or following event reachability.
   gameOutcomeChoiceOrProbabilityVerified:false
  };
  g.resultEvidence.push(record);
  return record;
 });
 const summaryGroups=groups.map(g=>{
  const statuses=g.resultEvidence.map(x=>x.normalizedResultLabel);
  const oneSuccess=statuses.filter(x=>x==='success').length===1;
  const oneFailure=statuses.filter(x=>x==='failure').length===1;
  const known=statuses.filter(Boolean).length;
  const paired=g.visibleRouteCount===2&&known===2&&oneSuccess&&oneFailure;
  return {
   visibleGroupOrdinal:g.visibleGroupOrdinal,
   visibleResultCount:g.visibleRouteCount,
   hasSiteSeparatedAlternativeResults:g.visibleRouteCount>1,
   explicitSuccessFailurePairOnSeparatedResults:paired,
   // The interface's outer group is not by itself a game player choice.
   interpretedAsPlayerChoice:false
  };
 });
 return {
  dataKind:'official-gametora-site-result-label-evidence',
  version:1,cardId:String(cardId),siteEventOrdinal,
  inspectedResultRoutes:routes.length,
  explicitLabelledRoutes:labels,ambiguousLabelledRoutes:ambiguous,
  routesWithoutExplicitLabel:unlabelled,
  explicitSuccessFailurePairGroups:summaryGroups.filter(
   g=>g.explicitSuccessFailurePairOnSeparatedResults).length,
  groups:summaryGroups,routes:observations,
  // Labels missing does not mean there is no success/failure branch.
  missingLabelMeansSingleGuaranteedResult:false,
  playerChoiceSemanticsVerified:false,
  nextEventReachabilityVerified:false,
  sourceTextExported:false,
  appEventSchemaAdoptable:false,publicationApproved:false
 };
}
function summarizeSiteOutcomeLabelEvidence(d){
 if(d?.dataKind!=='official-gametora-site-result-label-evidence'||
    d.appEventSchemaAdoptable!==false||d.publicationApproved!==false||
    d.sourceTextExported!==false)
  fail('only-unapproved-result-evidence');
 return {
  cardId:d.cardId,siteEventOrdinal:d.siteEventOrdinal,
  inspectedResultRoutes:d.inspectedResultRoutes,
  explicitlyLabelledResultRoutes:d.explicitLabelledRoutes,
  ambiguousLabelledRoutes:d.ambiguousLabelledRoutes,
  unlabelledResultRoutes:d.routesWithoutExplicitLabel,
  orSeparatedGroupCount:d.groups.filter(
   g=>g.hasSiteSeparatedAlternativeResults).length,
  explicitlyLabelledSuccessFailurePairGroups:
   d.explicitSuccessFailurePairGroups,
  labelsByResult:d.routes.map(r=>({
   group:r.choiceGroupOrdinal,result:r.resultOrdinal,
   label:r.normalizedResultLabel,kind:r.observedLabelKind
  })),
  playerChoiceSemanticsVerified:false,
  nextEventReachabilityVerified:false,
  appEventSchemaAdoptable:false,publicationApproved:false
 };
}
module.exports={markerFromOwnText,siteOutcomeLabelEvidence,
 summarizeSiteOutcomeLabelEvidence};
