'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const fixed=require('../tools/globalsim_roster32.cjs');
const source=require('../src/skill_p2_33_same_id_projection.cjs');
const cross=require('../src/skill_p2_33_surface_crosswalk.cjs');
const bands=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const proxy=require('../tools/skill_p2_33_surface_w.cjs');
const pred=(type,operator,value)=>({type,operator,value});
const sourcePairs=cross.pairedMechanisms(manifest).paired;
function appSourceFixture(){
 const skills=[];
 for(let i=0;i<818;i++){
  const numeric=String(300000+i);
  const pair=sourcePairs[i%sourcePairs.length];
  const [timer,value]=pair.timing.split(':');
  const band=bands.find(b=>b.id===pair.bandId);
  const current=i<82?[...band.predicates.map(p=>({...p})),
   pred(timer,'==',Number(value)),pred('ground_type','!=',3),
   pred('ground_condition','!=',4)]:
   [pred('distance_rate','>=',20)];
  const row={id:'skill:'+numeric,activationProfile:{
   status:'source-structure',sourceNumericId:numeric,
   invokes:[{index:0,preConditions:[],conditions:[current]}]
  }};
  skills.push(row);
 }
 return {skills,skillById:Object.fromEntries(skills.map(x=>[x.id,x]))};
}
function sourceModelFixture(){
 const rows=[];
 for(const pair of sourcePairs)
  for(const style of fixed.STYLES)
   for(const distanceType of [1,2,3,4])
    for(const scenario of fixed.SCENARIOS)
     for(const fieldSize of [9,12])for(const mode of fixed.MODES){
      if(scenario==='noFront'&&style==='Nige')continue;
      rows.push({mechanismKey:pair.mechanismKey,style,distanceType,
       scenario,fieldSize,mode,sourceIDIdentical:false,
       originalSkillWholeAND:false,onlySharedPartialMechanism:true,
       turfW:{lowerWPercent:75,upperWPercent:75},
       dirtW:{lowerWPercent:30,upperWPercent:30},
       original30:{direction:'turf-higher'},
       first15:{direction:'turf-higher'},
       last15:{direction:'turf-higher'},
       bothHalvesConfirmOriginalDirection:true,
       bothHalvesConfirmHypotheticalFivePointGap:true});
     }
 assert.equal(rows.length,960);
 return {schemaVersion:1,status:proxy.STATUS,
  source:{globalSimRevision:fixed.PIN,
   fixedOriginalUmaSimSkillSHA256:fixed.SOURCE_SHA},
  denominators:{sharedRankTimeMechanisms:4,
   comparableMechanismStyleScenarioHeadModeDistanceCells:960,
   originalSameSkillCrossSurfaceMeasured:0},
  rows};
}
test('same target skill original static ground condition is intersected in BOTH surfaces',()=>{
 const terms=[pred('ground_condition','!=',4),
  pred('ground_type','!=',3),pred('running_style','>=',2)];
 assert.equal(source.maskForBoth(terms,1,1),0);
 assert.equal(source.maskForBoth(terms,2,1),7);
 assert.equal(source.maskForBoth([...terms,pred('ground_type','==',1)],2,1),0);
 assert.equal(source.maskForBoth([...terms,pred('ground_condition','==',4)],2,1),0);
});
test('original same-ID minimal candidates select source AND and keep no dynamic/OR transfer',()=>{
 const app=appSourceFixture();const before=JSON.stringify(app);
 const cohort=source.selectMinimalOriginalSkills(app,manifest);
 assert.equal(JSON.stringify(app),before);
 assert.equal(cohort.sourceMatchedOriginalSkills,818);
 assert.equal(cohort.rowCount,82);
 assert.equal(cohort.rows[0].originalSourceSkillSameInBothSurfaces,undefined);
 assert.equal(cohort.rows[0].originalSkillIdentitySameInBothSurfaceContexts,true);
 assert.equal(cohort.rows[0].commonStaticContexts.length,16);
 assert(cohort.rows[0].commonStaticContexts.every(x=>
  x.commonGroundConditionMask===7));
 assert(cohort.rows[0].fixedTurfMechanismWitnessId!==
  cohort.rows[0].fixedDirtMechanismWitnessId);
 // In the original game an alternative Invoke / precondition can change
 // the meaning of the entire skill: no earlier candidate may be transferred.
 app.skills[0].activationProfile.invokes.push({
  index:1,conditions:[[pred('phase','==',2)]],preConditions:[]});
 assert.equal(source.selectMinimalOriginalSkills(app,manifest).rowCount,81);
 app.skills[0].activationProfile.invokes.pop();
 app.skills[0].activationProfile.invokes[0].conditions.push(
  [pred('motivation','==',4)]);
 assert.equal(source.selectMinimalOriginalSkills(app,manifest).rowCount,81);
 app.skills[0].activationProfile.invokes[0].conditions.pop();
 app.skills[0].activationProfile.invokes[0].preConditions=[
  [pred('start_phase','==',2)]];
 assert.equal(source.selectMinimalOriginalSkills(app,manifest).rowCount,81);
});
test('strict original skill identity joins original original-skill static axes to reusable model W, without proc',()=>{
 const app=appSourceFixture(),modelW=sourceModelFixture();
 const before=JSON.stringify(app);
 const output=source.audit(app,manifest,modelW);
 assert.equal(JSON.stringify(app),before);
 assert.equal(output.status,source.STATUS);
 assert.equal(output.summary.originalSameIDMinimalSkillCandidates,82);
 assert.equal(output.summary.originalSkillIDsWithAtLeastOneModelProjection,82);
 assert.equal(output.summary.uniqueReusedFixedPartialModelContexts,960);
 assert.equal(output.summary.conditionalOriginalIDModelProjectionReferences,82*960/4);
 assert.equal(output.summary.sameOriginalIDObservedActualSkillActivations,0);
 assert.equal(output.summary.p3OfficialSuitabilityRecords,0);
 assert.equal(output.records.length,82);
 const x=output.records[0];
 assert(x.modelProjectionRows.length>0);
 assert(x.modelProjectionRows.every(z=>
  z.originalSourceSkillId===x.originalSourceSkillId&&
  z.originalSourceSkillSameInBothSurfaces&&
  z.originalSkillWholeConditionOnOriginalJVMTickObserved===false&&
  z.eligibleForP3CardScoring===false));
 assert.equal(x.originalFullSkillW,null);
 assert.equal(x.actualSkillActivationRate,null);
 assert.equal(output.comparison.originalJVMSourceRankWindowDrawMeasured,false);
});
test('missing and unverifiable source model observations cannot become zero or grades',()=>{
 const app=appSourceFixture();
 const W=sourceModelFixture();
 W.rows=W.rows.slice(1);
 assert.throws(()=>source.audit(app,manifest,W),/fixed source model partial-mechanism W required/);
 W.rows.unshift({...sourceModelFixture().rows[0],
  sourceIDIdentical:true});
 assert.throws(()=>source.audit(app,manifest,W),/invalid fixed partial W observation/);
});
