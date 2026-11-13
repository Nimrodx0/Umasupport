#!/usr/bin/env node
'use strict';
/*
 * P2.15 vertical slice: genuinely observed model pre-skill positions supply
 * ONE original UmaSim predicate family, distance_rate (int trunc of 100*pos/L).
 *
 * GlobalSim v77 positions are MODEL observations, not UmaSim's own positions.
 * Original and instrumented no-skill engines MUST replay identically.
 * By default, all other source dynamic predicates, including ignored
 * order_rate, remain UNKNOWN. Source-anchored positional clause families
 * can optionally be joined using a separately verified provenance object.
 * No phase_random draws, original skill equip/proc or card scores.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const monitor=require('../src/skill_source_whole_tick_monitor.cjs');
const raceOpportunity=require('../src/skill_source_race_opportunity.cjs');
const profiles=require('../src/skill_condition_profiles.js');
const full=require('../src/skill_full_condition_path_audit.cjs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const pre=require('./globalsim_p2_15_preskill_phase_position.cjs');
const PIN='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const STATUS='P2.15-real-GlobalSim-position-source-distance-rate-predicate-join-not-game';
const UNRESOLVED_BOUNDARY=1e-6;
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const check=(ok,why)=>{if(!ok)throw Error('P2.15 distance-rate: '+why);};
const toType=c=>c.surface==='turf'?1:c.surface==='dirt'?2:null;
function validateSource(skillText,checkerText,skillCodeText){
 check(hash(skillText)===SOURCE_SHA,'pinned UmaSim original skill registry SHA mismatch');
 const checker='"distance_rate" -> condition.checkInRace { (simulation.position * 100.0 / baseSetting.courseLength).toInt() }';
 check(typeof checkerText==='string'&&checkerText.includes(checker),
  'fixed original Kotlin distance_rate arithmetic changed');
 check(typeof skillCodeText==='string'&&
  skillCodeText.includes('"order_rate" to "順位条件は無視"')&&
   skillCodeText.includes('"order" to "順位条件は無視"'),
  'original checker ignored-order_rate guard changed');
 const rows=JSON.parse(skillText.replace(/^\uFEFF/,''));
 check(Array.isArray(rows)&&rows.length===2162,'original skill registry count drift');
 const records=rows.map(x=>profiles.project(x,'pinned'));
 const eligible=records.filter(p=>p.status==='source-structure'&&
  p.invokes.some(inv=>[...inv.conditions,...inv.preConditions].some(row=>
   row.some(x=>x.type==='distance_rate'))));
 const ids=new Set();
 for(const p of eligible){
  check(!ids.has(p.sourceNumericId),'duplicate original distance-rate skill ID');
  ids.add(p.sourceNumericId);
  check(monitor.compile(p).predicateCount>0,'no original source predicates');
 }
 check(eligible.length>0,'original source has no distance_rate cohort');
 return {profiles:eligible,sourceSkillCount:rows.length,
  verifiedSourceFormula:checker,originalOrderRateIgnoredByPinnedChecker:true,
   originalOrderIgnoredByPinnedChecker:true,
   pinnedSourceCheckerIgnoredRankTypes:['order','order_rate']};
}
function context(plan,runner){
 check(plan&&plan.course&&Number.isFinite(plan.course.distance)&&
  plan.course.distance>0&&plan.course.distance<9999&&
  [1,2,3,4].includes(plan.course.distanceType)&&
  Number.isSafeInteger(plan.fieldSize)&&plan.fieldSize>=2,
  'invalid fixed model course');
 const ground=toType(plan.course);
 const style=expanded.STYLES.indexOf(plan.strategies?.[runner])+1;
 check([1,2].includes(ground)&&style>=1&&style<=4,
  'unknown fixed model race style or surface');
 // Do not invent course venue ID, weather/ground condition or skill state.
 return {running_style:style,distance_type:plan.course.distanceType,
  ground_type:ground};
}
function originalRate(position,distance){
 check(Number.isFinite(position)&&Number.isFinite(distance)&&
  distance>0&&distance<9999,'invalid model progress/race length');
 if(position<0||position>=distance)return null;
 const ratio=position*100/distance;
 // Kotlin double vs model f32 position: boundary can flip toInt.
 // Such ticks are withheld rather than silently choosing a side.
 if(Math.abs(ratio-Math.round(ratio))<=UNRESOLVED_BOUNDARY)return null;
 return Math.trunc(ratio);
}
function observations(compiled,rate){
 if(rate===null)return [];
 check(Number.isSafeInteger(rate)&&rate>=0&&rate<=100,'unsupported model distance_rate');
 const result=[];
 for(const ref of compiled.lookup.values()){
  if(ref.type!=='distance_rate')continue;
  result.push({...ref,satisfied:full.check(rate,ref.operator,ref.value)});
 }
 return result;
}
function validatePaired(plan,control,probe){
 check(control?.seed===plan.seed&&probe?.seed===plan.seed&&
  control.frames?.length>=2&&control.frames.length===probe.frames?.length,
  'paired model seeds or frames differ');
 for(let t=0;t<control.frames.length;t++){
  const a=control.frames[t],b=probe.frames[t];
  check(a.t===b.t&&a.horses?.length===plan.fieldSize&&
   b.horses?.length===plan.fieldSize,'matched source time/runner frames lost');
  for(let i=0;i<plan.fieldSize;i++)for(let c=0;c<4;c++)
   check(Number.isFinite(legacy.get(a.horses[i],c))&&
    legacy.get(a.horses[i],c)===legacy.get(b.horses[i],c),
    'observer changed original GlobalSim physics');
 }
 check(JSON.stringify(control.skillEvents)===JSON.stringify(probe.skillEvents),
  'observer changed original GlobalSim skill event records');
 return control.frames.length*plan.fieldSize*4;
}
function analyze(plans,control,probe,sourceProfiles,
 {rankEvidence=null,positionSourceEvidence=null,unknownRouteTriage=false,
  includeAbsoluteOrder=false}={}){
 check(!includeAbsoluteOrder||rankEvidence,
  'original absolute order model projection requires direct rank evidence');
 const triage=unknownRouteTriage?
  require('../src/skill_source_unknown_route_candidates.cjs'):null;
 check(!triage||positionSourceEvidence,
  'unknown-route witness requires the verified five positional source families');
 const positionFacts=positionSourceEvidence?
  require('../src/skill_source_position_stage_facts.cjs'):null;
 if(positionFacts)positionFacts.verifyEvidence(positionSourceEvidence);
 const rankBridge=rankEvidence?require('../src/skill_source_rank_tick_bridge.cjs'):null;
 if(rankBridge)rankBridge.validateEvidence(rankEvidence,plans);
 check(Array.isArray(plans)&&plans.length>0&&
  control?.length===plans.length&&probe?.length===plans.length&&
  Array.isArray(sourceProfiles)&&sourceProfiles.length>0,
  'need paired fixed races and original distance_rate cohort');
 const compiled=sourceProfiles.map(profile=>({profile,
  ast:monitor.compile(profile)}));
 check(compiled.every(x=>[...x.ast.lookup.values()].some(y=>
  y.type==='distance_rate')),'cohort includes unrelated source skill');
 const perSkill=Object.fromEntries(compiled.map(x=>[x.ast.sourceNumericId,{
  sourceNumericId:x.ast.sourceNumericId,modelRunnerTicks:0,
  distanceRateObservations:0,sourceConditionTrue:0,
  sourceConditionFalse:0,sourceConditionUnknown:0,
  sourceConditionEverTrueRunnerTraces:0,
  ...(rankBridge?{modelOrderRatePredicateFacts:0}:{}),
  ...(includeAbsoluteOrder?{modelAbsoluteOrderPredicateFacts:0}:{}),
  ...(positionFacts?{modelSourcePositionPredicateFacts:0}:{}),
  sourcePreconditionsWithDynamicPredicates:
   x.ast.invokes.filter(v=>v.preConditions.some(row=>row.some(p=>
    !monitor.STATIC_TYPES.has(p.type)))).length
 }]));
 const opportunityTrials=[];
 const totals={races:plans.length,modelFrames:0,unchangedModelPhysicsValues:0,
  modelRunnerPriorityTicks:0,modelProgressRateKnownRunnerTicks:0,
  modelProgressRateHeldBoundaryRunnerTicks:0,distanceRatePredicateFacts:0,
  sourceConditionTrueSkillRunnerTicks:0,sourceConditionFalseSkillRunnerTicks:0,
  sourceConditionUnknownSkillRunnerTicks:0,sourceConditionEverTrueRunnerTraces:0,
  initializedOrFinishedRunnerFramesHeld:0,
  ...(positionFacts?{
   modelSourcePositionPredicateFacts:0,
   modelRunnerPriorityTicksWithSourcePositionFacts:0
  }:{}),
  ...(rankBridge?{modelPrePriorityCachedRankRunnerTicks:0,
    modelOrderRatePredicateFacts:0}:{}),
  ...(includeAbsoluteOrder?{modelAbsoluteOrderPredicateFacts:0}:{}),};
 for(let r=0;r<plans.length;r++){
  const plan=plans[r],a=control[r],b=probe[r];
  totals.unchangedModelPhysicsValues+=validatePaired(plan,a,b);
  totals.modelFrames+=a.frames.length;
  const traces=Array.from({length:plan.fieldSize},()=>compiled.map(x=>{
   const logical=new monitor.WholeTickMonitor(x.profile);
   // The model's initialized t=0 frame has no actual source skill-call
   // observation. Earlier precondition latch history is therefore UNKNOWN,
   // never assumed false. A later positive fact can still establish true.
   logical.preState=logical.preState.map((state,index)=>
    x.ast.invokes[index].preConditions.length?monitor.UNKNOWN:state);
   return {compiled:x.ast,monitor:logical,seenTrue:false,tick:0,
    opportunityTrace:raceOpportunity.makeTrace(),
    ...(triage?{blockerTrace:triage.createTrace()}:{})};
  }));
  for(let t=0;t<a.frames.length;t++){
   for(let i=0;i<plan.fieldSize;i++){
    if(t===0){totals.initializedOrFinishedRunnerFramesHeld++;continue;}
    const pos1=legacy.get(b.frames[t].horses[i],4);
    const pos0=legacy.get(b.frames[t].horses[i],5);
    if(pos1===pre.SENTINEL&&pos0===pre.SENTINEL){
     totals.initializedOrFinishedRunnerFramesHeld++;continue;
    }
    check(Number.isFinite(pos1)&&pos1!==pre.SENTINEL&&pos1===pos0,
     'priority-1/0 position stages do not match');
    check(pos1===legacy.get(a.frames[t-1].horses[i],0),
     'model source pre-skill position differs from previous post-frame');
    const rate=originalRate(pos1,plan.course.distance);
    totals.modelRunnerPriorityTicks++;
    if(rate===null)totals.modelProgressRateHeldBoundaryRunnerTicks++;
    else totals.modelProgressRateKnownRunnerTicks++;
    const staticContext=context(plan,i);
    const exactModelRank=rankBridge?rankEvidence.rankByRace[r][t][i]:null;
    if(rankBridge&&exactModelRank!==null)totals.modelPrePriorityCachedRankRunnerTicks++;
    let positionFactsForRunner=0;
    for(const trace of traces[i]){
     const id=trace.compiled.sourceNumericId,summary=perSkill[id];
     const facts=observations(trace.compiled,rate);
     const rankFacts=rankBridge?rankBridge.observedOrderRateFacts(
      trace.compiled,exactModelRank,plan.fieldSize):[];
     const absoluteOrderFacts=includeAbsoluteOrder?
      rankBridge.observedAbsoluteOrderFacts(trace.compiled,exactModelRank,
       plan.fieldSize):[];
     const addedFacts=positionFacts?
      positionFacts.observations(trace.compiled,pos1,plan.course.distance):[];
     if(positionFacts){
      summary.modelSourcePositionPredicateFacts+=addedFacts.length;
      totals.modelSourcePositionPredicateFacts+=addedFacts.length;
      positionFactsForRunner+=addedFacts.length;
     }
     const tickFacts=[...facts,...rankFacts,...absoluteOrderFacts,...addedFacts];
     const result=trace.monitor.step({tickIndex:trace.tick++,
      staticContext,observations:tickFacts});
     if(triage)triage.observe(trace.blockerTrace,trace.compiled,
      result,staticContext,tickFacts);
     summary.modelRunnerTicks++;
     summary.distanceRateObservations+=facts.length;
     totals.distanceRatePredicateFacts+=facts.length;
     if(rankBridge){
      summary.modelOrderRatePredicateFacts+=rankFacts.length;
      totals.modelOrderRatePredicateFacts+=rankFacts.length;
     }
     if(includeAbsoluteOrder){
      summary.modelAbsoluteOrderPredicateFacts+=absoluteOrderFacts.length;
      totals.modelAbsoluteOrderPredicateFacts+=absoluteOrderFacts.length;
     }
     const outcome=result.overallCondition;
     check(['true','false','unknown'].includes(outcome),'unknown ternary outcome');
     summary['sourceCondition'+outcome[0].toUpperCase()+outcome.slice(1)]++;
     totals['sourceCondition'+outcome[0].toUpperCase()+outcome.slice(1)+
      'SkillRunnerTicks']++;
     raceOpportunity.append(trace.opportunityTrace,outcome);
     if(outcome==='true')trace.seenTrue=true;
     check(result.gameProcMeasured===false&&
      result.eligibleForP3CardScoring===false,
      'source whole skill result was accidentally promoted');
    }
    if(positionFacts&&positionFactsForRunner>0)
     totals.modelRunnerPriorityTicksWithSourcePositionFacts++;
   }
  }
  for(let i=0;i<traces.length;i++)for(const trace of traces[i]){
   opportunityTrials.push({
    sourceNumericId:trace.compiled.sourceNumericId,
    style:plan.strategies[i],
    modelRaceIndex:r,runnerIndex:i,
    courseId:plan.course.id,distanceType:plan.course.distanceType,
    surface:plan.course.surface,fieldSize:plan.fieldSize,
    scenario:plan.scenario,mode:plan.mode,
    trace:trace.opportunityTrace,
    ...(triage?{blockerTrace:trace.blockerTrace}:{})
   });
   if(trace.seenTrue){
    totals.sourceConditionEverTrueRunnerTraces++;
    perSkill[trace.compiled.sourceNumericId].sourceConditionEverTrueRunnerTraces++;
   }
  }
 }
 const raceOpportunityReport=raceOpportunity.aggregate(opportunityTrials);
 const triageReport=triage?triage.aggregate(opportunityTrials,raceOpportunityReport):null;
 const totalSourceTicks=totals.modelRunnerPriorityTicks*compiled.length;
 check(totals.modelRunnerPriorityTicks>0&&
  totals.modelProgressRateKnownRunnerTicks>0&&
  totals.modelProgressRateKnownRunnerTicks+
   totals.modelProgressRateHeldBoundaryRunnerTicks===
   totals.modelRunnerPriorityTicks&&
  totals.sourceConditionTrueSkillRunnerTicks+
   totals.sourceConditionFalseSkillRunnerTicks+
   totals.sourceConditionUnknownSkillRunnerTicks===totalSourceTicks&&
  Object.values(perSkill).every(x=>x.modelRunnerTicks===totals.modelRunnerPriorityTicks)&&
  raceOpportunityReport.totals.skillRunnerPriorityTicks===totalSourceTicks&&
  raceOpportunityReport.totals.verdicts['observed-at-least-once-true']===
   totals.sourceConditionEverTrueRunnerTraces&&
  raceOpportunityReport.denominators.skillRunnerRaceTrials===
   plans.reduce((n,p)=>n+p.fieldSize*compiled.length,0)&&
  raceOpportunityReport.totals.sourceTickStates.true===
   totals.sourceConditionTrueSkillRunnerTicks&&
  raceOpportunityReport.totals.sourceTickStates.false===
   totals.sourceConditionFalseSkillRunnerTicks&&
  raceOpportunityReport.totals.sourceTickStates.unknown===
   totals.sourceConditionUnknownSkillRunnerTicks,
  'real-model position-to-original-condition evidence count drift');
 return {schemaVersion:positionFacts?(rankBridge?5:4):(rankBridge?3:2),
  status:positionFacts?
   'P2.15-source-formula-position-stage-plus-distance-original-AST-on-GlobalSim-not-game':
   rankBridge?
    'P2.15-model-pre-priority-rank-plus-distance-original-source-condition-interpretation-not-game':STATUS,
  provenance:{originalUmaSimRevision:PIN,
   ...(positionFacts?{originalPositionFormulaEvidence:positionSourceEvidence}:{}),
   sourceSkillRegistrySHA256:SOURCE_SHA,
   originalConditionValue:'distance_rate=(simulation.position*100/courseLength).toInt()',
   originalOrderRate:'ignored by fixed UmaSim SkillChecker',
   globalSimRevision:legacy.PIN,
   rawUpstreamSkillDataRedistributed:false},
  experiment:{fixedNoSkillGlobalSimRaces:plans.length,
   modelPosition:'actual pre-skill priority calls from temporary read-only Rust probe',
   sourcePredicate:'distance_rate (exact comparison operator/value in original AST)',
   otherDynamicSourcePredicateObservations:positionFacts?
    'only phase/phase_firsthalf/phase_laterhalf/remain_distance/furlong source-formula projections':'none',
   staticContextFields:['running_style','distance_type','ground_type'],
   modelPositionIsOriginalUmaSimRuntime:false,
   preconditionHistoryBeforeFirstObservedModelPriorityCall:'unknown',
   boundaryToleranceFractionOfRaceProgress:UNRESOLVED_BOUNDARY,
   sourceExpressionCompiler:'previous P2.15 three-valued full-source AND/OR/preCondition/invoke monitor'},
  denominators:{sourceDistanceRateSkills:compiled.length,
   ...(positionFacts?{
    sourcePositionPredicateFamilies:positionFacts.TYPES,
    sourceSkillsWithPositionPredicates:compiled.filter(x=>
     [...x.ast.lookup.values()].some(ref=>
      positionFacts.TYPES.includes(ref.type))).length,
    sourcePositionPredicateOccurrences:compiled.reduce((n,x)=>n+
     [...x.ast.lookup.values()].filter(ref=>
      positionFacts.TYPES.includes(ref.type)).length,0)
   }:{}),
   ...(includeAbsoluteOrder?{
    sourceAbsoluteOrderSkillsAmongDistanceRate:compiled.filter(x=>
     [...x.ast.lookup.values()].some(y=>y.type==='order')).length,
    sourceAbsoluteOrderPredicateOccurrences:compiled.reduce((n,x)=>n+
     [...x.ast.lookup.values()].filter(y=>y.type==='order').length,0)
   }:{}),
   ...(rankBridge?{
    sourceOrderRateSkillsAmongDistanceRate:compiled.filter(x=>
     [...x.ast.lookup.values()].some(y=>y.type==='order_rate')).length,
    sourceOrderRatePredicateOccurrences:compiled.reduce((n,x)=>n+
     [...x.ast.lookup.values()].filter(y=>y.type==='order_rate').length,0)
   }:{}),
   sourcePredicateOccurrences:compiled.reduce((n,x)=>n+
    [...x.ast.lookup.values()].filter(y=>y.type==='distance_rate').length,0)},
  totals,
  ...(rankBridge?{rankJoinEvidence:{
   source:rankEvidence.source,
   modelStageTotals:rankEvidence.totals,
   ...(includeAbsoluteOrder?{
    interpretedAbsoluteOrderCondition:'exact 1-indexed ordinal at same GlobalSim priority rank; hold zero/out-of-field source values',
    originalUmaSimIgnoredAbsoluteOrder:true
   }:{}),
   interpretedRankCondition:'order_rate integer projection per verified GameTora explanation for 9/12 runners only',
   warning:'This is not supported by the fixed original UmaSim runtime; it ignores order_rate. No JP game-level semantics claim.'
  }}:{}),
  raceOpportunity:raceOpportunityReport,
  ...(triage?{unknownRouteTriage:triageReport}:{}),
  rows:Object.values(perSkill).sort((a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId)),
  gates:{realGlobalSimPreSkillPositionsObserved:true,
   originalUmaSimDistanceRateFormulaAppliedToModelPositions:true,
   originalUmaSimRaceTicksObserved:false,
   originalUmaSimAllDynamicPredicatesObserved:false,
   originalSourceFullGameSkillActivated:false,
   realGameSkillProcRateComputed:false,
   P3CardScoringApproved:false,P4UiChanged:false,
   observedStageRaceRunnerOpportunityGrouped:true,
   fullRaceSkillOpportunityRateEstablished:false,
   ...(triage?{
    unknownOriginalSourceRouteWitnessRecorded:true,
    historicalPreconditionLatchKeptSeparate:true,
    originalSourceSkillProcStillUnobserved:true
   }:{}),
   ...(positionFacts?{
    originalUmaSimPositionFormulaSourceVerified:true,
    fixedModelPositionAppliedToAdditionalSourceConditions:true,
    actualOriginalUmaSimRacePositionObserved:false,
    actualOriginalUmaSimFullSkillProcRateMeasured:false
   }:{}),
   ...(includeAbsoluteOrder?{
    modelDirectAbsoluteOrderAtSkillPriorityObserved:true,
    sourceAbsoluteOrderModelInterpretationApplied:true,
    originalUmaSimAbsoluteOrderConditionImplemented:false,
    actualGameAbsoluteOrderSemanticsProven:false
   }:{}),
   ...(rankBridge?{
    modelPriorityCachedRankObserved:true,
    sourceOrderRateModelInterpretationApplied:true,
    originalUmaSimOrderRateConditionImplemented:false,
    actualGameOrderRateSemanticsProven:false
   }:{}),},
  limitations:[
   'This is a source-formula interpretation of a REAL GlobalSim position at the original GlobalSim skill-priority stage. It is NOT a real UmaSim race-state observation or a live-game activation.',
   'The model is an unskilled fixed comparison race. Skills carrying distance_rate in the original registry were not installed in GlobalSim.',
   'Only distance_rate receives numeric predicate observations; phase_random, rank and all other dynamic source conditions remain unknown. Static ground condition and track venue are withheld unless separately proven.',
   'Original Kotlin SkillChecker ignores order_rate and order, so simulated proc records from that checker cannot certify game rank predicates; this study never substitutes model rank into them.',
   'True/false/unknown tallies are correlated model runner-ticks across skills, not independent activation events, measured source skill probabilities, or approved suitability scores.',
   'The new raceOpportunity counts each original skill for each model runner once per modeled race, reporting confirmed-at-least-once, unresolved, observed-all-false, or zero-observed-stage separately. Different runners in one race are not independent race trials.',
   'Observed-stage lower/upper fractions are descriptive bounds for this specific incomplete model priority-stage panel, not full-game race opportunity, statistical intervals, activation rates or recommendation grades.',
   'Near-integer progress fractions are withheld due to potential Kotlin double vs GlobalSim position precision differences.',
   ...(includeAbsoluteOrder?[
    'Absolute order is a conditional exact model rank projection of the original operator and 1-indexed value for 9/12-runner panels only. It is ignored in the fixed UmaSim checker; game rule verification remains separate.'
   ]:[]),
   ...(positionFacts?[
    'The additional five source families are source-formula projections from real GlobalSim model priority positions, NOT observed UmaSim currentPhase/startPosition or actual game state.',
    'Near phase, half-phase, remaining-distance integer and furlong boundaries are withheld. Unmeasured source state, historical preconditions and unrelated AND conditions stay unknown.',
    'This fixed cohort still contains only original skills with distance_rate; five new facts do not establish all original source skills as resolved or permit P3/P4 grades.'
   ]:[]),
   ...(rankBridge?[
    'order_rate mapped to ordinal rank via a documented 9/12-field rounding interpretation; the pinned original UmaSim checker IGNOREs it and these model numbers are not original UmaSim or JP game proof.',
    'Rank is sampled from source GlobalSim priority=1/0 rank caches in an independent third engine. It is not inferred from post-step positions; game-proc semantics remain unknown.'
   ]:[])
  ]};
}
function main(args){
 if(args[0]!=='replay'||args.length!==8)throw Error(
  'replay <model-template> <original-engine> <position-probe-engine> <fixed-skill-data> <fixed-checker.kt> <fixed-skill-data.kt> <report.json>');
 const [_,templateFile,originalEngine,probeEngine,skillFile,checkerFile,skillCodeFile,outFile]=args;
 const source=validateSource(fs.readFileSync(skillFile,'utf8'),
  fs.readFileSync(checkerFile,'utf8'),fs.readFileSync(skillCodeFile,'utf8'));
 const lines=fs.readFileSync(templateFile,'utf8').trim().split(/\r?\n/);
 check(lines.length===1,'fixed GlobalSim example must be a single JSONL race');
 const template=JSON.parse(lines[0]);
 check(template.experimentalRetailRuntime&&template.experimentalRetailInitialization,
  'GlobalSim fixed retail engine sample disabled');
 const plans=legacy.plans().filter((_,index)=>index%4===0);
 check(plans.length===8,'fixed eight-race model observation panel drift');
 const specs=plans.map(plan=>expanded.makeRace(template,plan));
 check(specs.every(s=>s.horses.every(h=>h.skills?.length===0)),
  'model baseline must contain no skills');
 const original=legacy.replay(originalEngine,specs);
 const probe=legacy.replay(probeEngine,specs);
 const result=analyze(plans,original,probe,source.profiles);
 fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n');
 console.log('P2_15_SOURCE_DISTANCE_RATE='+JSON.stringify({
  status:result.status,denominators:result.denominators,
  totals:result.totals,
  raceOpportunity:{denominators:result.raceOpportunity.denominators,
   verdicts:result.raceOpportunity.totals.verdicts,
   byStyle:result.raceOpportunity.byStyle.map(x=>({
    style:x.style,trials:x.runnerRaceTrials,
    verdicts:x.verdicts}))},
  gates:result.gates}));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={PIN,STATUS,SOURCE_SHA,UNRESOLVED_BOUNDARY,
 validateSource,context,originalRate,observations,validatePaired,analyze,main};
