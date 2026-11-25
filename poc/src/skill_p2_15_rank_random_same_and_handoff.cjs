'use strict';
/*
 * P2.15: source-EXACT rank + phase_random same-AND handoff.
 *
 * This does not create a random draw, project GlobalSim's sample window
 * onto an UmaSim skill, or claim a complete full-AND observation. Instead,
 * for every original source AND row containing BOTH order_rate and
 * phase_random, independently evaluate the original order_rate predicates
 * at every 1-based position in documented 9/12 runner panels.
 *
 * If rank is FALSE, its original AND row cannot pass at that tick even if
 * phase_random is UNKNOWN. If rank is TRUE, phase_random remains UNKNOWN.
 * Rank->percentage mapping is secondary-source, model-only interpretation.
 */
const whole=require('./skill_source_whole_tick_monitor.cjs');
const rank=require('./skill_source_rank_tick_bridge.cjs');
const evidence=require('./skill_p2_15_mechanism_evidence.cjs');
const axis=require('./skill_p2_15_parameterized_axis_gates.cjs');
const bounds=require('./skill_order_rate_bounds.cjs');
const TYPES=Object.freeze(['order_rate','phase_random']);
const STATUS='P2.15-same-original-AND-rank-random-gate-model-projection-not-source-proc';
const fail=(ok,reason)=>{if(!ok)throw Error('P2.15 rank-random handoff: '+reason)};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const rowKey=(r)=>[r.sourceNumericId,r.invokeOffset,
 r.conditionOrIndex,r.preconditionOrIndex===null?'_':r.preconditionOrIndex].join('|');
const unique=x=>[...new Set(x)].sort();
function compileRow(compiled,route){
 fail(compiled?.lookup instanceof Map&&route?.sourceNumericId===
  compiled.sourceNumericId,'compiled source or source route mismatch');
 const inv=compiled.invokes[route.invokeOffset];
 fail(inv&&inv.invokeIndex===route.invokeIndex,'source invoke missing or changed');
 const rows=inv.conditions[route.conditionOrIndex];
 const pre=route.preconditionOrIndex===null?[]:
  inv.preConditions[route.preconditionOrIndex];
 fail(Array.isArray(rows)&&Array.isArray(pre)&&
  (route.preconditionOrIndex===null)===(inv.preConditions.length===0),
  'source condition/precondition branch missing or changed');
 return {conditions:rows,preconditions:pre,
  exactOriginalANDPredicates:rows.length};
}
function qualifies(conditions){
 const types=new Set(conditions.map(x=>x.type));
 return TYPES.every(t=>types.has(t));
}
function rankPanel(compiled,route,fieldSize){
 fail(bounds.FIELDS.includes(fieldSize),'9/12 reference field only');
 const {conditions}=compileRow(compiled,route);
 const relevant=conditions.filter(x=>x.type==='order_rate');
 fail(relevant.length>0,'no order_rate in this original AND');
 const buckets={true:[],false:[],unknown:[]};
 for(let place=1;place<=fieldSize;place++){
  // Existing independent source-rank bridge emits source-identity checked
  // facts for all source predicates; take ONLY this Invoke/OR AND row.
  const facts=rank.observedOrderRateFacts(compiled,place,fieldSize);
  const known=new Map(facts.map(x=>[whole.identity(x),x.satisfied]));
  const statuses=relevant.map(ref=>{
   const observed=known.get(whole.identity(ref));
   return observed===undefined?whole.UNKNOWN:
    observed?whole.TRUE:whole.FALSE;
  });
  const rankGate=whole.AND(statuses);
  buckets[rankGate].push(place);
 }
 fail(buckets.true.length+buckets.false.length+buckets.unknown.length===
  fieldSize,'rank panel coverage incomplete');
 return {fieldSize,originalRankPredicateCount:relevant.length,
  projectedRankGateTruePositions:buckets.true,
  projectedRankGateFalsePositions:buckets.false,
  heldUnverifiedBoundaryPositions:buckets.unknown,
  actualModelRankTicksObserved:0,
  actualPhaseRandomDrawsObserved:0,
  completeSourceANDProven:false};
}
function audit(model,priorAxis){
 fail(isObj(model)&&Array.isArray(model.skills)&&isObj(model.skillById)&&
  priorAxis?.status===axis.STATUS&&Array.isArray(priorAxis.routeRows),
  'fixed app cohort and source static axis audit required');
 const priorByKey=new Map(priorAxis.routeRows.map(x=>[rowKey(x),x]));
 fail(priorByKey.size===priorAxis.routeRows.length,
  'duplicated original condition route in static evidence');
 const baseline=JSON.stringify(model);
 const sourceById=new Map(model.skills.filter(s=>
  s.activationProfile?.status==='source-structure')
  .map(s=>[s.activationProfile.sourceNumericId,s]));
 fail(sourceById.size===priorAxis.denominators.sourceMatchedSkills&&
  priorAxis.denominators.sourceRouteFamilies===priorAxis.routeRows.length,
  'different pinned source cohort');
 const rankEvidence=evidence.forType('order_rate');
 const randomEvidence=evidence.forType('phase_random');
 fail(rankEvidence.status==='selected-model-tick'&&
  randomEvidence.status==='geometry-counterfactual'&&
  bounds.SOURCE.status.includes('not-independent-JP-engine'),
  'reused evidence unexpectedly claims original skill game activation');
 const candidates=[];
 let matchingStructure=0,staticExcluded=0;
 for(const original of priorAxis.routeRows){
  const skill=sourceById.get(original.sourceNumericId);
  fail(skill&&priorByKey.get(rowKey(original))===original,
   'source numeric identity or route alignment lost');
  const compiled=whole.compile(skill);
  const {conditions,preconditions}=compileRow(compiled,original);
  if(!qualifies(conditions))continue;
  matchingStructure++;
  const possible=original.groundStateEligibilityMasks.some(Boolean);
  if(!possible)staticExcluded++;
  const panels=bounds.FIELDS.map(n=>rankPanel(compiled,original,n));
  const additionalCurrent=unique(conditions.filter(x=>
   !TYPES.includes(x.type)&&
   !['running_style','distance_type','ground_type','ground_condition'].includes(x.type))
   .map(x=>x.type));
  const historical=unique(preconditions.map(x=>x.type));
  candidates.push({
   sourceNumericId:original.sourceNumericId,
   invokeOffset:original.invokeOffset,invokeIndex:original.invokeIndex,
   conditionOrIndex:original.conditionOrIndex,
   preconditionOrIndex:original.preconditionOrIndex,
   familyId:original.familyId,
   mechanismKernelId:original.mechanismKernelId,
   sourceRouteKey:rowKey(original),
   sameCurrentANDRankRateAndRandom:true,
   originalConditionANDSize:conditions.length,
   originalHistoricalPreconditionANDSize:preconditions.length,
   otherCurrentUnknownOrContextTypes:additionalCurrent,
   historicalPreconditionTypesNotJoined:historical,
   anyStaticContextNotExcluded:possible,
   supportedRankPanels:panels,
   sourceRandomDrawObserved:false,
   sourceActualSkillTriggerObserved:false,
   globalSimEquippedSampleTransferAuthorized:false,
   opportunityOrSuitabilityInferred:false,
   nextExperiment:possible?
    'measure-original-phase-random-window-at-same-source-branch-runner-tick':
    'hold-static-incompatible-route-in-tested-3-axis-contexts'
  });
 }
 fail(JSON.stringify(model)===baseline,'mutated source model');
 const uniqueSkills=unique(candidates.map(c=>c.sourceNumericId));
 const kernels=unique(candidates.map(c=>c.mechanismKernelId));
 const totals={
  appSkills:priorAxis.denominators.appSkills,
  sourceMatchedSkills:priorAxis.denominators.sourceMatchedSkills,
  sourceUnavailableSkills:priorAxis.denominators.sourceUnavailableSkills,
  originalSourceRouteFamilies:priorAxis.denominators.sourceRouteFamilies,
  sameOriginalCurrentANDCandidates:matchingStructure,
  distinctSourceSkillsWithSameAND:uniqueSkills.length,
  sharedMechanismKernelsWithSameAND:kernels.length,
  staticExcludedRoutesInEnumeratedAxisPanel:staticExcluded,
  rankPanelsEnumerated:matchingStructure*bounds.FIELDS.length,
  modelRuntimeSameTickJoinedRouteObservations:0,
  observedOriginalSourceRandomDraws:0,
  provenCompleteOriginalSkillActivation:0,
  officialP3P4SuitabilityEvaluations:0
 };
 const familyStats=new Map();
 for(const c of candidates){
  const s=familyStats.get(c.familyId)??{
   familyId:c.familyId,mechanismKernelId:c.mechanismKernelId,
   sourceRoutes:0,sourceSkills:new Set(),historicalRoutes:0};
  s.sourceRoutes++;s.sourceSkills.add(c.sourceNumericId);
  if(c.originalHistoricalPreconditionANDSize>0)s.historicalRoutes++;
  familyStats.set(c.familyId,s);
 }
 const grouped=[...familyStats.values()].map(x=>({
  familyId:x.familyId,mechanismKernelId:x.mechanismKernelId,
  sourceRoutes:x.sourceRoutes,distinctSourceSkills:x.sourceSkills.size,
  originalPreconditionRoutes:x.historicalRoutes
 })).sort((a,b)=>b.distinctSourceSkills-a.distinctSourceSkills||
  a.familyId.localeCompare(b.familyId));
 return {
  schemaVersion:1,status:STATUS,
  fixedUmaSimRevision:priorAxis.pinnedGameModelRevision,
  researchSourceScopes:{
   orderRate:'secondary 9/12-rank mapping and observed GlobalSim rank model, NOT implemented in fixed original UmaSim',
   phaseRandom:'original window formula geometry counterfactual only; actual source draw not observed',
   sourceAND:'same Invoke/conditions OR source row; distinct preConditions remain historical and unresolved'
  },
  denominators:totals,
  byExactSourceFamily:grouped,
  candidates,
  limitations:[
   'Only rank-gate truth tables under 9/12 possible ordinal ranks were computed; these are NOT observed frequencies or race samples.',
   'False rank eliminates only its original current AND row, never another OR or Invoke.',
   'True rank with phase_random unobserved always leaves this current AND unresolved, unless another observed predicate makes it false.',
   'The source checker in pinned UmaSim ignores order_rate and real game percentage semantics are not independently verified.',
   'GlobalSim equipped sample random windows cannot be transplanted onto original UmaSim skill IDs without equivalence and same-tick evidence.',
   'No original random draw, same-tick observation or actual game skill event was measured; no absolute opportunity, 3-axis suitability or formal score.'
  ]
 };
}
/*
 * A testing/replay adapter for one runner's externally supplied model-rank
 * series, not a real telemetry generator. Never add phase_random facts.
 * Every original condition keeps its source identity in WholeTickMonitor.
 */
function replayRankOnlyModelTicks(skill,frames){
 fail(Array.isArray(frames)&&frames.length>0,
  'nonempty single-runner model-rank frames required');
 const compiled=whole.compile(skill);
 const first=frames[0];
 fail(first&&typeof first.raceKey==='string'&&first.raceKey.length>0&&
  typeof first.runnerKey==='string'&&first.runnerKey.length>0&&
  bounds.FIELDS.includes(first.fieldSize),
  'fixed race/runner identifier and 9/12 runner field size required');
 const ticksInput=[];
 for(const [i,frame] of frames.entries()){
  fail(isObj(frame)&&frame.tickIndex===i&&
   frame.raceKey===first.raceKey&&frame.runnerKey===first.runnerKey&&
   frame.fieldSize===first.fieldSize&&
   (frame.rank===null||Number.isSafeInteger(frame.rank)&&
    frame.rank>=1&&frame.rank<=frame.fieldSize)&&
   isObj(frame.staticContext)&&
   JSON.stringify(frame.staticContext)===JSON.stringify(first.staticContext),
   'one race, one runner, contiguous same-source-priority-tick and static context required');
  ticksInput.push({tickIndex:i,
   staticContext:frame.staticContext,
   observations:rank.observedOrderRateFacts(compiled,frame.rank,frame.fieldSize)});
 }
 const result=whole.run(skill,ticksInput);
 return {
  status:'source-full-logic-with-model-rank-only-phase-random-held',
  sourceNumericId:compiled.sourceNumericId,
  tickCount:frames.length,results:result.ticks,
  tallies:result.tallies,
  initialRankSource:'externally-supplied-9-or-12-runner-model-fixture-not-proven-original-UmaSim-rank',
  phaseRandomFactsSupplied:0,actualSourceRandomDraws:0,
  actualUmaSimRuntimeObserved:false,
  gameProcRate:null,P3CardSuitabilityApproved:false
 };
}
module.exports={STATUS,TYPES,rowKey,compileRow,qualifies,rankPanel,
 audit,replayRankOnlyModelTicks};
