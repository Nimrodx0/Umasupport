/* Fixed-source, no-prediction P2 coverage audit. Machine-readable samples
 * are CI artifacts, not deployed skill dictionaries. */
'use strict';
const {analyze}=require('./skill_rank_timing.js');
function cohort(records,{examplesPerGroup=4}={}){
 if(!Array.isArray(records))throw Error('Expected source records array');
 const summary={totalRecords:records.length,withRankTimePair:0,
  withoutRankTimePair:0,totalBranches:0,totalPairs:0,
  isolatedPairs:0,needsReviewPairs:0,
  isolatedWithoutExplicitStyle:0,reviewReasons:{},
  byTimeCode:{},byPhase:{},byRankConstraint:{},byPair:{},
  samples:{isolatedNoExplicitStyle:[],withExplicitStyle:[],
   extraOpportunity:[],orAlternatives:[],unresolvedTiming:[]}};
 const coalesce=(obj,key,n=1)=>{obj[key]=(obj[key]||0)+n;};
 const addSample=(key,rec,p)=>{
  const bucket=summary.samples[key];
  if(bucket.length>=examplesPerGroup)return;
  bucket.push({id:rec.id,name:rec.name,
   rank:p.rank,timing:p.timing,invokeIndex:p.invokeIndex,orIndex:p.orIndex,
   explicitRestrictions:p.explicitRestrictions,
   additionalConditions:p.additionalConditions,
   preConditions:p.preConditions,reviewReasons:p.reviewReasons});
 };
 for(const rec of records){
  const result=analyze(rec);
  if(result.status!=='source-structure')
   throw Error('P2 expected valid fixed skill structure: '+rec?.id);
  if(result.pairs.length)summary.withRankTimePair++;
  else summary.withoutRankTimePair++;
  for(const invoke of rec.invokes)summary.totalBranches+=(invoke.conditions||[]).length;
  for(const p of result.pairs){
   summary.totalPairs++;
   const isIsolated=p.status==='isolated-factual-pair';
   if(isIsolated)summary.isolatedPairs++;
   else summary.needsReviewPairs++;
   if(isIsolated&&!p.hasAnyExplicitStyleConstraint){
    summary.isolatedWithoutExplicitStyle++;
    addSample('isolatedNoExplicitStyle',rec,p);
   }
   if(p.hasAnyExplicitStyleConstraint)addSample('withExplicitStyle',rec,p);
   if(p.additionalConditions.length)addSample('extraOpportunity',rec,p);
   if(p.reviewReasons.includes('or-alternative-exists'))
    addSample('orAlternatives',rec,p);
   if(p.reviewReasons.includes('unresolved-timing'))
    addSample('unresolvedTiming',rec,p);
   for(const why of p.reviewReasons)coalesce(summary.reviewReasons,why);
   for(const t of p.timing){
    coalesce(summary.byTimeCode,t.type);
    for(const k of t.phaseIndexes)coalesce(summary.byPhase,String(k));
    const ranks=p.rank.operatorValues.map(x=>x.operator+x.value).join('&');
    const key=t.type+t.operator+t.value+' | order_rate'+ranks;
    const entry=summary.byPair[key]??={pairs:0,isolated:0,exampleIds:[]};
    entry.pairs++;if(isIsolated)entry.isolated++;
    if(entry.exampleIds.length<examplesPerGroup&&!entry.exampleIds.includes(rec.id))
     entry.exampleIds.push(rec.id);
   }
   coalesce(summary.byRankConstraint,p.rank.operatorValues
    .map(x=>x.operator+x.value).join('&'));
  }
 }
 if(summary.totalRecords!==summary.withRankTimePair+summary.withoutRankTimePair||
   summary.totalPairs!==summary.isolatedPairs+summary.needsReviewPairs)
  throw Error('P2 cohort count did not balance');
 summary.byPair=Object.fromEntries(Object.entries(summary.byPair)
  .sort((a,b)=>b[1].pairs-a[1].pairs||a[0].localeCompare(b[0])));
 return summary;
}
module.exports={cohort};
