'use strict';
/*
 * P2.15: A WITNESS-BASED route diagnosis for UNKNOWN original-source
 * three-valued outcomes evaluated against unskilled GlobalSim model state.
 *
 * For each unresolved skill × model runner × model race, retain ONE observed
 * UNKNOWN priority tick and ONE viable Invoke/condition-OR alternative
 * requiring the fewest DISTINCT missing predicate types + an explicit,
 * separate "precondition-latch-unknown" gate where applicable.
 *
 * This is neither a proof that those are the ONLY causes of uncertainty
 * across the race nor a guarantee that resolving these facts will yield
 * TRUE. It is a concrete, source-AST-grounded next-measurement candidate.
 */
const monitor=require('./skill_source_whole_tick_monitor.cjs');
const opportunity=require('./skill_source_race_opportunity.cjs');
const STATUS='P2.15-unresolved-original-source-route-witness-candidates-model-only';
const PRE='precondition-latch-unknown';
const fail=(ok,why)=>{if(!ok)throw Error('P2.15 unknown route diagnosis: '+why);};
function missing(ref,staticContext,observed){
 const stat=monitor.staticValue(staticContext,ref);
 if(stat!==monitor.UNKNOWN)return false;
 return !observed.has(monitor.identity(ref));
}
function inspect(compiled,result,staticContext,observations){
 fail(compiled?.lookup instanceof Map&&
  result?.sourceNumericId===compiled.sourceNumericId&&
  result.overallCondition===monitor.UNKNOWN&&
  Array.isArray(result.invokes)&&
  result.invokes.length===compiled.invokes.length,
  'requires matching UNKNOWN result of original source Invoke AST');
 const supplied=monitor.observationMap(compiled,observations);
 const paths=[];
 for(const [i,v] of compiled.invokes.entries()){
  const state=result.invokes[i];
  fail(state.invokeOffset===i&&state.invokeIndex===v.invokeIndex,
   'Invoke identity mismatch');
  if(state.conditionConjunction!==monitor.UNKNOWN)continue;
  const preUnknown=state.preconditionLatched===monitor.UNKNOWN;
  fail(preUnknown||state.preconditionLatched===monitor.TRUE,
   'non-viable historical precondition route');
  const normalPaths=v.conditions.length?v.conditions:[[]];
  const altStates=state.conditionAlternatives.length?
   state.conditionAlternatives:[monitor.TRUE];
  fail(normalPaths.length===altStates.length,
   'missing original conditions OR alternative status');
  for(const [index,row] of normalPaths.entries()){
   if(altStates[index]===monitor.FALSE)continue;
   const missingRefs=row.filter(ref=>missing(ref,staticContext,supplied));
   const kinds=[...new Set(missingRefs.map(x=>x.type))].sort();
   const gateKinds=[...kinds,...(preUnknown?[PRE]:[])].sort();
   fail(gateKinds.length>0,
    'UNKNOWN route could be true without any unobserved source gate');
   paths.push({invokeOffset:v.invokeOffset,invokeIndex:v.invokeIndex,
    conditionOrIndex:index,
    unknownPredicateTypes:kinds,
    unresolvedPreconditionLatch:preUnknown,
    unresolvedGateKinds:gateKinds,
    remainingDistinctGateKinds:gateKinds.length,
    modelSourceLogicOnly:true});
  }
 }
 fail(paths.length>0,
  'UNKNOWN original-source result has no potentially viable current condition route');
 // Deterministic representative. DO NOT discard the original OR alternatives
 // in the monitor itself; this is only a research triage witness.
 paths.sort((a,b)=>a.remainingDistinctGateKinds-b.remainingDistinctGateKinds||
  a.invokeOffset-b.invokeOffset||a.conditionOrIndex-b.conditionOrIndex||
  a.unresolvedGateKinds.join('|').localeCompare(b.unresolvedGateKinds.join('|')));
 return {sourceNumericId:compiled.sourceNumericId,
  alternativeRoutesStillPossiblyViable:paths.length,
  representative:paths[0],
  minimumGateKindsAtThisTick:paths[0].remainingDistinctGateKinds,
  actualSourceProcObserved:false,gameRate:null,approvedSuitability:null};
}
function createTrace(){
 return {unknownObservedTicks:0,candidateTicksInspected:0,
  candidateTicksSkippedAfterSingleGate:0,
  representative:null,witnessTick:null};
}
function observe(trace,compiled,result,staticContext,observations){
 fail(trace&&Number.isSafeInteger(trace.unknownObservedTicks)&&
  Number.isSafeInteger(result?.tickIndex)&&result.tickIndex>=0,
  'invalid source model trace or tick');
 if(result.overallCondition!==monitor.UNKNOWN)return;
 trace.unknownObservedTicks++;
 // A single missing gate is minimal for any still UNKNOWN route.
 // Later ticks may present other gate kinds; this is not an exhaustive
 // tally of every blocker over a race, only a deterministic best witness.
 if(trace.representative?.remainingDistinctGateKinds===1){
  trace.candidateTicksSkippedAfterSingleGate++;return;
 }
 const x=inspect(compiled,result,staticContext,observations);
 trace.candidateTicksInspected++;
 if(!trace.representative||
  x.representative.remainingDistinctGateKinds<
   trace.representative.remainingDistinctGateKinds){
  trace.representative=x.representative;
  trace.witnessTick=result.tickIndex;
 }
}
const styles=opportunity.STYLES;
function aggregate(trials,raceOpportunityReport){
 fail(Array.isArray(trials)&&trials.length>0&&
  raceOpportunityReport?.status===
   'P2.15-source-condition-on-observed-model-race-runner-traces-not-game',
  'need same full original source race-opportunity trial cohort');
 const perStyle=new Map(styles.map(style=>[style,{style,
  unresolvedRunnerRaceTrials:0,
  sourceSkillsWithUnresolvedModelRaces:new Set(),
  examplesByGate:new Map()}]));
 const byGate=new Map(),bySignature=new Map(),bySkillStyle=new Map();
 const counts={sourceSkillRunnerRaceTrials:trials.length,
  observedUnknownWithoutTrueRunnerRaceTrials:0,
  samplesWithFirstMinimumUnknownRoute:0,
  modelUnknownTicksInUnresolvedTrials:0,
  witnessTicksExaminedInUnresolvedTrials:0,
  unknownTicksSkippedAfterFirstSingleGateInUnresolvedTrials:0,
  unresolvedTrialsWithOneGateWitness:0,
  unresolvedTrialsWithTwoOrMoreGateWitness:0,
  witnessesWithPreconditionLatchUnknown:0,
  witnessesWithOnlyUnobservedPredicateTypes:0};
 for(const item of trials){
  const verdict=opportunity.conclude(item.trace).verdict;
  if(verdict!=='observed-unknown-without-true')continue;
  counts.observedUnknownWithoutTrueRunnerRaceTrials++;
  const t=item.blockerTrace,x=t?.representative;
  fail(x&&t.witnessTick!==null&&
   t.unknownObservedTicks===item.trace.outcomes.unknown&&
   t.candidateTicksInspected+t.candidateTicksSkippedAfterSingleGate===
    t.unknownObservedTicks&&
   Number.isSafeInteger(x.remainingDistinctGateKinds)&&
   x.remainingDistinctGateKinds>=1&&
   styles.includes(item.style),
   'lost minimum current-path witness for an unresolved skill-model-runner-race');
  counts.samplesWithFirstMinimumUnknownRoute++;
  counts.modelUnknownTicksInUnresolvedTrials+=t.unknownObservedTicks;
  counts.witnessTicksExaminedInUnresolvedTrials+=t.candidateTicksInspected;
  counts.unknownTicksSkippedAfterFirstSingleGateInUnresolvedTrials+=
   t.candidateTicksSkippedAfterSingleGate;
  if(x.remainingDistinctGateKinds===1)counts.unresolvedTrialsWithOneGateWitness++;
  else counts.unresolvedTrialsWithTwoOrMoreGateWitness++;
  if(x.unresolvedPreconditionLatch)counts.witnessesWithPreconditionLatchUnknown++;
  else counts.witnessesWithOnlyUnobservedPredicateTypes++;
  const st=perStyle.get(item.style);st.unresolvedRunnerRaceTrials++;
  st.sourceSkillsWithUnresolvedModelRaces.add(item.sourceNumericId);
  const signature=x.unresolvedGateKinds.join(' + ');
  const key=[item.sourceNumericId,item.style].join('|');
  if(!bySkillStyle.has(key))bySkillStyle.set(key,{
   sourceNumericId:item.sourceNumericId,style:item.style,
   unresolvedRunnerRaceTrials:0,
   bestWitnessOneGateTrials:0,
   candidateGateKinds:new Set(),
   originalSourceWholeSkillProcObserved:false});
  const cell=bySkillStyle.get(key);
  cell.unresolvedRunnerRaceTrials++;
  if(x.remainingDistinctGateKinds===1)cell.bestWitnessOneGateTrials++;
  for(const kind of x.unresolvedGateKinds){
   cell.candidateGateKinds.add(kind);
   if(!byGate.has(kind))byGate.set(kind,{
    gateKind:kind,representativeRunnerRaceTrials:0,
    sourceSkillStyleCells:new Set(),sourceSkills:new Set(),
    byStyle:Object.fromEntries(styles.map(s=>[s,0])),
    witnessExample:null});
   const g=byGate.get(kind);
   g.representativeRunnerRaceTrials++;
   g.sourceSkillStyleCells.add(key);g.sourceSkills.add(item.sourceNumericId);
   g.byStyle[item.style]++;
   if(!g.witnessExample)g.witnessExample={
    sourceNumericId:item.sourceNumericId,style:item.style,
    sourceInvokeOffset:x.invokeOffset,sourceConditionsOrIndex:x.conditionOrIndex,
    modelRaceIndex:item.modelRaceIndex,modelRunnerIndex:item.runnerIndex,
    witnessObservedTick:t.witnessTick,
    totalDistinctMissingGateKinds:x.remainingDistinctGateKinds};
  }
  if(!bySignature.has(signature))bySignature.set(signature,{
   candidateGateCombination:signature,representativeRunnerRaceTrials:0,
   sourceSkills:new Set(),sourceSkillStyleCells:new Set()});
  const g=bySignature.get(signature);
  g.representativeRunnerRaceTrials++;g.sourceSkills.add(item.sourceNumericId);
  g.sourceSkillStyleCells.add(key);
 }
 fail(counts.samplesWithFirstMinimumUnknownRoute===
  raceOpportunityReport.totals.verdicts['observed-unknown-without-true']&&
  counts.sourceSkillRunnerRaceTrials===
  raceOpportunityReport.denominators.skillRunnerRaceTrials&&
  counts.unresolvedTrialsWithOneGateWitness+
   counts.unresolvedTrialsWithTwoOrMoreGateWitness===
   counts.observedUnknownWithoutTrueRunnerRaceTrials&&
  [...bySignature.values()].reduce((n,x)=>n+x.representativeRunnerRaceTrials,0)===
   counts.observedUnknownWithoutTrueRunnerRaceTrials&&
  [...perStyle.values()].reduce((n,x)=>n+x.unresolvedRunnerRaceTrials,0)===
   counts.observedUnknownWithoutTrueRunnerRaceTrials,
  'route diagnosis population or overlap denominator drift');
 const byCandidateGate=[...byGate.values()].map(g=>({
  ...g,sourceSkillStyleCells:g.sourceSkillStyleCells.size,
  sourceSkills:g.sourceSkills.size
 })).sort((a,b)=>b.representativeRunnerRaceTrials-a.representativeRunnerRaceTrials||
  a.gateKind.localeCompare(b.gateKind));
 return {schemaVersion:1,status:STATUS,
  counts,
  definition:{
   unit:'original source skill × one GlobalSim model runner × one fixed model race',
   state:'observed UNKNOWN with no observed TRUE across sampled model priority ticks',
   pathChoice:'earliest observed UNKNOWN witness having the minimum number of distinct unobserved condition types plus separate unresolved precondition-latch gate',
   gateMeaning:'an original-source condition that is unknown under supplied model facts, NOT a proven cause of no real game skill activation',
   singleGateOptimization:'once a one-gate witness is found, later unknown stages are not diagnosed; other candidate gates may exist',
   splitByStyles:styles,
   acrossGateRowsMayOverlap:true,
   acrossCandidateCombinationRowsFormPartition:true,
   gameRate:null,approvedSkillSuitability:null
  },
  byCandidateGate,
  byCandidateCombination:[...bySignature.values()].map(g=>({
   candidateGateCombination:g.candidateGateCombination,
   representativeRunnerRaceTrials:g.representativeRunnerRaceTrials,
   sourceSkills:g.sourceSkills.size,
   sourceSkillStyleCells:g.sourceSkillStyleCells.size
  })).sort((a,b)=>b.representativeRunnerRaceTrials-a.representativeRunnerRaceTrials||
   a.candidateGateCombination.localeCompare(b.candidateGateCombination)),
  byStyle:[...perStyle.values()].map(g=>({
   style:g.style,unresolvedRunnerRaceTrials:g.unresolvedRunnerRaceTrials,
   sourceSkillsWithUnresolvedModelRaces:g.sourceSkillsWithUnresolvedModelRaces.size,
   approvedSuitabilityLabel:null})),
  bySkillStyle:[...bySkillStyle.values()].map(c=>({
   ...c,candidateGateKinds:[...c.candidateGateKinds].sort()
  })).sort((a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId)||
   styles.indexOf(a.style)-styles.indexOf(b.style)),
  gates:{originalSourceASTReferencesVerified:true,
   historicalPreconditionsHeldSeparate:true,
   multipleInvokesAndORAlternativesPreserved:true,
   modelPriorityStateOnly:true,
   allRemainingUnknownsProvenCausedByWitness:false,
   originalSourceRuntimeSkillActivationObserved:false,
   gameProcRateMeasured:false,
   P3ScoringApproved:false,P4UiChanged:false},
  limitations:[
   'A representative witness is selected for prioritizing NEXT observation, not an exhaustive list of blockers across all alternative source routes, other model ticks, or the actual game.',
   'Current conditions and a historically unknown precondition latch are never conflated. A precondition latch may be UNKNOWN from the unobserved initial state and from other missing precondition facts.',
   'The original source AST Invoke/OR alternatives are kept; only paths that remain potentially viable under the supplied facts are considered. Selecting one shortest path does not mean it is the only source activation path.',
   'One source predicate type may appear many times with different operators; a gate kind counts types, not all exact comparator instances. A supplied future fact may be false, so clearing a gate does not guarantee TRUE.',
   'Same model runners, model races, conditions and source skills are correlated. Counts are not independent game trials, suitability scores, actual UmaSim proc counts, or gameplay probabilities.'
  ]};
}
module.exports={STATUS,PRE,inspect,createTrace,observe,aggregate};
