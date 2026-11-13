'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit,TRACE,STATUS}=require('../src/skill_p2_15_registered_source_race_trace.cjs');
function example(){
 const trials=Array.from({length:3},(_,j)=>{
  const s=1300+j*10,e=s+10;
  const ticks=Array.from({length:5},(_,i)=>{
   const position=s-2+i*3;
   return {tick:200+i,position,start:s,end:e,
    phasePredicateHit:position>=s&&position<=e};
  });
  return {trial:j,raceFrameCount:750,originalCheckerCalls:5,
   phasePredicateTrueCalls:ticks.filter(x=>x.phasePredicateHit).length,
   phasePredicateFalseCalls:ticks.filter(x=>!x.phasePredicateHit).length,
   modelSkillEvents:0,originalPhaseRandomWindowWasChecked:true,ticks};
 });
 return {schemaVersion:1,status:TRACE,sourceSkillId:'200592',
  sourceOriginalInvokeIndex:1,sourceOriginalORIndex:0,sourceOriginalInvokeCount:1,
  sourceOriginalConditionsORCount:1,sourceOriginalSelectedANDSize:2,
  sourceOriginalPreconditionORCount:0,
  sourceOriginalCurrentANDHasOrderRate:true,
  sourceOriginalCurrentANDHasPhaseRandom2:true,
  originalSkillRecordEquippedUnmodified:true,
  originalInvokeConditionsUsedUnmodified:true,
  originalOrderRateWasIgnoredBySource:true,
  actualSourceCheckerTickCount:15,
  phasePredicateTrueCalls:trials.reduce((n,x)=>n+x.phasePredicateTrueCalls,0),
  phasePredicateFalseCalls:trials.reduce((n,x)=>n+x.phasePredicateFalseCalls,0),
  sourceModelSkillEventCount:0,realGameSkillProcObserved:false,trials};
}
test('one real-registry skill run is still a phase-only model observation',()=>{
 const r=audit(example());
 assert.equal(r.status,STATUS);
 assert.equal(r.counts.originalRegisteredSkillEquippedInThreeSourceRaces,3);
 assert.equal(r.counts.sourceOriginalPhaseRandomCheckerTicks,15);
 assert.equal(r.counts.originalOrderRatePredicateEvaluatedInSource,0);
 assert.equal(r.counts.fullOriginalRankAndWindowANDProven,0);
 assert.equal(r.counts.officialP3P4Ratings,0);
});
test('no rank, OR, source-identity or source window substitution is accepted',()=>{
 const changes=[
  d=>d.sourceSkillId='99000216',d=>d.sourceOriginalConditionsORCount=0,
  d=>d.sourceOriginalORIndex=12,d=>d.sourceOriginalSelectedANDSize=1,
  d=>d.sourceOriginalCurrentANDHasOrderRate=false,
  d=>d.originalSkillRecordEquippedUnmodified=false,
  d=>d.originalInvokeConditionsUsedUnmodified=false,
  d=>d.originalOrderRateWasIgnoredBySource=false,
  d=>d.realGameSkillProcObserved=true,d=>d.trials[0].ticks[2].start++,
  d=>d.trials[1].ticks[0].phasePredicateHit=!d.trials[1].ticks[0].phasePredicateHit,
  d=>d.trials[1].ticks[1].tick=d.trials[1].ticks[0].tick,
  d=>d.trials[1].modelSkillEvents=-1,
  d=>d.trials.pop(),d=>d.phasePredicateTrueCalls=999
 ];
 for(const f of changes){
  const x=structuredClone(example());f(x);
  assert.throws(()=>audit(x),/P2.15 registered-source trace/);
 }
});
test('source skips a model race checker: record missing, never infer FALSE',()=>{
 const x=example();
 const t=x.trials[0];
 t.ticks=[];t.originalCheckerCalls=0;
 t.phasePredicateTrueCalls=0;t.phasePredicateFalseCalls=0;
 t.originalPhaseRandomWindowWasChecked=false;
 x.actualSourceCheckerTickCount-=5;
 x.phasePredicateTrueCalls-=example().trials[0].phasePredicateTrueCalls;
 x.phasePredicateFalseCalls-=example().trials[0].phasePredicateFalseCalls;
 const r=audit(x);
 assert.equal(r.counts.sourceOriginalPhaseRandomCheckerTicks,10);
 assert.equal(r.counts.fullOriginalRankAndWindowANDProven,0);
});
