'use strict';
/*
 * Candidate-level comparison between rendered original-site groupings and
 * independent historical source route effects. Never infer choice vs outcome
 * from identical visual group counts; never approve publication.
 */
const {scanOwnText}=require('./official_gametora_numeric_fact_parser.cjs');
const fail=s=>{throw Error('GameTora元サイト経路候補: '+s);};
const normSet=arr=>[...arr].sort().join('|');
function sourceRoutes(event){
 if(!Array.isArray(event?.choices)||!event.choices.length)fail('旧出典経路の欠落');
 const out=[];
 for(const [ci,ch] of event.choices.entries()){
  if(!ch||!Array.isArray(ch.effects)&&!Array.isArray(ch.outcomes))fail('旧出典選択肢の効果が不正');
  const variants=Array.isArray(ch.outcomes)?ch.outcomes:[ch.effects];
  for(const [ri,effects] of variants.entries()){
   if(!Array.isArray(effects))fail('旧出典結果が不正');
   const facts=[],hints=[];
   for(const fact of effects){
    if(!fact||typeof fact.type!=='string')continue;
    if(fact.type==='skill_hint'&&Number.isSafeInteger(fact.skill_id)&&fact.skill_id>0){
     const value=Number(fact.value);
     if(Number.isSafeInteger(value)&&value>=1)hints.push(String(fact.skill_id)+':'+value);
    }
    if(fact.type==='bond'||fact.type==='chain_end')continue;
    const amount=Number(fact.value);
    if(!Number.isFinite(amount)||![
     'skill_hint','speed','stamina','power','guts','wisdom',
     'energy','max_energy','skill_points','mood'
    ].includes(fact.type))continue;
    facts.push(fact.type+':'+amount);
   }
   out.push({choiceIndex:ci+1,outcomeIndex:ri+1,
    factualSignature:normSet(facts),hintSignature:normSet(hints)});
  }
 }
 return out;
}
function compareRenderedGroups(event,groups){
 const reference=sourceRoutes(event);
 if(!Array.isArray(groups)||groups.length>20||
   groups.some(x=>!Array.isArray(x?.effectTexts)||!Array.isArray(x?.hintLinks)||
    x.effectTexts.some(t=>typeof t!=='string'||t.length>400)||
    x.hintLinks.some(h=>typeof h?.status!=='string')))
  fail('描画候補グループが不正');
 const observed=groups.map((g,index)=>{
  const effects=g.effectTexts.map(scanOwnText).filter(f=>f&&f.kind!=='unclassified'&&f.amount!==null);
  const hints=g.hintLinks.filter(x=>x.status==='unique-verified-name'&&
    typeof x.numericId==='string'&&Number.isInteger(x.level)&&x.level>=1);
  return {index:index+1,factualSignature:normSet(effects.map(f=>f.kind+':'+f.amount)),
   hintSignature:normSet(hints.map(h=>h.numericId+':'+h.level)),
   unclassifiedNumericTexts:g.effectTexts.map(scanOwnText).filter(x=>x?.requiresReview).length,
   unresolvedHintNames:g.hintLinks.filter(x=>x.status!=='unique-verified-name').length};
 });
 const candidateMatches=reference.map(r=>
  observed.filter(o=>o.factualSignature===r.factualSignature&&
   o.hintSignature===r.hintSignature).map(o=>o.index));
 const fullyUnique=candidateMatches.every(xs=>xs.length===1)&&
  new Set(candidateMatches.flat()).size===reference.length&&
  reference.length===observed.length;
 const countPairs=candidateMatches.filter(x=>x.length>0).length;
 return {
  sourceRoutes:reference.length,renderedGroupCandidates:observed.length,
  sourceGroupsWithMatchingFactAndHintSignature:countPairs,
  uniqueRouteGroupAssignment:fullyUnique,
  uniquelyAssignedRouteLocations:fullyUnique?reference.map((route,index)=>({
   choiceOrdinal:route.choiceIndex,outcomeOrdinal:route.outcomeIndex,
   renderedGroupOrdinal:candidateMatches[index][0]
  })):[],
  unmatchedSourceRoutes:candidateMatches.filter(xs=>xs.length===0).length,
  ambiguousSourceRoutes:candidateMatches.filter(xs=>xs.length>1).length,
  unclassifiedNumericTexts:observed.reduce((s,x)=>s+x.unclassifiedNumericTexts,0),
  unresolvedHintNames:observed.reduce((s,x)=>s+x.unresolvedHintNames,0),
  visualGroupSemanticsVerified:false,
  choiceAndOutcomeLabelsVerified:false,
  explicitChainTerminationVerified:false,
  sourceReuseAllowed:false,publicationApproved:false
 };
}
module.exports={sourceRoutes,compareRenderedGroups};
