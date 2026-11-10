'use strict';
/* P2 read-only source-path audit. It does not infer style likelihood or
 * collapse a non-predictable condition to a generic/universal skill. */
const triage=require('./skill_condition_research_triage.cjs');
const RANK='rank-opportunity-study';
const DEFERRED=new Set(['no-general-style-inference',
 'complex-or-external-hold','unreviewed']);
const normal=x=>String(x||'').normalize('NFKC').trim();
function analyze(records){
 if(!Array.isArray(records))throw Error('Matched source skill records required');
 const cases=[],ids=new Set();
 for(const skill of records){
  if(!skill||typeof skill.id!=='string'||!/^\d+$/.test(skill.id)||
     typeof skill.name!=='string'||!Array.isArray(skill.invokes)||
     ids.has(skill.id))throw Error('Malformed or duplicate source identity');
  ids.add(skill.id);
  const paths=[];
  for(const [invokeOffset,inv] of skill.invokes.entries()){
   for(const side of ['preConditions','conditions']){
    const groups=inv[side]||[];
    if(!Array.isArray(groups))throw Error('Malformed source OR groups');
    for(const [orIndex,row] of groups.entries()){
     if(!Array.isArray(row))throw Error('Malformed source AND row');
     const rankTypes=[...new Set(row.filter(x=>triage.typeDecision(x.type).group===RANK)
      .map(x=>x.type))].sort();
     const deferredTypes=[...new Set(row.filter(x=>
      DEFERRED.has(triage.typeDecision(x.type).group))
      .map(x=>x.type))].sort();
     const pilotTypes=[...new Set(row.filter(x=>
      triage.typeDecision(x.type).group==='interaction-or-spurt-pilot')
      .map(x=>x.type))].sort();
     // Do not publish original condition values or full source skill records.
     paths.push({invokeIndex:inv.index??invokeOffset,
      invokeOffset,side,orIndex,rankTypes,deferredTypes,pilotTypes,
      rankAndDeferredSameAnd:rankTypes.length>0&&deferredTypes.length>0});
    }
   }
  }
  const ranked=paths.filter(p=>p.rankTypes.length),
   deferred=paths.filter(p=>p.deferredTypes.length);
  if(!ranked.length||!deferred.length)continue;
  const sameAnd=paths.filter(p=>p.rankAndDeferredSameAnd);
  const shareInvoke=ranked.some(a=>deferred.some(b=>
   a.invokeOffset===b.invokeOffset));
  const shareOppositeSide=ranked.some(a=>deferred.some(b=>
   a.invokeOffset===b.invokeOffset&&a.side!==b.side));
  const classifications={
   sameAnd:!!sameAnd.length,
   sameInvokeOnlyWithoutSameAnd:!sameAnd.length&&shareInvoke,
   differentInvokeOnly:!sameAnd.length&&!shareInvoke,
   intersectsPreconditions:shareOppositeSide,
   hasRankOnlyAnd:ranked.some(p=>!p.deferredTypes.length),
   hasDeferredOnlyAnd:deferred.some(p=>!p.rankTypes.length)
  };
  const cohort=classifications.sameAnd?'same-AND-conjunction':
    classifications.sameInvokeOnlyWithoutSameAnd?'separate-AND-or-sides':
      'different-invokes-only';
  cases.push({sourceNumericId:skill.id,skillName:normal(skill.name),
   cohort,classification:classifications,
   allRankTypes:[...new Set(ranked.flatMap(p=>p.rankTypes))].sort(),
   allDeferredTypes:[...new Set(deferred.flatMap(p=>p.deferredTypes))].sort(),
   rankRows:ranked.length,deferredRows:deferred.length,
   sameAndRows:sameAnd.length,
   invokes:skill.invokes.length,paths,
   disposition:'hold-whole-skill-style-suitability',
   note:'Every Invoke, OR and precondition path must be evaluated in context. '+
    'Unresearched or skipped style inference is not a generic/neutral '+
    'or zero-opportunity predicate.'});
 }
 cases.sort((a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId));
 const count=f=>cases.filter(f).length;
 return {
  schemaVersion:1,
  status:'P2-source-structure-rank-and-deferred-mixed-cohort-not-style-suitability',
  sourceDenominator:records.length,
  mixedSkills:cases.length,
  byRelation:{
   sameAnd:count(x=>x.classification.sameAnd),
   sameInvokeOnlyWithoutSameAnd:count(x=>
    x.classification.sameInvokeOnlyWithoutSameAnd),
   differentInvokeOnly:count(x=>x.classification.differentInvokeOnly),
   intersectsPreconditions:count(x=>x.classification.intersectsPreconditions),
   hasRankOnlyAnd:count(x=>x.classification.hasRankOnlyAnd),
   hasDeferredOnlyAnd:count(x=>x.classification.hasDeferredOnlyAnd)
  },
  byDeferredType:Object.fromEntries([...new Set(cases.flatMap(x=>x.allDeferredTypes))]
   .sort().map(type=>[type,count(x=>x.allDeferredTypes.includes(type))])),
  cases,
  limitations:[
   'Skill-level overlap does not prove rank and deferred conditions are in the same AND row.',
   'Across Invoke, preconditions or OR alternatives, marginal measurements may not be combined.',
   'A skipped distance-to-horse condition is unknown for style, NOT generic or style-neutral.',
   'No game activation probabilities, card grade or effect usefulness are computed.'
  ]
 };
}
module.exports={RANK,DEFERRED,analyze};
