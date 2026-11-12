#!/usr/bin/env node
'use strict';
/*
 * P2.15 triple-source reference experiment:
 * original GlobalSim v77, independently instrumented pre-priority POSITION
 * probe, and independently instrumented pre-priority RANK-CACHE probe.
 *
 * Join only exact source-AST distance_rate and documentary order_rate.
 * Do not call the resulting model comparison a game activation probability.
 */
const fs=require('node:fs');
const expanded=require('./globalsim_position_expanded.cjs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const distance=require('./globalsim_p2_15_source_distance_rate_ticks.cjs');
const rankBridge=require('../src/skill_source_rank_tick_bridge.cjs');
const STATUS='P2.15-direct-model-priority-rank-source-order-rate-and-distance-rate-not-game';
const fail=(ok,msg)=>{if(!ok)throw Error('P2.15 triple-model: '+msg)};
function compare(baseline,joined,evidence){
 fail(baseline.status===distance.STATUS&&
  joined.status==='P2.15-model-pre-priority-rank-plus-distance-original-source-condition-interpretation-not-game'&&
  baseline.schemaVersion===2&&joined.schemaVersion===3,
  'wrong source-condition model comparison lineage');
 const t0=baseline.totals,t1=joined.totals;
 fail(baseline.denominators.sourceDistanceRateSkills===
  joined.denominators.sourceDistanceRateSkills&&
  baseline.denominators.sourcePredicateOccurrences===
  joined.denominators.sourcePredicateOccurrences&&
  t0.modelRunnerPriorityTicks===t1.modelRunnerPriorityTicks&&
  t0.distanceRatePredicateFacts===t1.distanceRatePredicateFacts&&
  t0.unchangedModelPhysicsValues===t1.unchangedModelPhysicsValues,
  'original source cohort or model physical denominator changed after rank join');
 fail(evidence.totals.modelPriorityPositionPairsMatched===
  t0.modelRunnerPriorityTicks&&
  evidence.totals.rankPriorityPairsMatched===t0.modelRunnerPriorityTicks&&
  t1.modelPrePriorityCachedRankRunnerTicks===t0.modelRunnerPriorityTicks,
  'rank observations do not cover exactly the independent position-probe stages');
 const names=['True','False','Unknown'];
 const diff=Object.fromEntries(names.map(k=>[k.toLowerCase(),
  t1['sourceCondition'+k+'SkillRunnerTicks']-
  t0['sourceCondition'+k+'SkillRunnerTicks']]));
 fail(diff.true>=0&&diff.false>=0&&diff.unknown<=0&&
  diff.true+diff.false+diff.unknown===0,
  'order_rate facts reversed previously conclusive source-condition outcomes');
 const bv=baseline.raceOpportunity.totals.verdicts,
  jv=joined.raceOpportunity.totals.verdicts;
 const allTrialCount=baseline.raceOpportunity.denominators.skillRunnerRaceTrials;
 fail(allTrialCount===joined.raceOpportunity.denominators.skillRunnerRaceTrials&&
  jv['observed-at-least-once-true']>=bv['observed-at-least-once-true']&&
  jv['observed-unknown-without-true']<=bv['observed-unknown-without-true']&&
  jv['no-observed-priority-ticks']===bv['no-observed-priority-ticks']&&
  jv['observed-all-false']>=bv['observed-all-false'],
  'rank evidence changed race-level source logic nonmonotonically');
 const baselineStyle=new Map(baseline.raceOpportunity.bySkillStyle.map(x=>
  [[x.sourceNumericId,x.style].join('|'),x]));
 const improvements=[];
 for(const r of joined.raceOpportunity.bySkillStyle){
  const key=[r.sourceNumericId,r.style].join('|');
  const b=baselineStyle.get(key);
  fail(b?.runnerRaceTrials===r.runnerRaceTrials,
   'rank interpretation changed original source skill/style trial denominator');
  const gains=r.verdicts['observed-at-least-once-true']-
   b.verdicts['observed-at-least-once-true'];
  const resolvedUnknown=b.verdicts['observed-unknown-without-true']-
   r.verdicts['observed-unknown-without-true'];
  fail(gains>=0&&resolvedUnknown>=0,'source rank model changed confirmed opportunity sign');
  if(gains>0||resolvedUnknown>0)improvements.push({
   sourceNumericId:r.sourceNumericId,style:r.style,
   observedRunnerRaceTrials:r.runnerRaceTrials,
   addedConfirmedModelRunnerRaces:gains,resolvedUnknownModelRunnerRaces:resolvedUnknown,
   status:'interpreted-model-source-condition-change-not-game'
  });
 }
 return {sourceSkillCount:joined.denominators.sourceDistanceRateSkills,
  sourceWithOrderRate:joined.denominators.sourceOrderRateSkillsAmongDistanceRate,
  sourceOrderRatePredicateOccurrences:joined.denominators.sourceOrderRatePredicateOccurrences,
  originalModelPriorityRunnerTicks:t0.modelRunnerPriorityTicks,
  recordedRankPredicateFacts:t1.modelOrderRatePredicateFacts,
  sourceConditionSkillRunnerTickChanges:diff,
  originalObservedSourceConditionRunnerRaces:{...bv},
  rankJoinedObservedSourceConditionRunnerRaces:{...jv},
  sourceSkillStyleCellsWithObservableChange:improvements.length,
  changedSkillStyleCells:improvements,
  actualGameProcCount:null,gameRate:null,approvedStyleScore:null};
}
function analyze(plans,originalReplies,positionReplies,rankReplies,profiles){
 const evidence=rankBridge.buildEvidence(plans,originalReplies,positionReplies,rankReplies);
 rankBridge.validateEvidence(evidence,plans);
 const originalConditions=distance.analyze(plans,originalReplies,positionReplies,profiles);
 const joined=distance.analyze(plans,originalReplies,positionReplies,profiles,
  {rankEvidence:evidence});
 const comparison=compare(originalConditions,joined,evidence);
 fail(comparison.recordedRankPredicateFacts>0&&
  comparison.sourceWithOrderRate>0&&
  comparison.sourceOrderRatePredicateOccurrences>0,
  'frozen source cohort has no verified observable order_rate source comparison');
 return {schemaVersion:1,status:STATUS,
  provenance:{originalUmaSimRevision:distance.PIN,
   originalSkillRegistrySHA256:distance.SOURCE_SHA,
   globalSimRevision:rankBridge.MODEL_PIN,
   sourceRankMeaning:'GameTora documented 9/12 integer rounding, not fixed UmaSim runtime',
   sourceOrderRateImplementedInPinnedUmaSim:false,
   originalSkillDataRedistributed:false},
  design:{modelRaces:plans.length,allThreeModelEnginesSameInputs:true,
   sourceSkillsNotEquipped:true,
   modelPriorityStage:'actual direct rank_of(i), same step priority1 and priority0',
   rankAndDistanceSameRunnerAndStep:true,
   baselinePredicateTypes:['distance_rate'],
   addedInterpretivePredicateTypes:['order_rate'],
   otherSourceDynamicConditionTypes:'held unknown'},
  modelStageValidation:evidence.totals,
  comparison,
  byStyle:joined.raceOpportunity.byStyle,
  bySkillStyle:joined.raceOpportunity.bySkillStyle,
  byContext:joined.raceOpportunity.bySkillStyleContext,
  limitations:[
   'The previous distance_rate-only model result and joined rank-interpretation result use identical 8 source-pinned no-skill model races.',
   'No skill in the source cohort is actually installed. The reported source conditions are model interpretations, not real activation events.',
   'order_rate has the 9/12-runners literature mapping, but is explicitly IGNORED by pinned UmaSim SkillChecker, so the model rank observation does not constitute a game-source or game-runtime measurement.',
   'Independent physical parity compares original GlobalSim v77, position-probe binary and rank-probe binary without changing source skill logic.',
   'Each skill × runner × race counts once, not per priority tick. Within one race several same-style runners share model results.',
   'No direct game activation probability, source precondition game fidelity, representative opponent distribution, skill utility or suitability grading is established.'
  ],
  gates:{realModelRankAtBothPriorityStagesObserved:true,
   sameRunnerSameTickSourceDistanceRankJoined:true,
   sourceOrderRateGameSemanticsValidated:false,
   actualOriginalUmaSimRuntimeRankChecked:false,
   fullSourceDynamicConditionsObserved:false,
   originalSourceSkillsEquipped:false,
   realGameSkillProcRateMeasured:false,P3CardScoringApproved:false,P4UiChanged:false}
 };
}
function main(args){
 if(args.length!==9||args[0]!=='replay')throw Error(
  'replay <template.jsonl> <original> <position-probe> <rank-probe> <skill_data.txt> <SkillChecker.kt> <SkillData.kt> <out.json>');
 const [_,templatePath,originalEngine,posEngine,rankEngine,
  skillPath,checkerPath,skillCodePath,outPath]=args;
 const source=distance.validateSource(fs.readFileSync(skillPath,'utf8'),
  fs.readFileSync(checkerPath,'utf8'),fs.readFileSync(skillCodePath,'utf8'));
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 fail(lines.length===1,'must use original single pinned GlobalSim template');
 const template=JSON.parse(lines[0]);
 fail(template.experimentalRetailRuntime===true&&
  template.experimentalRetailInitialization===true,'fixed retail runtime required');
 const plans=legacy.plans().filter((_,i)=>i%4===0);
 fail(plans.length===8&&plans.every(p=>[9,12].includes(p.fieldSize)),
  'frozen 8-race 9/12 field experimental panel drift');
 const races=plans.map(p=>expanded.makeRace(template,p));
 fail(races.every(r=>r.horses.every(h=>Array.isArray(h.skills)&&h.skills.length===0)),
  'model runners must have NO original source skills installed');
 const original=legacy.replay(originalEngine,races);
 const positions=legacy.replay(posEngine,races);
 const ranks=legacy.replay(rankEngine,races);
 const out=analyze(plans,original,positions,ranks,source.profiles);
 fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
 console.log('P2_15_DIRECT_RANK_JOIN='+JSON.stringify({
  status:out.status,
  sourceSkillCount:out.comparison.sourceSkillCount,
  sourceWithOrderRate:out.comparison.sourceWithOrderRate,
  sourceOrderRatePredicateOccurrences:out.comparison.sourceOrderRatePredicateOccurrences,
  modelStageValidation:out.modelStageValidation,
  sourceConditionSkillRunnerTickChanges:out.comparison.sourceConditionSkillRunnerTickChanges,
  originalRunnerRaceVerdicts:out.comparison.originalObservedSourceConditionRunnerRaces,
  joinedRunnerRaceVerdicts:out.comparison.rankJoinedObservedSourceConditionRunnerRaces,
  changedSkillStyleCells:out.comparison.sourceSkillStyleCellsWithObservableChange,
  gates:out.gates
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,compare,analyze,main};
