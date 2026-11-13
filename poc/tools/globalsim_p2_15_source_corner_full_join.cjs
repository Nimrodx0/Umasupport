#!/usr/bin/env node
'use strict';
/*
 * P2.15: original source cornerNumber, cross-verified with fixed independent
 * GlobalSim course geometry, joined with BOTH ranks and six position
 * predicates at exactly one physical model runner pre-skill priority tick.
 * Original full-source AST and UNKNOWN precondition history are preserved.
 * This is a model projection study, NOT source UmaSim/runtime/game skill proc.
 */
const fs=require('node:fs');
const distance=require('./globalsim_p2_15_source_distance_rate_ticks.cjs');
const rank=require('../src/skill_source_rank_tick_bridge.cjs');
const position=require('../src/skill_source_position_stage_facts.cjs');
const corner=require('../src/skill_source_corner_stage_facts.cjs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const STATUS='P2.15-source-corner-matched-geometry-plus-both-ranks-and-position-model-not-game';
const fail=(ok,msg)=>{if(!ok)throw Error('P2.15 corner full conjunction: '+msg);};
const KEYS=['observed-at-least-once-true','observed-unknown-without-true',
 'observed-all-false','no-observed-priority-ticks'];
function compare(before,after,rankEvidence,cornerEvidence){
 fail(before.status===after.status&&before.schemaVersion===5&&after.schemaVersion===5&&
  before.provenance.originalUmaSimRevision===corner.REV&&
  after.provenance.originalUmaSimRevision===corner.REV&&
  after.gates.originalUmaSimCornerRuntimeObserved===false&&
  after.gates.realGameCornerSemanticsValidated===false&&
  after.gates.fixedOriginalAndModelCourseCornerIntervalsMatched===true,
  'source provenance, three-valued lineage or no-game caveats changed');
 corner.validateEvidence(cornerEvidence);
 for(const key of ['sourceDistanceRateSkills','sourcePredicateOccurrences',
  'sourceOrderRateSkillsAmongDistanceRate','sourceAbsoluteOrderSkillsAmongDistanceRate',
  'sourcePositionPredicateOccurrences']){
  fail(before.denominators[key]===after.denominators[key],
   'source skills/conditions denominator changed: '+key);
 }
 for(const key of ['modelRunnerPriorityTicks','unchangedModelPhysicsValues',
  'distanceRatePredicateFacts','modelOrderRatePredicateFacts',
  'modelAbsoluteOrderPredicateFacts','modelSourcePositionPredicateFacts']){
  fail(before.totals[key]===after.totals[key],
   'model source physical/skill tick changed: '+key);
 }
 fail(after.totals.modelRunnerPriorityTicks===
   rankEvidence.totals.rankPriorityPairsMatched&&
  after.totals.modelRunnerPriorityTicksWithKnownCornerNumber+
  after.totals.modelPriorityRunnerTicksHeldAtCornerBoundary===
   after.totals.modelRunnerPriorityTicks,
  'corner stage count did not match source priority stage');
 fail(after.denominators.sourceCornerSkillsAmongDistanceRate>0&&
  after.denominators.sourceCornerPredicateOccurrences>0&&
  after.totals.modelSourceCornerPredicateFacts>0,
  'no actual original corner source predicate observed');
 const diff=Object.fromEntries(['True','False','Unknown'].map(x=>
  [x.toLowerCase(),after.totals['sourceCondition'+x+'SkillRunnerTicks']-
   before.totals['sourceCondition'+x+'SkillRunnerTicks']]));
 fail(diff.true>=0&&diff.false>=0&&diff.unknown<=0&&
  diff.true+diff.false+diff.unknown===0,
  'corner observations reversed a definite same-stage source outcome');
 const a=after.raceOpportunity,b=before.raceOpportunity;
 fail(a.denominators.skillRunnerRaceTrials===b.denominators.skillRunnerRaceTrials&&
  a.totals.verdicts[KEYS[0]]>=b.totals.verdicts[KEYS[0]]&&
  a.totals.verdicts[KEYS[1]]<=b.totals.verdicts[KEYS[1]]&&
  a.totals.verdicts[KEYS[2]]>=b.totals.verdicts[KEYS[2]]&&
  a.totals.verdicts[KEYS[3]]===b.totals.verdicts[KEYS[3]],
  'corner evidence reversed a known source runner-race outcome');
 const cells=new Map(b.bySkillStyle.map(row=>[
  row.sourceNumericId+'|'+row.style,row]));
 const changes=[];
 for(const row of a.bySkillStyle){
  const old=cells.get(row.sourceNumericId+'|'+row.style);
  fail(old?.runnerRaceTrials===row.runnerRaceTrials,
   'corner data changed source skill-style population');
  const gained=row.verdicts[KEYS[0]]-old.verdicts[KEYS[0]];
  const resolved=old.verdicts[KEYS[1]]-row.verdicts[KEYS[1]];
  fail(gained>=0&&resolved>=0,
   'corner interpretation changed known source outcome in skill/style group');
  if(gained||resolved)changes.push({
   sourceNumericId:row.sourceNumericId,style:row.style,
   runnerRaceTrials:row.runnerRaceTrials,
   newModelSourceLogicalTrue:gained,reducedModelUnknown:resolved,
   gameProcRate:null,P3Suitability:null});
 }
 const tri=after.unknownRouteTriage;
 fail(tri?.counts.sourceSkillRunnerRaceTrials===
   a.denominators.skillRunnerRaceTrials&&
  tri.counts.observedUnknownWithoutTrueRunnerRaceTrials===
   a.totals.verdicts[KEYS[1]]&&
  tri.byCandidateCombination.reduce((n,x)=>
   n+x.representativeRunnerRaceTrials,0)===a.totals.verdicts[KEYS[1]],
  'unknown route witnesses no longer share joined original source trial cohort');
 return {
  fixedOriginalSourceSkills:before.denominators.sourceDistanceRateSkills,
  sourceWithOriginalCorner:after.denominators.sourceCornerSkillsAmongDistanceRate,
  originalCornerPredicateOccurrences:after.denominators.sourceCornerPredicateOccurrences,
  modelCornerPredicateObservations:after.totals.modelSourceCornerPredicateFacts,
  modelPriorityRunnerTicks:after.totals.modelRunnerPriorityTicks,
  modelPriorityRunnerTicksWithKnownCornerNumber:
   after.totals.modelPriorityRunnerTicksWithKnownCornerNumber,
  modelPriorityRunnerTicksHeldAtCornerBoundary:
   after.totals.modelPriorityRunnerTicksHeldAtCornerBoundary,
  sameTickWholeSourceDelta:diff,
  beforeSourceCornerRunnerRaceVerdicts:{...b.totals.verdicts},
  afterSourceCornerRunnerRaceVerdicts:{...a.totals.verdicts},
  skillStyleCellsWithNewObservations:changes.length,
  changedSkillStyleCells:changes,
  actualOriginalUmaSimProcCount:null,gameProcRate:null,P3CardScore:null
 };
}
function analyze(plans,original,positions,ranks,profiles,positionEvidence,cornerEvidence){
 position.verifyEvidence(positionEvidence);
 corner.validateEvidence(cornerEvidence);
 const rankEvidence=rank.buildEvidence(plans,original,positions,ranks);
 rank.validateEvidence(rankEvidence,plans);
 const opts={rankEvidence,positionSourceEvidence:positionEvidence,
  includeAbsoluteOrder:true,unknownRouteTriage:true};
 const baseline=distance.analyze(plans,original,positions,profiles,opts);
 const joined=distance.analyze(plans,original,positions,profiles,{
  ...opts,cornerSourceEvidence:cornerEvidence});
 const comparison=compare(baseline,joined,rankEvidence,cornerEvidence);
 return {schemaVersion:1,status:STATUS,
  provenance:{originalUmaSimRevision:corner.REV,
   globalSimRevision:corner.MODEL_REV,
   originalSkillDictionarySHA256:distance.SOURCE_SHA,
   cornerSourceGeometryEvidence:cornerEvidence,
   originalUmaSimSkillRuntimeObserved:false,
   rawUpstreamSkillDataRepublished:false},
  design:{fixedNoSkillModelRaces:plans.length,
   verifiedCornerSourceCourseIds:[...corner.IDS],
   modelPriorityPositionAndRankSameRunnerTick:true,
   originalSourcePredicates:['distance_rate',...position.TYPES,
    'order_rate','order','corner'],
   originalSourceANDORInvokePreconditionsPreserved:true,
   sourceModelsAreNotSameAsJapaneseGame:true},
  modelStageValidation:rankEvidence.totals,
  comparison,
  unknownRouteTriage:joined.unknownRouteTriage,
  byStyle:joined.raceOpportunity.byStyle,
  bySkillStyle:joined.raceOpportunity.bySkillStyle,
  gates:{sourceOriginalCornerFormulaAndBothCourseGeometriesMatched:true,
   modelPriorityPositionUsedForOriginalSourceCorner:true,
   sourcePreconditionTrueLatchPreserved:true,
   sourceUnknownHistoricalLatchNotOverwritten:false,
   actualOriginalUmaSimRuntimeObserved:false,
   actualGameSkillProcRateMeasured:false,
   P2SuitabilityApproved:false,P3CardScoringApproved:false,
   P4UiChanged:false},
  limitations:[
   'Pinned original UmaSim cornerNumber is evaluated using source-validated course intervals but actual GlobalSim model pre-skill positions, NOT the original UmaSim runtime simulation.position.',
   'Zero outside a corner and 2/3/4 index numbering for three corners are original source behaviors, but near the numeric endpoints no observation is supplied.',
   'Preconditions are historical latches; before the first observed GlobalSim priority call their state is UNKNOWN, not false. If observed true later, it latches and remains true.',
   'A confirmed model logical condition need not cause any original source skill proc or actual game skill activation. Fixed UmaSim ignores both original rank conditions order and order_rate.',
   'The 8 artificial no-skill model races are correlated, not individual independent proc opportunities; P3/P4 gates remain closed.'
  ]};
}
function main(args){
 if(args[0]!=='replay'||args.length!==12)
  throw Error('replay <template.jsonl> <original-engine> <position-engine> <rank-engine> <source-skills.txt> <SkillChecker.kt> <SkillData.kt> <RaceState.kt> <RaceCalculator.kt> <rawData.kt> <course_data.json> <output.json>');
 const [_,templatePath,engine0,engineP,engineR,skills,checkerPath,skillData,
  statePath,calculatorPath,rawData,modelCourse,output]=args;
 const checker=fs.readFileSync(checkerPath,'utf8');
 const sourceSkills=distance.validateSource(fs.readFileSync(skills,'utf8'),
  checker,fs.readFileSync(skillData,'utf8')).profiles;
 const state=fs.readFileSync(statePath,'utf8');
 const positionEvidence=position.verifyPinnedSources(checker,state,
  fs.readFileSync(calculatorPath,'utf8'));
 const cornerEvidence=corner.verifyPinnedSources(checker,state,
  fs.readFileSync(rawData,'utf8'),fs.readFileSync(modelCourse,'utf8'));
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 fail(lines.length===1,'original GlobalSim fixed race template changed');
 const template=JSON.parse(lines[0]);
 fail(template.experimentalRetailRuntime===true&&
  template.experimentalRetailInitialization===true,'model retail fixture changed');
 const plans=legacy.plans().filter((_,i)=>i%4===0);
 fail(plans.length===8&&plans.every(p=>corner.IDS.includes(String(p.course.id))),
  'fixed 8 artificial course sample not exactly 10502/10504');
 const races=plans.map(plan=>expanded.makeRace(template,plan));
 fail(races.every(x=>x.horses.every(h=>h.skills?.length===0)),
  'source skill unexpectedly equipped in no-skill model experiment');
 const out=analyze(plans,legacy.replay(engine0,races),legacy.replay(engineP,races),
  legacy.replay(engineR,races),sourceSkills,positionEvidence,cornerEvidence);
 fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
 console.log('P2_15_SOURCE_CORNER_FULL_JOIN='+JSON.stringify({
  comparison:{...out.comparison,
   changedSkillStyleCells:out.comparison.changedSkillStyleCells.slice(0,20)},
  unknownRouteCounts:out.unknownRouteTriage.counts,
  topUnknownGates:out.unknownRouteTriage.byCandidateGate.slice(0,12),
  styleVerdicts:out.byStyle.map(x=>({style:x.style,verdicts:x.verdicts})),
  gates:out.gates
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,compare,analyze,main};
