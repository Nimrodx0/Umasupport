#!/usr/bin/env node
'use strict';
/*
 * P2.15 exact original source position-derived clauses projected onto the
 * SAME unskilled GlobalSim priority positions as existing distance_rate.
 * This is not an original UmaSim simulation, actual skill activation, or
 * real-game activation rate. Whole AST AND/OR/preconditions remain ternary.
 */
const fs=require('node:fs');
const distance=require('./globalsim_p2_15_source_distance_rate_ticks.cjs');
const stage=require('../src/skill_source_position_stage_facts.cjs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const STATUS='P2.15-source-phase-remain-furlong-projection-same-model-stage-not-game';
const fail=(ok,why)=>{if(!ok)throw Error('P2.15 source position family join: '+why);};
function compare(baseline,joined){
 fail(baseline.status===distance.STATUS&&baseline.schemaVersion===2&&
  joined.schemaVersion===4&&
  joined.gates.originalUmaSimPositionFormulaSourceVerified===true&&
  joined.gates.actualOriginalUmaSimRacePositionObserved===false&&
  joined.provenance.originalUmaSimRevision===baseline.provenance.originalUmaSimRevision,
  'original source position model lineage / non-promotion changed');
 for(const key of ['sourceDistanceRateSkills','sourcePredicateOccurrences'])
  fail(baseline.denominators[key]===joined.denominators[key],
   'source population differs after stage facts: '+key);
 for(const key of ['modelRunnerPriorityTicks','distanceRatePredicateFacts',
  'unchangedModelPhysicsValues','modelProgressRateKnownRunnerTicks',
  'modelProgressRateHeldBoundaryRunnerTicks'])
  fail(baseline.totals[key]===joined.totals[key],
   'original source position model denominator drift: '+key);
 const old=baseline.totals,newTotals=joined.totals;
 const change=Object.fromEntries(['True','False','Unknown'].map(key=>
  [key.toLowerCase(),newTotals['sourceCondition'+key+'SkillRunnerTicks']-
   old['sourceCondition'+key+'SkillRunnerTicks']]));
 fail(change.true>=0&&change.false>=0&&change.unknown<=0&&
  change.true+change.false+change.unknown===0,
  'new source facts reversed definite original full-logic outcome');
 const before=baseline.raceOpportunity,after=joined.raceOpportunity;
 const columns=['observed-at-least-once-true','observed-unknown-without-true',
  'observed-all-false','no-observed-priority-ticks'];
 fail(before.denominators.skillRunnerRaceTrials===
  after.denominators.skillRunnerRaceTrials&&
  after.totals.verdicts[columns[0]]>=before.totals.verdicts[columns[0]]&&
  after.totals.verdicts[columns[1]]<=before.totals.verdicts[columns[1]]&&
  after.totals.verdicts[columns[2]]>=before.totals.verdicts[columns[2]]&&
  after.totals.verdicts[columns[3]]===before.totals.verdicts[columns[3]],
  'source stage facts introduced impossible race-level three-valued result');
 const prev=new Map(before.bySkillStyle.map(row=>[
  [row.sourceNumericId,row.style].join('|'),row]));
 let changedCells=0;
 const cells=[];
 for(const row of after.bySkillStyle){
  const b=prev.get([row.sourceNumericId,row.style].join('|'));
  fail(b?.runnerRaceTrials===row.runnerRaceTrials,
   'source phase projection dropped model skill/style trials');
  const gains=row.verdicts[columns[0]]-b.verdicts[columns[0]];
  const resolved=b.verdicts[columns[1]]-row.verdicts[columns[1]];
  fail(gains>=0&&resolved>=0,'joined style cell verdict changed non-monotonically');
  if(gains||resolved){changedCells++;cells.push({
   sourceNumericId:row.sourceNumericId,style:row.style,
   runnerRaceTrials:row.runnerRaceTrials,
   additionalConfirmedRunnerRaces:gains,
   fewerUnknownRunnerRaces:resolved,
   gameRate:null,acceptedStyleGrade:null
  });}
 }
 fail(joined.totals.modelSourcePositionPredicateFacts>0&&
  joined.denominators.sourceSkillsWithPositionPredicates>0,
  'no additional source positional facts actually measured');
 return {sourceSkillCount:joined.denominators.sourceDistanceRateSkills,
  sourceSkillsWithNewPredicateFamilies:joined.denominators.sourceSkillsWithPositionPredicates,
  originalSourcePredicateOccurrences:joined.denominators.sourcePositionPredicateOccurrences,
  emittedModelSourcePredicateFacts:joined.totals.modelSourcePositionPredicateFacts,
  modelPriorityRunnerTicksWithSourcePositionFacts:
   joined.totals.modelRunnerPriorityTicksWithSourcePositionFacts,
  sourceWholeConditionSkillRunnerTickChanges:change,
  baselineRunnerRaceVerdicts:{...before.totals.verdicts},
  joinedRunnerRaceVerdicts:{...after.totals.verdicts},
  skillStyleCellsWithChangedSourceEvidence:changedCells,
  changedSkillStyleCells:cells,originalUmaSimSkillProcs:null,
  gameRate:null,P3Score:null};
}
function analyze(plans,baselineReplies,positionReplies,sourceProfiles,verifiedSources){
 stage.verifyEvidence(verifiedSources);
 const baseline=distance.analyze(plans,baselineReplies,positionReplies,sourceProfiles);
 const joined=distance.analyze(plans,baselineReplies,positionReplies,sourceProfiles,
  {positionSourceEvidence:verifiedSources,unknownRouteTriage:true});
 const comparison=compare(baseline,joined);
 return {schemaVersion:1,status:STATUS,
  provenance:{originalUmaSimRevision:stage.ORIGINAL_REV,
   sourceSkillRegistrySHA256:distance.SOURCE_SHA,
   globalSimRevision:legacy.PIN,
   originalSourceFormulaEvidence:verifiedSources,
   rawOriginalSkillRegistryRedistributed:false},
  design:{modelRaces:plans.length,
   fixedUnskilledGlobalSim:true,
   originalUmaSimRacePositionObserved:false,
   modelStage:'actual priority1/priority0 positions from read-only model probe',
   verifiedSourceFamilies:stage.TYPES,
   firstSourceTickPreviousPreconditionHistory:'unknown',
   unobservedDynamicConditions:'unknown',
   originalSourceAllSkillsMeasured:false,
   comparisonUnit:'source skill × model runner × model race'},
  validation:{originalModelPhysicalColumnsUnchanged:
   joined.totals.unchangedModelPhysicsValues,
   modelRunnerPriorityTicks:joined.totals.modelRunnerPriorityTicks},
  comparison,
  unknownRouteTriage:joined.unknownRouteTriage,
  byStyle:joined.raceOpportunity.byStyle,
  bySkillStyle:joined.raceOpportunity.bySkillStyle,
  gates:{sourceOriginalFiveFormulasPinned:true,
   threeValuedWholeSourceASTPreserved:true,
   unresolvedSourceORInvokePathWitnessesRecorded:true,
   originalUmaSimFullUnknownCausesIdentified:false,
   modelPriorityPositionsDirectlyObserved:true,
   actualOriginalUmaSimStartPositionObserved:false,
   originalSourceFullANDMeasured:false,
   originalSourceSkillsEquipped:false,
   actualGameSkillProcRateMeasured:false,
   P3CardScoringApproved:false,P4UiChanged:false},
  limitations:[
   'Original UmaSim phase, half-phase, remain_distance and furlong formulas are applied to REAL unskilled GlobalSim priority-stage model positions, not UmaSim startPosition or game race state.',
   'The five new numeric predicate families are measured on the SAME individual model runner and priority tick as distance_rate, but the original simulator runtime and its full dynamic AND were not executed.',
   'Original source OR, preConditions state latch, multiple Invoke branches, unknown dynamic conditions and explicit static context remain separately preserved by the prior ternary monitor.',
   'Near-boundary projection is held unknown; source formulas, model position sampling and race frames are not a validated equivalence to Japanese game engine physics.',
   'Per-tick positions, shared source predicates, multiple runners and original skill paths are correlated. No P3 card score, P4 UI or official suitability labels are assigned.'
  ]};
}
function main(args){
 if(args[0]!=='replay'||args.length!==10)
  throw Error('replay <model-template.jsonl> <original-engine> <position-probe> <skill_data.txt> <SkillChecker.kt> <SkillData.kt> <RaceState.kt> <RaceCalculator.kt> <report.json>');
 const [_,templatePath,originalEngine,positionEngine,
  registry,checker,skillData,state,calculator,output]=args;
 const source=distance.validateSource(fs.readFileSync(registry,'utf8'),
  fs.readFileSync(checker,'utf8'),fs.readFileSync(skillData,'utf8'));
 const verified=stage.verifyPinnedSources(fs.readFileSync(checker,'utf8'),
  fs.readFileSync(state,'utf8'),fs.readFileSync(calculator,'utf8'));
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 fail(lines.length===1,'fixed GlobalSim example template changed');
 const template=JSON.parse(lines[0]);
 fail(template.experimentalRetailRuntime===true&&
  template.experimentalRetailInitialization===true,'retail model not fixed');
 const plans=legacy.plans().filter((_,index)=>index%4===0);
 fail(plans.length===8,'fixed original source 8-model-race panel changed');
 const modelRaces=plans.map(p=>expanded.makeRace(template,p));
 fail(modelRaces.every(r=>r.horses.every(h=>Array.isArray(h.skills)&&h.skills.length===0)),
  'model runners unexpectedly have source skills equipped');
 const original=legacy.replay(originalEngine,modelRaces);
 const observed=legacy.replay(positionEngine,modelRaces);
 const report=analyze(plans,original,observed,source.profiles,verified);
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('P2_15_FIVE_SOURCE_POSITION_FAMILIES='+JSON.stringify({
  provenance:report.provenance,
  stage:report.validation,comparison:report.comparison,
  unknownRouteWitnessSummary:{
   counts:report.unknownRouteTriage.counts,
   topGates:report.unknownRouteTriage.byCandidateGate.slice(0,12),
   topCombinations:report.unknownRouteTriage.byCandidateCombination.slice(0,12),
   byStyle:report.unknownRouteTriage.byStyle
  },
  fourStyle:report.byStyle.map(row=>({style:row.style,
   runnerRaceTrials:row.runnerRaceTrials,verdicts:row.verdicts})),
  gates:report.gates
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,compare,analyze,main};
