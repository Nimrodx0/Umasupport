'use strict';
/* Research-only check of original RaceCalculator runs with original 末脚
 * source check frame. NEVER promote original model events into real game
 * activation rates or four-style suitability. No source skill_data redistributed.
 */
const PIN='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const STATUS='P2.39-original-source-RaceCalculator-natural-spurt-same-tick-checker-only';
const STYLES=['NIGE','SEN','SASI','OI'];
const fail=(ok,msg)=>{if(!ok)throw Error('P2.39 source real-spurt: '+msg)};
function validate(x){
 fail(x?.schemaVersion===1&&x.status===STATUS&&
  x.originalSourceRevision===PIN&&x.sourceSkillId==='200512'&&
  x.originalAND==='is_lastspurt==1 AND phase_firsthalf_random==3'&&
  JSON.stringify(x.styles)===JSON.stringify(STYLES)&&
  x.originalSourceRaceTrials===12&&Array.isArray(x.trials)&&
  x.trials.length===12&&x.actualOriginalRaceCalculatorExecuted===true&&
  x.originalSpurtStateArtificiallyInjected===false&&
  x.otherRunnersOrRaceRanksObserved===false&&
  x.officialGameSkillProcRate===null&&
  x.approvedSkillOrCardScore===null,
  'pinned original source context or model-only boundary mismatch');
 const sum={frames:0,spurt:0,windowChecks:0,joint:0,events:0};
 const seen=new Set(),byStyle={};
 for(const row of x.trials){
  const ident=row.style+'|'+row.trial;
  fail(STYLES.includes(row.style)&&Number.isInteger(row.trial)&&
   row.trial>=0&&row.trial<3&&!seen.has(ident)&&
   row.sourceSkillId==='200512'&&
   Number.isInteger(row.sourceCourseLocation)&&
   Number.isInteger(row.sourceCourseId)&&
   Number.isFinite(row.sourceCourseLength)&&row.sourceCourseLength>=1000&&
   Number.isInteger(row.sourceRaceFrameCount)&&row.sourceRaceFrameCount>100&&
   Number.isInteger(row.naturalRaceSpurtFrames)&&row.naturalRaceSpurtFrames>=0&&
   row.naturalRaceSpurtFrames<=row.sourceRaceFrameCount&&
   Number.isInteger(row.sameTickWindowChecks)&&row.sameTickWindowChecks>=0&&
   Number.isInteger(row.sameTickJointConditionHits)&&
   row.sameTickJointConditionHits>=0&&
   row.sameTickJointConditionHits<=row.sameTickWindowChecks&&
   Number.isInteger(row.sourceRegisteredModelEvents)&&
   row.sourceRegisteredModelEvents===row.sameTickJointConditionHits&&
   row.sourceRegisteredModelEvents<=1&&
   row.originalRaceCalculatorUsed===true&&
   row.originalSpurtParametersNotInjected===true&&
   Array.isArray(row.exampleCheckedTicks)&&
   row.exampleCheckedTicks.length<=5&&
   row.exampleCheckedTicks.length<=row.sameTickWindowChecks,
   'source race per-style model observation invalid');
  seen.add(ident);
  if(!byStyle[row.style])byStyle[row.style]={
   originalSourceRaces:0,actualNaturalSpurtFrames:0,
   checkerWindowCalls:0,registeredSourceModelEvents:0,
   observedSameTickJointHits:0
  };
  const y=byStyle[row.style];
  y.originalSourceRaces++;
  y.actualNaturalSpurtFrames+=row.naturalRaceSpurtFrames;
  y.checkerWindowCalls+=row.sameTickWindowChecks;
  y.registeredSourceModelEvents+=row.sourceRegisteredModelEvents;
  y.observedSameTickJointHits+=row.sameTickJointConditionHits;
  sum.frames+=row.sourceRaceFrameCount;sum.spurt+=row.naturalRaceSpurtFrames;
  sum.windowChecks+=row.sameTickWindowChecks;
  sum.joint+=row.sameTickJointConditionHits;
  sum.events+=row.sourceRegisteredModelEvents;
  let previous=-1;
  for(const w of row.exampleCheckedTicks){
   fail(Number.isInteger(w.frame)&&w.frame>previous&&
    w.frame<row.sourceRaceFrameCount&&
    Number.isFinite(w.position)&&
    Number.isFinite(w.sourceWindowStart)&&
    Number.isFinite(w.sourceWindowEnd)&&
    w.sourceWindowStart<=w.sourceWindowEnd&&
    w.sourceWindowEnd-w.sourceWindowStart<=10.000001&&
    w.windowCheckTrue===(w.position>=w.sourceWindowStart&&
     w.position<=w.sourceWindowEnd)&&
    w.actualSourceRaceFrameSpurting===true&&
    w.originalSkillModelEvent===w.windowCheckTrue,
    'same source tick natural spurt/window witness inconsistency');
   previous=w.frame;
  }
 }
 fail(seen.size===12&&
  STYLES.every(s=>byStyle[s]?.originalSourceRaces===3),
  'missing exact original 4-style x 3-race cohort');
 fail(sum.frames===x.originalSourceRaceFrames&&
  sum.spurt===x.naturalSourceSpurtFrames&&
  sum.windowChecks===x.originalSameTickWindowChecks&&
  sum.joint===x.originalSameTickJointHits&&
  sum.events===x.sourceModelRegisteredSkillEvents&&
  sum.spurt>0&&sum.events===sum.joint,
  'original source race aggregation or spurt validation failed');
 return {schemaVersion:1,status:'P2.39-validated-original-source-race-same-tick-partial-evidence',
  source:{revision:PIN,originalSkillId:'200512',
   originalSourceRaceCalculatorUsed:true,
   originalSkillConditionANDVerified:true,
   fourStyleSingleRunnerScenariosOnly:true},
  summary:{
   originalSourceRaceTrials:12,
   originalSourceRaceFrames:sum.frames,
   naturalSourceSpurtFrames:sum.spurt,
   sameTickOriginalWindowCheckerCalls:sum.windowChecks,
   sameTickOriginalJointConditionHits:sum.joint,
   originalSourceModelSkillEvents:sum.events,
   verifiedNaturalSpurtAndRandomWindowTickAgreement:true,
   completeFourStyleActivationRatesApproved:0,
   officialGameProcRateMeasurements:0,
   productSkillOrCardScores:0
  },
  byStyle,
  limitations:[
   'RaceFrame.spurting is source-calculated after original RaceCalculator movement, using source spurtParameters. This is not a preassigned specialState approximation.',
   'Original source checker only reaches the random-window test after other AND terms pass, and stops checking after skill activation. Its call count is not a general random-window rate denominator.',
   'Only the original single-runner simulated model, one track and synthetic equal ability setup are tested, without real opponent ranks or Game-sourced proc verification.',
   'Three source model races per style are mechanism probes, not enough for reliable statistical four-style superiority or suitability ratings.',
   'No actual Japanese game proc rate, original game engine equivalence, skill effectiveness or support-card rating is established.'
  ]};
}
module.exports={PIN,STATUS,STYLES,validate};
