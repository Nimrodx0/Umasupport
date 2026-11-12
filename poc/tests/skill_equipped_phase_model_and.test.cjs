'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/skill_equipped_phase_model_and.cjs');
const rank=require('../tools/globalsim_change_order_skill_tick.cjs');
const selected=require('../tools/globalsim_p2_15_equipped_runtime_windows.cjs');
const packed=(...parts)=>parts.reduce((n,x)=>n*32+x,0);
function fixture(){
 const n=9,p={seed:123,fieldSize:n,
  course:{id:10502,distance:1600,distanceType:2,surface:'turf'},
  scenario:'balanced',mode:'equal',
  strategies:['Nige','Nige','Senkou','Senkou','Sasi','Sasi','Sasi','Oikomi','Oikomi']};
 const baseline={seed:123,skillEvents:[
  {skillId:200451,horseIndex:0,t:5},
  {skillId:200701,horseIndex:7,t:7}],frames:[]};
 const model=structuredClone(baseline);
 const rankModel=structuredClone(baseline);
 for(let t=0;t<3;t++){
  const a={t,horses:[]},b={t,horses:[]},c={t,horses:[]};
  for(let i=0;i<n;i++){
   const pos=100+i*15+t*2;
   const row=[pos,16,100,0.5,0,-1];
   a.horses.push([...row]);
   b.horses.push(t?[
    ...row.slice(0,4),pos-2,pos-2]:[...row]);
   const k=i+1,prev=t===1?0:k;
   c.horses.push(t?[...row.slice(0,4),k-prev,
    packed(k,prev,k,prev,k,k)]:[...row]);
  }
  baseline.frames.push(a);model.frames.push(b);rankModel.frames.push(c);
 }
 model.p2SampledSkillWindows=Array.from({length:n},(_,i)=>{
  const pos=100+i*15;
  return [
   {skillId:'200451',detailIndex:0,windows:[[pos,pos+10]],
    hasPrerequisite:0},
   {skillId:'200501',detailIndex:0,windows:[[pos+20,pos+30]],
    hasPrerequisite:0},
   {skillId:'200701',detailIndex:0,
    windows:i>4?[[pos,pos+10]]:[[9999,9999]],hasPrerequisite:0}
  ];
 });
 return {plans:[p],original:[baseline],windows:[model],ranks:[rankModel]};
}
test('pinned source model expressions are exact, fail on unfamiliar model skill',()=>{
 assert.deepEqual(m.modelClauses('200701'),[
  {type:'distance_type',operator:'==',value:2},
  {type:'phase_random',operator:'==',value:2},
  {type:'order_rate',operator:'>',value:50}
 ]);
 assert.throws(()=>m.modelClauses('not-pinned'),/unvalidated/);
});
test('window membership is the sampled interval, AND respects original rank rounding and static distance',()=>{
 const id='200701';
 const detail={skillId:id,windows:[[100,110]],
  researchSampleStatus:'valid-in-course-runtime-window'};
 const course={distance:1600,distanceType:2,fieldSize:9};
 let c=m.candidate(id,detail,105,6,course);
 assert.equal(c.phaseWindowContainsPosition,true);
 assert.equal(c.andSatisfied,true);
 assert.deepEqual(c.otherConditions.map(x=>x.satisfied),[true,true]);
 assert.equal(m.candidate(id,detail,105,5,course).andSatisfied,false);
 assert.equal(m.candidate(id,detail,110,6,course).andSatisfied,false);
 assert.equal(m.candidate(id,detail,105,7,{...course,distanceType:3}).andSatisfied,false);
 assert.equal(m.candidate(id,{skillId:id,windows:[[9999,9999]],
  researchSampleStatus:'reserved-inactive-detail'},105,6,course).andSatisfied,false);
 assert.equal(m.candidate(id,null,105,6,course).andSatisfied,null);
 assert.equal(m.candidate('200451',{...detail,skillId:'200451'},105,5,course).andSatisfied,true);
 assert.throws(()=>m.candidate(id,detail,105,10,course),/source-timed model state/);
});
test('direct 3 independent model replays keep skill and physics parity; actual windows and rank conjunctions grouped separately',()=>{
 const f=fixture();
 const x=m.analyze(f.plans,f.original,f.windows,f.ranks);
 assert.equal(x.status,m.STATUS);
 assert.equal(x.modelDesign.fixedEquippedRaces,1);
 assert.equal(x.modelDesign.modelRunnerRaces,9);
 assert.equal(x.totals.equippedModelRunnerRaces,27);
 assert.equal(x.totals.inspectedSameStageModelRunnerTicks,54);
 assert.equal(x.totals.modelSkillEvents,2);
 assert.equal(x.skills['200451'].modelSkillEvents,1);
 assert.equal(x.skills['200501'].modelSkillEvents,0);
 assert.equal(x.skills['200701'].modelSkillEvents,1);
 assert.equal(x.skills['200451'].phaseWindowMemberRunnerTicks,18);
 assert.equal(x.skills['200451'].wholeModelExpressionANDRunnerTicks,18);
 assert.equal(x.skills['200501'].phaseWindowMemberRunnerTicks,0);
 assert.equal(x.skills['200501'].wholeModelExpressionANDRunnerTicks,0);
 assert.equal(x.skills['200701'].phaseWindowMemberRunnerTicks,8);
 assert.equal(x.skills['200701'].wholeModelExpressionANDRunnerTicks,8);
 assert.equal(x.skills['200701'].reservedInactiveDetailRunnerRaces,5);
 assert.equal(x.skills['200701'].runnerRacesWithANDVisit,4);
 assert.equal(x.totals.phaseWindowMemberRunnerTicks,26);
 assert.equal(x.totals.wholeModelExpressionANDRunnerTicks,26);
 assert.equal(x.totals.runnerRacesWithANDAndModelEvent,2);
 assert.equal(x.totals.runnerRacesWithANDNoModelEvent,11);
 assert.equal(x.totals.runnerRacesWithNoANDAndModelEvent,0);
 assert.equal(x.totals.runnerRacesWithNoANDNoModelEvent,14);
 assert.equal(x.totals.modelSkillEventsOnANDRunnerRaces,2);
 assert.equal(x.totals.modelSkillEventsOnNoANDRunnerRaces,0);
 assert.equal(x.totals.runnerRacesWithRepeatedModelEvents,0);
 assert.equal(x.skills['200701'].runnerRacesWithANDAndModelEvent,1);
 assert.equal(x.skills['200701'].runnerRacesWithANDNoModelEvent,3);
 assert.equal(x.modelDesign.modelEventTimeAlignedToObservedPriorityTick,false);
 assert.equal(x.evidenceGates.modelSkillEventPresenceCrossTabulatedWithANDRunnerRaces,true);
 assert.equal(x.evidenceGates.modelEventTickCausalityVerified,false);
 assert.equal(x.threeEngineValidation.modelPriorityPositionPairsMatched,18);
 assert.equal(x.threeEngineValidation.rankProbePhysicalValuesMatched,108);
 assert.equal(x.bySkillStyle.length,12);
 assert.equal(x.evidenceGates.originalUmaSimRandomDrawsObserved,false);
 assert.equal(x.evidenceGates.liveGameSkillActivationRateMeasured,false);
 assert.equal(x.totals.approvedSuitabilityLabel,null);
});
test('per-runner model event presence is counted once, duplicate events separately, and unmatched AND stays an audit cell',()=>{
 const f=fixture();
 for(const reply of [f.original[0],f.windows[0],f.ranks[0]]){
  // Synthetic events deliberately carry times beyond this captured panel.
  // The result must never claim same-tick causal corroboration.
  reply.skillEvents.push({skillId:200501,horseIndex:0,t:20});
  reply.skillEvents.push({skillId:200451,horseIndex:0,t:21});
 }
 const x=m.analyze(f.plans,f.original,f.windows,f.ranks);
 assert.equal(x.totals.modelSkillEvents,4);
 assert.equal(x.totals.runnerRacesWithANDAndModelEvent,2);
 assert.equal(x.totals.runnerRacesWithANDNoModelEvent,11);
 assert.equal(x.totals.runnerRacesWithNoANDAndModelEvent,1);
 assert.equal(x.totals.runnerRacesWithNoANDNoModelEvent,13);
 assert.equal(x.totals.runnerRacesWithRepeatedModelEvents,1);
 assert.equal(x.totals.modelSkillEventsOnANDRunnerRaces,3);
 assert.equal(x.totals.modelSkillEventsOnNoANDRunnerRaces,1);
 assert.equal(x.skills['200501'].runnerRacesWithNoANDAndModelEvent,1);
 assert.equal(x.evidenceGates.modelEventTickCausalityVerified,false);
});
test('event identity must refer to an actual runner, even when it has no sampled AND evidence',()=>{
 const f=fixture();
 for(const reply of [f.original[0],f.windows[0],f.ranks[0]])
  reply.skillEvents.push({skillId:200701,horseIndex:99,t:1});
 assert.throws(()=>m.analyze(f.plans,f.original,f.windows,f.ranks),
  /no attributable runner/);
});
test('mismatched independent model skill events and physics must be rejected',()=>{
 const f=fixture();
 const mutated=structuredClone(f.ranks);
 mutated[0].skillEvents.pop();
 assert.throws(()=>m.analyze(f.plans,f.original,f.windows,mutated),
  /original GlobalSim skill event/);
 const physics=structuredClone(f.ranks);
 physics[0].frames[1].horses[3][2]=75;
 assert.throws(()=>m.analyze(f.plans,f.original,f.windows,physics),
  /observer changed original GlobalSim physics/);
 const stage=structuredClone(f.ranks);
 stage[0].frames[2].horses[4][5]=packed(4,5,4,5,4,5);
 stage[0].frames[2].horses[4][4]=-1;
 assert.throws(()=>m.analyze(f.plans,f.original,f.windows,stage),
  /rank cache changed/);
});
test('missing model detail is never falsely counted as a failed random-window draw',()=>{
 const f=fixture();
 f.windows[0].p2SampledSkillWindows[8]=f.windows[0].p2SampledSkillWindows[8]
  .filter(r=>r.skillId!=='200701');
 const x=m.analyze(f.plans,f.original,f.windows,f.ranks);
 assert.equal(x.skills['200701'].missingDetailRunnerRaces,1);
 assert.equal(x.skills['200701'].wholeModelExpressionANDRunnerTicks,6);
 assert.equal(x.skills['200701'].runnerRacesWithANDVisit,3);
 assert.equal(x.evidenceGates.entire102SourcePhaseRandomSkillsMeasured,false);
});
test('original window parser rejects counterfeit skill identifiers, intervals and duplicate model details',()=>{
 const f=fixture();
 f.windows[0].p2SampledSkillWindows[0][0].skillId='999999';
 assert.throws(()=>m.analyze(f.plans,f.original,f.windows,f.ranks),
  /Malformed model pending skill detail/);
 const bad=fixture();
 bad.windows[0].p2SampledSkillWindows[0][0].windows=[[15,10]];
 assert.throws(()=>m.analyze(bad.plans,bad.original,bad.windows,bad.ranks),
  /Invalid model sampled interval/);
});
