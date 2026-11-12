'use strict';
/*
 * P2.15: race/runner/skill units for model source-CONDITION opportunities.
 *
 * Each trial is ONE source skill evaluated counterfactually for ONE runner
 * across observed skill-priority ticks of ONE unskilled model race.
 *
 * This does NOT observe actual skill activation, or establish a full-race
 * absence from an incomplete source-observation interval. Never count
 * correlated runner-ticks as independent activation trials.
 */
const STATES=['true','false','unknown'];
const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const VERDICTS=[
 'observed-at-least-once-true',
 'observed-unknown-without-true',
 'observed-all-false',
 'no-observed-priority-ticks'
];
const fail=(condition,msg)=>{if(!condition)throw Error('P2.15 race opportunity: '+msg);};
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const counts=()=>({true:0,false:0,unknown:0});
function makeTrace(){
 return {ticks:0,outcomes:counts()};
}
function append(trace,outcome){
 fail(isObject(trace)&&Number.isSafeInteger(trace.ticks)&&
  isObject(trace.outcomes)&&STATES.every(s=>Number.isSafeInteger(trace.outcomes[s])&&
   trace.outcomes[s]>=0),'invalid mutable trace');
 fail(STATES.includes(outcome),'invalid source condition outcome');
 trace.ticks++;trace.outcomes[outcome]++;
 return trace;
}
function conclude(trace){
 fail(isObject(trace)&&Number.isSafeInteger(trace.ticks)&&trace.ticks>=0&&
  isObject(trace.outcomes)&&STATES.every(s=>Number.isSafeInteger(trace.outcomes[s])&&
  trace.outcomes[s]>=0)&&
  STATES.reduce((s,k)=>s+trace.outcomes[k],0)===trace.ticks,
  'trace outcome counts inconsistent');
 const verdict=trace.ticks===0?VERDICTS[3]:
  trace.outcomes.true>0?VERDICTS[0]:
  trace.outcomes.unknown>0?VERDICTS[1]:VERDICTS[2];
 return {verdict,observedPriorityTicks:trace.ticks,
  observedSourceConditionTicks:{...trace.outcomes}};
}
function newGroup(meta){
 return {...meta,runnerRaceTrials:0,observedRunnerRaceTrials:0,
  modelRacesWithStylePresent:0,
  verdicts:Object.fromEntries(VERDICTS.map(k=>[k,0])),
  skillRunnerPriorityTicks:0,sourceTickStates:counts(),
  // Under the explicitly observed priority ticks only, not a full race.
  observedStageConfirmedFractionLower:null,
  observedStagePossibleFractionUpper:null,
  countAsGameSkillActivation:false,suitabilityLabel:null};
}
function add(group,item){
 group.runnerRaceTrials++;
 group.verdicts[item.verdict]++;
 if(item.observedPriorityTicks>0)group.observedRunnerRaceTrials++;
 group.skillRunnerPriorityTicks+=item.observedPriorityTicks;
 for(const s of STATES)group.sourceTickStates[s]+=
  item.observedSourceConditionTicks[s];
}
function finalize(group){
 const v=group.verdicts,n=group.runnerRaceTrials;
 fail(n===VERDICTS.reduce((s,k)=>s+v[k],0),'group lost runner-race trials');
 fail(group.observedRunnerRaceTrials===n-v[VERDICTS[3]],
  'group observed runner-race denominator drift');
 fail(group.skillRunnerPriorityTicks===
  STATES.reduce((a,k)=>a+group.sourceTickStates[k],0),
  'group source tick denominator drift');
 return {...group,
  observedStageConfirmedFractionLower:n?v[VERDICTS[0]]/n:null,
  observedStagePossibleFractionUpper:n?
   (v[VERDICTS[0]]+v[VERDICTS[1]]+v[VERDICTS[3]])/n:null};
}
function validateTrial(t){
 fail(isObject(t)&&/^[0-9]+$/.test(t.sourceNumericId||'')&&
  STYLES.includes(t.style)&&Number.isSafeInteger(t.modelRaceIndex)&&
  t.modelRaceIndex>=0&&Number.isSafeInteger(t.runnerIndex)&&t.runnerIndex>=0&&
  Number.isSafeInteger(t.courseId)&&t.courseId>0&&
  Number.isSafeInteger(t.distanceType)&&t.distanceType>=1&&t.distanceType<=4&&
  ['turf','dirt'].includes(t.surface)&&Number.isSafeInteger(t.fieldSize)&&
  t.fieldSize>=2&&t.runnerIndex<t.fieldSize&&
  typeof t.scenario==='string'&&t.scenario.length>0&&
  typeof t.mode==='string'&&t.mode.length>0,
  'invalid original source skill / fixed model runner-race identity');
 const result=conclude(t.trace);
 return {...t,trace:undefined,...result};
}
function aggregate(input){
 fail(Array.isArray(input)&&input.length>0,
  'nonempty original source skill runner-race trials required');
 const ids=new Set(),bySkillStyle=new Map(),byContext=new Map(),
  totals=newGroup({});
 const perRaceStyles=new Map();
 const allRaceIndices=new Set();
 for(const raw of input){
  const item=validateTrial(raw);
  allRaceIndices.add(item.modelRaceIndex);
  const key=[item.modelRaceIndex,item.runnerIndex,item.sourceNumericId].join('/');
  fail(!ids.has(key),'duplicate skill × runner × model-race trial');
  ids.add(key);
  const id=[item.sourceNumericId,item.style].join('|');
  if(!bySkillStyle.has(id))bySkillStyle.set(id,newGroup({
   sourceNumericId:item.sourceNumericId,style:item.style
  }));
  const contextKey=[id,item.courseId,item.distanceType,item.surface,
   item.fieldSize,item.scenario,item.mode].join('|');
  if(!byContext.has(contextKey))byContext.set(contextKey,newGroup({
   sourceNumericId:item.sourceNumericId,style:item.style,
   courseId:item.courseId,distanceType:item.distanceType,
   surface:item.surface,fieldSize:item.fieldSize,
   scenario:item.scenario,mode:item.mode
  }));
  add(totals,item);add(bySkillStyle.get(id),item);add(byContext.get(contextKey),item);
  // Distinct course/style/race to prevent mistaking multiple runners in
  // the same race for separate race configurations.
  const raceStyle=[id,item.modelRaceIndex].join('|');
  if(!perRaceStyles.has(raceStyle))perRaceStyles.set(raceStyle,{
   sourceNumericId:item.sourceNumericId,style:item.style,
   modelRaceIndex:item.modelRaceIndex,contextKey,id});
  else fail(perRaceStyles.get(raceStyle).contextKey===contextKey,
   'inconsistent model race context for same skill and style');
 }
 for(const v of perRaceStyles.values()){
  bySkillStyle.get(v.id).modelRacesWithStylePresent++;
  byContext.get(v.contextKey).modelRacesWithStylePresent++;
 }
 const order=(a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId)||
  STYLES.indexOf(a.style)-STYLES.indexOf(b.style)||
  (a.courseId??0)-(b.courseId??0)||
  (a.fieldSize??0)-(b.fieldSize??0)||
  String(a.scenario??'').localeCompare(String(b.scenario??''))||
  String(a.mode??'').localeCompare(String(b.mode??''));
 const skillStyles=[...bySkillStyle.values()].map(finalize).sort(order);
 const contextRows=[...byContext.values()].map(finalize).sort(order);
 totals.modelRacesWithStylePresent=allRaceIndices.size;
 const all=finalize(totals);
 const distinctRacesByStyle=new Map(STYLES.map(style=>[style,new Set()]));
 for(const present of perRaceStyles.values())
  distinctRacesByStyle.get(present.style).add(present.modelRaceIndex);
 fail(all.runnerRaceTrials===skillStyles.reduce((sum,row)=>
   sum+row.runnerRaceTrials,0)&&
  all.runnerRaceTrials===contextRows.reduce((sum,row)=>
   sum+row.runnerRaceTrials,0),'aggregated denominators diverge');
 for(const metric of VERDICTS){
  fail(all.verdicts[metric]===skillStyles.reduce((sum,row)=>
   sum+row.verdicts[metric],0),'style-level verdict count lost');
 }
 const styles=STYLES.map(style=>{
  const rows=skillStyles.filter(x=>x.style===style);
  const group=newGroup({style});
  group.modelRacesWithStylePresent=distinctRacesByStyle.get(style).size;
  for(const r of rows){
   group.runnerRaceTrials+=r.runnerRaceTrials;
   group.observedRunnerRaceTrials+=r.observedRunnerRaceTrials;
   group.skillRunnerPriorityTicks+=r.skillRunnerPriorityTicks;
   for(const k of VERDICTS)group.verdicts[k]+=r.verdicts[k];
   for(const k of STATES)group.sourceTickStates[k]+=r.sourceTickStates[k];
  }
  return finalize(group);
 });
 fail(styles.reduce((sum,x)=>sum+x.runnerRaceTrials,0)===
  all.runnerRaceTrials,'four style trial count drift');
 return {
  schemaVersion:1,
  status:'P2.15-source-condition-on-observed-model-race-runner-traces-not-game',
  denominators:{
   skillRunnerRaceTrials:all.runnerRaceTrials,
   observedSkillRunnerRaceTrials:all.observedRunnerRaceTrials,
   sourceSkillStyleCells:skillStyles.length,
   sourceSkillStyleModelContexts:contextRows.length,
   // Includes multiple runner-traces per model race and one race per
   // runner model observation; NOT game activation trial denominator.
   groupedRaceStyleInstances:perRaceStyles.size
  },
  totals:all,
  byStyle:styles,
  bySkillStyle:skillStyles,
  bySkillStyleContext:contextRows,
  gates:{
   observedWindowEventVerified:true,
   unknownRetainedAsUnknown:true,
   originalSkillEquipped:false,
   allActualGameRaceOpportunityObserved:false,
   originalUmaSimDynamicConditionsAllObserved:false,
   actualSkillProcRateMeasured:false,
   eligibleForP3CardScoring:false,
   suitabilityLabel:null
  },
  limitations:[
   'A trial means one original-source skill interpreted counterfactually for one runner in one unskilled GlobalSim race, NOT one independent real game race/skill proc.',
   'One race with multiple runners of the same style creates multiple runner-race trials. modelRacesWithStylePresent separately counts distinct modeled races for context only.',
   'Confirmed means >=1 observed priority-stage tick has ALL original source predicates true under available model facts. Unresolved means no confirmed true and at least one unknown. All-false means only the OBSERVED priority-stage ticks are false. No-observed-stage is separately held.',
   'The lower/upper fractions refer ONLY to opportunities across the captured model priority stages; they are not statistical confidence intervals, true full-race bounds, activation probabilities, or suitability scores.',
   'The t=0 initialized state and original UmaSim/game behavior are not fully observed. An all-false observed trace does NOT prove that the original game skill could not activate in the race.',
   'Only distance_rate is dynamically observed for this P2.15 cohort. Other source predicates and the effects of actually equipping skills remain unknown.',
   'Model context and source skill records are fixed-version research; no original game skill effects, cooldowns, random windows or P3/P4 claims are permitted.'
  ]
 };
}
module.exports={STATES,STYLES,VERDICTS,makeTrace,append,conclude,aggregate};
