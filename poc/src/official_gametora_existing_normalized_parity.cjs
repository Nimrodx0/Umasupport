'use strict';
/*
 * Compare the SAME 30001 support events via two independently executed paths:
 * historical pinned GT-derived JSON -> UmaSupport's existing numeric converter,
 * versus original GameTora's visible DOM -> numeric effect / ID+hint-Lv parser.
 *
 * This is not source-text extraction, a public catalog, or proof that a visual
 * group represents an in-game user choice rather than a random outcome.
 */
const {scanOwnText,matchedEffectKinds}=require('./official_gametora_numeric_fact_parser.cjs');
const fail=s=>{throw Error('既存GT正規化結果と本体DOMの差分: '+s);};
const types=new Set(['skill_hint','speed','stamina','power','guts','wisdom',
 'energy','max_energy','skill_points','mood','bond']);
const signature=items=>items.slice().sort().join('|');
function sourceRouteFacts(event){
 if(!event||!Number.isSafeInteger(event.sourceOrdinal)||!Array.isArray(event.choices)||
   !['random','arrows'].includes(event.section)||event.choices.length===0)
  fail('既存変換器が出力したイベントの形式が不正');
 const result=[];
 for(const [ci,choice] of event.choices.entries()){
  if(choice.choiceOrdinal!==ci+1||!Array.isArray(choice.routes)||!choice.routes.length)
   fail('元選択肢の位置が不正');
  for(const [ri,route] of choice.routes.entries()){
   if(route.routeOrdinal!==ri+1||!Array.isArray(route.effects)||
      !Array.isArray(route.numericHintFacts)||!Array.isArray(route.directSkillGrantFacts)||
      !Array.isArray(route.guardKinds)||typeof route.explicitChainEnd!=='boolean')
    fail('結果経路と既存スキル候補が不正');
   const facts=[],hints=[],excludedKinds=[];
   for(const effect of route.effects){
    if(!effect||typeof effect.type!=='string')fail('数値効果が不正');
    if(types.has(effect.type)&&Number.isSafeInteger(effect.numericValue)){
     facts.push(effect.type+':'+effect.numericValue);
    }else if(effect.type!=='chain_end'){
     excludedKinds.push(effect.type);
    }
   }
   for(const hint of route.numericHintFacts){
    if(hint?.originType==='skill_hint'&&hint.numericFactParsed===true&&
       /^\d+$/.test(String(hint.skillNumericId||''))&&
       Number.isSafeInteger(hint.level)&&hint.level>0){
      hints.push(hint.skillNumericId+':'+hint.level);
    }else excludedKinds.push(hint?.originType||'unresolved-hint');
   }
   if(route.directSkillGrantFacts.length)excludedKinds.push('direct-skill-grant');
   if(route.guardKinds.length)excludedKinds.push('guarded-result');
   result.push({
    choiceOrdinal:ci+1,routeOrdinal:ri+1,
    effectSignature:signature(facts),hintSignature:signature(hints),
    ignoredOrUnparsedEffectKinds:[...new Set(excludedKinds)].sort(),
    hasExplicitChainEnd:route.explicitChainEnd
   });
  }
 }
 return result;
}
function parseNumericFactWithLocalContext(own,contexts=[]){
 const direct=scanOwnText(own);
 if(!direct||!direct.requiresReview)return {fact:direct,resolvedWithContext:false};
 if(direct.kind!=='unclassified'||direct.count!==1||direct.amount===null||
  !Array.isArray(contexts)||contexts.length>6||
  contexts.some(t=>typeof t!=='string'||t.length>300))
  return {fact:direct,resolvedWithContext:false};
 const usable=contexts.map(scanOwnText)
  .filter(x=>x&&!x.requiresReview&&x.count===1&&x.amount===direct.amount&&
    (types.has(x.kind)||x.kind==='bond'));
 // If two enclosing ancestors assign distinct effect kinds, do not guess.
 const signatures=new Set(usable.map(x=>x.kind+':'+x.amount));
 return signatures.size===1?{fact:usable[0],resolvedWithContext:true}:
  {fact:direct,resolvedWithContext:false};
}
function renderedRouteFacts(groups){
 if(!Array.isArray(groups)||groups.length>60||
  groups.some(g=>!g||!Array.isArray(g.effectTexts)||!Array.isArray(g.hintLinks)||
   (g.effectContexts!==undefined&&(!Array.isArray(g.effectContexts)||
     g.effectContexts.length!==g.effectTexts.length||
     g.effectContexts.some(a=>!Array.isArray(a)||a.length>6||
      a.some(t=>typeof t!=='string'||t.length>300))))||
   g.effectTexts.length>80||
   g.effectTexts.some(x=>typeof x!=='string'||x.length>400)||
   g.hintLinks.some(x=>typeof x?.status!=='string')))
  fail('GameTora本体の経路観測形式が不正');
 return groups.map((group,i)=>{
  const analyzed=group.effectTexts.map((t,i)=>
   parseNumericFactWithLocalContext(t,group.effectContexts?.[i]||[]));
  const observed=analyzed.map(x=>x.fact).filter(Boolean);
  const resolvedWithContext=analyzed.filter(x=>x.resolvedWithContext).length;
  const facts=observed.filter(x=>!x.requiresReview&&x.amount!==null&&types.has(x.kind))
   .map(x=>x.kind+':'+x.amount);
  const hints=group.hintLinks.flatMap(x=>x.status==='unique-verified-name'&&
    /^\d+$/.test(String(x.numericId||''))&&Number.isSafeInteger(x.level)&&x.level>0?
      [x.numericId+':'+x.level]:[]);
  return {
   renderedGroupOrdinal:i+1,effectSignature:signature(facts),
   hintSignature:signature(hints),
   unclassifiedNumeric:observed.filter(x=>x.requiresReview||
    !types.has(x.kind)&&x.kind!=='bond').length,
   excludedBondNumeric:observed.filter(x=>!x.requiresReview&&x.kind==='bond').length,
   unresolvedHintLinks:group.hintLinks.length-hints.length,
   numericContextResolutions:resolvedWithContext,
   // Diagnostic counts only; never log the effect text from the source site.
   ambiguousCauseCodes:group.effectTexts.filter(t=>scanOwnText(t)?.kind==='unclassified').map(t=>{
    const kinds=matchedEffectKinds(t);
    return kinds.length?kinds.slice().sort().join('+'):'NO_KNOWN_EFFECT_KIND';
   }),
   parserIssues:{
    ambiguousKind:observed.filter(x=>x.kind==='unclassified').length,
    multipleNumericAmounts:observed.filter(x=>x.count!==1).length,
    recognizedButExcluded:observed.filter(x=>!x.requiresReview&&!types.has(x.kind)).length,
    unrecognizedEffectKind:observed.filter(x=>!types.has(x.kind)&&x.kind!=='unclassified').length
   }
  };
 });
}
function compareConvertedToSiteEvent(converted,groups){
 const source=sourceRouteFacts(converted);
 const actual=renderedRouteFacts(groups);
 const matches=source.map(r=>actual
  .filter(o=>o.effectSignature===r.effectSignature&&o.hintSignature===r.hintSignature)
  .map(o=>o.renderedGroupOrdinal));
 const unique=source.length>0&&source.length===actual.length&&
  matches.every(x=>x.length===1)&&new Set(matches.flat()).size===source.length;
 const uncertainSource=source.reduce((n,x)=>n+x.ignoredOrUnparsedEffectKinds.length,0);
 const unclassified=actual.reduce((n,x)=>n+x.unclassifiedNumeric,0);
 const unresolvedHints=actual.reduce((n,x)=>n+x.unresolvedHintLinks,0);
 const ambiguousCauses={};
 for(const row of actual)for(const code of row.ambiguousCauseCodes)
  ambiguousCauses[code]=(ambiguousCauses[code]||0)+1;
 const contextResolutionCount=actual.reduce((n,x)=>n+x.numericContextResolutions,0);
 const explicitlyExcludedBondFacts=actual.reduce((n,x)=>n+x.excludedBondNumeric,0);
 const parserIssueTotals=Object.fromEntries(
  ['ambiguousKind','multipleNumericAmounts','recognizedButExcluded','unrecognizedEffectKind']
   .map(k=>[k,actual.reduce((n,x)=>n+x.parserIssues[k],0)])
 );
 // Exactly the same subset as the older raw-source probe, now sourced from
 // the actual existing app-normalizer output, not from a parallel input parser.
 const siteNumericProjectionParity=unique&&uncertainSource===0&&
  unclassified===0&&unresolvedHints===0;
 return {
  sourceOrdinal:converted.sourceOrdinal,
  existingConverterEventId:converted.eventId,
  sourceSection:converted.section,
  existingConverterChoiceCount:converted.choices.length,
  existingConverterRouteCount:source.length,
  renderedRouteCount:actual.length,
  uniquelyMatchedRouteCount:matches.filter(x=>x.length===1).length,
  missingNormalizedRoutes:matches.filter(x=>x.length===0).length,
  ambiguousNormalizedRoutes:matches.filter(x=>x.length>1).length,
  surplusRenderedRoutes:unique?0:Math.max(0,actual.length-new Set(matches.flat()).size),
  convertedSourceUnmappedKinds:uncertainSource,
  renderedUnclassifiedNumeric:unclassified,
  renderedParserIssueCounts:parserIssueTotals,
  numericKindResolvedByBoundedDOMContext:contextResolutionCount,
  siteBondNumericFactsOutsideComparedSubset:explicitlyExcludedBondFacts,
  renderedAmbiguousKindCauses:ambiguousCauses,
  renderedUnresolvedHintIds:unresolvedHints,
  visibleNumericProjectionParity:siteNumericProjectionParity,
  routeLinks:unique?source.map((s,i)=>({
   sourceChoiceOrdinal:s.choiceOrdinal,sourceOutcomeOrdinal:s.routeOrdinal,
   renderedGroupOrdinal:matches[i][0]
  })):[],
  sourceChainTerminals:source.filter(x=>x.hasExplicitChainEnd).length,
  // Bond and recipient identity remain outside this numerical subset.
  // A context clue can classify a bond delta without approving its recipient.
  bondRecipientIdentityVerified:false,
  bondNumericValueSourceCompared:true,
  originalSiteTerminalFlagsIndependentlyVerified:false,
  outcomesUserChoiceVsChanceVerified:false,
  fullProductionSchemaParityVerified:false,
  publicationApproved:false,
  noSourceProseIncluded:true
 };
}
function compareConvertedCardToSite(converted,joins,groupsByDisplayedEvent){
 if(converted?.cardId!=='30001'||converted.sourceEventCount!==5||
  !Array.isArray(converted.events)||converted.events.length!==5||
  !Array.isArray(joins)||joins.length!==5||
  !Array.isArray(groupsByDisplayedEvent)||groupsByDisplayedEvent.length!==5)
  fail('参照する既存変換済み30001カードと5イベントが一致しない');
 const srcSeen=new Set(),siteSeen=new Set();
 const comparisons=joins.map(j=>{
  const si=j?.historicalEventOrdinal,di=j?.renderedEventPosition;
  if(!Number.isInteger(si)||si<1||si>5||srcSeen.has(si)||
    !Number.isInteger(di)||di<1||di>5||siteSeen.has(di))
   fail('出典イベントとの見出し紐付けが曖昧・重複・欠損');
  srcSeen.add(si);siteSeen.add(di);
  const convertedEvent=converted.events[si-1];
  if(convertedEvent.sourceOrdinal!==si||
     convertedEvent.section!==j.sourceCategory)
   fail('既存変換器のイベントカテゴリ・位置が元参照と不一致');
  const result=compareConvertedToSiteEvent(convertedEvent,groupsByDisplayedEvent[di-1]);
  return {...result,displayedEventOrdinal:di};
 });
 const counts={eventsCompared:comparisons.length,
  sourceRouteCount:comparisons.reduce((sum,c)=>sum+c.existingConverterRouteCount,0),
  siteRouteCount:comparisons.reduce((sum,c)=>sum+c.renderedRouteCount,0),
  matchedUniqueRoutes:comparisons.reduce((sum,c)=>sum+c.uniquelyMatchedRouteCount,0),
  parityEvents:comparisons.filter(c=>c.visibleNumericProjectionParity).length,
  unresolvedEvents:comparisons.filter(c=>!c.visibleNumericProjectionParity).length};
 return {
  cardId:'30001',
  reference:'existing-gametora-whole-event-normalize',
  target:'gametora-original-rendered-event-groups',
  ...counts,events:comparisons,
  allFiveEventNumericProjectionsMatch:counts.parityEvents===5&&
     counts.sourceRouteCount===counts.siteRouteCount&&
     counts.matchedUniqueRoutes===counts.sourceRouteCount,
  // Renderer cannot prove probabilities, availability, manual choice semantics
  // or all current schema fields; keep user-visible release out of this path.
  liveSourceReplacesHistoricalReference:false,
  siteGameMechanicsIndependentlyVerified:false,
  fullAppEventJsonReproductionVerified:false,
  approvedForRelease:false,
  noSourceProseIncluded:true
 };
}
module.exports={parseNumericFactWithLocalContext,sourceRouteFacts,renderedRouteFacts,compareConvertedToSiteEvent,compareConvertedCardToSite};
