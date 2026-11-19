'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const v=require('../src/skill_p2_39_race_spurt_same_tick.cjs');
function fixture(){
 const trials=[];
 for(const style of v.STYLES)for(let trial=0;trial<3;trial++){
  trials.push({style,trial,sourceSkillId:'200512',
   sourceCourseLocation:10001,sourceCourseId:10101,
   sourceCourseLength:1200,
   sourceRaceFrameCount:200,
   naturalRaceSpurtFrames:50,
   sameTickWindowChecks:2,
   sameTickJointConditionHits:1,
   sourceRegisteredModelEvents:1,
   originalRaceCalculatorUsed:true,
   originalSpurtParametersNotInjected:true,
   exampleCheckedTicks:[
    {frame:150,position:1060,
     sourceWindowStart:1070,sourceWindowEnd:1080,
     windowCheckTrue:false,actualSourceRaceFrameSpurting:true,
     originalSkillModelEvent:false},
    {frame:151,position:1075,
     sourceWindowStart:1070,sourceWindowEnd:1080,
     windowCheckTrue:true,actualSourceRaceFrameSpurting:true,
     originalSkillModelEvent:true}
   ]});
 }
 return {schemaVersion:1,status:v.STATUS,
  originalSourceRevision:v.PIN,sourceSkillId:'200512',
  originalAND:'is_lastspurt==1 AND phase_firsthalf_random==3',
  styles:v.STYLES,originalSourceRaceTrials:12,
  originalSourceRaceFrames:2400,naturalSourceSpurtFrames:600,
  originalSameTickWindowChecks:24,originalSameTickJointHits:12,
  sourceModelRegisteredSkillEvents:12,
  actualOriginalRaceCalculatorExecuted:true,
  originalSpurtStateArtificiallyInjected:false,
  otherRunnersOrRaceRanksObserved:false,
  officialGameSkillProcRate:null,approvedSkillOrCardScore:null,
  trials};
}
test('12 original source races preserve exact 4 styles x 3 and same-tick AND without suitability claims',()=>{
 const x=fixture(),old=JSON.stringify(x);
 const result=v.validate(x);
 assert.equal(JSON.stringify(x),old,'source remains read-only');
 assert.equal(result.summary.naturalSourceSpurtFrames,600);
 assert.equal(result.summary.originalSourceModelSkillEvents,12);
 assert.equal(result.summary.sameTickOriginalJointConditionHits,12);
 assert.equal(result.summary.completeFourStyleActivationRatesApproved,0);
 assert.equal(result.summary.officialGameProcRateMeasurements,0);
 assert.equal(result.summary.productSkillOrCardScores,0);
 assert(Object.values(result.byStyle).every(x=>x.originalSourceRaces===3));
});
test('artificial spurt, false same tick or purported real game rate fail closed',()=>{
 const a=fixture();a.originalSpurtStateArtificiallyInjected=true;
 assert.throws(()=>v.validate(a),/pinned original source context/);
 const b=fixture();b.trials[0].exampleCheckedTicks[0].actualSourceRaceFrameSpurting=false;
 assert.throws(()=>v.validate(b),/same source tick natural spurt/);
 const c=fixture();c.officialGameSkillProcRate=.5;
 assert.throws(()=>v.validate(c),/pinned original source context/);
 const d=fixture();d.trials[0].sourceRegisteredModelEvents=0;
 assert.throws(()=>v.validate(d),/source race per-style/);
});
test('independent trial, source revision and original position-window boundaries stay strict',()=>{
 const a=fixture();a.trials[11].trial=2;a.trials[10].trial=2;
 assert.throws(()=>v.validate(a),/source race per-style/);
 const b=fixture();b.originalSourceRevision='other';
 assert.throws(()=>v.validate(b),/pinned original source context/);
 const c=fixture();c.trials[0].exampleCheckedTicks[1].sourceWindowEnd=1073;
 assert.throws(()=>v.validate(c),/same source tick natural spurt/);
 const d=fixture();d.originalSameTickJointHits=13;
 assert.throws(()=>v.validate(d),/original source race aggregation/);
});
