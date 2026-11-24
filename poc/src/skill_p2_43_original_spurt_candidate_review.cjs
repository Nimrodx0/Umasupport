'use strict';
/*
 * P2.43 G4: inspect only three previously selected P2.42 source route IDs
 * in the already loaded, pinned original skill dictionary. Preserve exact
 * AND operators/values, OR/Invoke/preconditions, and original Kotlin source
 * checker semantics. This does NOT simulate or rate skill activation.
 */
const p232=require('./skill_p2_32_research_queue.cjs');
const p237=require('./skill_p2_37_dynamic_state_evidence.cjs');
const p238=require('./skill_p2_38_original_spurt_phase_same_and.cjs');
const timing=require('./skill_rank_timing.js');
const TARGETS=Object.freeze([
 {sourceNumericId:'203431',otherType:'phase_firsthalf_random'},
 {sourceNumericId:'204661',otherType:'infront_near_lane_time'},
 {sourceNumericId:'210081',otherType:'phase_random'}
]);
const STATUS='P2.43-exact-three-original-spurt-AND-source-mechanism-inspection-not-proc';
const EXPECTED_ORIGINAL_AND=Object.freeze({
 '203431':['distance_type|==|3','is_lastspurt|==|1',
  'phase_firsthalf_random|==|3'],
 '204661':['ground_type|==|2','infront_near_lane_time|>=|1',
  'is_lastspurt|==|1'],
 '210081':['is_lastspurt|==|1','phase_random|==|3']
});
const PIN=p237.PIN;
const fail=(ok,why)=>{if(!ok)throw Error('P2.43 exact spurt AND: '+why)};
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const sig=predicates=>predicates.map(c=>
 [c.type,c.operator,c.value].join('|')).sort().join('&&');
const keys=rows=>new Map(rows.map(r=>[r.sourceNumericId,r]));
const sourceCodePaths={
 checker:'race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt',
 approximations:'race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data2/SkillData.kt'
};
function inspectMechanisms(source){
 const c=source?.checker,d=source?.skillData;
 fail(source?.revision===PIN&&typeof c==='string'&&typeof d==='string',
  'pinned Kotlin originals not supplied');
 const check=[
  ['"is_lastspurt" -> condition.checkInRaceBool { isInSpurt() }',c],
  ['"phase_firsthalf_random" -> checkInRandom(',c],
  ['baseSetting.initPhaseRandom(condition.value, 0.0 to 0.5)',c],
  ['"phase_random" -> checkInRandom(',c],
  ['baseSetting.initPhaseRandom(condition.value)',c],
  ['"infront_near_lane_time" -> condition.checkSpecialState(-1)',c],
  ['val key = approximateTypeToState[type]',c],
  ['simulation.specialState[key] ?: 0',c],
  ['"infront_near_lane_time" to "infront_near_lane"',d],
  ['"infront_near_lane" to ApproximateMultiCondition(',d],
  ['class ApproximateStartContinue(',d],
  ['Random.nextDouble() < start',d],
  ['Random.nextDouble() < continuation',d]
 ];
 for(const [fragment,raw] of check)
  fail(raw.includes(fragment),'original checker or approximate model drift: '+fragment);
 return {
  isLastspurt:'original-RaceCalculator-computed-spurt-state',
  phaseFirsthalfRandom:'original-source-random-window-in-first-half-of-selected-phase',
  phaseRandom:'original-source-random-window-in-whole-selected-phase',
  infrontNearLaneTime:'source-randomized-specialState-not-observed-opponent-lane-geometry',
  originalKotlinMechanismSourceVerified:true
 };
}
function audit(model,queue,dynamic,previous,source){
 const mechanisms=inspectMechanisms(source);
 fail(Array.isArray(model?.skills)&&model.skills.length===881&&
  model.skillById&&
  queue?.status===p232.STATUS&&queue.denominators?.appSkills===881&&
  queue.denominators?.sourceMatchedSkills===818&&
  queue.denominators?.originalRouteFamilies===970&&
  dynamic?.status===p237.STATUS&&dynamic.source?.revision===PIN&&
  dynamic.source?.mechanismSourceVerified===true&&
  dynamic.summary?.originalFullSourceANDProven===0&&
  previous?.status===p238.STATUS&&previous.source?.originalUmaSimRevision===PIN&&
  previous.summary?.skills===2&&
  previous.summary?.sourceOriginalANDMatched===2&&
  Array.isArray(previous.rows)&&previous.rows.length===2,
  'pinned model, source route, P2.37 or P2.38 reference missing');
 const bySource=keys(model.skills.filter(x=>
  x.activationProfile?.status==='source-structure').map(x=>({
  sourceNumericId:x.activationProfile.sourceNumericId,skill:x
 })));
 fail(bySource.size===818,'source ID population changed');
 const q=keys(queue.rows.filter(x=>x.sourceNumericId!==null));
 const observed=dynamic.rows?.is_lastspurt;
 fail(q.size===818&&Array.isArray(observed)&&observed.length===61,
  'P2.32/P2.37 source-spurt route population changed');
 const originalRef=previous.rows.map(x=>x.sourceANDPredicates);
 fail(originalRef.every(x=>Array.isArray(x)&&x.length===2)&&
  sig(originalRef[0])===sig(originalRef[1]),
  'P2.38 two exact source AND references changed');
 const res=[];
 for(const {sourceNumericId:id,otherType} of TARGETS){
  const skill=bySource.get(id)?.skill,profile=skill?.activationProfile;
  const qrow=q.get(id),match=observed.filter(x=>x.sourceNumericId===id);
  fail(skill&&qrow?.skillId===skill.id&&match.length===1,
   'expected selected original skill and one spurt route missing: '+id);
  const row=match[0];
  const f=qrow.routeFamilies?.find(x=>
   x.invokeOffset===row.invokeOffset&&
   x.conditionOrIndex===row.conditionOrIndex&&
   x.preconditionOrIndex===row.preconditionOrIndex);
  fail(f&&qrow.routeFamilies.length===1&&
   profile.invokes.length===1&&
   f.invokeOffset===0&&f.conditionOrIndex===0&&
   f.preconditionOrIndex===null&&f.preconditionOrCount===0&&
   f.conditionOrCount===1&&f.hasOtherInvokes===false&&
   row.invokeIndex===f.invokeIndex&&row.hasOtherInvokes===false&&
   row.probabilityOrScore===null&&
   row.wholeSkillSuitability==='not-established'&&
   row.sourcePredicates?.length===1&&
   row.sourcePredicates[0].side==='conditions'&&
   row.sourcePredicates[0].operator==='=='&&
   row.sourcePredicates[0].value===1&&
   f.finiteCompatibleStyles.length===4&&
   same(row.finiteCompatibleStyles,f.finiteCompatibleStyles)&&
   same(row.otherUnverifiedTypes,
    f.unverifiedTypes.filter(x=>x!=='is_lastspurt')),
   'source Invoke/OR, finite styles or dynamic predicate mismatch: '+id);
  const inv=profile.invokes[0],conditions=inv.conditions?.[0];
  fail(inv.index===f.invokeIndex&&inv.preConditions.length===0&&
   inv.conditions.length===1&&Array.isArray(conditions)&&
   conditions.length>=2&&
   conditions.every(c=>typeof c.type==='string'&&
    ['==','!=','<=','>=','<','>'].includes(c.operator)&&
    Number.isSafeInteger(c.value)),
   'source original current AND no longer isolated: '+id);
  const spurt=conditions.filter(x=>x.type==='is_lastspurt'),
   companion=conditions.filter(x=>x.type===otherType);
  fail(spurt.length===1&&spurt[0].operator==='=='&&spurt[0].value===1&&
   companion.length===1&&conditions.filter(c=>c.type==='is_lastspurt'||
    c.type===otherType).length===2&&
   row.sourcePredicates[0].andOffset===conditions.indexOf(spurt[0])&&
   f.unverifiedTypes.includes(otherType),
   'original source lastspurt + other condition pair shifted: '+id);
  const currentTerms=conditions.map(c=>({type:c.type,operator:c.operator,
   value:c.value}));
  fail(sig(currentTerms)===EXPECTED_ORIGINAL_AND[id].slice().sort().join('&&'),
   'pinned source exact original AND operator, value or extra gate drift: '+id);
  const extraConditions=conditions.filter(c=>
   c.type!=='is_lastspurt'&&c.type!==otherType);
  const otherTypes=[...new Set(extraConditions.map(c=>c.type))].sort();
  const expected=extraConditions.map(x=>x.type);
  fail(expected.every(x=>x&&!x.startsWith('is_lastspurt')),
   'unexpected source extra AND');
  const dynamicNearLane=otherType==='infront_near_lane_time';
  const phase=dynamicNearLane?null:timing.timing(companion[0]);
  fail(dynamicNearLane||
   phase?.status==='source-defined'&&phase.randomWindow===true&&
   phase.windows.length===1&&
   companion[0].operator==='=='&&
   companion[0].value>=0&&companion[0].value<=3&&
   (otherType==='phase_firsthalf_random'?
    phase.kind==='random-within-first-half':
    phase.kind==='random-within-phase'),
   'original phase window type/operator/source value unsupported: '+id);
  const refMatch=sig(currentTerms)===sig(originalRef[0]);
  const sourceRefSubAND=originalRef[0].every(p=>
   currentTerms.some(c=>c.type===p.type&&c.operator===p.operator&&c.value===p.value));
  const explicitStaticGates=currentTerms.filter(c=>
   ['distance_type','ground_type','running_style','track_id'].includes(c.type));
  const disposition=dynamicNearLane?
   'hold-source-approximate-near-lane-state-not-independent-position-observation':
   refMatch?
    'reuse-identical-original-source-AND-mechanism-only-not-style-W':
    sourceRefSubAND?
     'reuse-P2.38-spurt-window-predicates-but-hold-middle-distance-full-AND-W':
     'hold-distinct-full-phase-random-window-no-P2.38-source-AND-transfer';
  res.push({sourceNumericId:id,skillId:skill.id,
   originalSkillName:skill.name,
   route:{invokeOffset:0,invokeIndex:inv.index,conditionOrIndex:0,
    preconditionOrIndex:null,originalConditionsOrCount:inv.conditions.length,
    originalPreconditionsOrCount:inv.preConditions.length,
    otherInvokeExists:profile.invokes.length>1},
   exactOriginalCurrentAND:currentTerms,
   otherSourceANDTerms:extraConditions.map(c=>({
    type:c.type,operator:c.operator,value:c.value})),
   originalSpurtPredicate:{...spurt[0]},
   originalCompanionPredicate:{...companion[0]},
   companionTiming:phase,
   identicalFullCurrentANDToP238Reference:refMatch,
   originalP238SpurtAndWindowPredicatesAllPresent:sourceRefSubAND,
   explicitOriginalRaceGates:explicitStaticGates,
   originalFiniteCompatibleStyles:[...f.finiteCompatibleStyles],
   disposition,
   companionMechanism:dynamicNearLane?
    mechanisms.infrontNearLaneTime:
    otherType==='phase_firsthalf_random'?
     mechanisms.phaseFirsthalfRandom:mechanisms.phaseRandom,
   sameSourceTickSkillANDObservedHere:false,
   additionalSourceRaceTrials:0,
   measuredOriginalModelSkillActivationRate:null,
   officialGameSkillProcRate:null,validatedFourStyleWOrD:null,
   eligibleForP3CardScoring:false,cardScore:null});
 }
 fail(res.length===3&&
  new Set(res.map(x=>x.sourceNumericId)).size===3,
  'source-selected three-study cohort duplicated');
 return {schemaVersion:1,status:STATUS,
  source:{revision:PIN,originalCheckerPath:sourceCodePaths.checker,
   originalApproximationPath:sourceCodePaths.approximations,
   p237Status:dynamic.status,p238Status:previous.status,
   mechanismSourceVerified:mechanisms.originalKotlinMechanismSourceVerified},
  summary:{
   originalSourceSkillCandidates:3,
   exactOriginalCurrentANDReviewed:3,
   nearLaneSourceApproximationHeld:res.filter(x=>x.disposition.startsWith(
    'hold-source-approximate-near-lane')).length,
   otherTwoOriginalRandomWindowMechanisms:res.filter(x=>
    x.companionTiming?.status==='source-defined').length,
   exactCurrentANDReusedFromP238:res.filter(x=>
    x.identicalFullCurrentANDToP238Reference).length,
   additionalRaceOrSameTickTrials:0,
   originalFullSkillActivationRatesMeasured:0,
   officialGameSkillProcRatesMeasured:0,
   approvedP3OrP4Ratings:0
  },
  rows:res,limitations:[
   'The source checker and dictionary are the pinned third-party UmaSim model, not independent game engine source.',
   'infront_near_lane_time reads approximated randomized specialState; no physical opponent lane/position observation is implied.',
   'Original source operators, numeric thresholds and any additional source AND terms remain attached to each route.',
   'Even identical source AND to P2.38/39 only reuses mechanism evidence from highly restricted artificial setups, never game incidence or four-style score.',
   'A source-defined random window (phase_random or phase_firsthalf_random) is not a measured same-tick full skill activation.',
   'No source external copyrighted dictionary is republished in this repository; research output is a small, bounded diagnostic.'
  ]};
}
module.exports={PIN,TARGETS,STATUS,inspectMechanisms,audit};
