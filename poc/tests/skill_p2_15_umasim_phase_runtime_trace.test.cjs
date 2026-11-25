'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const validation=require('../src/skill_p2_15_umasim_phase_runtime_trace.cjs');
const pinned=require('../src/skill_phase_random_source_window_audit.cjs');
const source=require('../src/skill_phase_random_draw_support.cjs');
const fakeChecker=[
 ...pinned.CHECKER_ANCHORS.map(line=>line==='baseSetting.initPhaseRandom(condition.value)'?line+'\n}':line),
 'class RandomEntry(start: Double, end: Double) : ClosedFloatingPointRange<Double> by start..end',
 'RandomPosition.RANDOM -> Random.nextDouble()',
 '// test-only synthetic text, not source verification'
].join('\n')+'\n'+'//'.repeat(600);
const fakeRace=source.RACE_ANCHORS.join('\n')+'\n'+'//'.repeat(600);
const clone=x=>JSON.parse(JSON.stringify(x));
function sample(){
 const trials=Array.from({length:validation.COUNT},(_,trial)=>({
  trial,sourceSkillId:validation.ID,cacheKey:'phase_random2',phaseId:2,
  phaseStart:100,phaseEnd:300,
  drawnWindowStart:150+trial,drawnWindowEndInclusive:160+trial,
  outsideStart:false,insideStart:true,insideEnd:true,outsideEnd:false,
  cacheReusedForSameSkill:true,
  controlledPositionTickIndices:[0,1,2,3],
  actualOriginalWindowObserved:true,raceSimulationUsed:false,
  modelOrGameRankObserved:false
 }));
 return {schemaVersion:1,status:validation.TRACE,
  sourceSkillId:validation.ID,phaseId:2,randomPositionMode:'RANDOM',
  trialCount:validation.COUNT,sourceCompiledAndExecuted:true,
  originalRaceCalculatorInvoked:false,sourceOrderRateRuntimeChecked:false,
  actualGameSkillProcObserved:false,trials};
}
test('actual source window trace is accepted only as isolated controlled-checker evidence',()=>{
 const x=validation.validate(sample(),fakeChecker,fakeRace);
 assert.equal(x.status,validation.STATUS);
 assert.equal(x.tests.actualSourceDrawnWindowObservations,12);
 assert.equal(x.tests.controlledSourceCheckerCalls,48);
 assert.equal(x.tests.distinctObservedWindowCoordinates,12);
 assert.equal(x.boundary.actualRaceCalculatorUsed,false);
 assert.equal(x.boundary.observedActualUmaSimOrderRate,false);
 assert.equal(x.boundary.observedModelRankAndRandomSameTick,false);
 assert.equal(x.boundary.formalSkillOrCardSuitabilityRating,false);
});
test('rejects fabricated rank results, game proc, unanchored source checker and forced random mode',()=>{
 const mutations=[
  x=>x.originalRaceCalculatorInvoked=true,
  x=>x.sourceOrderRateRuntimeChecked=true,
  x=>x.actualGameSkillProcObserved=true,
  x=>x.randomPositionMode='MIDDLE',
  x=>x.trials[0].modelOrGameRankObserved=true,
  x=>x.trials[0].raceSimulationUsed=true,
  x=>x.trials[0].actualOriginalWindowObserved=false,
  x=>x.trials[0].cacheReusedForSameSkill=false,
  x=>x.trials[0].insideEnd=false,
  x=>x.trials[0].drawnWindowEndInclusive+=1,
  x=>x.trials[0].drawnWindowStart=999,
  x=>x.trials[1].trial=0,
  x=>x.trials.pop()
 ];
 for(const m of mutations){
  const x=clone(sample());m(x);
  assert.throws(()=>validation.validate(x,fakeChecker,fakeRace),
   /source JVM window trace|P2.15 phase/);
 }
 assert.throws(()=>validation.validate(sample(),fakeChecker+'\n"order_rate" ->',fakeRace),
  /started implementing order_rate/);
 assert.throws(()=>validation.validate(sample(),fakeChecker.replaceAll(
  'RandomPosition.RANDOM -> Random.nextDouble()','RandomPosition.RANDOM -> Random.nextFloat()'),fakeRace),
  /P2.15 phase source|P2.15 phase draw/);
});
