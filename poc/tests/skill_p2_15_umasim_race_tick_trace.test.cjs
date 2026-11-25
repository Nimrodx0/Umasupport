'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const s=require('../src/skill_p2_15_umasim_race_tick_trace.cjs');
function example(){
 const races=Array.from({length:3},(_,trial)=>{
  const start=1410+trial*2,end=start+10;
  const ticks=Array.from({length:12},(_,i)=>{
   const position=start-4+i*1.5;
   return {tick:i+100,position,start,end,
    hit:position>=start&&position<=end};
  });
  return {trial,syntheticSourceSkillId:s.ID,randomPositionMode:'RANDOM',
   phaseId:2,raceCalculatorExecuted:true,
   phaseStart:1350,phaseEnd:1600,windowStart:start,windowEnd:end,
   raceFrameCount:1000,sourceCheckerCalls:ticks.length,
   sourceCheckerTrueCount:ticks.filter(x=>x.hit).length,
   sourceCheckerFalseCount:ticks.filter(x=>!x.hit).length,
   sameOriginalWindowEveryTick:true,framePositionJoined:true,
   realRegisteredSkillEquipped:false,sourceOrderRateEvaluated:false,
   gameProcRateComputed:false,ticks};
 });
 return {schemaVersion:1,status:s.RAW,sourceModel:'pinned-mee1080-umasim',
  syntheticSourceSkillId:s.ID,trialCount:3,
  instrumentation:'one-original-checkInRandom-return-with-identity-boolean',
  actualUmaSimRaceCalculatorExecuted:true,sourceRankImplemented:false,
  realSourceSkillRecordsUsed:false,gameProcOrSuitabilityCalculated:false,races};
}
test('same-original-source race frame is an observed checker tick, not actual game suitability',()=>{
 const r=s.validate(example());
 assert.equal(r.denominators.actualSourceRaceCalculatorRaces,3);
 assert.equal(r.denominators.sameSourceRunnerAndSkillCheckTickObservations,36);
 assert.equal(r.denominators.actualRegisteredSourceSkillTrials,0);
 assert.equal(r.denominators.implementedOriginalOrderRateRuntimeObservations,0);
 assert.equal(r.denominators.formallyEvaluatedSuitabilities,0);
});
test('strictly rejects forged rank, substituted skill, window drift and tick mixups',()=>{
 const mutate=[
  x=>x.sourceRankImplemented=true,
  x=>x.realSourceSkillRecordsUsed=true,
  x=>x.gameProcOrSuitabilityCalculated=true,
  x=>x.races[0].trial=1,
  x=>x.races[0].sourceOrderRateEvaluated=true,
  x=>x.races[0].syntheticSourceSkillId='200592',
  x=>x.races[0].framePositionJoined=false,
  x=>x.races[0].windowEnd=x.races[0].windowStart+11,
  x=>x.races[0].ticks[0].hit=!x.races[0].ticks[0].hit,
  x=>x.races[0].ticks[0].start+=3,
  x=>x.races[0].ticks[1].tick=x.races[0].ticks[0].tick,
  x=>x.races[0].ticks[0].tick=0,
  x=>x.races[0].ticks[0].tick=99999,
  x=>x.races[0].sourceCheckerCalls=1,
  x=>x.races[0].raceFrameCount=0,
  x=>x.races[0].ticks=[],
  x=>x.races.pop()
 ];
 for(const f of mutate){
  const x=structuredClone(example());f(x);
  assert.throws(()=>s.validate(x),/P2.15 source race-tick trace/);
 }
});
