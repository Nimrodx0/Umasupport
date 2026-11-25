'use strict';
/*
 * P2.15 / P2.32: first actual reusable mechanism application across all
 * source-matched app skills, NOT a proc/suitability simulation.
 *
 * Reuse the pre-existing source-compiled predicate identities and the
 * source-exact staticValue/check comparison machinery. Evaluate ALL source
 * values individually in a fixed 4 x 4 x 2 axis panel, retaining each of
 * four possible ground_condition values (not artificially choosing one).
 *
 * Each integer from 0..15 is a bitset for ground_condition=1,2,3,4 which
 * has NOT been ruled out by the known static predicates of the given route.
 * No dynamic term is set TRUE and the bitset is NOT a trigger opportunity.
 */
const ticks=require('./skill_source_whole_tick_monitor.cjs');
const full=require('./skill_full_condition_path_audit.cjs');
const reuse=require('./skill_p2_32_mechanism_reuse.cjs');
const AXES=Object.freeze({
 runningStyle:Object.freeze([1,2,3,4]),
 distanceType:Object.freeze([1,2,3,4]),
 groundType:Object.freeze([1,2]),
 groundCondition:Object.freeze([1,2,3,4])
});
const STATIC_CHECKED=new Set([
 'running_style','distance_type','ground_type','ground_condition'
]);
const PANEL=Object.freeze(AXES.runningStyle.flatMap(style=>
 AXES.distanceType.flatMap(distance=>
  AXES.groundType.map(surface=>({running_style:style,
   distance_type:distance,ground_type:surface})))));
const STATUS='P2.15-P2.32-per-source-parameter-static-axis-upper-bound-only';
const assert=(x,msg)=>{if(!x)throw Error('P2.15 3-axis original gate: '+msg)};
const key=(id,inv,c,p)=>[id,inv,c,p===null?'_':p].join('|');
function routeRefs(compiled,m){
 const inv=compiled.invokes[m.invokeOffset];
 assert(inv&&inv.invokeIndex===m.invokeIndex,'original invoke identity mismatch');
 assert(Number.isSafeInteger(m.conditionOrIndex)&&m.conditionOrIndex>=0,
  'condition OR position required');
 const c=inv.conditions[m.conditionOrIndex];
 const pre=m.preconditionOrIndex===null?[]:
  inv.preConditions[m.preconditionOrIndex];
 assert(Array.isArray(c)&&Array.isArray(pre),'source route alternative absent');
 assert((m.preconditionOrIndex===null)===(inv.preConditions.length===0),
  'preconditions alternative topology changed');
 return [...c,...pre];
}
function maskFor(terms,context){
 let mask=0;
 for(const state of AXES.groundCondition){
  const ctx={...context,ground_condition:state};
  if(terms.every(t=>!STATIC_CHECKED.has(t.type)||
   ticks.staticValue(ctx,t)!==ticks.FALSE))
   mask|=1<<(state-1);
 }
 return mask;
}
function routeGrid(compiled,member){
 const refs=routeRefs(compiled,member);
 const masks=PANEL.map(c=>maskFor(refs,c));
 assert(masks.every(x=>Number.isInteger(x)&&x>=0&&x<=15),
  'outside ground-state bitmask domain');
 // Independent pre-existing finite-domain checker is cross-tested against
 // a Cartesian enumeration with the actual source scalar values.
 for(const style of full.STYLES){
  const base=full.checkCombination(refs,style.id);
  const any=PANEL.some((c,i)=>c.running_style===style.id&&masks[i]!==0);
  assert((base==='not-excluded-by-known-domains')===any,
   'finite P2.15 source checker disagrees with per-axis parameterization');
 }
 return {
  groundStateEligibilityMasks:masks,
  unknownDynamicTypes:[...new Set(refs.filter(r=>!STATIC_CHECKED.has(r.type))
   .map(r=>r.type))].sort(),
  exactSourceValuesRetainedInInputOnly:true
 };
}
function panelIndex(style,distance,surface){
 assert([style,distance,surface].every(Number.isSafeInteger)&&
  style>=1&&style<=4&&distance>=1&&distance<=4&&
  surface>=1&&surface<=2,'invalid static comparison axes');
 return ((style-1)*4+(distance-1))*2+(surface-1);
}
function groundAllows(masks,style,distance,surface,condition){
 return !!(masks[panelIndex(style,distance,surface)]&(1<<(condition-1)));
}
function discrimination(masks,axis){
 assert(Array.isArray(masks)&&masks.length===PANEL.length,
  'invalid 32-cell panel');
 for(const style of AXES.runningStyle)
  for(const distance of AXES.distanceType)
   for(const surface of AXES.groundType)
    for(const condition of AXES.groundCondition){
     if(axis==='style'&&style!==1||axis==='distance'&&distance!==1||
        axis==='surface'&&surface!==1)continue;
     const vals=(axis==='style'?AXES.runningStyle:
      axis==='distance'?AXES.distanceType:AXES.groundType).map(value=>{
      const st=axis==='style'?value:style;
      const dt=axis==='distance'?value:distance;
      const gr=axis==='surface'?value:surface;
      return groundAllows(masks,st,dt,gr,condition);
     });
     if(vals.some(x=>x!==vals[0]))return true;
    }
 return false;
}
function audit(model,prior){
 assert(model&&Array.isArray(model.skills)&&
  model.skillById&&prior?.status===reuse.STATUS&&
  Array.isArray(prior.mechanismFamilies),
  'source model and mechanism family report required');
 const before=JSON.stringify(model);
 const modelById=new Map(model.skills.map(x=>[x.id,x]));
 assert(modelById.size===model.skills.length,'duplicated app skill identities');
 const compiled=new Map();
 const fullMembers=[],familySummaries=[];
 const perSkillMasks=new Map(),skillHasDynamic=new Set();
 let routeCount=0;
 for(const family of prior.mechanismFamilies){
  assert(typeof family.familyId==='string'&&
   typeof family.mechanismKernelId==='string'&&
   Array.isArray(family.originalSourceMembers),
   'bad mechanism family');
  const gridSignatures=new Set(),sourceIds=new Set();
  for(const m of family.originalSourceMembers){
   const skill=modelById.get(m.skillId);
   assert(skill&&skill.activationProfile?.status==='source-structure'&&
    skill.activationProfile.sourceNumericId===m.sourceNumericId,
    'source skill and reference mismatch');
   if(!compiled.has(m.sourceNumericId))
    compiled.set(m.sourceNumericId,ticks.compile(skill));
   const facts=routeGrid(compiled.get(m.sourceNumericId),m);
   const identity=key(m.sourceNumericId,m.invokeOffset,
    m.conditionOrIndex,m.preconditionOrIndex);
   assert(!fullMembers.some(x=>x.routeKey===identity),
    'duplicated source route in grouping');
   gridSignatures.add(JSON.stringify(facts.groundStateEligibilityMasks));
   sourceIds.add(m.sourceNumericId);
   fullMembers.push({
    sourceNumericId:m.sourceNumericId,
    invokeOffset:m.invokeOffset,invokeIndex:m.invokeIndex,
    conditionOrIndex:m.conditionOrIndex,
    preconditionOrIndex:m.preconditionOrIndex,
    routeKey:identity,
    familyId:family.familyId,mechanismKernelId:family.mechanismKernelId,
    ...facts,
    routeMayBeStaticallyEligibleSomewhere:facts.groundStateEligibilityMasks.some(Boolean),
    runtimeSourceConditionsVerified:false
   });
   if(facts.unknownDynamicTypes.length)skillHasDynamic.add(m.sourceNumericId);
   const union=perSkillMasks.get(m.sourceNumericId)??Array(PANEL.length).fill(0);
   for(let i=0;i<PANEL.length;i++)union[i]|=facts.groundStateEligibilityMasks[i];
   perSkillMasks.set(m.sourceNumericId,union);
   routeCount++;
  }
  assert(sourceIds.size===family.distinctSourceSkills&&
   family.sourceRouteFamilies===family.originalSourceMembers.length,
   'mechanism family members count changed');
  familySummaries.push({
   familyId:family.familyId,mechanismKernelId:family.mechanismKernelId,
   sourceRouteFamilies:family.sourceRouteFamilies,
   distinctSourceSkills:family.distinctSourceSkills,
   distinctExactSourceParameterSets:family.distinctExactNumericParameterSets,
   distinctAxisGatePatterns:gridSignatures.size,
   // Operator/numeric parameter variation can change explicit eligibility,
   // but one family's dynamic mechanism algorithm remains reusable.
   independentlyRecheckedEverySourcePredicate:true,
   wholeSourceANDProven:false
  });
 }
 // Source Invokes with no conditions contain NO recorded condition OR
 // route in the P2.32 queue, but still belong to the source-matched cohort.
 // Compile them conservatively; they will receive the explicit hold below.
 for(const skill of model.skills){
  const p=skill.activationProfile;
  if(p?.status==='source-structure'&&!compiled.has(p.sourceNumericId))
   compiled.set(p.sourceNumericId,ticks.compile(skill));
 }
 assert(routeCount===prior.denominators.sourceRouteFamilies&&
  compiled.size===prior.denominators.sourceMatchedSkills,
  'source original-route cohort changed');
 const sourceRows=[],emptyInvokeSourceIds=[];
 for(const skill of model.skills){
  if(skill.activationProfile?.status!=='source-structure'){
   sourceRows.push({skillId:skill.id,sourceNumericId:null,
    status:'unmatched-source-no-gate-inference'});
   continue;
  }
  const id=skill.activationProfile.sourceNumericId;
  const ref=compiled.get(id);
  assert(ref,'missing compiled matched skill');
  let masks=perSkillMasks.get(id)??Array(PANEL.length).fill(0);
  const hasEmpty=ref.invokes.some(v=>!v.conditions.length);
  if(hasEmpty){
   // Empty conditions invokes are TRUE in source, perhaps gated by
   // preconditions history. We cannot prove a universal exclusion here.
   masks=Array(PANEL.length).fill(15);
   emptyInvokeSourceIds.push(id);
  }
  const distance=discrimination(masks,'distance');
  const surface=discrimination(masks,'surface');
  const style=discrimination(masks,'style');
  sourceRows.push({
   skillId:skill.id,sourceNumericId:id,
   status:hasEmpty?'source-empty-condition-invoke-held':
    'static-necessary-gates-only',
   potentialGroundStateMasks:masks,
   hasKnownStyleGateContrast:style,
   hasKnownDistanceGateContrast:distance,
   hasKnownSurfaceGateContrast:surface,
   unknownDynamicSourcePredicatesPresent:skillHasDynamic.has(id),
   noDynamicConditionsEvaluated:true,
   actualSkillTriggerObserved:false
  });
 }
 const matched=sourceRows.filter(x=>x.sourceNumericId!==null);
 const num=predicate=>matched.filter(predicate).length;
 const result={
  schemaVersion:1,status:STATUS,
  pinnedGameModelRevision:prior.pinnedGameModelRevision,
  panelDefinition:{order:'running_style 1..4 × distance_type 1..4 × ground_type 1..2',
   groundConditionBitIndex:'1<< (ground_condition - 1)',
   eachCellMeaning:'bit set means NO CONTRADICTION in original recognized source static gates; unknown dynamic predicates still UNKNOWN',
   contexts:PANEL},
  denominators:{
   appSkills:model.skills.length,sourceMatchedSkills:matched.length,
   sourceUnavailableSkills:model.skills.length-matched.length,
   sourceRouteFamilies:routeCount,
   exactStructureFamilies:familySummaries.length,
   sharedMechanismKernels:prior.denominators.sharedMechanismKernels,
   familiesWithDifferentStaticAxisMasks:familySummaries.filter(x=>
    x.distinctAxisGatePatterns>1).length,
   skillsWithSomeDistanceStaticGateContrast:num(x=>x.hasKnownDistanceGateContrast),
   skillsWithSomeSurfaceStaticGateContrast:num(x=>x.hasKnownSurfaceGateContrast),
   skillsWithSomeStyleStaticGateContrast:num(x=>x.hasKnownStyleGateContrast),
   skillsWithNoStaticallyPossibleAxisContext:num(x=>
    x.potentialGroundStateMasks.every(v=>v===0)),
   skillsWithUnrestrictedPotentialStaticAxisContexts:num(x=>
    x.potentialGroundStateMasks.every(v=>v===15)),
   skillsWithEmptyConditionInvokeHeld:emptyInvokeSourceIds.length,
   sourceRuntimePredicateMeasurements:0,
   completedWholeSkillConditionEvaluations:0,
   verifiedGameProcProbabilities:0,
   officialSkillCardSuitabilityScores:0,
   actualAppliedOmissions:0
  },
  familyStaticPatternSummaries:familySummaries,
  sourceRows,
  routeRows:fullMembers,
  caveats:[
   'No original game runtime was executed, and no GlobalSim rank/timing facts are added by this finite panel.',
   'Every non-static source predicate remains unresolved, even when a prior P2.15 mechanism has model-tick or geometry evidence.',
   'A nonzero ground-state bitmask is a NECESSARY static compatibility upper bound, NOT whole AND/OR/precondition activation.',
   'Ground condition is enumerated jointly per context, not chosen independently for individual predicates.',
   'A zero static mask may prove an original route inconsistent under the source finite predicates only; it cannot prove the absence of another source Invoke/OR alternative.',
   'Source threshold and operator values are evaluated individually using the existing source AST and checker; only normalized masks and IDs are emitted.',
   'Distance/surface contrasts here are EXPLICIT eligibility only, not implicit dynamic activation opportunity, model race probability, effect usefulness or P3/P4 rating.'
  ]
 };
 assert(JSON.stringify(model)===before,'original app model mutated');
 return result;
}
module.exports={AXES,PANEL,STATUS,STATIC_CHECKED,maskFor,routeGrid,
 panelIndex,groundAllows,discrimination,audit};
