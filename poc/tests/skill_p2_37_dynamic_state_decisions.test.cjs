'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const review=require('../src/skill_p2_37_dynamic_state_decisions.cjs');
const queue=require('../src/skill_p2_32_research_queue.cjs');
const pred=(type,operator='==',value=1)=>({type,operator,value});
const skill=(id,invokes)=>({id:'skill:'+id,name:'synthetic '+id,
 activationProfile:{status:'source-structure',sourceNumericId:id,invokes}});
const checkSource=[
 '"is_overtake" -> condition.checkSpecialState()',
 '"change_order_onetime" -> condition.checkSpecialState()',
 '"is_lastspurt" -> condition.checkInRaceBool { isInSpurt() }',
 'val key = approximateTypeToState[type]',
 '(simulation.specialState[key] ?: 0) + adjust'
].join('\n');
const skillData=[
 '"is_overtake" to "overtake"',
 '"change_order_onetime" to "change_order_onetime"',
 '"change_order_onetime" to ApproximateRandomRates(',
 'listOf(-1 to 0.2, 1 to 0.2)',
 '"overtake" to ApproximateMultiCondition(',
 'ApproximateStartContinue("逃げ", 0.05, 0.50)',
 'ApproximateStartContinue("先行", 0.15, 0.55)',
 'ApproximateStartContinue("その他", 0.20, 0.60)'
].join('\n');
function example(){
 const skills=[
  skill('101',[{index:1,conditions:[
   [pred('is_overtake'),pred('order_rate','<=',50),pred('phase','==',1)],
   [pred('phase','==',1)]
  ],preConditions:[]}]),
  skill('102',[{index:2,
   conditions:[[pred('change_order_onetime','!=',0)]],
   preConditions:[[pred('is_lastspurt')]]}]),
  skill('103',[{index:3,conditions:[[
   pred('is_lastspurt'),pred('phase_firsthalf_random','==',2)
  ]],preConditions:[]}])
 ];
 const model={skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s]))};
 const rows=skills.map(s=>queue.analyzeSkill(s));
 const routeFamilies=rows.flatMap(r=>r.routeFamilies);
 return {model,sourceQueue:{status:queue.STATUS,
  denominators:{appSkills:skills.length,
   sourceMatchedSkills:skills.length,
   originalRouteFamilies:routeFamilies.length},
  rows}};
}
test('classifies 3 original dynamic mechanisms without W/D or P3 scoring',()=>{
 const {model,sourceQueue}=example(),old=JSON.stringify({model,sourceQueue});
 const x=review.audit(model,sourceQueue,checkSource,skillData);
 assert.equal(JSON.stringify({model,sourceQueue}),old,'read only');
 assert.equal(x.status,review.STATUS);
 assert.equal(x.summary.targetedSourceRouteFamilies,3);
 assert.equal(x.summary.distinctTargetedSkills,3);
 assert.equal(x.summary.byType.is_overtake.originalSourceSkills,1);
 assert.equal(x.summary.byType.change_order_onetime.originalRouteFamilies,1);
 assert.equal(x.summary.byType.is_lastspurt.originalRouteFamilies,2);
 assert.equal(x.summary.byType.is_lastspurt.historicalPreconditionFamilies,1);
 assert.equal(x.summary.byType.is_overtake.sameCurrentANDRankFamilies,1);
 assert.equal(x.summary.byType.is_overtake.sameCurrentANDTimeFamilies,1);
 assert.equal(x.summary.byType.change_order_onetime.sameCurrentANDRankFamilies,0);
 assert.equal(x.summary.productSuitableScores,0);
 assert.equal(x.summary.actualAppliedEventOmissions,0);
 assert(x.rows.every(r=>r.modelPartialRankWAndDUsableAsWholeRoute===false&&
  r.eligibleForP3CardScoring===false));
 const first=x.rows.find(r=>r.sourceNumericId==='101');
 assert.equal(first.sourceRoute.conditionORCount,2);
 assert.equal(first.otherInvokeOrORAlternatives,true);
 assert.equal(first.sourceRoute.invokeIndex,1);
 assert.equal(first.sourceRoute.invokeOffset,0);
 const historical=x.rows.find(r=>r.sourceNumericId==='102');
 assert.deepEqual(historical.predicateTypes,
  ['change_order_onetime','is_lastspurt']);
 assert(historical.sourceConditionEventPredicates.some(r=>
  r.type==='is_lastspurt'&&r.side==='historical-precondition-AND'));
});
test('source code approximations are required and cannot be silently promoted as real game evidence',()=>{
 const {model,sourceQueue}=example();
 const corrupt=skillData.replace('0.05, 0.50','0.55, 0.50');
 assert.throws(()=>review.audit(model,sourceQueue,checkSource,corrupt),
  /source checker or approximate-state semantics drift/);
 assert.throws(()=>review.audit(model,sourceQueue,
  checkSource.replace('isInSpurt()','inFinalStraight()'),skillData),
  /source checker or approximate-state semantics drift/);
 assert.equal(review.verdict.is_overtake.noAutomaticOmission,true);
 assert.match(review.verdict.is_overtake.reason,/approximate/);
});
test('precondition/OR/Invoke source identity cannot be shuffled into a false same-tick decision',()=>{
 const {model,sourceQueue}=example();
 sourceQueue.rows[0].routeFamilies[0].conditionOrIndex=5;
 assert.throws(()=>review.audit(model,sourceQueue,checkSource,skillData),
  /source branch topology differs|invalid route offset|invalid original AND predicates/);
 const x=example();
 x.sourceQueue.rows[1].sourceNumericId='999';
 assert.throws(()=>review.audit(x.model,x.sourceQueue,checkSource,skillData),
  /numeric ID mismatch/);
});
