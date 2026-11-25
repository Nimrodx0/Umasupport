'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const study=require('../src/skill_p2_37_dynamic_state_evidence.cjs');
const status=require('../src/skill_p2_32_research_queue.cjs').STATUS;
const spec=()=>({
 revision:study.PIN,
 checker:[
  '"change_order_onetime" -> condition.checkSpecialState()',
  '"is_overtake" -> condition.checkSpecialState()',
  '"is_lastspurt" -> condition.checkInRaceBool { isInSpurt() }',
  'simulation.specialState[key] ?: 0',
  'val spurtParameters = simulation.spurtParameters ?: return false',
  'spurtParameters.distance + simulation.position >= setting.courseLength'
 ].join('\n'),
 skillData:[
  '"change_order_onetime" to ApproximateRandomRates(',
  'listOf(-1 to 0.2, 1 to 0.2)',
  '"overtake" to ApproximateMultiCondition(',
  'ApproximateStartContinue("逃げ", 0.05, 0.50)',
  'ApproximateStartContinue("先行", 0.15, 0.55)',
  'ApproximateStartContinue("その他", 0.20, 0.60)',
  '"change_order_onetime" to "change_order_onetime"',
  '"is_overtake" to "overtake"'
 ].join('\n'),
 calculator:[
  'if (changeSecond) {',
  'approximateConditions.forEach { entry ->',
  'simulation.specialState[entry.key] = entry.value.update(this, simulation.specialState[entry.key] ?: 0)'
 ].join('\n')
});
const types=['change_order_onetime','is_overtake','is_lastspurt'];
const counts=[30,21,55];
const cases=[30,27,61];
function mock(){
 const skills=[],rows=[];
 let i=0;
 for(const [idx,type] of types.entries()){
  for(let n=0;n<counts[idx];n++){
   const id=String(200000+i),skillId='skill:'+id;
   const ors=idx>0&&n<6?2:1;
   const invokes=[{index:1,preConditions:[],conditions:[]}];
   const family=[];
   for(let orIndex=0;orIndex<ors;orIndex++){
    invokes[0].conditions.push([{type,operator:'==',value:1}]);
    family.push({invokeOffset:0,invokeIndex:1,
     conditionOrIndex:orIndex,preconditionOrIndex:null,
     conditionOrCount:ors,preconditionOrCount:0,
     hasOtherInvokes:false,finiteCompatibleStyles:['逃げ','先行','差し','追込'],
     unverifiedTypes:[type,'phase'],researchGroup:'event-state-pilot-next'});
   }
   skills.push({id:skillId,activationProfile:{status:'source-structure',
    sourceNumericId:id,invokes}});
   rows.push({skillId,sourceNumericId:id,
    status:'source-route-research-candidates-only',routeFamilies:family});
   i++;
  }
 }
 while(i<818){
  const id=String(200000+i),skillId='skill:'+id;
  skills.push({id:skillId,activationProfile:{status:'source-structure',
   sourceNumericId:id,invokes:[{index:1,conditions:[[]],preConditions:[]}]}});
  rows.push({skillId,sourceNumericId:id,
   status:'source-route-research-candidates-only',routeFamilies:[]});
  i++;
 }
 while(i<881){
  const skillId='hint:unmatched-'+i;
  skills.push({id:skillId});
  rows.push({skillId,sourceNumericId:null,status:'source-unavailable',routeFamilies:[]});
  i++;
 }
 return {model:{skills,skillById:Object.fromEntries(skills.map(x=>[x.id,x]))},
  queue:{status,denominators:{appSkills:881,sourceMatchedSkills:818,
   originalRouteFamilies:970,officialP3OrP4Ratings:0},rows},
  source:spec()};
}
test('source-confirmed approximate events are not made into model style probabilities',()=>{
 const {model,queue,source}=mock();
 const before=JSON.stringify({model,queue});
 const x=study.audit(model,queue,source);
 assert.equal(before,JSON.stringify({model,queue}));
 assert.equal(x.source.mechanismSourceVerified,true);
 assert.deepEqual(types.map(t=>[
  x.summary.byOriginalPredicate[t].sourceSkills,
  x.summary.byOriginalPredicate[t].originalRouteFamilies]),[
  [30,30],[21,27],[55,61]]);
 assert.equal(x.summary.productSkillSuitabilityScores,0);
 assert.equal(x.summary.selectedNewRealGameMeasurements,0);
 assert(x.rows.change_order_onetime.every(x=>
  x.evaluationDecision==='reject-model-approximation-as-actual-style-evidence'&&
  x.probabilityOrScore===null));
 assert(x.rows.is_overtake.every(x=>
  x.mechanism==='source-style-parameterized-random-overtake-approximation'));
 assert(x.rows.is_lastspurt.every(x=>
  x.evaluationDecision.includes('conditionally-adopt-mechanism-meaning')));
});
test('differing original simulation approximation or spurt check fails closed',()=>{
 const x=mock();
 x.source.skillData=x.source.skillData.replace('0.15, 0.55','0.25, 0.55');
 assert.throws(()=>study.audit(x.model,x.queue,x.source),/approximate-state generation/);
 const y=mock();
 y.source.checker=y.source.checker.replace('simulation.spurtParameters ?: return false','null');
 assert.throws(()=>study.audit(y.model,y.queue,y.source),/checker mechanism drift/);
 const z=mock();z.source.calculator=z.source.calculator.replace('if (changeSecond)', 'if (true)');
 assert.throws(()=>study.audit(z.model,z.queue,z.source),/timed update drift/);
});
test('changing OR branch, invoke identity or predicate invalidates original route evidence',()=>{
 const x=mock();
 x.model.skills[0].activationProfile.invokes[0].index=9;
 assert.throws(()=>study.audit(x.model,x.queue,x.source),/original Invoke number/);
 const y=mock();
 y.model.skills[30].activationProfile.invokes[0].conditions[0][0].type='other';
 assert.throws(()=>study.audit(y.model,y.queue,y.source),/no longer contains requested/);
 const z=mock();z.queue.rows[30].routeFamilies[0].preconditionOrIndex=0;
 assert.throws(()=>study.audit(z.model,z.queue,z.source),/AND\/OR or precondition topology/);
});
