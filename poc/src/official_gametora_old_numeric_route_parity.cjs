'use strict';
/*
 * Route-by-route scalar facts from actual site DOM, matched to pinned OLD
 * source in RAM. Never count unverified hint IDs or obtain_skill as verified.
 */
const {parseNumericFactWithLocalContext}=require('./official_gametora_existing_normalized_parity.cjs');
const fail=s=>{throw Error('元サイト経路別数値事実の限定照合: '+s);};
const SCALAR=new Set(['speed','stamina','power','guts','wisdom',
 'energy','max_energy','skill_points','mood','bond']);
const bag=xs=>xs.slice().sort().join('|');
function sourceRoutes(event){
 if(!Array.isArray(event?.choices)||!event.choices.length)
  fail('参照イベントが不正');
 return event.choices.map(choice=>{
  const paths=Array.isArray(choice.outcomes)?choice.outcomes:
   Array.isArray(choice.effects)?[choice.effects]:null;
  if(!paths?.length||paths.some(x=>!Array.isArray(x)))
   fail('元の結果構造が不正');
  return paths.map(effects=>{
   const facts=[],excluded=[];
   for(const effect of effects){
    if(typeof effect?.type!=='string')fail('元の効果コードが不正');
    if(!SCALAR.has(effect.type)){
     excluded.push(effect.type);continue;
    }
    if(!/^[+-]\d{1,5}$/.test(String(effect.value||'')))
     fail('元の数値が単一スカラーではない');
    facts.push(effect.type+':'+Number(effect.value));
   }
   return {signature:bag(facts),scalarCount:facts.length,
    notComparedKinds:[...new Set(excluded)].sort()};
  });
 });
}
function visibleRoute(route){
 if(!route||!Array.isArray(route.effectTexts)||route.effectTexts.length>80||
  !Array.isArray(route.effectContexts)||
  route.effectContexts.length!==route.effectTexts.length)
  fail('DOM数値断片が不正');
 const facts=[],unresolved=[],excluded=[];
 for(let i=0;i<route.effectTexts.length;i++){
  const raw=route.effectTexts[i],context=route.effectContexts[i];
  if(typeof raw!=='string'||raw.length>400||!Array.isArray(context)||
   context.length>6||context.some(t=>typeof t!=='string'||t.length>300))
   fail('DOM文字数上限超過');
  const parsed=parseNumericFactWithLocalContext(raw,context).fact;
  if(!parsed)continue;
  if(parsed.requiresReview||!Number.isSafeInteger(parsed.amount)){
   unresolved.push('ambiguous-numeric-text');continue;
  }
  if(!SCALAR.has(parsed.kind)){excluded.push(parsed.kind);continue;}
  facts.push(parsed.kind+':'+parsed.amount);
 }
 return {signature:bag(facts),scalarCount:facts.length,
  unresolvedNumbers:unresolved.length,excludedKinds:[...new Set(excluded)].sort()};
}
function compareNumericRoutes(event,observedChoices){
 const reference=sourceRoutes(event);
 if(!Array.isArray(observedChoices)||observedChoices.length!==reference.length||
  observedChoices.some((x,i)=>!Array.isArray(x)||x.length>12))
  fail('元とサイトの外側選択肢数が不正');
 const rows=[],links=[];
 for(const [ci,refRoutes] of reference.entries()){
  const seen=observedChoices[ci].map(visibleRoute);
  const candidates=refRoutes.map(s=>seen
   .map((t,i)=>t.signature===s.signature&&t.unresolvedNumbers===0?i+1:null)
   .filter(Boolean));
  const unique=seen.length===refRoutes.length&&
   candidates.every(c=>c.length===1)&&
   new Set(candidates.flat()).size===refRoutes.length;
  rows.push({choiceOrdinal:ci+1,referenceRoutes:refRoutes.length,
   observedRoutes:seen.length,expectedScalarEffects:refRoutes.reduce((n,x)=>n+x.scalarCount,0),
   observedScalarEffects:seen.reduce((n,x)=>n+x.scalarCount,0),
   unmatchedRoutes:candidates.filter(x=>x.length===0).length,
   ambiguousRoutes:candidates.filter(x=>x.length>1).length,
   siteUnresolvedNumericTexts:seen.reduce((n,x)=>n+x.unresolvedNumbers,0),
   sourceExcludedKinds:[...new Set(refRoutes.flatMap(x=>x.notComparedKinds))].sort(),
   siteExcludedKinds:[...new Set(seen.flatMap(x=>x.excludedKinds))].sort(),
   // Effect-kind and signed-number codes only; never site prose or HTML.
   numericMismatchDiagnostics:unique?null:{
    oldTypedNumericSignatures:refRoutes.map(x=>x.signature),
    siteTypedNumericSignatures:seen.map(x=>x.signature)},
   exactDistinctNumericRouteMatching:unique});
  if(unique)for(const [ri,c] of candidates.entries())
   links.push({choiceOrdinal:ci+1,sourceRouteOrdinal:ri+1,renderedRouteOrdinal:c[0]});
 }
 const all=rows.every(x=>x.exactDistinctNumericRouteMatching&&
  x.expectedScalarEffects===x.observedScalarEffects);
 const fullyParsed=rows.every(x=>x.siteUnresolvedNumericTexts===0&&
  x.expectedScalarEffects===x.observedScalarEffects&&
  x.observedRoutes===x.referenceRoutes);

 return {
  referenceChoices:reference.length,referenceResultRoutes:reference.flat().length,
  observedResultRoutes:observedChoices.flat().length,
  referenceScalarEffects:rows.reduce((n,x)=>n+x.expectedScalarEffects,0),
  siteScalarEffects:rows.reduce((n,x)=>n+x.observedScalarEffects,0),
  uniquelyMatchedNumericRoutes:links.length,
  everyNumericResultRouteOneToOne:all,
  // Pure extraction works even when the historical reference is stale.
  allObservedSignedScalarFactsParsed:fullyParsed,
  historicalValueOrEffectKindDriftObserved:fullyParsed&&!all,
  rows,links:all?links:[],
  skillHintIdAndLevelVerified:false,
  directSkillGrantVerified:false,
  bondRecipientIdentityVerified:false,
  externalOccurrenceProbabilityVerified:false,
  sourceTextExported:false,publicationApproved:false
 };
}
module.exports={sourceRoutes,visibleRoute,compareNumericRoutes};
