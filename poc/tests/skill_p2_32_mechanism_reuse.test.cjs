'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mechanism=require('../src/skill_p2_15_mechanism_evidence.cjs');
const reuse=require('../src/skill_p2_32_mechanism_reuse.cjs');
const blocker=require('../src/skill_source_path_blocker_impact.cjs');
const omission=require('../src/skill_condition_spec_omission.cjs');
const queue=require('../src/skill_p2_32_research_queue.cjs');
const P=(type,operator='==',value=1)=>({type,operator,value});
const inv=(conditions,preConditions=[],index=1)=>({index,conditions,preConditions});
const skill=(id,invokes)=>({id:'skill:'+id,name:'Synthetic '+id,
 activationProfile:{status:'source-structure',sourceNumericId:id,invokes}});
function fixture(){
 const skills=[
  skill('100',[inv([[P('order_rate','<=',50),P('phase_random','==',2)]])]),
  skill('101',[inv([[P('order_rate','<=',70),P('phase_random','==',3)]])]),
  skill('102',[inv([[P('order_rate','>',50),P('phase_random','==',2)]])]),
  skill('103',[inv([[P('order_rate','<=',50),P('corner_random','==',2)]])]),
  skill('104',[inv([[P('order_rate','<=',50),P('phase_random','==',2)]],
   [[P('motivation','>=',3)]])]),
  skill('105',[inv([[P('order_rate','<=',60),P('phase_random','==',3)]],
   [[P('motivation','>=',4)]])]),
  skill('106',[inv([
   [P('order_rate','<=',50),P('phase_random','==',2)],
   [P('order_rate','<=',50),P('corner_random','==',2)]
  ])]),
  {id:'hint:unmatched',name:'unmatched',activationProfile:{
   status:'unavailable',reason:'not-linked'}}
 ];
 return {skills,skillById:Object.fromEntries(skills.map(x=>[x.id,x])),
  cards:[]};
}
function full(m){
 const blockerReport=blocker.audit(m,['100','101']);
 const specReport=omission.audit(m);
 const queueReport=queue.audit(m,{blockerReport,specReport});
 return reuse.audit(m,queueReport);
}
test('prior evidence is appropriately scoped and documented, not automatically expanded',()=>{
 const rank=mechanism.forType('order_rate');
 assert.equal(rank.status,'selected-model-tick');
 assert(rank.limitation.includes('ignores order_rate'));
 const random=mechanism.forType('phase_random');
 assert.equal(random.status,'geometry-counterfactual');
 assert(random.limitation.includes('source UmaSim'));
 assert.equal(mechanism.forType('corner').status,'selected-model-tick');
 assert.equal(mechanism.forType('corner_random').status,
  'no-specific-mechanism-evidence');
 assert.equal(mechanism.forType('phase_firsthalf_random').status,
  'no-specific-mechanism-evidence');
 assert.equal(mechanism.forType('motivation').status,'conditional-fixed-state');
 assert.equal(mechanism.forType('track_id').status,'source-static-context');
 for(const type of ['running_style','distance_type','ground_type','ground_condition'])
  assert.equal(mechanism.forType(type).status,'source-finite-eligibility');
 for(const row of mechanism.forTypes(Object.keys(mechanism.DEFINITIONS)))
  for(const rel of row.evidencePaths)
   assert(fs.existsSync(path.join(__dirname,'../..',rel)),
    'Missing referenced evidence: '+rel);
 assert(mechanism.forTypes(['order_rate','order_rate']).length===1);
 assert(rank.fullSourceANDProven===false);
});
test('same predicate operators with different numeric thresholds share mechanism only',()=>{
 const m=fixture(),old=JSON.stringify(m),report=full(m);
 assert.equal(JSON.stringify(m),old);
 const grouped=report.mechanismFamilies.find(g=>g.originalSourceMembers
  .some(x=>x.sourceNumericId==='100'));
 assert.deepEqual(grouped.originalSourceMembers.map(x=>x.sourceNumericId),['100','101']);
 assert.equal(grouped.distinctExactNumericParameterSets,2);
 assert(grouped.operatorAndBranchShape.conditionAND.some(x=>
  x[0]==='order_rate'&&x[1]==='<='));
 assert.equal(grouped.noWholeSourceSkillTriggerInference,true);
 assert.equal(grouped.sourceThresholdsAndContextMustBeReevaluated,true);
 assert.equal(grouped.priorP215Evidence.find(x=>x.type==='phase_random').status,
  'geometry-counterfactual');
 assert.equal(grouped.priorP215Evidence.find(x=>x.type==='order_rate').status,
  'selected-model-tick');
 assert.equal(grouped.nextMechanismResearchAction,
  'reuse-previous-geometry-and-tick-studies-then-test-source-draw-and-same-branch-conjunction');
});
test('operator and conditions/preconditions branches cannot borrow other skills outcomes',()=>{
 const report=full(fixture());
 const find=id=>report.mechanismFamilies.find(g=>g.originalSourceMembers
  .some(x=>x.sourceNumericId===id));
 assert.notEqual(find('100').familyId,find('102').familyId);
 assert.notEqual(find('100').familyId,find('104').familyId);
 assert.notEqual(find('100').familyId,find('106').familyId);
 assert.notEqual(find('100').familyId,find('103').familyId);
 assert.deepEqual(find('104').originalSourceMembers.map(x=>x.sourceNumericId),
  ['104','105']);
 assert.equal(find('104').distinctExactNumericParameterSets,2);
 assert.deepEqual(find('104').operatorAndBranchShape.preconditionAND,
  [['motivation','>=']]);
 assert.equal(find('106').operatorAndBranchShape.conditionORCount,2);
 assert.equal(find('100').operatorAndBranchShape.conditionORCount,1);
});
test('read-only grouping covers every original source route and retains no skill score',()=>{
 const r=full(fixture()),d=r.denominators;
 assert.equal(r.status,reuse.STATUS);
 assert.equal(d.appSkills,8);
 assert.equal(d.sourceMatchedSkills,7);
 assert.equal(d.sourceUnavailableSkills,1);
 assert.equal(d.sourceRouteFamilies,8);
 assert.equal(r.mechanismFamilies.reduce((n,g)=>n+g.sourceRouteFamilies,0),8);
 assert.equal(d.sourceRouteWholeActivationProofs,0);
 assert.equal(d.actualAppliedOmissions,0);
 assert.equal(d.formalSkillCardSuitabilityRatings,0);
 assert(r.initialMechanismFamilyPilots.length<=7);
 assert(r.initialMechanismFamilyPilots.every(x=>x.noSkillBySkillRetestPromise));
 assert(r.initialMechanismFamilyPilots.some(x=>
  x.selectedAs==='reuse-existing-mechanism-evidence'));
 assert(r.initialMechanismFamilyPilots.every(x=>[
  'reuse-existing-mechanism-evidence','inspect-unstudied-mechanism'
 ].includes(x.selectedAs)));
 assert.equal(Object.hasOwn(r,'skillSuitabilityScores'),false);
});
test('unreviewed corner_random remains a new mechanism, not inherited from corner',()=>{
 const r=full(fixture());
 const g=r.mechanismFamilies.find(x=>x.originalSourceMembers
  .some(y=>y.sourceNumericId==='103'));
 assert(g.notYetMechanismStudiedTypes.includes('corner_random'));
 assert.equal(g.nextMechanismResearchAction,
  'check-original-source-mechanism-for-unstudied-types-before-new-runtime-simulation');
 assert(!g.priorP215Evidence.some(x=>x.type==='corner'));
});
test('invalid identity and source route topology fail closed',()=>{
 const m=fixture();const b=blocker.audit(m,['100','101']);
 const s=omission.audit(m);
 const q=queue.audit(m,{blockerReport:b,specReport:s});
 assert.throws(()=>reuse.audit(m,{...q,status:'fake'}),/route queue required/);
 q.rows[0].routeFamilies[0].conditionOrCount=2;
 assert.throws(()=>reuse.audit(m,q),/source branch topology differs/);
});

test('explicit finite eligibility is not counted as an unstudied dynamic mechanism',()=>{
 const r=full(fixture());
 const group=r.mechanismFamilies.find(x=>x.originalSourceMembers
  .some(m=>m.sourceNumericId==='104'));
 assert.deepEqual(group.notYetMechanismStudiedTypes,[]);
 assert(group.fixedStateConditionalTypes.includes('motivation'));
 const result=reuse.newResearchGap(['distance_type','phase_random','order_rate']);
 assert.deepEqual(result.notYetMechanismStudiedTypes,[]);
 assert.deepEqual(result.explicitFiniteEligibilityTypes,['distance_type']);
 assert.equal(result.nextMechanismResearchAction,
  'reuse-previous-geometry-and-tick-studies-then-test-source-draw-and-same-branch-conjunction');
});
