'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const triage=require('../src/skill_source_unknown_route_candidates.cjs');
const monitor=require('../src/skill_source_whole_tick_monitor.cjs');
const race=require('../src/skill_source_race_opportunity.cjs');
const joint=require('../tools/globalsim_p2_15_source_position_families_ticks.cjs');
const fact=(type,operator,value)=>({type,operator,value});
const profile=(id,invokes)=>({status:'source-structure',sourceNumericId:id,
 invokes:invokes.map((v,index)=>({...v,index}))});
const inv=(conditions,preConditions=[])=>({conditions,preConditions});
const observed=(compiled,type,truth)=>[...compiled.lookup.values()]
 .filter(x=>x.type===type).map(x=>({...x,satisfied:truth}));
const CTX={running_style:1,distance_type:2,ground_type:1};
function make(profile){
 const m=new monitor.WholeTickMonitor(profile);
 m.preState=m.preState.map((x,i)=>
  m.compiled.invokes[i].preConditions.length?monitor.UNKNOWN:x);
 return m;
}
test('current AND/OR witness excludes definitely false routes and retains exact original Invoke identity',()=>{
 const p=profile('100001',[
  inv([[fact('running_style','==',1),fact('phase','==',1),
    fact('order_rate','>=',50)],
   [fact('running_style','==',2),fact('phase_random','==',2)]]),
  inv([[fact('running_style','==',1),fact('distance_rate','>=',20)]],
    [[fact('corner','==',2)]])
 ]);
 const m=make(p);
 const facts=[...observed(m.compiled,'phase',true),
  ...observed(m.compiled,'distance_rate',true)];
 const state=m.step({tickIndex:0,staticContext:CTX,observations:facts});
 assert.equal(state.overallCondition,monitor.UNKNOWN);
 const a=triage.inspect(m.compiled,state,CTX,facts);
 assert.equal(a.alternativeRoutesStillPossiblyViable,2);
 assert.equal(a.minimumGateKindsAtThisTick,1);
 assert.deepEqual(a.representative.unknownPredicateTypes,['order_rate']);
 assert.equal(a.representative.unresolvedPreconditionLatch,false);
 assert.equal(a.representative.invokeOffset,0);
 assert.equal(a.representative.conditionOrIndex,0);
 assert.equal(a.gameRate,null);
 assert.equal(a.actualSourceProcObserved,false);
});
test('initial precondition history stays a distinct gate even when the current precondition is false',()=>{
 const p=profile('100002',[inv([
  [fact('running_style','==',1),fact('phase','==',1)]],
  [[fact('corner','==',2)]])]);
 const m=make(p);
 const now=[...observed(m.compiled,'phase',true),
  ...observed(m.compiled,'corner',false)];
 const state=m.step({tickIndex:0,staticContext:CTX,observations:now});
 assert.equal(state.invokes[0].preconditionNow,monitor.FALSE);
 assert.equal(state.invokes[0].preconditionLatched,monitor.UNKNOWN);
 assert.equal(state.overallCondition,monitor.UNKNOWN);
 const a=triage.inspect(m.compiled,state,CTX,now);
 assert.deepEqual(a.representative.unresolvedGateKinds,[triage.PRE]);
 assert.deepEqual(a.representative.unknownPredicateTypes,[]);
 assert.equal(a.representative.unresolvedPreconditionLatch,true);
});
test('unknown OR path with two missing kinds improves to one at later observed model priority tick',()=>{
 const p=profile('100003',[inv([[
  fact('running_style','==',1),fact('phase_random','==',1),
  fact('order_rate','>=',50)]])]);
 const m=make(p),t=triage.createTrace();
 const first=m.step({tickIndex:0,staticContext:CTX,observations:[]});
 triage.observe(t,m.compiled,first,CTX,[]);
 assert.equal(t.representative.remainingDistinctGateKinds,2);
 assert.deepEqual(t.representative.unresolvedGateKinds,['order_rate','phase_random']);
 const after=observed(m.compiled,'order_rate',true);
 const second=m.step({tickIndex:1,staticContext:CTX,observations:after});
 triage.observe(t,m.compiled,second,CTX,after);
 assert.equal(t.representative.remainingDistinctGateKinds,1);
 assert.equal(t.witnessTick,1);
 assert.deepEqual(t.representative.unresolvedGateKinds,['phase_random']);
 const third=m.step({tickIndex:2,staticContext:CTX,observations:[]});
 triage.observe(t,m.compiled,third,CTX,[]);
 assert.equal(t.unknownObservedTicks,3);
 assert.equal(t.candidateTicksInspected,2);
 assert.equal(t.candidateTicksSkippedAfterSingleGate,1);
});
test('source predicate identity corruption is rejected instead of manufacturing a source candidate',()=>{
 const p=profile('100003',[inv([[fact('phase_random','==',1)]])]);
 const m=make(p),state=m.step({tickIndex:0,staticContext:CTX});
 assert.throws(()=>triage.inspect(m.compiled,state,CTX,[{
  ...[...m.compiled.lookup.values()][0],value:2,satisfied:true
 }]),/observation predicate does not match/);
 assert.throws(()=>triage.inspect(m.compiled,{...state,
  overallCondition:monitor.TRUE},CTX,[]),/matching UNKNOWN/);
});
test('one representative candidate per unresolved runner-race is aggregated without treating every unknown tick as independent',()=>{
 const p=profile('100003',[inv([[fact('phase_random','==',1)]])]);
 const m=make(p),blocker=triage.createTrace(),trace=race.makeTrace();
 for(let tick=0;tick<4;tick++){
  const result=m.step({tickIndex:tick,staticContext:CTX});
  race.append(trace,result.overallCondition);
  triage.observe(blocker,m.compiled,result,CTX,[]);
 }
 const common={sourceNumericId:'100003',style:'Nige',modelRaceIndex:0,
  courseId:10502,distanceType:2,surface:'turf',fieldSize:2,
  scenario:'balanced',mode:'equal'};
 const trials=[{...common,runnerIndex:0,trace,blockerTrace:blocker},
  {...common,runnerIndex:1,trace:race.makeTrace(),blockerTrace:triage.createTrace()}];
 const opp=race.aggregate(trials);
 const report=triage.aggregate(trials,opp);
 assert.equal(report.counts.sourceSkillRunnerRaceTrials,2);
 assert.equal(report.counts.observedUnknownWithoutTrueRunnerRaceTrials,1);
 assert.equal(report.counts.modelUnknownTicksInUnresolvedTrials,4);
 assert.equal(report.counts.witnessTicksExaminedInUnresolvedTrials,1);
 assert.equal(report.counts.unknownTicksSkippedAfterFirstSingleGateInUnresolvedTrials,3);
 assert.equal(report.byCandidateGate.length,1);
 assert.equal(report.byCandidateGate[0].gateKind,'phase_random');
 assert.equal(report.byCandidateGate[0].representativeRunnerRaceTrials,1);
 assert.equal(report.byCandidateGate[0].sourceSkillStyleCells,1);
 assert.equal(report.byCandidateCombination[0].representativeRunnerRaceTrials,1);
 assert.equal(report.byStyle.find(x=>x.style==='Nige').unresolvedRunnerRaceTrials,1);
 assert.equal(report.gates.allRemainingUnknownsProvenCausedByWitness,false);
 assert.equal(report.gates.P3ScoringApproved,false);
});
test('multiple Invoke alternatives are not flattened into one synthetic path',()=>{
 const p=profile('100004',[inv([[fact('phase_random','==',1)]]),
  inv([[fact('running_style','==',2),fact('phase_random','==',2)]])]);
 const m=make(p),state=m.step({tickIndex:0,staticContext:CTX});
 assert.equal(state.overallCondition,monitor.UNKNOWN);
 const a=triage.inspect(m.compiled,state,CTX,[]);
 assert.equal(a.alternativeRoutesStillPossiblyViable,1);
 assert.equal(a.representative.invokeOffset,0);
});
test('same-stage integrated five-source family study preserves original outputs and provides unknown witness data',()=>{
 const plan={seed:101,fieldSize:2,scenario:'balanced',mode:'equal',
  course:{id:10502,distance:1600,distanceType:2,surface:'turf'},
  strategies:['Nige','Senkou']};
 const frame=pos=>[pos,10,100,0,0,0];
 const control={seed:101,skillEvents:[],frames:[
  {t:0,horses:[frame(210.1),frame(300.1)]},
  {t:1,horses:[frame(310.1),frame(420.1)]},
  {t:2,horses:[frame(500.1),frame(600.1)]}
 ]};
 const probe=structuredClone(control);
 for(let t=1;t<3;t++)for(let i=0;i<2;i++){
  probe.frames[t].horses[i][4]=control.frames[t-1].horses[i][0];
  probe.frames[t].horses[i][5]=control.frames[t-1].horses[i][0];
 }
 const source=[profile('100003',[inv([[fact('distance_rate','>=',10),
   fact('phase','==',1),fact('phase_random','==',1)]])])];
 const e=require('../src/skill_source_position_stage_facts.cjs');
 const evidence=e.verifyPinnedSources(
  e.CHECKER_ANCHORS.join('\n')+'x'.repeat(1300),
  e.STATE_ANCHORS.join('\n')+'x'.repeat(1300),
  e.CALCULATOR_ANCHORS.join('\n')+'x'.repeat(1300));
 const out=joint.analyze([plan],[control],[probe],source,evidence);
 assert.equal(out.validation.modelRunnerPriorityTicks,4);
 assert.equal(out.unknownRouteTriage.counts.observedUnknownWithoutTrueRunnerRaceTrials,2);
 assert.equal(out.unknownRouteTriage.byCandidateGate[0].gateKind,'phase_random');
 assert.equal(out.unknownRouteTriage.bySkillStyle[0].unresolvedRunnerRaceTrials,2);
 assert.equal(out.gates.unresolvedSourceORInvokePathWitnessesRecorded,true);
 assert.equal(out.gates.originalUmaSimFullUnknownCausesIdentified,false);
});
