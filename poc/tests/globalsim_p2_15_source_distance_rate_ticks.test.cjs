'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const t=require('../tools/globalsim_p2_15_source_distance_rate_ticks.cjs');
const p=(type,operator,value)=>({type,operator,value});
const inv=(conditions,preConditions=[],index=0)=>({index,conditions,preConditions});
const profile=(id,invokes)=>({status:'source-structure',
 sourceNumericId:id,invokes});
const r1=p('distance_rate','>=',20),r2=p('distance_rate','<',50);
function sample(){
 const plan={seed:101,fieldSize:2,scenario:'balanced',mode:'equal',course:{
  id:10502,distance:1600,distanceType:2,surface:'turf'
 },strategies:['Nige','Senkou']};
 const row=(pos)=>[pos,12,100,0,0,0];
 const frames=[
  {t:0,horses:[row(500),row(160)]},
  {t:1,horses:[row(550),row(250)]},
  {t:2,horses:[row(600),row(350)]}
 ];
 const control={seed:101,skillEvents:[],frames};
 const probe=structuredClone(control);
 for(let tick=1;tick<3;tick++){
  for(let i=0;i<2;i++){
   const pos=control.frames[tick-1].horses[i][0];
   probe.frames[tick].horses[i][4]=pos;
   probe.frames[tick].horses[i][5]=pos;
  }
 }
 const source=profile('100101',[
  inv([[p('running_style','==',1),r1,r2],
       [p('running_style','==',2),p('phase_random','==',1)]])
 ]);
 return {plans:[plan],control:[control],probe:[probe],source:[source]};
}
test('fixed model position is measured at same original stage and joined to exact original predicates',()=>{
 const f=sample();const result=t.analyze(f.plans,f.control,f.probe,f.source);
 assert.equal(result.status,t.STATUS);
 assert.equal(result.denominators.sourceDistanceRateSkills,1);
 assert.equal(result.denominators.sourcePredicateOccurrences,2);
 assert.equal(result.totals.races,1);
 assert.equal(result.totals.modelRunnerPriorityTicks,4);
 assert.equal(result.totals.modelFrames,3);
 assert.equal(result.totals.unchangedModelPhysicsValues,24);
 assert.equal(result.totals.modelProgressRateHeldBoundaryRunnerTicks,1);
 assert.equal(result.totals.modelProgressRateKnownRunnerTicks,3);
 assert.equal(result.totals.sourceConditionTrueSkillRunnerTicks,2);
 assert.equal(result.totals.sourceConditionUnknownSkillRunnerTicks,2);
 assert.equal(result.totals.sourceConditionFalseSkillRunnerTicks,0);
 assert.equal(result.totals.sourceConditionEverTrueRunnerTraces,1);
 assert.equal(result.gates.realGlobalSimPreSkillPositionsObserved,true);
 assert.equal(result.gates.originalUmaSimRaceTicksObserved,false);
 assert.equal(result.gates.P3CardScoringApproved,false);
 assert.equal(result.rows[0].distanceRateObservations,6);
 assert.equal(result.schemaVersion,2);
 assert.equal(result.raceOpportunity.denominators.skillRunnerRaceTrials,2);
 assert.equal(result.raceOpportunity.denominators.sourceSkillStyleCells,2);
 assert.equal(result.raceOpportunity.totals.verdicts['observed-at-least-once-true'],1);
 assert.equal(result.raceOpportunity.totals.verdicts['observed-unknown-without-true'],1);
 assert.equal(result.raceOpportunity.totals.verdicts['observed-all-false'],0);
 assert.equal(result.raceOpportunity.totals.sourceTickStates.true,2);
 assert.equal(result.raceOpportunity.totals.sourceTickStates.unknown,2);
 assert.equal(result.raceOpportunity.bySkillStyle.length,2);
 assert.equal(result.raceOpportunity.gates.actualSkillProcRateMeasured,false);
 assert.equal(result.gates.observedStageRaceRunnerOpportunityGrouped,true);
 assert.equal(result.gates.fullRaceSkillOpportunityRateEstablished,false);
});
test('Kotlin progress toInt comparison uses truncated integer and protects precision boundaries',()=>{
 assert.equal(t.originalRate(500,1600),31);
 assert.equal(t.originalRate(559,1600),34);
 assert.equal(t.originalRate(160,1600),null);
 assert.equal(t.originalRate(0,1600),null);
 assert.equal(t.originalRate(-10,1600),null);
 assert.equal(t.originalRate(1600,1600),null);
 assert.equal(t.originalRate(1599.999,1600),99);
 assert.throws(()=>t.originalRate(NaN,1600),/invalid model progress/);
});
test('all source condition comparisons preserve exact operator/values and indexed identity',()=>{
 const ast=require('../src/skill_source_whole_tick_monitor.cjs').compile(
  profile('100101',[inv([[r1,r2],[p('distance_rate','!=',40)]])]));
 const facts=t.observations(ast,31);
 assert.deepEqual(facts.map(x=>[x.side,x.orIndex,x.predicateIndex,x.satisfied]),[
  ['conditions',0,0,true],['conditions',0,1,true],['conditions',1,0,true]
 ]);
 assert.equal(t.observations(ast,null).length,0);
 assert.deepEqual(t.context({course:{distance:1600,distanceType:2,
  surface:'turf'},fieldSize:2,strategies:['Nige','Senkou']},0),
 {running_style:1,distance_type:2,ground_type:1});
});
test('physical original versus observer parity and priority positions fail closed',()=>{
 const f=sample();
 const mismatched=structuredClone(f.probe);
 mismatched[0].frames[1].horses[0][0]=560;
 assert.throws(()=>t.analyze(f.plans,f.control,mismatched,f.source),
  /observer changed original GlobalSim physics/);
 const stages=structuredClone(f.probe);
 stages[0].frames[1].horses[0][5]=501;
 assert.throws(()=>t.analyze(f.plans,f.control,stages,f.source),
  /priority-1\/0 position stages do not match/);
 const shifted=structuredClone(f.probe);
 shifted[0].frames[1].horses[0][4]=510;
 shifted[0].frames[1].horses[0][5]=510;
 assert.throws(()=>t.analyze(f.plans,f.control,shifted,f.source),
  /previous post-frame/);
 const event=structuredClone(f.probe);
 event[0].skillEvents=[{skillId:999}];
 assert.throws(()=>t.analyze(f.plans,f.control,event,f.source),
  /skill event records/);
});
test('unobserved source rank or random requirements remain unknown, not silently true',()=>{
 const f=sample();
 const original=profile('200701',[inv([
  [p('running_style','==',1),p('distance_rate','>=',20),
   p('order_rate','>',50),p('phase_random','==',2)]
 ])]);
 const x=t.analyze(f.plans,f.control,f.probe,[original]);
 assert.equal(x.totals.sourceConditionTrueSkillRunnerTicks,0);
 assert.equal(x.totals.sourceConditionUnknownSkillRunnerTicks,2);
 assert.equal(x.totals.sourceConditionFalseSkillRunnerTicks,2);
 assert.equal(x.gates.originalUmaSimAllDynamicPredicatesObserved,false);
});
test('unseen t=0 precondition history is held unknown even if later progress gates are false',()=>{
 const f=sample();
 const p1=profile('100201',[inv([[p('distance_rate','<',50)]],
  [[p('distance_rate','>=',80)]])]);
 const x=t.analyze(f.plans,f.control,f.probe,[p1]);
 assert.equal(x.totals.sourceConditionTrueSkillRunnerTicks,0);
 assert.equal(x.totals.sourceConditionFalseSkillRunnerTicks,0);
 assert.equal(x.totals.sourceConditionUnknownSkillRunnerTicks,4);
 assert.equal(x.experiment.preconditionHistoryBeforeFirstObservedModelPriorityCall,'unknown');
 assert.equal(x.raceOpportunity.totals.verdicts['observed-at-least-once-true'],0);
 assert.equal(x.raceOpportunity.totals.verdicts['observed-unknown-without-true'],2);
});
test('mismatched source registry or checker cannot masquerade as original semantics',()=>{
 assert.throws(()=>t.validateSource('[]','x','y'),/SHA mismatch/);
 assert.equal(t.SOURCE_SHA.length,64);
 const check=require('../src/skill_source_whole_tick_monitor.cjs');
 const cohort=profile('100101',[inv([[p('order_rate','>=',50)]])]);
 const f=sample();
 assert.throws(()=>t.analyze(f.plans,f.control,f.probe,[cohort]),
  /unrelated source skill/);
});
