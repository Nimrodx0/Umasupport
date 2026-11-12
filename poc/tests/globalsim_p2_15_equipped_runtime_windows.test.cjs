'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tool=require('../tools/globalsim_p2_15_equipped_runtime_windows.cjs');
const pos=require('../tools/globalsim_p2_15_preskill_phase_position.cjs');
function fixture(){
 const plan={seed:123,fieldSize:1,course:{id:10502,distance:1600},strategies:['Senkou']};
 const horse=x=>[x,15,100,.5,0,-1];
 const frames=[{t:0,horses:[horse(5)]},{t:1,horses:[horse(10)]},
  {t:2,horses:[horse(25)]}];
 const a={seed:123,frames,skillEvents:[{horseIndex:0,skillId:200451,t:1}]};
 const b=structuredClone(a);
 b.frames[1].horses[0][4]=5;b.frames[1].horses[0][5]=5;
 b.frames[2].horses[0][4]=10;b.frames[2].horses[0][5]=10;
 b.p2SampledSkillWindows=[[
  {skillId:'200451',detailIndex:0,windows:[[5,15]],hasPrerequisite:0},
  {skillId:'200501',detailIndex:0,windows:[[10,20]],hasPrerequisite:0}
 ]];
 return {plans:[plan],original:[a],probe:[b]};
}
test('equipped skill source windows and model skill events are distinct evidence',()=>{
 const {plans,original,probe}=fixture();
 const x=tool.analyze(plans,original,probe);
 assert.equal(x.status,tool.STATUS);
 assert.equal(x.totals.sampledWindows,2);
 assert.equal(x.totals.observedSkillStagePositions,2);
 assert.equal(x.totals.positionsMatchingPriorPostFrame,2);
 assert.equal(x.totals.sampledWindowMemberRunnerTicks,3);
 assert.equal(x.skills['200451'].modelSkillEvents,1);
 assert.equal(x.skills['200501'].modelSkillEvents,0);
 assert.equal(x.skills['200701'].missingDetailContexts,1);
 assert.equal(x.gates.actualUmaSimSamplesObserved,false);
 assert.equal(x.gates.gameProcRateEstablished,false);
 assert.equal(x.totals.identicalPhysicalValues,12);
});
test('probe fails closed on changed skill events, physics or skill-stage position',()=>{
 const f=fixture();
 const events=structuredClone(f.probe);events[0].skillEvents=[];
 assert.throws(()=>tool.analyze(f.plans,f.original,events),/changed original model skill events/);
 const physics=structuredClone(f.probe);physics[0].frames[1].horses[0][1]++;
 assert.throws(()=>tool.analyze(f.plans,f.original,physics),/changed model race physics/);
 const stage=structuredClone(f.probe);stage[0].frames[1].horses[0][5]=4;
 assert.throws(()=>tool.analyze(f.plans,f.original,stage),/stage positions diverged/);
 const prior=structuredClone(f.probe);
 prior[0].frames[1].horses[0][4]=4;prior[0].frames[1].horses[0][5]=4;
 assert.throws(()=>tool.analyze(f.plans,f.original,prior),/prior post frame/);
});
test('sample parsing rejects duplicate skill, malformed interval and untrusted source ids',()=>{
 const f=fixture();
 const duplicate=structuredClone(f.probe);duplicate[0].p2SampledSkillWindows[0]
  .push(structuredClone(duplicate[0].p2SampledSkillWindows[0][0]));
 assert.throws(()=>tool.analyze(f.plans,f.original,duplicate),/Duplicate runtime skill detail/);
 const backwards=structuredClone(f.probe);
 backwards[0].p2SampledSkillWindows[0][0].windows=[[30,10]];
 assert.throws(()=>tool.analyze(f.plans,f.original,backwards),/Invalid model sampled interval/);
 const unknown=structuredClone(f.probe);
 unknown[0].p2SampledSkillWindows[0][0].skillId='made-up';
 assert.throws(()=>tool.analyze(f.plans,f.original,unknown),/Malformed model pending skill detail/);
 const missing=structuredClone(f.probe);
 delete missing[0].p2SampledSkillWindows;
 assert.throws(()=>tool.analyze(f.plans,f.original,missing),/frame mismatch/);
});
test('exact source patch is read-only, includes restoration, and rejects rerun',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p215-equipped-'));
 try{
  for(const [name,steps] of Object.entries(pos.replacement)){
   const file=path.join(dir,name);
   fs.mkdirSync(path.dirname(file),{recursive:true});
   let body=steps.map(x=>x[0]).join('\n// marker\n');
   if(name==='src/lib.rs')body+='\n    let mut field = RaceField::new(solvers);'+
    '\n    match frames.finish()? {'+
    '\nfor key in ["results", "finishFrames", "conservePowerDiagnostics"]';
   fs.writeFileSync(file,body);
  }
  const result=tool.patch(dir);
  assert.equal(result.globalSimRevision,pos.PIN);
  assert(result.noNewRngOrSkillDecisions);
  const rust=fs.readFileSync(path.join(dir,'src/lib.rs'),'utf8');
  assert(rust.includes('solver.pending_skills.iter()'));
  assert(rust.includes('p2SampledSkillWindows'));
  assert(rust.includes('"p2SampledSkillWindows"]'));
  assert.throws(()=>tool.patch(dir),/pinned GlobalSim source moved/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a pinned 9999m inactive reserved detail is not a sampled window',()=>{
 const f=fixture();
 f.probe[0].p2SampledSkillWindows[0].push({skillId:'200701',detailIndex:0,
  windows:[[9999,9999]],hasPrerequisite:0});
 const x=tool.analyze(f.plans,f.original,f.probe);
 assert.equal(x.totals.pendingWindowEntriesIncludingInactive,3);
 assert.equal(x.totals.sampledWindows,2);
 assert.equal(x.totals.reservedInactiveDetails,1);
 assert.equal(x.skills['200701'].instantiatedDetails,1);
 assert.equal(x.skills['200701'].modelSampledWindows,0);
 assert.equal(x.skills['200701'].reservedInactiveDetails,1);
 assert.equal(x.totals.sampledWindowMemberRunnerTicks,3);
 const bad=structuredClone(f.probe);
 bad[0].p2SampledSkillWindows[0][0].windows=[[1700,1710]];
 assert.throws(()=>tool.analyze(f.plans,f.original,bad),/out-of-course/);
});
test('template validation accepts only exact fixed source skill expressions',()=>{
 const t={experimentalRetailRuntime:true,experimentalRetailInitialization:true,
  horses:Array(9).fill({}),skillData:{}};
 for(const [id,condition] of Object.entries(tool.EXPRESSIONS))
  t.skillData[id]={alternatives:[{condition,precondition:'',effects:[{type:28}]}]};
 assert.doesNotThrow(()=>tool.validateTemplate(t));
 t.skillData['200701'].alternatives[0].condition='phase_random==2';
 assert.throws(()=>tool.validateTemplate(t),/source skill changed/);
});
