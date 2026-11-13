'use strict';
/*
 * P2.32: reuse existing P2.15 MECHANISM studies across original source
 * predicate families, never copy a particular skill's activation outcome.
 *
 * A family normalizes literal threshold VALUES only. It preserves:
 * - separate conditions AND from latched preConditions AND;
 * - repeated predicates and original comparison operators;
 * - OR cardinalities and presence of other Invoke alternatives.
 * Exact values and source branch identities are retained in the input model.
 *
 * The generated artifact contains NO full original predicate data/values.
 */
const {createHash}=require('node:crypto');
const queue=require('./skill_p2_32_research_queue.cjs');
const evidence=require('./skill_p2_15_mechanism_evidence.cjs');
const STATUS='P2.32-mechanism-reuse-source-family-audit-not-skill-suitability';
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const opOk=new Set(['==','!=','<','<=','>','>=']);
const unique=xs=>[...new Set(xs)].sort();
const compareId=(a,b)=>a.localeCompare(b,undefined,{numeric:true});
function predicateTerms(terms){
 if(!Array.isArray(terms)||terms.some(x=>!isObj(x)||
   typeof x.type!=='string'||!x.type||!opOk.has(x.operator)||
   !Number.isSafeInteger(x.value)))
  throw Error('P2.32 mechanism: invalid original AND predicates');
 const operatorShape=terms.map(x=>[x.type,x.operator])
  .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 // This is used ONLY for in-memory value-variation counts, never exported.
 const values=terms.map(x=>[x.type,x.operator,x.value])
  .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return {operatorShape,values};
}
function routeMechanism(skill,route){
 const p=skill?.activationProfile;
 if(p?.status!=='source-structure'||p.sourceNumericId!==route.sourceNumericId)
  throw Error('P2.32 mechanism: app/source identity mismatch');
 if(!Number.isSafeInteger(route.invokeOffset)||route.invokeOffset<0||
    !Number.isSafeInteger(route.conditionOrIndex)||
    route.conditionOrIndex<0)
  throw Error('P2.32 mechanism: invalid route offset');
 const inv=p.invokes?.[route.invokeOffset];
 if(!isObj(inv)||inv.index!==route.invokeIndex&&
    (inv.index??route.invokeOffset)!==route.invokeIndex||
    !Array.isArray(inv.conditions)||!Array.isArray(inv.preConditions))
  throw Error('P2.32 mechanism: invalid source invoke');
 const cond=inv.conditions[route.conditionOrIndex];
 const pre=route.preconditionOrIndex===null?[]:
  inv.preConditions[route.preconditionOrIndex];
 if(!Array.isArray(cond)||!Array.isArray(pre)||
    (route.preconditionOrIndex===null)!==(inv.preConditions.length===0)||
    inv.conditions.length!==route.conditionOrCount||
    inv.preConditions.length!==route.preconditionOrCount||
    (p.invokes.length>1)!==route.hasOtherInvokes)
  throw Error('P2.32 mechanism: source branch topology differs');
 const a=predicateTerms(cond),b=predicateTerms(pre);
 const shape={
  conditionAND:a.operatorShape,
  preconditionAND:b.operatorShape,
  conditionORCount:route.conditionOrCount,
  preconditionORCount:route.preconditionOrCount,
  hasOtherInvokes:route.hasOtherInvokes
 };
 const signature=JSON.stringify(shape);
 const id=createHash('sha256').update(signature).digest('hex').slice(0,16);
 return {
  familyId:id,signature,shape,
  inMemoryValueVariant:JSON.stringify([a.values,b.values]),
  mechanismTypes:unique([...cond,...pre].map(x=>x.type)),
  member:{
   skillId:skill.id,sourceNumericId:p.sourceNumericId,
   invokeOffset:route.invokeOffset,invokeIndex:route.invokeIndex,
   conditionOrIndex:route.conditionOrIndex,
   preconditionOrIndex:route.preconditionOrIndex,
   researchGroup:route.researchGroup,
   finiteCompatibleStyles:route.finiteCompatibleStyles
  }
 };
}
const STATIC_ELIGIBILITY_TYPES=new Set([
 'running_style','distance_type','ground_type','ground_condition',
 'track_id'
]);
function kernelOf(operatorAndBranchShape){
 const shape={
  // Group reusable predicate interpreters across different operators,
  // literal thresholds and OR counts. Keep current vs latched preconditions
  // as separate slots; exact source-route composition is NOT reused.
  currentAND:operatorAndBranchShape.conditionAND.map(x=>x[0])
   .filter(x=>!STATIC_ELIGIBILITY_TYPES.has(x)).sort(),
  latchedPreconditionAND:operatorAndBranchShape.preconditionAND.map(x=>x[0])
   .filter(x=>!STATIC_ELIGIBILITY_TYPES.has(x)).sort()
 };
 const signature=JSON.stringify(shape);
 return {kernelId:createHash('sha256').update(signature)
  .digest('hex').slice(0,16),kernelTypeSideShape:shape,signature};
}
function newResearchGap(types){
 const known=evidence.forTypes(types);
 const notStudied=known.filter(x=>
  x.status==='no-specific-mechanism-evidence').map(x=>x.type);
 const counterfactual=known.filter(x=>
  x.status==='geometry-counterfactual').map(x=>x.type);
 const fixed=known.filter(x=>
  x.status==='conditional-fixed-state').map(x=>x.type);
 const limitedModel=known.filter(x=>
  x.status==='selected-model-tick').map(x=>x.type);
 const staticOnly=known.filter(x=>
  x.status==='source-static-context').map(x=>x.type);
 const explicitFiniteGates=known.filter(x=>
  x.status==='source-finite-eligibility').map(x=>x.type);
 let next;
 if(notStudied.length)
  next='check-original-source-mechanism-for-unstudied-types-before-new-runtime-simulation';
 else if(counterfactual.length)
  next='reuse-previous-geometry-and-tick-studies-then-test-source-draw-and-same-branch-conjunction';
 else if(staticOnly.length||fixed.length||explicitFiniteGates.length)
  next='verify-exact-static-context-and-fixed-state-assumptions-before-dynamic-AND';
 else
  next='reuse-existing-model-tick-instrumentation-and-check-source-exact-operator-values';
 return {
  notYetMechanismStudiedTypes:notStudied,
  counterfactualWindowTypes:counterfactual,
  selectedModelTickTypes:limitedModel,
  staticContextOnlyTypes:staticOnly,
  explicitFiniteEligibilityTypes:explicitFiniteGates,
  fixedStateConditionalTypes:fixed,
  nextMechanismResearchAction:next,
  // Even all selected-model-tick terms do NOT prove a new route was jointly
  // checked in the source runtime or in the actual game.
  wholeRouteEvaluated:false
 };
}
function audit(model,queueReport){
 if(!isObj(model)||!Array.isArray(model.skills)||!isObj(model.skillById)||
    queueReport?.status!==queue.STATUS||!Array.isArray(queueReport.rows))
  throw Error('P2.32 mechanism: original model and route queue required');
 const before=JSON.stringify(model);
 const byId=new Map(model.skills.map(s=>[s.id,s]));
 if(byId.size!==model.skills.length)
  throw Error('P2.32 mechanism: duplicate application skill identity');
 const groups=new Map();
 let count=0;
 for(const row of queueReport.rows){
  const original=byId.get(row.skillId);
  if(!original||!Array.isArray(row.routeFamilies))
   throw Error('P2.32 mechanism: route queue skill unmatched');
  if(row.sourceNumericId===null){
   if(row.routeFamilies.length)throw Error('P2.32 mechanism: unmatched skill routes');
   continue;
  }
  for(const route of row.routeFamilies){
   const x=routeMechanism(original,{...route,
    sourceNumericId:row.sourceNumericId});
   let g=groups.get(x.familyId);
   if(!g){
    g={familyId:x.familyId,signature:x.signature,shape:x.shape,
     mechanismTypes:x.mechanismTypes,memberRecords:[],
     numericVariants:new Set()};
    groups.set(x.familyId,g);
   }else if(g.signature!==x.signature||
      JSON.stringify(g.mechanismTypes)!==JSON.stringify(x.mechanismTypes))
    throw Error('P2.32 mechanism: hash collision or shape inconsistency');
   const key=[row.sourceNumericId,route.invokeOffset,
    route.conditionOrIndex,route.preconditionOrIndex].join('|');
   if(g.memberRecords.some(r=>r.routeIdentityKey===key))
    throw Error('P2.32 mechanism: duplicated source route');
   g.memberRecords.push({...x.member,routeIdentityKey:key});
   g.numericVariants.add(x.inMemoryValueVariant);
   count++;
  }
 }
 if(count!==queueReport.denominators.originalRouteFamilies||
    queueReport.denominators.appSkills!==model.skills.length||
    queueReport.denominators.sourceMatchedSkills!==model.skills.filter(s=>
     s.activationProfile?.status==='source-structure').length)
  throw Error('P2.32 mechanism: source cohort mismatch');
 if(JSON.stringify(model)!==before)
  throw Error('P2.32 mechanism: mutated app model');
 const report=[...groups.values()].map(g=>{
  const joined=unique(g.memberRecords.map(r=>r.sourceNumericId));
  const reuse=evidence.forTypes(g.mechanismTypes);
  const kernel=kernelOf(g.shape);
  const research=newResearchGap(g.mechanismTypes);
  const relevant=g.memberRecords.filter(r=>[
   'rank-source-join-first','event-state-pilot-next'
  ].includes(r.researchGroup));
  return {
   familyId:g.familyId,
   mechanismKernelId:kernel.kernelId,
   mechanismKernelTypeSideShape:kernel.kernelTypeSideShape,
   // Derived from original TYPE + comparator, not source numeric values.
   operatorAndBranchShape:g.shape,
   sourceRouteFamilies:g.memberRecords.length,
   distinctSourceSkills:joined.length,
   distinctExactNumericParameterSets:g.numericVariants.size,
   mechanismTypes:g.mechanismTypes,
   priorP215Evidence:reuse,
   ...research,
   currentlyFirstTierSourceRouteFamilies:relevant.length,
   originalSourceMembers:g.memberRecords,
   onlyMechanismAlgorithmReusable:true,
   sourceThresholdsAndContextMustBeReevaluated:true,
   noWholeSourceSkillTriggerInference:true,
   noApprovedSuitabilityRating:true
  };
 }).sort((a,b)=>b.distinctSourceSkills-a.distinctSourceSkills||
   b.sourceRouteFamilies-a.sourceRouteFamilies||
   a.familyId.localeCompare(b.familyId));
 // The first pilot must REUSE work already done, not solely pick the
 // largest unknown family. Then sample unknown mechanisms separately.
 const kernels=new Map();
 for(const g of report){
  let k=kernels.get(g.mechanismKernelId);
  if(!k){
   k={mechanismKernelId:g.mechanismKernelId,
    mechanismKernelTypeSideShape:g.mechanismKernelTypeSideShape,
    families:0,sourceRoutes:0,ids:new Set(),exampleFamilyId:g.familyId};
   kernels.set(g.mechanismKernelId,k);
  }
  if(JSON.stringify(k.mechanismKernelTypeSideShape)!==
     JSON.stringify(g.mechanismKernelTypeSideShape))
   throw Error('P2.32 mechanism: kernel signature collision');
  k.families++;
  k.sourceRoutes+=g.sourceRouteFamilies;
  for(const m of g.originalSourceMembers)k.ids.add(m.sourceNumericId);
 }
 const mechanismKernels=[...kernels.values()].map(k=>({
  mechanismKernelId:k.mechanismKernelId,
  mechanismKernelTypeSideShape:k.mechanismKernelTypeSideShape,
  exactOperatorBranchFamilies:k.families,
  sourceRouteFamilies:k.sourceRoutes,
  distinctSourceSkills:k.ids.size,
  representativeExactFamilyId:k.exampleFamilyId,
  neverCopiesSkillSpecificResults:true
 })).sort((a,b)=>b.distinctSourceSkills-a.distinctSourceSkills||
  b.sourceRouteFamilies-a.sourceRouteFamilies||
  a.mechanismKernelId.localeCompare(b.mechanismKernelId));
 const firstTier=report.filter(r=>r.currentlyFirstTierSourceRouteFamilies>0);
 const byCoverage=(a,b)=>b.distinctSourceSkills-a.distinctSourceSkills||
  b.sourceRouteFamilies-a.sourceRouteFamilies||
  a.familyId.localeCompare(b.familyId);
 const hasMechanismObservation=r=>r.priorP215Evidence.some(e=>[
  'selected-model-tick','geometry-counterfactual'
 ].includes(e.status));
 const reusable=[],usedKernels=new Set();
 for(const g of firstTier.filter(r=>
   !r.notYetMechanismStudiedTypes.length&&hasMechanismObservation(r))
   .sort(byCoverage)){
  if(reusable.length>=3)break;
  if(usedKernels.has(g.mechanismKernelId))continue;
  reusable.push(g);
  usedKernels.add(g.mechanismKernelId);
 }
 const novelCandidates=firstTier.filter(r=>
  r.notYetMechanismStudiedTypes.length>0).sort(byCoverage);
 const novel=[],seenSignatures=new Set();
 for(const pass of [0,1]){
  if(novel.length>=4)break;
  for(const g of novelCandidates){
   if(novel.length>=4)break;
   const signature=g.notYetMechanismStudiedTypes.join('|');
   if(novel.includes(g)||usedKernels.has(g.mechanismKernelId)||
      (pass===0&&seenSignatures.has(signature)))continue;
   novel.push(g);
   usedKernels.add(g.mechanismKernelId);
   seenSignatures.add(signature);
  }
 }
 const pilots=[...reusable.map(g=>({g,kind:'reuse-existing-mechanism-evidence'})),
  ...novel.map(g=>({g,kind:'inspect-unstudied-mechanism'}))].map(({g,kind})=>({
   familyId:g.familyId,mechanismKernelId:g.mechanismKernelId,
   distinctSourceSkills:g.distinctSourceSkills,
   memberRouteFamilies:g.sourceRouteFamilies,
   representativeSourceRoute:g.originalSourceMembers.find(m=>[
    'rank-source-join-first','event-state-pilot-next'
   ].includes(m.researchGroup)),
   mechanismTypes:g.mechanismTypes,
   previouslyStudiedMechanismTypes:g.priorP215Evidence.filter(e=>
    e.status!=='no-specific-mechanism-evidence').map(e=>e.type),
   notYetMechanismStudiedTypes:g.notYetMechanismStudiedTypes,
   nextMechanismResearchAction:g.nextMechanismResearchAction,
   selectedAs:kind,
   noSkillBySkillRetestPromise:true
  }));
 const typeReuse=evidence.forTypes(unique(report.flatMap(g=>g.mechanismTypes)));
 const matched=queueReport.denominators.sourceMatchedSkills;
 return {
  schemaVersion:1,status:STATUS,
  pinnedGameModelRevision:queueReport.pinnedGameModelRevision,
  denominators:{
   appSkills:model.skills.length,sourceMatchedSkills:matched,
   sourceUnavailableSkills:model.skills.length-matched,
   sourceRouteFamilies:count,
   normalizedMechanismFamilies:report.length,
   sharedMechanismKernels:mechanismKernels.length,
   familiesWithVariableNumericParameters:report.filter(g=>
    g.distinctExactNumericParameterSets>1).length,
   distinctSourceSkillsInFirstTier:unique(report.flatMap(g=>
    g.originalSourceMembers.filter(m=>[
     'rank-source-join-first','event-state-pilot-next'
    ].includes(m.researchGroup)).map(x=>x.sourceNumericId))).length,
   sourceRouteWholeActivationProofs:0,
   actualAppliedOmissions:0,
   formalSkillCardSuitabilityRatings:0
  },
  previouslyStudiedTypeInventory:typeReuse,
  // Family grouping and pilot selection are RESEARCH organization only.
  mechanismFamilies:report,
  mechanismKernels,
  initialMechanismFamilyPilots:pilots,
  pilotSelectionPolicy:{
   existingEvidenceReuseMax:3,unstudiedMechanismReviewMax:4,
   unstudiedTypeSignatureDiversityFirst:true,
   distinctMechanismKernelPerPilot:true,
   scoringOrProbabilityBased:false
  },
  constraints:[
   'Comparison operators and AND/precondition separation must match to share a source-mechanism family; numeric thresholds remain parameter-specific.',
   'An example route does not certify other member skills, OR branches, precondition histories, equipment or cooldown effects.',
   'P2.15 source semantics and GlobalSim positions/skill events may come from different runtimes and cohorts; they cannot be silently merged.',
   'Prior mechanism-level observation is reusable but not proof of whole original source condition activation.',
   'Pilot samples are unique per current-vs-latched type kernel, but individual operators, numeric thresholds and source OR/Invoke structures remain separate.',
   'The first seven are at most seven diverse family experiments, NOT an obligation to test all source skills individually.',
   'The provisional source-skill seven from earlier P2.32 are superseded as research selection, not deleted from historical evidence.',
   'No absolute or comparative game proc rates, no official P3/P4 rating, no actual omission is calculated.'
  ]
 };
}
module.exports={STATUS,predicateTerms,routeMechanism,kernelOf,newResearchGap,audit};
