#!/usr/bin/env node
'use strict';
/*
 * P2.15: resume original absolute-order and order_rate research and combine
 * them with distance_rate plus five source-verified position predicates at
 * the SAME GlobalSim pre-skill priority stage. Original source OR/AND,
 * preConditions and Invoke identities are unchanged; missing is UNKNOWN.
 * Research-only source-interpretation: NOT UmaSim proc or live game rates.
 */
const fs=require('node:fs');
const distance=require('./globalsim_p2_15_source_distance_rate_ticks.cjs');
const stage=require('../src/skill_source_position_stage_facts.cjs');
const rankBridge=require('../src/skill_source_rank_tick_bridge.cjs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const STATUS='P2.15-direct-model-rank-and-position-original-condition-interpretations-not-game';
const fail=(ok,msg)=>{if(!ok)throw Error('P2.15 combined rank-position: '+msg);};
const VERDICTS=['observed-at-least-once-true','observed-unknown-without-true',
 'observed-all-false','no-observed-priority-ticks'];
function compare(before,after,rankEvidence){
 fail(before.schemaVersion===5&&after.schemaVersion===5&&
  before.status===after.status&&
  before.provenance.originalUmaSimRevision===stage.ORIGINAL_REV&&
  after.provenance.originalUmaSimRevision===stage.ORIGINAL_REV&&
  before.gates.actualGameOrderRateSemanticsProven===false&&
  after.gates.actualGameAbsoluteOrderSemanticsProven===false&&
  after.gates.originalUmaSimAbsoluteOrderConditionImplemented===false&&
  before.gates.originalUmaSimPositionFormulaSourceVerified===true,
  'did not preserve pinned source interpretation and model-only boundaries');
 fail(before.denominators.sourceDistanceRateSkills===
  after.denominators.sourceDistanceRateSkills&&
  before.denominators.sourceOrderRateSkillsAmongDistanceRate===
  after.denominators.sourceOrderRateSkillsAmongDistanceRate&&
  before.denominators.sourcePositionPredicateOccurrences===
  after.denominators.sourcePositionPredicateOccurrences&&
  after.denominators.sourceAbsoluteOrderSkillsAmongDistanceRate>0&&
  after.denominators.sourceAbsoluteOrderPredicateOccurrences>0,
  'changed original source cohort or no absolute order source predicates');
 for(const key of ['modelRunnerPriorityTicks','unchangedModelPhysicsValues',
  'distanceRatePredicateFacts','modelOrderRatePredicateFacts',
  'modelSourcePositionPredicateFacts','modelProgressRateKnownRunnerTicks',
  'modelProgressRateHeldBoundaryRunnerTicks']){
  fail(before.totals[key]===after.totals[key],
   'source model baseline drift: '+key);
 }
 fail(before.totals.modelRunnerPriorityTicks===
  rankEvidence.totals.activePreSkillRunnerTicks&&
  rankEvidence.totals.rankPriorityPairsMatched===
   before.totals.modelRunnerPriorityTicks&&
  after.totals.modelAbsoluteOrderPredicateFacts>0,
  'no independent pre-skill order evidence at the same source tick');
 const diff=Object.fromEntries(['True','False','Unknown'].map(x=>
  [x.toLowerCase(),after.totals['sourceCondition'+x+'SkillRunnerTicks']-
   before.totals['sourceCondition'+x+'SkillRunnerTicks']]));
 fail(diff.true>=0&&diff.false>=0&&diff.unknown<=0&&
  diff.true+diff.false+diff.unknown===0,
  'absolute order facts caused a nonmonotonic full-source AST outcome');
 const b=before.raceOpportunity,a=after.raceOpportunity;
 fail(b.denominators.skillRunnerRaceTrials===
  a.denominators.skillRunnerRaceTrials&&
  a.totals.verdicts[VERDICTS[0]]>=b.totals.verdicts[VERDICTS[0]]&&
  a.totals.verdicts[VERDICTS[1]]<=b.totals.verdicts[VERDICTS[1]]&&
  a.totals.verdicts[VERDICTS[2]]>=b.totals.verdicts[VERDICTS[2]]&&
  a.totals.verdicts[VERDICTS[3]]===b.totals.verdicts[VERDICTS[3]],
  'nonmonotonic model runner-race aggregation');
 const prior=new Map(b.bySkillStyle.map(x=>[
  x.sourceNumericId+'|'+x.style,x]));
 const changes=[];
 for(const row of a.bySkillStyle){
  const old=prior.get(row.sourceNumericId+'|'+row.style);
  fail(old&&row.runnerRaceTrials===old.runnerRaceTrials,
   'original skill-style denominator changed');
  const gain=row.verdicts[VERDICTS[0]]-old.verdicts[VERDICTS[0]];
  const resolved=old.verdicts[VERDICTS[1]]-row.verdicts[VERDICTS[1]];
  fail(gain>=0&&resolved>=0,'order source facts reversed skill-style verdict');
  if(gain||resolved)changes.push({
   sourceNumericId:row.sourceNumericId,style:row.style,
   sourceAbsoluteOrderSubconditionUsed:true,
   modelRunnerRaceTrials:row.runnerRaceTrials,
   additionalModelSourceConditionConfirmed:gain,
   reducedUnknownModelRunnerRaces:resolved,
   actualGameProcRate:null,approvedSuitabilityLabel:null
  });
 }
 const triage=after.unknownRouteTriage;
 fail(triage?.counts?.sourceSkillRunnerRaceTrials===
  a.denominators.skillRunnerRaceTrials&&
  triage.counts.observedUnknownWithoutTrueRunnerRaceTrials===
  a.totals.verdicts[VERDICTS[1]]&&
  triage.byCandidateCombination.reduce((n,x)=>
   n+x.representativeRunnerRaceTrials,0)===
  a.totals.verdicts[VERDICTS[1]],
  'new unknown route diagnosis is not on same joined original AST');
 return {
  originalSourceSkills:after.denominators.sourceDistanceRateSkills,
  sourceWithOrderRate:after.denominators.sourceOrderRateSkillsAmongDistanceRate,
  sourceWithAbsoluteOrder:after.denominators.sourceAbsoluteOrderSkillsAmongDistanceRate,
  originalAbsoluteOrderPredicateOccurrences:
   after.denominators.sourceAbsoluteOrderPredicateOccurrences,
  observedAbsoluteOrderModelPredicateFacts:
   after.totals.modelAbsoluteOrderPredicateFacts,
  modelRunnerPreSkillPriorityTicks:after.totals.modelRunnerPriorityTicks,
  extraAbsoluteOrderModelTickOutcomes:diff,
  modelRunnerRaceVerdictsBeforeAbsoluteOrder:{...b.totals.verdicts},
  modelRunnerRaceVerdictsAfterAbsoluteOrder:{...a.totals.verdicts},
  changedOriginalSkillStyleCells:changes.length,
  changedSkillStyleCells:changes,
  trueGameSkillProcObserved:false,gameRate:null,P3CardScore:null
 };
}
function analyze(plans,originalReplies,positionReplies,rankReplies,
 profiles,positionSourceEvidence){
 stage.verifyEvidence(positionSourceEvidence);
 const rankEvidence=rankBridge.buildEvidence(plans,originalReplies,
  positionReplies,rankReplies);
 rankBridge.validateEvidence(rankEvidence,plans);
 const before=distance.analyze(plans,originalReplies,positionReplies,profiles,
  {rankEvidence,positionSourceEvidence});
 const after=distance.analyze(plans,originalReplies,positionReplies,profiles,
  {rankEvidence,positionSourceEvidence,includeAbsoluteOrder:true,
   unknownRouteTriage:true});
 const comparison=compare(before,after,rankEvidence);
 fail(comparison.originalSourceSkills===253||plans.length<8,
  'fixed original 253 skill research denominator drift');
 return {schemaVersion:1,status:STATUS,
  provenance:{originalUmaSimRevision:stage.ORIGINAL_REV,
   originalSkillRegistrySHA256:distance.SOURCE_SHA,
   globalSimRevision:rankBridge.MODEL_PIN,
   exactSourcePositionFormulas:positionSourceEvidence,
   originalUmaSimIgnoresOrderAndOrderRate:true,
   percentMapping:rankEvidence.source.mapping,
   rawOriginalSkillDictionaryRepublished:false},
  design:{modelRaces:plans.length,
   sourceSkillsNotEquipped:true,
   exactGlobalSimPreSkillRankAndPositionSameRunnerAndTick:true,
   predicateTypes:['distance_rate',...stage.TYPES,'order_rate','order'],
   rankPercentageModelInterpretationOnly:true,
   originalSourceANDORInvokeAndPreconditionPreserved:true,
   unknownOtherSourcePredicatesStillUnknown:true},
  modelStageValidation:rankEvidence.totals,
  comparison,
  unknownRouteTriage:after.unknownRouteTriage,
  byStyle:after.raceOpportunity.byStyle,
  bySkillStyle:after.raceOpportunity.bySkillStyle,
  byContext:after.raceOpportunity.bySkillStyleContext,
  gates:{originalUmaSimSourceDataPinned:true,
   independentThreeEngineModelPhysicsCompared:true,
   sameRunnerSameTickSourcePositionAndRankJoined:true,
   exactAbsoluteOrderAndInterpretedOrderRateDifferent:true,
   historicalPreconditionsStillTernary:true,
   originalUmaSimOrderAndOrderRateIgnored:true,
   actualOriginalUmaSimSkillProcObserved:false,
   actualGameSkillProcRateMeasured:false,
   P2SuitabilityApproved:false,P3CardScoringApproved:false,
   P4UiChanged:false},
  limitations:[
   'Original UmaSim ignores order and order_rate. Absolute rank has a model-based 1-index interpretation; order_rate uses published 9/12 rounding. Neither is a direct measurement of game rank semantics.',
   'Actual model ranking and position are measured at the same priority tick in independently built GlobalSim v77 probes with unmodified physics. The original UmaSim runtime and original source skill proc are NOT observed.',
   'Unknown preConditions before first observed frame are not zeroed, source AND/OR/Invoke pathways remain independent and other dynamic conditions are not manufactured.',
   'The 8 no-skill artificial GlobalSim races do not represent independent current-game skill proc observations or a real opponent roster distribution.',
   'Counts of candidate source predicates or per-tick verdicts are correlated and cannot be treated as independent game events.',
   'Research does not qualify P2 suitability, P3 card grading, P4 UI, actual gameplay probabilities or effects.'
  ]};
}
function main(args){
 if(args[0]!=='replay'||args.length!==11)
  throw Error('replay <template.jsonl> <original-engine> <position-engine> <rank-engine> <skill_data.txt> <SkillChecker.kt> <SkillData.kt> <RaceState.kt> <RaceCalculator.kt> <out.json>');
 const [_,templatePath,originalEngine,positionEngine,rankEngine,
  registry,checker,skillData,state,calculator,output]=args;
 const profiles=distance.validateSource(fs.readFileSync(registry,'utf8'),
  fs.readFileSync(checker,'utf8'),fs.readFileSync(skillData,'utf8')).profiles;
 const fixed=stage.verifyPinnedSources(fs.readFileSync(checker,'utf8'),
  fs.readFileSync(state,'utf8'),fs.readFileSync(calculator,'utf8'));
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 fail(lines.length===1,'fixed source template changed');
 const template=JSON.parse(lines[0]);
 fail(template.experimentalRetailRuntime===true&&
  template.experimentalRetailInitialization===true,'fixed retail model not present');
 const plans=legacy.plans().filter((_,i)=>i%4===0);
 fail(plans.length===8&&plans.every(p=>[9,12].includes(p.fieldSize)),
  'fixed eight race 9/12 panel changed');
 const races=plans.map(plan=>expanded.makeRace(template,plan));
 fail(races.every(x=>x.horses.every(h=>h.skills?.length===0)),
  'the original source skill set is unexpectedly equipped');
 const orig=legacy.replay(originalEngine,races);
 const position=legacy.replay(positionEngine,races);
 const ranks=legacy.replay(rankEngine,races);
 const result=analyze(plans,orig,position,ranks,profiles,fixed);
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('P2_15_RANK_POSITION_FULL_JOIN='+JSON.stringify({
  modelStageValidation:result.modelStageValidation,
  comparison:{...result.comparison,changedSkillStyleCells:
   result.comparison.changedSkillStyleCells.slice(0,15)},
  unknownGateCounts:result.unknownRouteTriage.counts,
  topRemainingUnknownGates:result.unknownRouteTriage.byCandidateGate.slice(0,12),
  byStyle:result.byStyle.map(x=>({style:x.style,verdicts:x.verdicts})),
  gates:result.gates
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,compare,analyze,main};
