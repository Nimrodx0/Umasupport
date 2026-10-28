'use strict';
/*
 * One pinned OLD support card: existing app-schema "effects[]" from the
 * established non-skill inventory, compared to original GameTora DOM facts.
 *
 * No third-party story content or old database effects are used to fill
 * missing facts on the original site. Recipient identity, probabilities,
 * chain reachability and real-game outcomes are not inferred here.
 */
const POLICY=require('../config/event-source-priority.v1.json');
const {analyze}=require('./phase2_gt_whole_nonskill_effect_inventory.cjs');
const {renderedRouteFacts}=require('./official_gametora_existing_normalized_parity.cjs');
const fail=s=>{throw Error('SSR30001実サイトと非スキル効果スキーマの照合: '+s);};
const bag=x=>x.slice().sort().join('|');
function buildPinnedEffectDraft(document){
 if(document?.kind!=='support'||document.id!==30001||
   !document.events_ja||Object.keys(document.events_ja).length!==5)
  fail('固定GT30301ではなく既存SSR30001の5イベント元資料が必要');
 const index={
  dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,
  sourcePins:{gameToraDerived:POLICY.baselineRevision,
   checker:'isolated-one-card-browser-parity-not-index-release'},
  cards:[{cardId:'30001',sourceMissing:false,gameToraObservedCount:5}],
  stats:{gameToraEventRecords:5}
 };
 const report=analyze({documents:[document],index});
 if(report?.publicationApproved!==false||
  report?.automaticRuntimeAdoption!==false||
  report?.sourceProseIncluded!==false||
  report?.onlyIsolatedEffectShapePreview!==true||
  report?.summary?.sourceEvents!==5||
  report?.summary?.expandedRoutes!==9)
  fail('既存の非スキルスキーマ候補を隔離できない');
 const app=report.isolatedPreview.cards.find(x=>x.cardId==='30001');
 return {
  sourceCardId:'30001',sourceEventCount:5,
  sourceRouteCount:9,
  eligibleEffectEventCount:app?.events.length||0,
  eligibleEffectComponentCount:report.summary.isolatedPreviewEffectRecords,
  blockedSourceEvents:report.summary.blockedEvents,
  isolatedAppCard:app||null,
  originatingThirdPartyDataNeverPublished:true
 };
}
function comparePinnedEffectsToSite({draft,siteParity,siteEventGroups}){
 if(draft?.sourceCardId!=='30001'||draft.sourceEventCount!==5||
  draft.sourceRouteCount!==9||draft.originatingThirdPartyDataNeverPublished!==true||
  !Array.isArray(draft.isolatedAppCard?.events)||
  !Array.isArray(siteEventGroups)||siteEventGroups.length!==5||
  siteParity?.cardId!=='30001'||siteParity.allFiveEventNumericProjectionsMatch!==true||
  siteParity.sourceRouteCount!==9||siteParity.siteRouteCount!==9||
  !Array.isArray(siteParity.events)||siteParity.events.length!==5)
  fail('実サイトの全数値経路と元非スキル隔離投影の証拠不足');
 const byEvent=new Map(draft.isolatedAppCard.events.map(e=>[e.id,e]));
 const comparisons=[];
 let appEffectCount=0,siteEffectCount=0,matchedEffectCount=0,matchedRoutes=0,
  appBondEffectCount=0,siteBondEffectCount=0,recipientEvidenceNotOnSite=0,
  terminalPathsInEffectDraft=0,missingEventProjections=0;
 for(const join of siteParity.events){
  const n=join.sourceOrdinal,display=join.displayedEventOrdinal;
  if(!Number.isInteger(n)||n<1||n>5||
    !Number.isInteger(display)||display<1||display>5||
    !Array.isArray(join.routeLinks)||join.routeLinks.length!==join.renderedRouteCount)
   fail('元イベント・サイトの経路紐付けが不正');
  const id='gt:30001:'+String(n).padStart(3,'0')+':effect-only';
  const event=byEvent.get(id);
  if(!event){missingEventProjections++;comparisons.push({
   sourceOrdinal:n,appEventPresent:false,matchedRoutes:0,
   skippedBecauseEffectCandidateNotEligible:true
  });continue;}
  const site=renderedRouteFacts(siteEventGroups[display-1]);
  const routeStatuses=[];
  let same=0;
  for(const link of join.routeLinks){
   const ci=link.sourceChoiceOrdinal,ri=link.sourceOutcomeOrdinal;
   if(!Number.isInteger(ci)||ci<1||!Number.isInteger(ri)||ri<1||
    !Number.isInteger(link.renderedGroupOrdinal)||
    link.renderedGroupOrdinal<1||link.renderedGroupOrdinal>site.length)
    fail('経路ID・結果番号が不正');
   const group=site[link.renderedGroupOrdinal-1];
   const part=event.type==='auto'?ci===1?event:null:event.choices?.[ci-1];
   const leaf=part?.outcomes?part.outcomes[ri-1]:ri===1?part:null;
   const appEffects=leaf?.effects||[];
   const appNums=appEffects.map(x=>x.kind+':'+x.delta);
   const websiteNums=(group.effectSignature||'').split('|').filter(x=>x&&!x.startsWith('skill_hint:'));
   const hasPath=!!leaf&&Array.isArray(appEffects);
   const matches=hasPath&&bag(appNums)===bag(websiteNums);
   appEffectCount+=appNums.length;siteEffectCount+=websiteNums.length;
   appBondEffectCount+=appEffects.filter(x=>x.kind==='bond').length;
   siteBondEffectCount+=websiteNums.filter(x=>x.startsWith('bond:')).length;
   recipientEvidenceNotOnSite+=appEffects.filter(x=>x.recipientCharId!==undefined).length;
   if(leaf?.terminal===true)terminalPathsInEffectDraft++;
   if(matches){matchedRoutes++;same+=appNums.length;}
   routeStatuses.push({
    sourceChoiceOrdinal:ci,sourceOutcomeOrdinal:ri,
    appPathPresent:hasPath,nonSkillNumericEffectsMatch:matches,
    appEffectCount:appNums.length,siteEffectCount:websiteNums.length,
    bondRecipientIdentityIndependentlyRead:false
   });
  }
  matchedEffectCount+=same;
  comparisons.push({sourceOrdinal:n,appEventPresent:true,
   projectedResultRoutes:routeStatuses.length,
   matchedRoutes:routeStatuses.filter(x=>x.nonSkillNumericEffectsMatch).length,
   allNumericEffectsMatch:routeStatuses.every(x=>x.nonSkillNumericEffectsMatch),
   routeStatuses});
 }
 const matchedEvents=comparisons.filter(x=>x.allNumericEffectsMatch).length;
 const status={
  cardId:'30001',source:'GameTora-original-site-rendered-DOM',
  reference:'actual phase2_gt_whole_nonskill_effect_inventory isolated app effects',
  eventsCompared:5,appEffectEvents:draft.eligibleEffectEventCount,
  matchedEvents,matchedEffectRoutes:matchedRoutes,
  siteEffectCount,appEffectCount,matchedEffectCount,
  siteBondEffectCount,appBondEffectCount,
  numberOfAppRecipientIdsNotVerifiedBySite:recipientEvidenceNotOnSite,
  appTerminalRoutes:terminalPathsInEffectDraft,
  missingEventProjections,
  allRenderedNonSkillNumericEffectsMatch:matchedEvents===5&&matchedRoutes===9&&
   siteEffectCount===appEffectCount&&matchedEffectCount===appEffectCount,
  recipientCharIdSourceSiteVerified:false,
  appEffectStageReachabilityVerified:false,
  fullCombinedAppEventJsonVerified:false,
  sourceNarrativeIncluded:false,publicationApproved:false,
  comparisons
 };
 return status;
}
module.exports={buildPinnedEffectDraft,comparePinnedEffectsToSite};
