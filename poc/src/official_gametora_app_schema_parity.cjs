'use strict';
/*
 * Compare the original GameTora *rendered* numeric skill facts to the REAL
 * UmaSupport app-schema projection for the SAME PINNED historical SSR30001.
 *
 * The old source controls route/event ID alignment, not observed rewards:
 * each skill ID and hint level must independently occur in the rendered site.
 * This is a RAM-only unpublished skill projection, not a complete event DB.
 */
const {transformDocument}=require('./gametora_whole_event_normalize.cjs');
const {crosswalk}=require('./gametora_event_skill_crosswalk.cjs');
const {project}=require('./gametora_app_schema_dry_run.cjs');
const {renderedRouteFacts}=require('./official_gametora_existing_normalized_parity.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const fail=x=>{throw Error('GameTora実サイトとアプリ用スキル投影: '+x);};
const sorted=x=>x.slice().sort().join('|');
const numericSkillId=x=>typeof x==='string'&&/^skill:[1-9]\d*$/.test(x)?x.slice(6):null;
const rewardCode=r=>numericSkillId(r.skillId)&&Number.isInteger(r.level)&&r.level>0&&
 !r.kind?numericSkillId(r.skillId)+':'+r.level:null;
function buildPinnedCardDraft(document,skillText){
 if(document?.kind!=='support'||document.id!==30001||
  typeof skillText!=='string'||skillText.length<100)fail('固定SSR30001の元入力が不正');
 const transformed=transformDocument(document);
 if(transformed.sourceEventCount!==5||transformed.sourceExpandedRoutes!==9||
  transformed.cardId!=='30001')fail('既存カードの5イベント9経路の固定母数が変化');
 const {reviewQueue,effectTypeCounts,...row}=transformed;
 const totals={
  rosterCards:1,sourceEvents:row.sourceEventCount,
  sourceChoices:row.sourceChoiceCount,expandedRoutes:row.sourceExpandedRoutes,
  numericHintMentions:row.numericParsedHintMentions,
  unresolvedHintMentions:row.unresolvedHintMentions,
  directSkillGrantMentions:row.directSkillGrantMentions
 };
 const candidate={
  schemaVersion:1,dataKind:'gametora-whole-event-numeric-candidate',
  sourcePins:{gameToraDerived:POLICY.baselineRevision},
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  cards:[row],totals
 };
 const card={id:'30001',hints:[],events:[]};
 const model={cards:[card],cardById:{'30001':card},skills:[],skillById:{},meta:{}};
 const map=crosswalk({candidate,skillText,model});
 const outcome=project({candidate,crosswalk:map,skillText,model});
 const result=outcome.dryRunCatalog?.cards?.find(x=>x.cardId==='30001');
 if(outcome.report?.publicationApproved!==false||
    outcome.report?.sourceProseIncluded!==false||
    outcome.report?.totals?.sourceEvents!==5||
    !result||!Array.isArray(result.events))
  fail('実アプリスキーマの非公開投影が不正');
 return {normalized:transformed,appCard:result,
  sourceEventCount:5,sourceRouteCount:9,
  projectedEventCount:result.events.length,
  excludedSourcePositions:outcome.report.excludedSourcePositions,
  runtimeEventCount:outcome.runtimeValidation.eventsWithRecords,
  publicSourceTextApproved:false};
}
function comparePinnedAppDraftToOriginalSite({draft,siteParity,siteEventGroups,
  siteChoiceSemantics=null}){
 if(draft?.normalized?.cardId!=='30001'||draft.appCard?.cardId!=='30001'||
  draft.sourceEventCount!==5||draft.sourceRouteCount!==9||
  !Array.isArray(draft.normalized.events)||draft.normalized.events.length!==5||
  !Array.isArray(draft.appCard.events)||
  !Array.isArray(siteEventGroups)||siteEventGroups.length!==5||
  siteParity?.cardId!=='30001'||!Array.isArray(siteParity.events)||
  siteParity.events.length!==5||
  siteParity.allFiveEventNumericProjectionsMatch!==true||
  siteParity.matchedUniqueRoutes!==9||
  siteParity.sourceRouteCount!==9||siteParity.siteRouteCount!==9||
  siteChoiceSemantics!==null&&(!Array.isArray(siteChoiceSemantics)||
     siteChoiceSemantics.length!==5))
  fail('元サイトの5イベント9経路と実スキーマ投影の基礎証拠が不足');
 const appById=new Map(draft.appCard.events.map(x=>[x.id,x]));
 const seen=new Set(),comparisons=[];
 let siteHints=0,appHints=0,matchedHints=0,matchedRoutes=0,siteBond=0,
  appTerminal=0,terminalPositivelyCorroborated=0,appRequires=0,
  siteNonSkillEffectFragments=0;
 for(const binding of siteParity.events){
  const n=binding.sourceOrdinal,display=binding.displayedEventOrdinal;
  if(!Number.isInteger(n)||n<1||n>5||seen.has(n)||
   !Number.isInteger(display)||display<1||display>5||
   !Array.isArray(binding.routeLinks))fail('表示イベントの固定紐付けが不正');
  seen.add(n);
  const original=draft.normalized.events[n-1],app=appById.get(original.eventId);
  const site=renderedRouteFacts(siteEventGroups[display-1]);
  const proof=siteChoiceSemantics?.find(s=>s.historicalEventOrdinal===n);
  const sourceRouteCount=original.choices.reduce((v,c)=>v+c.routes.length,0);
  if(binding.existingConverterRouteCount!==sourceRouteCount||
   binding.renderedRouteCount!==site.length||
   binding.routeLinks.length!==site.length)fail('元サイトと元正規化器の経路数が一致しない');
  const present=!!app;
  const sourceAuto=original.choices.length===1&&
    original.choices[0].sourceLabelWasEmpty===true;
  const expectedType=sourceAuto?'auto':'choice';
  const shapeMatch=present&&app.type===expectedType&&
    (sourceAuto?app.choices===undefined:
     Array.isArray(app.choices)&&app.choices.length===original.choices.length);
  const siteChoiceCountProof=proof?.choiceCardinalityAgrees===true&&
    proof?.alternativeOutcomeStructureAgrees===true;
  const usedLocations=new Set(),compared=[];
  if(app?.requires)appRequires++;
  for(const [ci,choice] of original.choices.entries()){
   for(const [ri,route] of choice.routes.entries()){
    const link=binding.routeLinks.find(l=>l.sourceChoiceOrdinal===ci+1&&
     l.sourceOutcomeOrdinal===ri+1);
    if(!link||!Number.isInteger(link.renderedGroupOrdinal)||
     link.renderedGroupOrdinal<1||link.renderedGroupOrdinal>site.length||
     usedLocations.has(link.renderedGroupOrdinal))
     fail('サイト経路の場所が不正・重複');
    usedLocations.add(link.renderedGroupOrdinal);
    const observed=site[link.renderedGroupOrdinal-1];
    const part=sourceAuto?app:app?.choices?.[ci];
    const actualRoute=choice.routes.length>1?
       part?.outcomes?.[ri]:part?.rewards!==undefined?part:part?.outcomes?.[ri];
    const siteSkills=observed.hintSignature?observed.hintSignature.split('|'):[];
    const appRewards=actualRoute?.rewards;
    const appSkillCodes=Array.isArray(appRewards)?appRewards.map(rewardCode):[];
    const payloadMatch=Array.isArray(appRewards)&&
      appSkillCodes.every(Boolean)&&sorted(siteSkills)===sorted(appSkillCodes);
    const shape=!!part&&!!actualRoute&&
      (choice.routes.length>1?part.outcomes?.length===choice.routes.length:
      Array.isArray(part.rewards)&&!part.outcomes);
    const siteEffects=observed.effectSignature?
      observed.effectSignature.split('|'):[];
    const bond=siteEffects.filter(x=>x.startsWith('bond:')).length;
    siteBond+=bond;siteNonSkillEffectFragments+=siteEffects.filter(x=>!x.startsWith('skill_hint:')).length;
    siteHints+=siteSkills.length;appHints+=appSkillCodes.filter(Boolean).length;
    if(payloadMatch)matchedHints+=siteSkills.length;
    if(shape&&payloadMatch)matchedRoutes++;
    if(actualRoute?.terminal===true)appTerminal++;
    // Site evidence for terminal is independently route-bound in the
    // original browser pilot, but it does NOT establish every non-terminal.
    if(actualRoute?.terminal===true&&
       proof?.explicitTerminalRouteCheck?.explicitTerminalRouteLocationVerified===true&&
       proof.explicitTerminalRouteCheck.routeEvidencePairCount===1)
      terminalPositivelyCorroborated++;
    compared.push({choiceOrdinal:ci+1,outcomeOrdinal:ri+1,
      runtimePathExists:shape,skillRewardsMatch:payloadMatch,
      observedSiteHintCount:siteSkills.length,appRewardCount:appSkillCodes.filter(Boolean).length,
      siteNonSkillNumericCount:siteEffects.length,
      appTerminal:actualRoute?.terminal===true,
      siteTerminalProvenForThisRoute:false});
   }
  }
  const routeCountMatches=usedLocations.size===site.length;
  const eventAllSkillsMatch=shapeMatch&&routeCountMatches&&
   compared.every(x=>x.runtimePathExists&&x.skillRewardsMatch);
  comparisons.push({sourceOrdinal:n,siteEventPosition:display,appEventPresent:present,
   appEventType:app?.type||null,appChoiceCount:app?.choices?.length||0,
   appHasRequires:!!app?.requires,
   sourceChoiceCount:original.choices.length,siteChoiceCardinalityCompatible:siteChoiceCountProof,
   outcomeCountSource:sourceRouteCount,outcomeCountSite:site.length,
   appSchemaShapeMatchesHistoricalGrouping:shapeMatch&&routeCountMatches,
   appSkillRewardsMatchOriginalSite:eventAllSkillsMatch,
   comparisons:compared});
 }
 const allEventsPresent=comparisons.every(x=>x.appEventPresent);
 const appSkillRouteParity=allEventsPresent&&draft.appCard.events.length===5&&
  matchedRoutes===9&&matchedHints===siteHints&&siteHints===appHints;
 const siteChoiceEvidenceComplete=comparisons.every(x=>x.siteChoiceCardinalityCompatible);
 return {
  cardId:'30001',source:'GameTora-original-site-rendered-DOM',
  reference:'actual gametora_app_schema_dry_run project result for pinned old card',
  eventsCompared:comparisons.length,
  appEventsPresent:comparisons.filter(x=>x.appEventPresent).length,
  routeCount:9,siteHintRewards:siteHints,appHintRewards:appHints,
  matchedHintRewards:matchedHints,matchedSkillRoutes:matchedRoutes,
  appSkillRouteParity,siteChoiceCardinalityConfirmed:siteChoiceEvidenceComplete,
  websiteParsedBondDeltas:siteBond,
  siteNonSkillNumericEffectsExcludedFromThisAppSkillProjection:siteNonSkillEffectFragments,
  draftEventsWithRequires:appRequires,
  appTerminalRoutes:appTerminal,
  terminalRouteEvidenceEvents:terminalPositivelyCorroborated,
  appEventTypeIndependentlyConfirmed:false,
  appRequiresFullyConfirmedBySite:false,
  appTerminalFlagsFullyConfirmedBySite:false,
  bondRecipientCharIdConfirmedBySite:false,
  copiedGameToraSourceProse:false,
  nonSkillAppEffectsParityVerified:false,
  fullAppJsonParityVerified:false,
  gameMechanicsVerified:false,
  publicationApproved:false,
  comparisons
 };
}
module.exports={buildPinnedCardDraft,comparePinnedAppDraftToOriginalSite};
