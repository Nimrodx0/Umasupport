'use strict';
/*
 * P2.32 -> P2.15 research-selection handoff.
 * Read-only structural candidate ordering, NOT an evaluated skill condition.
 * A shared source OR/precondition alternative is compared across 4 styles;
 * a route from another Invoke/OR is NEVER spliced into that comparison.
 *
 * Important: "finite compatible" means only that the four P2.15 finite
 * domains did not prove a contradiction. It does not prove a skill fires.
 */
const sourceBlockers=require('./skill_source_path_blocker_impact.cjs');
const spec=require('./skill_condition_spec_omission.cjs');
const triage=require('./skill_condition_research_triage.cjs');
const styles=require('./skill_full_condition_path_audit.cjs').STYLES;
const SOURCE_TYPES=Object.freeze({
 rank:'rank-opportunity-study',
 event:'interaction-or-spurt-pilot',
 timing:'timing-or-geometry-only',
 context:'explicit-eligibility'
});
const STATUS='P2.32-source-route-research-selection-not-complete-skill-suitability';
const RESEARCH_ORDER=Object.freeze([
 'rank-source-join-first',
 'event-state-pilot-next',
 'complex-dynamic-route-hold',
 'single-style-opportunity-study',
 'context-or-setup-gate-first',
 'source-structure-only-hold'
]);
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const unique=xs=>[...new Set(xs)].sort();
const keyOf=r=>JSON.stringify([
 r.invokeOffset,r.conditionOrIndex,r.preconditionOrIndex
]);
const compareId=(a,b)=>a.localeCompare(b,undefined,{numeric:true});
function assignGroup(route){
 const missing=route.unverifiedTypes;
 const groups=missing.map(t=>triage.typeDecision(t).group);
 const specCandidates=missing.filter(t=>
  spec.classify(t).classification==='conditional-axis-omission-candidate');
 const context=missing.filter(t=>
  triage.typeDecision(t).group===SOURCE_TYPES.context&&!specCandidates.includes(t));
 const rank=missing.filter(t=>triage.typeDecision(t).group===SOURCE_TYPES.rank);
 const event=missing.filter(t=>triage.typeDecision(t).group===SOURCE_TYPES.event);
 const comparable=route.finiteCompatibleStyles.length>=2;
 const residual=missing.filter(t=>!specCandidates.includes(t));
 // Removing a fixed-state candidate here means "hypothetical after checking
 // the stated comparison assumptions". The original source is not changed.
 const count=residual.length;
 const conditional=specCandidates.length>0;
 let researchGroup,nextStep;
 if(context.length){
  researchGroup='context-or-setup-gate-first';
  nextStep='validate-actual-race-and-horse-context-before-any-axis-comparison';
 }else if(comparable&&rank.length&&count<=2){
  researchGroup='rank-source-join-first';
  nextStep='check-source-exact-rank-window-AND-at-the-same-runner-and-tick';
 }else if(comparable&&event.length&&count<=2){
  researchGroup='event-state-pilot-next';
  nextStep='verify-event-state-mechanism-before-same-tick-intersection';
 }else if(comparable&&(rank.length||event.length)){
  researchGroup='complex-dynamic-route-hold';
  nextStep='select-one-testable-condition-and-keep-other-AND-terms-unverified';
 }else if(route.finiteCompatibleStyles.length===1&&(rank.length||event.length)){
  researchGroup='single-style-opportunity-study';
  nextStep='study-absolute-opportunity-within-explicitly-compatible-style';
 }else{
  researchGroup='source-structure-only-hold';
  nextStep='review-game-mechanics-and-practical-impact-before-simulation';
 }
 return {researchGroup,nextStep,
  fixedStateAssumptionsRequired:conditional,
  fixedStateCandidateTypes:specCandidates,
  contextOrSetupTypes:context,
  rankStudyTypes:rank,
  eventStudyTypes:event,
  missingTypesBeforeFixedState:missing.length,
  missingTypesOnlyIfFixedStateAssumptionsSatisfied:count,
  // These types are not presumed already measured. A rank study is partial
  // evidence, NOT source-exact full-AND proof.
  noCompleteSourceRouteClaim:true,
  neverReadyForP3CardScoring:true,
  typeGroups:unique(groups)};
}
function analyzeSkill(skill){
 if(!isObj(skill)||typeof skill.id!=='string')
  throw Error('P2.32 selection: malformed app skill');
 if(skill.activationProfile?.status!=='source-structure')
  return {skillId:skill.id,sourceNumericId:null,
   status:'source-unavailable',routeFamilies:[]};
 const p=skill.activationProfile;
 if(!/^\d+$/.test(p.sourceNumericId||''))
  throw Error('P2.32 selection: invalid matched source numeric ID');
 const routeFamilies=new Map();
 for(const style of styles){
  for(const r of sourceBlockers.routes(skill,style.id)){
   const key=keyOf(r);
   let family=routeFamilies.get(key);
   if(!family){
    family={
     invokeOffset:r.invokeOffset,invokeIndex:r.invokeIndex,
     conditionOrIndex:r.conditionOrIndex,
     preconditionOrIndex:r.preconditionOrIndex,
     conditionOrCount:r.conditionOrCount,
     preconditionOrCount:r.preconditionOrCount,
     hasOtherInvokes:r.hasOtherInvokes,
     unverifiedTypes:r.unresolvedTypes,
     finiteCompatibleStyles:[],finiteIncompatibleStyles:[],
     routeKey:key
    };
    routeFamilies.set(key,family);
   }else if(family.invokeIndex!==r.invokeIndex||
      JSON.stringify(family.unverifiedTypes)!==JSON.stringify(r.unresolvedTypes)||
      family.conditionOrCount!==r.conditionOrCount||
      family.preconditionOrCount!==r.preconditionOrCount)
    throw Error('P2.32 selection: source route varies across styles');
   if(r.finiteGateStatus==='not-excluded-by-known-domains')
    family.finiteCompatibleStyles.push(style.name);
   else family.finiteIncompatibleStyles.push({
    style:style.name,knownDomainStatus:r.finiteGateStatus
   });
  }
 }
 const routes=[...routeFamilies.values()].map(route=>{
  if(route.finiteCompatibleStyles.length+route.finiteIncompatibleStyles.length!==styles.length)
   throw Error('P2.32 selection: lost original style path cell');
  return {...route,...assignGroup(route)};
 });
 return {skillId:skill.id,sourceNumericId:p.sourceNumericId,
  status:'source-route-research-candidates-only',routeFamilies:routes};
}
function audit(model,{blockerReport,specReport}={}){
 if(!isObj(model)||!Array.isArray(model.skills)||!isObj(model.skillById)||
    blockerReport?.status!==sourceBlockers.sourceStatus||
    specReport?.status!=='p2-32-game-spec-conditional-omission-triage-only')
  throw Error('P2.32 selection: pinned source audits required');
 const before=JSON.stringify(model);
 const rows=model.skills.map(analyzeSkill);
 if(JSON.stringify(model)!==before)
  throw Error('P2.32 selection: original app model modified');
 if(new Set(rows.map(r=>r.skillId)).size!==rows.length)
  throw Error('P2.32 selection: duplicate app skill ID');
 const matched=rows.filter(r=>r.sourceNumericId!==null);
 if(new Set(matched.map(r=>r.sourceNumericId)).size!==matched.length)
  throw Error('P2.32 selection: duplicate source numeric identity');
 const blockersById=new Map(blockerReport.rows.map(r=>[r.sourceNumericId,r]));
 const specById=new Map(specReport.rows.filter(r=>r.sourceNumericId)
  .map(r=>[r.sourceNumericId,r]));
 if(blockersById.size!==matched.length||specById.size!==matched.length||
    blockerReport.denominators.sourceMatchedSkills!==matched.length||
    specReport.denominators.sourceMatchedSkills!==matched.length||
    rows.length!==blockerReport.denominators.appSkills||
    rows.length!==specReport.denominators.appSkills)
  throw Error('P2.32 selection: mismatch between source-audit cohorts');
 const allRoutes=[];
 for(const r of matched){
  const b=blockersById.get(r.sourceNumericId),s=specById.get(r.sourceNumericId);
  if(!b||!s||s.skillId!==r.skillId||b.skillId!==r.skillId)
   throw Error('P2.32 selection: source identity or matching record drift');
  const srcSkill=model.skills.find(x=>x.id===r.skillId);
  for(const style of styles){
   const raw=sourceBlockers.routes(srcSkill,style.id);
   const observed=raw.filter(x=>x.finiteGateStatus==='not-excluded-by-known-domains');
   const prior=b.byStyle[style.name];
   if(raw.length!==prior.allSourceRouteAlternatives||
      observed.length!==prior.finiteCompatibleRoutes)
    throw Error('P2.32 selection: disagreement with P2.15 path gates');
  }
  const wantFixed=s.occurrences.filter(o=>
   o.classification==='conditional-axis-omission-candidate').length;
  const gotFixed=r.routeFamilies.reduce((n,f)=>n+
   f.unverifiedTypes.filter(t=>spec.classify(t).classification===
    'conditional-axis-omission-candidate').length,0);
  // Distinct TYPE per source route, and original occurrence counts are
  // different units. Never assert they are equal on repeated AND predicates.
  if(gotFixed>wantFixed*styles.length&&wantFixed===0)
   throw Error('P2.32 selection: missing source fixed-state candidate');
  for(const family of r.routeFamilies){
   // Preserve ALL source route families, even those finite-gate excluded.
   allRoutes.push({sourceNumericId:r.sourceNumericId,skillId:r.skillId,...family});
  }
 }
 const actionable=allRoutes.filter(r=>r.finiteCompatibleStyles.length>0);
 const ordered=actionable.slice().sort((a,b)=>{
  const group=RESEARCH_ORDER.indexOf(a.researchGroup)-
   RESEARCH_ORDER.indexOf(b.researchGroup);
  if(group)return group;
  const types=a.missingTypesOnlyIfFixedStateAssumptionsSatisfied-
    b.missingTypesOnlyIfFixedStateAssumptionsSatisfied;
  if(types)return types;
  const pairs=b.finiteCompatibleStyles.length-a.finiteCompatibleStyles.length;
  if(pairs)return pairs;
  const id=compareId(a.sourceNumericId,b.sourceNumericId);
  return id||a.invokeOffset-b.invokeOffset||
   a.conditionOrIndex-b.conditionOrIndex||
   (a.preconditionOrIndex??-1)-(b.preconditionOrIndex??-1);
 });
 const researchGroups=Object.fromEntries(RESEARCH_ORDER.map(g=>[g,{
  routeFamilies:actionable.filter(r=>r.researchGroup===g).length,
  sourceSkills:new Set(actionable.filter(r=>r.researchGroup===g)
   .map(r=>r.sourceNumericId)).size
 }]));
 const typeBuckets=new Map();
 for(const r of actionable.filter(x=>
   ['rank-source-join-first','event-state-pilot-next'].includes(x.researchGroup))){
  for(const type of r.unverifiedTypes){
   const bucket=typeBuckets.get(type)??{type,routeFamilies:0,
    sourceSkillIds:new Set(),routeFamilyKeys:new Set(),
    isFixedStateCandidate:spec.classify(type).classification===
     'conditional-axis-omission-candidate'};
   const k=r.sourceNumericId+'|'+r.routeKey;
   if(!bucket.routeFamilyKeys.has(k)){
    bucket.routeFamilies++;
    bucket.sourceSkillIds.add(r.sourceNumericId);
    bucket.routeFamilyKeys.add(k);
   }
   typeBuckets.set(type,bucket);
  }
 }
 const nextTypeResearch=[...typeBuckets.values()].map(t=>({
  type:t.type,distinctSourceSkills:t.sourceSkillIds.size,
  routeFamilies:t.routeFamilies,
  conditionalFixedStateCandidate:t.isFixedStateCandidate,
  // Measuring this type alone does not evaluate the entire source route.
  countsArePotentialReviewScopeOnly:true
 })).sort((a,b)=>b.distinctSourceSkills-a.distinctSourceSkills||
  b.routeFamilies-a.routeFamilies||a.type.localeCompare(b.type));
 return {
  schemaVersion:1,status:STATUS,
  pinnedGameModelRevision:spec.SOURCE_REV,
  denominators:{
   appSkills:rows.length,sourceMatchedSkills:matched.length,
   sourceUnavailableSkills:rows.length-matched.length,
   originalRouteFamilies:allRoutes.length,
   finiteCompatibleRouteFamilies:actionable.length,
   finiteExcludedRouteFamilies:allRoutes.length-actionable.length,
   candidateSkillIds:unique(ordered.filter(r=>
    ['rank-source-join-first','event-state-pilot-next'].includes(r.researchGroup))
    .map(r=>r.sourceNumericId)).length,
   completedSourceRouteEvaluations:0,
   actualAppliedOmissions:0,
   officialP3OrP4Ratings:0
  },
  byResearchGroup:researchGroups,
  nextTypeResearch,
  // Sorted, referenceable list of exact source routes to resume in P2.15.
  // No original source predicate strings or game data are republished.
  priorityRouteCandidates:ordered.slice(0,100),
  rows,
  limitations:[
   'Research ordering is a heuristic for choosing a next experiment, not a derived skill ranking or observed trigger probability.',
   'Compatible means not explicitly contradicted by the checked finite domains; track_id and other course/horses constraints may remain unresolved.',
   'A common route across multiple styles is necessary for a comparable P2.15 source-branch contrast, not sufficient evidence of different probabilities.',
   'Known source predicate types including rank/phase remain unmeasured for whole-skill AND/OR/Invoke semantics.',
   'Fixed motivation is removable only from a hypothetical contrast where the same value satisfies the source predicate in every compared case.',
   'Route families are scoped to their original Invoke and condition/precondition OR indices. Other branches cannot donate successful conditions.',
   'No full proc observations, real-game evidence, formal thresholds, P3 scores or UI changes.'
  ]
 };
}
module.exports={STATUS,RESEARCH_ORDER,assignGroup,analyzeSkill,audit};
