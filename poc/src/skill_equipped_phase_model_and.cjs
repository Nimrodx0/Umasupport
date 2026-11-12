'use strict';
/*
 * P2.15 actual-EQUIPPED GlobalSim v77 window/position/rank conjunction.
 *
 * Model-only, exactly three pinned example skills. There is no use of
 * UmaSim's RNG or original UmaSim phase_random source record here.
 * In particular, a window+other-AND hit is NOT a game skill activation.
 */
const equipped=require('../tools/globalsim_p2_15_equipped_runtime_windows.cjs');
const rankBridge=require('./skill_source_rank_tick_bridge.cjs');
const rankBounds=require('./skill_order_rate_bounds.cjs');
const legacy=require('../tools/globalsim_change_order_internal_probe.cjs');
const expanded=require('../tools/globalsim_position_expanded.cjs');
const pre=require('../tools/globalsim_p2_15_preskill_phase_position.cjs');
const STATUS='P2.15-equipped-GlobalSim-actual-phase-random-and-rank-same-tick-not-UmaSim-game';
const IDS=equipped.IDS;
const EXPECTED=equipped.EXPRESSIONS;
const fail=(x,msg)=>{if(!x)throw Error('P2.15 equipped phase AND: '+msg)};
function modelClauses(skillId){
 fail(IDS.includes(skillId),'unvalidated model skill ID');
 const expr=EXPECTED[skillId];
 const terms=expr.split('&').map(part=>{
  const m=/^(phase_random|distance_type|order_rate)(==|!=|<=|>=|<|>)([0-9]+)$/.exec(part);
  fail(m,'original model expression has unsupported clause');
  return {type:m[1],operator:m[2],value:Number(m[3])};
 });
 fail(terms.filter(x=>x.type==='phase_random').length===1&&
  terms.every(x=>x.type!=='phase_random'||x.operator==='==')&&
  terms.every(x=>x.type!=='order_rate'||x.operator==='>'&&x.value===50)&&
  terms.every(x=>x.type!=='distance_type'||x.operator==='=='&&x.value===2),
  'model expression exceeds source-rechecked exact three-skill scope');
 return terms;
}
function candidate(skillId,windowDetail,position,order,course){
 const terms=modelClauses(skillId);
 fail(Number.isFinite(position)&&position>=0&&
  course&&Number.isFinite(course.distance)&&course.distance>0&&
  Number.isSafeInteger(course.distanceType)&&rankBounds.FIELDS.includes(course.fieldSize)&&
  Number.isSafeInteger(order)&&order>=1&&order<=course.fieldSize,
  'missing or invalid source-timed model state');
 if(windowDetail===null)return {state:'missing-original-model-detail',
  phaseWindowContainsPosition:null,andSatisfied:null,
  sourceModelRuntimeSkillProcObserved:false};
 fail(windowDetail.skillId===skillId&&
  Array.isArray(windowDetail.windows)&&windowDetail.windows.length>0,
  'skill window does not belong to exact model ID');
 if(windowDetail.researchSampleStatus==='reserved-inactive-detail')
  return {state:'model-construction-reserved-inactive-region',
   phaseWindowContainsPosition:false,andSatisfied:false,
   sourceModelRuntimeSkillProcObserved:false};
 fail(windowDetail.researchSampleStatus==='valid-in-course-runtime-window',
  'unverified model random sampling status');
 for(const w of windowDetail.windows)
  fail(Array.isArray(w)&&w.length===2&&w.every(Number.isFinite)&&
   w[0]>=0&&w[0]<w[1]&&w[1]<=course.distance,
   'malformed original-model runtime random interval');
 const phaseHit=windowDetail.windows.some(([start,end])=>
  start<=position&&position<end);
 const otherTerms=terms.filter(x=>x.type!=='phase_random');
 const evaluations=otherTerms.map(x=>({
  ...x,
  satisfied:x.type==='distance_type'?
   rankBounds.compare(course.distanceType,x.operator,x.value):
   rankBounds.compare(order,x.operator,rankBounds.cutoff(course.fieldSize,x.value))
 }));
 const andSatisfied=phaseHit&&evaluations.every(x=>x.satisfied);
 return {state:'actual-equipped-model-initial-sampled-window-AND-gate',
  phaseWindowContainsPosition:phaseHit,
  otherConditions:evaluations,andSatisfied,
  sourceModelRuntimeSkillProcObserved:false};
}
const tally=()=>({
 equippedModelRunnerRaces:0,validSampledWindowRunnerRaces:0,
 reservedInactiveDetailRunnerRaces:0,missingDetailRunnerRaces:0,
 inspectedSameStageModelRunnerTicks:0,validSampledWindowRunnerTicks:0,
 phaseWindowMemberRunnerTicks:0,wholeModelExpressionANDRunnerTicks:0,
 runnerRacesWithPhaseWindowVisit:0,runnerRacesWithANDVisit:0,
 runnerRacesWithNoANDVisit:0,runnerRacesWithNoSampledStage:0,
 modelSkillEvents:0,actualUmaSimSourceSkillProcs:null,
 gameActivationProbability:null,approvedSuitabilityLabel:null
});
function analyze(plans,originalReplies,windowReplies,rankReplies){
 fail(Array.isArray(plans)&&plans.length>0&&
  originalReplies?.length===plans.length&&
  windowReplies?.length===plans.length&&
  rankReplies?.length===plans.length,'matched equipped triple-engine races required');
 const windows=equipped.analyze(plans,originalReplies,windowReplies);
 const rankEvidence=rankBridge.buildEvidence(plans,
  originalReplies,windowReplies,rankReplies);
 fail(windows.status===equipped.STATUS&&
  rankEvidence.totals.modelPriorityPositionPairsMatched===
   windows.totals.observedSkillStagePositions&&
  rankEvidence.totals.rankPriorityPairsMatched===
   windows.totals.observedSkillStagePositions&&
  rankEvidence.totals.rankProbePhysicalValuesMatched===
   windows.totals.identicalPhysicalValues&&
  rankEvidence.totals.positionalProbePhysicalValuesMatched===
   windows.totals.identicalPhysicalValues,
  'real-model equipped three-engine physical or priority-stage proof missing');
 const skills=Object.fromEntries(IDS.map(id=>[id,tally()]));
 const byStyle=new Map();
 const totals=tally();
 let totalDistinctRunners=0;
 for(let r=0;r<plans.length;r++){
  const p=plans[r],control=originalReplies[r],sample=windowReplies[r],
    modelRank=rankReplies[r];
  fail(control?.seed===p.seed&&sample?.seed===p.seed&&modelRank?.seed===p.seed&&
   JSON.stringify(control.skillEvents)===JSON.stringify(modelRank.skillEvents)&&
   Number.isSafeInteger(p.fieldSize)&&rankBounds.FIELDS.includes(p.fieldSize)&&
   modelRank.frames.length===sample.frames.length,
   'different equipped original/model-rank skillEvents or runner cohort');
  for(let i=0;i<p.fieldSize;i++){
   totalDistinctRunners++;
   const style=p.strategies?.[i];
   fail(expanded.STYLES.includes(style),'invalid fixed model running style');
   const details=equipped.checkedWindows(sample,i,p.course.distance);
   const record=new Map(details.map(d=>[d.skillId,d]));
   const context={...p.course,fieldSize:p.fieldSize};
   for(const id of IDS){
    const detail=record.get(id)??null;
    const current=skills[id],key=id+'|'+style;
    if(!byStyle.has(key))byStyle.set(key,{
     modelSkillId:id,style,...tally()});
    const styleRow=byStyle.get(key);
    let sawWindow=false,sawAnd=false,visited=0,validTicks=0;
    for(let frame=1;frame<sample.frames.length;frame++){
     const position=legacy.get(sample.frames[frame].horses[i],4);
     const position0=legacy.get(sample.frames[frame].horses[i],5);
     const rank=rankEvidence.rankByRace[r][frame][i];
     if(position===pre.SENTINEL&&position0===pre.SENTINEL){
      fail(rank===null,'finished/model-priority rank diverged');
      continue;
     }
     fail(rank!==null&&Number.isFinite(position)&&position===position0,
      'same-stage model position or internal rank missing');
     visited++;
     const state=candidate(id,detail,position,rank,context);
     if(detail?.researchSampleStatus==='valid-in-course-runtime-window')
      validTicks++;
     if(state.phaseWindowContainsPosition)sawWindow=true;
     if(state.andSatisfied)sawAnd=true;
     for(const row of [totals,current,styleRow]){
      row.inspectedSameStageModelRunnerTicks++;
      if(state.state==='actual-equipped-model-initial-sampled-window-AND-gate')
       row.validSampledWindowRunnerTicks++;
      if(state.phaseWindowContainsPosition)row.phaseWindowMemberRunnerTicks++;
      if(state.andSatisfied)row.wholeModelExpressionANDRunnerTicks++;
     }
    }
    for(const row of [totals,current,styleRow]){
     row.equippedModelRunnerRaces++;
     if(detail===null)row.missingDetailRunnerRaces++;
     else if(detail.researchSampleStatus==='reserved-inactive-detail')
      row.reservedInactiveDetailRunnerRaces++;
     else row.validSampledWindowRunnerRaces++;
     if(sawWindow)row.runnerRacesWithPhaseWindowVisit++;
     if(sawAnd)row.runnerRacesWithANDVisit++;
     else row.runnerRacesWithNoANDVisit++;
     if(!visited)row.runnerRacesWithNoSampledStage++;
    }
   }
  }
  // Skill activations are separate original-GlobalSim events. Do not
  // re-label a skill-window membership or AND-gate tick as a proc.
  for(const event of control.skillEvents||[]){
   const id=String(event.skillId);
   if(!IDS.includes(id))continue;
   const runner=event.horseIndex;
   fail(Number.isSafeInteger(runner)&&runner>=0&&runner<p.fieldSize,
    'equipped model skill event with no attributable runner');
   const style=p.strategies[runner],styleRow=byStyle.get(id+'|'+style);
   fail(styleRow,'model event refers to no matching original style trace');
   for(const row of [totals,skills[id],styleRow])row.modelSkillEvents++;
  }
 }
 fail(totalDistinctRunners===
  totals.equippedModelRunnerRaces/IDS.length,
  'model source unit count changed');
 fail(totals.phaseWindowMemberRunnerTicks===
   windows.totals.sampledWindowMemberRunnerTicks&&
  totals.modelSkillEvents===windows.totals.modelSkillEvents,
  'direct independently sampled model windows or event count differ');
 for(const id of IDS){
  const skill=skills[id],ref=windows.skills[id];
  fail(skill.phaseWindowMemberRunnerTicks===ref.windowMemberRunnerTicks&&
   skill.modelSkillEvents===ref.modelSkillEvents&&
   skill.validSampledWindowRunnerRaces===ref.instantiatedDetails-ref.reservedInactiveDetails&&
   skill.reservedInactiveDetailRunnerRaces===ref.reservedInactiveDetails&&
   skill.missingDetailRunnerRaces===ref.missingDetailContexts,
   'exact model window source details changed after rank AND join');
 }
 const rows=[...byStyle.values()].sort((a,b)=>
  IDS.indexOf(a.modelSkillId)-IDS.indexOf(b.modelSkillId)||
  expanded.STYLES.indexOf(a.style)-expanded.STYLES.indexOf(b.style));
 for(const result of [...rows,...Object.values(skills),totals]){
  fail(result.validSampledWindowRunnerRaces+
    result.reservedInactiveDetailRunnerRaces+
    result.missingDetailRunnerRaces===result.equippedModelRunnerRaces&&
   result.runnerRacesWithANDVisit+result.runnerRacesWithNoANDVisit===
    result.equippedModelRunnerRaces&&
   result.wholeModelExpressionANDRunnerTicks<=result.phaseWindowMemberRunnerTicks&&
   result.phaseWindowMemberRunnerTicks<=result.validSampledWindowRunnerTicks&&
   result.validSampledWindowRunnerTicks<=result.inspectedSameStageModelRunnerTicks&&
   result.runnerRacesWithANDVisit<=result.runnerRacesWithPhaseWindowVisit,
   'equipped model window/rank source count inconsistent');
 }
 fail(rows.length===IDS.length*4&&
  rows.reduce((n,row)=>n+row.equippedModelRunnerRaces,0)===
  totals.equippedModelRunnerRaces,
  'missing model skill / running-style cells');
 return {
  schemaVersion:1,status:STATUS,
  provenance:{
   originalGlobalSimRevision:legacy.PIN,
   actualModelEquippedSkillExpressions:EXPECTED,
   originalUmaSimPhaseRandomDrawObserved:false,
   originalUmaSimSourceSkillRegistryUsed:false,
   noOriginalGameSemanticsEstablished:true
  },
  modelDesign:{
   fixedEquippedRaces:plans.length,
   modelRunnerRaces:totalDistinctRunners,
   actuallyEquippedModelSkills:IDS.length,
   sameRunnerSamePrePriorityTick:true,
   directModelSampledWindows:true,
   directModelPriorityRankCaches:true,
   rule:'valid initialized model PendingSkill.windows contains position AND original model additional conditions hold',
   windowMembership:'start <= model pre-skill pos < end',
   ordinalRankRule:'GlobalSim original order_rate_get_pos (n*rate/100).round for 9/12 runners',
   noSkillProcSubstitutedForConditionHit:true
  },
  threeEngineValidation:rankEvidence.totals,
  priorEquippedWindowEvidence:{
   status:windows.status,
   sampledWindows:windows.totals.sampledWindows,
   inactiveReservedDetails:windows.totals.reservedInactiveDetails,
   matchedModelSkillEvents:windows.totals.identicalOriginalSkillEvents
  },
  totals,skills,bySkillStyle:rows,
  evidenceGates:{
   actualGlobalSimSampledPhaseWindowObserved:true,
   installedSourceModelSkillDetailConfirmed:true,
   actualModelPrePriorityRankAndPositionJoined:true,
   independentThreeEnginePhysicalAndSkillEventParity:true,
   modelConditionANDMeasuredForPinnedThreeSkills:true,
   originalUmaSimRandomDrawsObserved:false,
   originalUmaSimFullSourceConditionsValidated:false,
   liveGameSkillActivationRateMeasured:false,
   entire102SourcePhaseRandomSkillsMeasured:false,
   P3CardScoringApproved:false,P4UiChanged:false
  },
  limitations:[
   'The three actual-equipped skills are only the pinned GlobalSim EXAMPLE skill IDs/expressions. They are not proven identical to the original UmaSim skill registry paths.',
   'These are real GlobalSim sampled windows, not the previously fabricated halfway draw or actual UmaSim/JP game draws.',
   'RNG, source skill initialization, physical trajectories and logged model skill events are unmodified across three independently built binaries.',
   'Window membership plus explicit model distance_type/order_rate AND is an opportunity at original model priority stage, NOT an observed activation or activation probability. Prior skill activation/cooldown may prevent an event.',
   'Reserved 9999m details are inactive, not actual 9999m random draws. Missing details are kept distinct.',
   'The fixed 8 artificial equipped races have correlated runner ticks and nonrepresentative opponents; no direct runner-style suitability grade follows.',
   'Stage rank data and sampled windows come from two separate read-only probes proven physical and event identical, not from guessed post-race ordering.'
  ]
 };
}
module.exports={STATUS,modelClauses,candidate,analyze};
