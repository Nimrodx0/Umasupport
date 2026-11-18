'use strict';
/*
 * P2.37. Three G4 dynamic source condition mechanisms. This reads exact
 * source/Invoke/OR/AND positions and source-JVM semantics, not a race model.
 * It never converts approximate source simulation states into real game rates.
 */
const reuse=require('./skill_p2_32_mechanism_reuse.cjs');
const queueModule=require('./skill_p2_32_research_queue.cjs');
const STATUS='P2.37-original-dynamic-state-mechanism-adoption-and-holds-not-skill-rates';
const TYPES=['is_overtake','change_order_onetime','is_lastspurt'];
const rankTypes=new Set(['order','order_rate']);
const timeTypes=new Set(['phase','phase_firsthalf','phase_laterhalf',
 'phase_random','phase_firsthalf_random','phase_laterhalf_random',
 'distance_rate','remain_distance','accumulatetime','furlong']);
const verdict={
 is_overtake:{
  mechanism:'source-special-state-overtake',
  sourceInterpretation:'adopt-check-special-state-via-overtake-mapping',
  modelWAndD:'hold-event-state-unobserved-at-matching-rank-time-tick',
  reason:'Source simulator uses a style-dependent approximate overtake state, which cannot be reconstructed from a simple absolute/relative rank observation and does not prove the actual game event distribution.',
  futureTrigger:'validated comparable same-tick overtake-state observations with original AND and style context',
  noAutomaticOmission:true
 },
 change_order_onetime:{
  mechanism:'source-special-state-change-order-onetime',
  sourceInterpretation:'adopt-check-special-state-via-change-order-onetime-mapping',
  modelWAndD:'hold-event-state-unobserved-at-matching-rank-time-tick',
  reason:'Source condition reads a special state filled by random signed approximations; equality of model rank changes with this state is not established.',
  futureTrigger:'source-state and model-rank-change relationship validated at the original predicate tick',
  noAutomaticOmission:true
 },
 is_lastspurt:{
  mechanism:'source-live-is-in-spurt-boolean',
  sourceInterpretation:'adopt-direct-isInSpurt-boolean-check-at-tick',
  modelWAndD:'hold-spurt-state-not-validated-alongside-original-AND',
  reason:'Source checks isInSpurt() as a real-time Boolean; late-race time alone cannot establish this state without spurt/stamina context.',
  futureTrigger:'source-compatible spurt-state observation at original AND tick and applicable race contexts',
  noAutomaticOmission:true
 }
};
function checkSource(checker,skillData){
 const requiredChecker=[
  '"is_overtake" -> condition.checkSpecialState()',
  '"change_order_onetime" -> condition.checkSpecialState()',
  '"is_lastspurt" -> condition.checkInRaceBool { isInSpurt() }',
  'val key = approximateTypeToState[type]',
  '(simulation.specialState[key] ?: 0) + adjust'
 ];
 const requiredData=[
  '"is_overtake" to "overtake"',
  '"change_order_onetime" to "change_order_onetime"',
  '"change_order_onetime" to ApproximateRandomRates(',
  'listOf(-1 to 0.2, 1 to 0.2)',
  '"overtake" to ApproximateMultiCondition(',
  'ApproximateStartContinue("逃げ", 0.05, 0.50)',
  'ApproximateStartContinue("先行", 0.15, 0.55)',
  'ApproximateStartContinue("その他", 0.20, 0.60)'
 ];
 if(typeof checker!=='string'||typeof skillData!=='string'||
  requiredChecker.some(x=>!checker.includes(x))||
  requiredData.some(x=>!skillData.includes(x)))
  throw Error('P2.37 pinned source checker or approximate-state semantics drift');
}
function audit(model,queue,checker,skillData){
 checkSource(checker,skillData);
 if(!model||!Array.isArray(model.skills)||!model.skillById||
  queue?.status!==queueModule.STATUS||!Array.isArray(queue.rows)||
  queue.denominators?.appSkills!==model.skills.length||
  queue.denominators?.sourceMatchedSkills!==
   model.skills.filter(x=>x.activationProfile?.status==='source-structure').length)
  throw Error('P2.37 original source model and P2.32 route census required');
 const before=JSON.stringify(model);
 const byId=new Map(model.skills.map(x=>[x.id,x]));
 if(byId.size!==model.skills.length||queue.rows.length!==model.skills.length)
  throw Error('P2.37 duplicate source model skill or queue population');
 const rows=[];
 for(const source of queue.rows){
  const skill=byId.get(source.skillId);
  if(!skill||!Array.isArray(source.routeFamilies))
   throw Error('P2.37 source skill identity or route census lost');
  if(source.sourceNumericId===null){
   if(source.routeFamilies.length||skill.activationProfile?.status==='source-structure')
    throw Error('P2.37 unmatched source skill with routes');
   continue;
  }
  if(source.sourceNumericId!==skill.activationProfile?.sourceNumericId)
   throw Error('P2.37 source numeric ID mismatch');
  for(const route of source.routeFamilies){
   // Reuse P2.32's exact Invoke/OR/precondition alignment and operator guard.
   const z=reuse.routeMechanism(skill,{...route,
    sourceNumericId:source.sourceNumericId});
   const inv=skill.activationProfile.invokes[route.invokeOffset];
   const current=inv.conditions[route.conditionOrIndex];
   const pre=route.preconditionOrIndex===null?[]:
    inv.preConditions[route.preconditionOrIndex];
   const types=TYPES.filter(t=>[...current,...pre].some(x=>x.type===t));
   if(!types.length)continue;
   const uses=new Set([...current,...pre].map(x=>x.type));
   const andHasRank=current.some(x=>rankTypes.has(x.type));
   const andHasTime=current.some(x=>timeTypes.has(x.type));
   // This is a shape/interpretation decision only. All model W/D remains
   // held until the actual dynamic state and other predicates are observed.
   rows.push({
    skillId:skill.id,sourceNumericId:source.sourceNumericId,
    sourceRoute:{invokeIndex:route.invokeIndex,invokeOffset:route.invokeOffset,
     conditionOrIndex:route.conditionOrIndex,
     preconditionOrIndex:route.preconditionOrIndex,
     conditionORCount:route.conditionOrCount,
     preconditionORCount:route.preconditionOrCount,
     hasOtherInvokes:route.hasOtherInvokes,
     familyId:z.familyId,mechanismKernelId:reuse.kernelOf(z.shape).kernelId},
    predicateTypes:types,
    sourceConditionEventPredicates:[...current,...pre].filter(x=>types.includes(x.type))
     .map(x=>({type:x.type,operator:x.operator,value:x.value,
      side:current.includes(x)?'current-AND':'historical-precondition-AND'})),
    observedOtherConditionTypes:[...uses].filter(x=>!types.includes(x)).sort(),
    finiteCompatibleStyles:[...route.finiteCompatibleStyles],
    rankPredicateInSameCurrentAND:andHasRank,
    timePredicateInSameCurrentAND:andHasTime,
    otherInvokeOrORAlternatives:route.hasOtherInvokes||
     route.conditionOrCount>1||route.preconditionOrCount>1,
    sourceTypeStudy:'mechanism-defined-not-observed-state',
    modelPartialRankWAndDUsableAsWholeRoute:false,
    eligibleForP3CardScoring:false
   });
  }
 }
 const byType=Object.fromEntries(TYPES.map(t=>{
  const rs=rows.filter(r=>r.predicateTypes.includes(t));
  const skills=new Set(rs.map(r=>r.sourceNumericId));
  const comparable=rs.filter(r=>r.finiteCompatibleStyles.length>=2);
  const withRank=rs.filter(r=>r.rankPredicateInSameCurrentAND);
  const withTime=rs.filter(r=>r.timePredicateInSameCurrentAND);
  const latent=rs.filter(r=>r.sourceConditionEventPredicates.some(x=>
   x.type===t&&x.side==='historical-precondition-AND'));
  return [t,{
   originalSourceSkills:skills.size,originalRouteFamilies:rs.length,
   multistyleRouteFamilies:comparable.length,
   sameCurrentANDRankFamilies:withRank.length,
   sameCurrentANDTimeFamilies:withTime.length,
   historicalPreconditionFamilies:latent.length,
   observedMatchingDynamicStates:0,
   formalSkillSuitableAssessments:0,
   ...verdict[t]
  }];
 }));
 const sampled=rows.filter(x=>x.finiteCompatibleStyles.length>=2)
  .sort((a,b)=>Number(b.rankPredicateInSameCurrentAND&&
    b.timePredicateInSameCurrentAND)-
   Number(a.rankPredicateInSameCurrentAND&&a.timePredicateInSameCurrentAND)||
   Number(b.rankPredicateInSameCurrentAND)-
   Number(a.rankPredicateInSameCurrentAND)||
   a.sourceNumericId.localeCompare(b.sourceNumericId,undefined,{numeric:true}))
  .slice(0,6).map(x=>({sourceNumericId:x.sourceNumericId,
   ...x.sourceRoute,predicateTypes:x.predicateTypes,
   rankSameAND:x.rankPredicateInSameCurrentAND,
   timeSameAND:x.timePredicateInSameCurrentAND,
   otherAlternatives:x.otherInvokeOrORAlternatives}));
 if(JSON.stringify(model)!==before)
  throw Error('P2.37 mutated source model');
 return {
  schemaVersion:1,status:STATUS,
  source:{pinnedOriginalUmaSimRevision:
   'f6e4501ee6c6c2d4ac8698e7796e309d31575bde',
   checker:'race/calc2/SkillChecker.kt',
   skillData:'race/data2/SkillData.kt',sourceTypeChecksPassed:true},
  summary:{appSkills:model.skills.length,
   sourceMatchedSkills:queue.denominators.sourceMatchedSkills,
   totalOriginalRouteFamilies:queue.denominators.originalRouteFamilies,
   targetedSourceRouteFamilies:rows.length,
   distinctTargetedSkills:new Set(rows.map(r=>r.sourceNumericId)).size,
   byType,
   productSuitableScores:0,actualAppliedEventOmissions:0},
  nextRepresentativeRoutes:sampled,
  rows,limitations:[
   'Original source approximate overtaking and rank-change state mechanics are not validated Japanese game event rates.',
   'Some original source predicates can be directly interpreted, but this does not establish time-coincident full AND, source runtime activation or style frequency.',
   'Source rank-only W/D cannot replace unknown event-state, precondition history or other AND terms.',
   'One route family can be in several types and an original skill can have several OR/Invoke routes. Counts must not be summed as independent skills.',
   'Existing static style/distance/surface eligibility is retained; no dynamic rule is assumed independent of style.',
   'Research is bounded to three important conditions, not all G4 predicates, no P3 ratings.'
  ]};
}
module.exports={TYPES,STATUS,verdict,checkSource,audit};
