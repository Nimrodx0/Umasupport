'use strict';
/*
 * P2.15 source-only blocker impact.
 *
 * Treat source Invoke/OR/AND/preConditions as actual logical branching.
 * "No remaining unsupported TYPE" does not mean that even one predicate has
 * been evaluated in a simulator or the game. It only ranks next research.
 */
const full=require('./skill_full_condition_path_audit.cjs');
const FIELDS=full.DOMAINS;
const names=full.STYLES;
const uniq=xs=>[...new Set(xs)].sort();
const ordered=xs=>xs.slice().sort((a,b)=>a.localeCompare(b));
const sourceStatus='P2.15-source-route-blocker-candidates-not-proc-possibility';
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function routes(skill,styleId){
 const p=skill.activationProfile;
 if(!p||p.status!=='source-structure')return [];
 if(!Array.isArray(p.invokes)||!p.invokes.length||
  !/^\d+$/.test(p.sourceNumericId||''))
  throw Error('P2.15 blocker: malformed original source identity');
 const out=[];
 for(const [invokeOffset,inv] of p.invokes.entries()){
  if(!isObj(inv)||!Array.isArray(inv.conditions)||
   !Array.isArray(inv.preConditions)||
   inv.conditions.some(x=>!Array.isArray(x))||
   inv.preConditions.some(x=>!Array.isArray(x)))
   throw Error('P2.15 blocker: invalid Invoke AND/OR matrix');
  for(const [conditionOrIndex,and] of inv.conditions.entries()){
   const preRows=inv.preConditions.length?inv.preConditions:[[]];
   for(const [preIndex,pre] of preRows.entries()){
    for(const q of [...and,...pre])
     if(!isObj(q)||typeof q.type!=='string'||
      !['==','!=','<','<=','>','>='].includes(q.operator)||
      !Number.isSafeInteger(q.value))
      throw Error('P2.15 blocker: invalid original predicate');
    const status=full.checkCombination([...and,...pre],styleId);
    const unknown=uniq([...and,...pre].map(x=>x.type)
     .filter(type=>!Object.hasOwn(FIELDS,type)));
    out.push({
     invokeOffset,
     invokeIndex:inv.index??invokeOffset,
     conditionOrIndex,
     preconditionOrIndex:inv.preConditions.length?preIndex:null,
     conditionOrCount:inv.conditions.length,
     preconditionOrCount:inv.preConditions.length,
     finiteGateStatus:status,
     // Exact conjunctive UNMEASURED type set, not a union of all pre-ORs.
     unresolvedTypes:unknown,
     blockerTypeCount:unknown.length,
     hasOtherInvokes:p.invokes.length>1
    });
   }
  }
 }
 return out;
}
function analyzeSkill(skill){
 if(!isObj(skill)||typeof skill.id!=='string')
  throw Error('P2.15 blocker: malformed app skill');
 if(skill.activationProfile?.status!=='source-structure')
  return {skillId:skill.id,status:'original-source-unmatched',byStyle:null};
 const sourceNumericId=skill.activationProfile.sourceNumericId;
 const byStyle={};
 for(const style of names){
  const all=routes(skill,style.id);
  const viable=all.filter(x=>x.finiteGateStatus==='not-excluded-by-known-domains');
  const min=viable.length?Math.min(...viable.map(x=>x.blockerTypeCount)):null;
  const best=viable.filter(x=>x.blockerTypeCount===min);
  const zero=viable.some(x=>!x.blockerTypeCount);
  const singleton=uniq(viable.filter(x=>x.blockerTypeCount===1)
   .map(x=>x.unresolvedTypes[0]));
  const candidates=zero?[]:singleton;
  const allPairs=uniq(viable.filter(x=>x.blockerTypeCount===2)
   .map(x=>x.unresolvedTypes.join(' + ')));
  byStyle[style.name]={
   status:min===null?'no-finite-domain-compatible-route':
    min===0?'only-finite-predicate-types-in-some-route':
    min===1?'one-unverified-predicate-type-away-in-some-route':
    'two-or-more-unverified-types-in-every-route',
   finiteCompatibleRoutes:viable.length,
   finiteIncompatibleRoutes:all.length-viable.length,
   allSourceRouteAlternatives:all.length,
   minimumRemainingTypeCount:min,
   // A type is counted once per candidate skill/style cell.
   singleTypeResearchCandidates:candidates,
   twoTypeResearchCandidates:min>=2?allPairs:[],
   bestRouteAlternatives:best.map(x=>({
    invokeOffset:x.invokeOffset,conditionOrIndex:x.conditionOrIndex,
    preconditionOrIndex:x.preconditionOrIndex,
    unresolvedTypes:x.unresolvedTypes,
    additionalInvokesPresent:x.hasOtherInvokes,
    conditionOrCount:x.conditionOrCount,
    preconditionOrCount:x.preconditionOrCount
   }))
  };
 }
 return {skillId:skill.id,sourceNumericId,
  status:'original-source-branch-structure-audited-not-runtime-measured',
  invokes:skill.activationProfile.invokes.length,
  byStyle};
}
function audit(model,sourceRankCohort){
 if(!model||!Array.isArray(model.skills)||!model.skillById||
  !Array.isArray(sourceRankCohort)||!sourceRankCohort.length)
  throw Error('P2.15 blocker: app source model and signed-rank cohort required');
 const cohort=new Set(sourceRankCohort.map(String));
 if(cohort.size!==sourceRankCohort.length||
  sourceRankCohort.some(x=>!/^\d+$/.test(String(x))))
  throw Error('P2.15 blocker: signed-rank source identities repeated or unknown');
 const old=JSON.stringify(model.cards||[]);
 const checked=model.skills.map(analyzeSkill);
 if(JSON.stringify(model.cards||[])!==old)
  throw Error('P2.15 blocker mutated app cards');
 const matched=checked.filter(x=>x.byStyle!==null),unmatched=checked.filter(x=>x.byStyle===null);
 if(new Set(checked.map(x=>x.skillId)).size!==checked.length||
  new Set(matched.map(x=>x.sourceNumericId)).size!==matched.length)
  throw Error('P2.15 blocker: duplicate source skill');
 const present=new Set(matched.map(x=>x.sourceNumericId));
 if([...cohort].some(x=>!present.has(x)))
  throw Error('P2.15 blocker: missing original signed rank cohort');
 const cells=matched.flatMap(x=>names.map(style=>({
  sourceNumericId:x.sourceNumericId,style:style.name,
  info:x.byStyle[style.name],
  isSignedRankChangeSource:cohort.has(x.sourceNumericId)
 })));
 const counts={};
 for(const cell of cells)counts[cell.info.status]=(counts[cell.info.status]||0)+1;
 const groups=new Map();
 for(const cell of cells){
  if(!cell.info.singleTypeResearchCandidates.length)continue;
  for(const type of cell.info.singleTypeResearchCandidates){
   if(!groups.has(type))groups.set(type,{type,styleCells:new Set(),skills:new Set(),
    signedRankSourceStyleCells:new Set(),signedRankSourceSkills:new Set()});
   const g=groups.get(type);
   const k=cell.sourceNumericId+'|'+cell.style;
   g.styleCells.add(k);
   g.skills.add(cell.sourceNumericId);
   if(cell.isSignedRankChangeSource){
    g.signedRankSourceStyleCells.add(k);
    g.signedRankSourceSkills.add(cell.sourceNumericId);
   }
  }
 }
 const possibleNextTypes=[...groups.values()].map(g=>({
  type:g.type,uniqueStyleCellsOneTypeAway:g.styleCells.size,
  uniqueSourceSkillsWithAtLeastOneStyleCell:g.skills.size,
  signedRankCohortStyleCells:g.signedRankSourceStyleCells.size,
  signedRankCohortSkills:g.signedRankSourceSkills.size
 })).sort((a,b)=>b.uniqueSourceSkillsWithAtLeastOneStyleCell-
  a.uniqueSourceSkillsWithAtLeastOneStyleCell||
  b.uniqueStyleCellsOneTypeAway-a.uniqueStyleCellsOneTypeAway||
  a.type.localeCompare(b.type));
 const cohortCells=cells.filter(x=>x.isSignedRankChangeSource);
 const allSourceCellTotal=matched.length*4;
 if(cells.length!==allSourceCellTotal)throw Error('P2.15 blocker: lost style cells');
 const distinct=ss=>new Set(ss).size;
 return {
  schemaVersion:1,status:sourceStatus,
  denominators:{appSkills:checked.length,sourceMatchedSkills:matched.length,
   sourceUnmatchedSkills:unmatched.length,allSourceStyleCells:cells.length,
   signedRankSourceSkills:cohort.size,signedRankSourceStyleCells:cohortCells.length},
  byMinimumUnknownTypeCount:counts,
  zeroTypeBlockerSourceSkills:distinct(cells.filter(x=>
   x.info.minimumRemainingTypeCount===0).map(x=>x.sourceNumericId)),
  oneTypeBlockerSourceSkills:distinct(cells.filter(x=>
   x.info.minimumRemainingTypeCount===1).map(x=>x.sourceNumericId)),
  cohortByMinimumUnknownTypeCount:Object.fromEntries(
   uniq(cohortCells.map(x=>x.info.status)).map(status=>[status,
    cohortCells.filter(x=>x.info.status===status).length])),
  impactIfOneTypeCouldBeMeasured:possibleNextTypes,
  rows:matched,
  limitations:[
   'This is a source-structure candidate audit only. Zero unsupported TYPEs does NOT mean that source comparisons, race context or skill invocation were measured.',
   'An OR alternative with one remaining predicate code is counted separately from other OR alternatives and other Invokes; it is NOT a whole-skill evaluation.',
   'A type may occur in multiple predicates with different operators/values. Resolving a TYPE requires evaluating all exact source predicates of that type in the SAME relevant runtime tick.',
   'The candidate count is an optimistic upper bound of source skill/style pairs which might acquire a fully instrumented branch, never a forecast of ratings, proc rates or actual skill benefit.',
   'Unknown predicates, source preconditions, OR paths, multi Invoke, activation, gameplay effects, model-vs-game validity and source rights remain separately gated.',
   'Partial-condition W/D evidence from P2.13/P2.20 is not treated as full source predicate measurement and cannot silently clear a blocker.'
  ]};
}
module.exports={routes,analyzeSkill,audit,sourceStatus};
