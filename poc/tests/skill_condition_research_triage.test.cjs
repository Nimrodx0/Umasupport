'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inventory}=require('../src/skill_condition_inventory.cjs');
const triage=require('../src/skill_condition_research_triage.cjs');
const c=(type,value=1)=>({type,operator:'==',value});
const make=(id,conditions,preConditions=[])=>({id:String(id),name:'fixture-'+id,
 rarity:'normal',invokes:[{conditions,preConditions,effects:[]}]});
test('explicit restrictions, timing context and source rank are separate and not style labels',()=>{
 for(const [type,expected] of [
  ['running_style','explicit-eligibility'],
  ['distance_type','explicit-eligibility'],
  ['corner_random','timing-or-geometry-only'],
  ['phase_laterhalf_random','timing-or-geometry-only'],
  ['order_rate','rank-opportunity-study'],
  ['is_overtake','interaction-or-spurt-pilot'],
  ['is_lastspurt','interaction-or-spurt-pilot'],
  ['blocked_side_continuetime','interaction-or-spurt-pilot'],
  ['bashin_diff_infront','no-general-style-inference'],
  ['distance_diff_top','no-general-style-inference'],
  ['is_used_skill_id','complex-or-external-hold'],
  ['random_lot','complex-or-external-hold'],
  ['not_a_real_type','unreviewed']
 ]) {
  const result=triage.typeDecision(type);
  assert.equal(result.group,expected,type);
  assert.equal(result.canInferStyle,false,type);
 }
});
test('app vs full denominator, OR complexity and held candidate intersections are separate',()=>{
 const app=[
  make(1,[[c('order_rate',40),c('phase_random',1),c('distance_diff_top',5)]]),
  make(2,[[c('order_rate',50)],[c('is_overtake',1)]]),
  make(3,[[c('running_style',1),c('corner_random',1)]],[[c('is_used_skill_id',99)]]),
  make(4,[[c('unmapped_predicate_type',2)]])
 ];
 const whole=[...app,make(5,[[c('is_lastspurt',1)]])];
 const report=triage.examine(inventory(whole),inventory(app),{matchedRecords:app});
 assert.equal(report.summary.totalSourceTypes,8);
 assert.equal(report.summary.appMatchedSkillRecords,4);
 assert.equal(report.summary.matchedSkillStructure.includesRankType,2);
 assert.equal(report.summary.matchedSkillStructure.candidateAndDeferredMixed,1);
 assert.equal(report.summary.matchedSkillStructure.includesPilotType,1);
 assert.equal(report.summary.matchedSkillStructure.withOr,1);
 assert.equal(report.summary.matchedSkillStructure.withPreConditions,1);
 assert.equal(report.summary.matchedSkillStructure.includesDeferredType,3);
 assert.deepEqual(report.summary.unreviewedAppTypes,['unmapped_predicate_type']);
 assert.equal(report.summary.noAutomaticStyleLabels,true);
 assert.equal(report.summary.noAutomaticUniversalStyleInferences,true);
 const last=report.byType.find(x=>x.type==='is_lastspurt');
 assert.equal(last.sourceRegistrySkills,1);
 assert.equal(last.appMatchedSkills,0);
});
test('missing and unfamiliar types are not neutral; no made-up style ranks',()=>{
 const app=[make(7,[[c('distance_diff_rate',2)]])];
 const report=triage.examine(inventory(app),inventory(app),{matchedRecords:app});
 assert.equal(report.byType[0].treatment,'skip-style-inference-by-default');
 assert.equal(report.summary.matchedSkillStructure.includesDeferredType,1);
 assert.equal(triage.typeDecision('some_future_code').treatment,'hold-unreviewed-code');
 assert(!Object.hasOwn(report,'styles'));
 assert(!Object.hasOwn(report,'cardRating'));
});
test('inconsistent inventory or duplicate source identities fail closed',()=>{
 const app=[make(10,[[c('order_rate',40)]])];
 assert.throws(()=>triage.examine(inventory(app),{counts:{byType:{},distinctConditionTypes:1}},
  {matchedRecords:app}),/coverage mismatch/);
 assert.throws(()=>triage.examine(inventory(app),inventory(app),
  {matchedRecords:[app[0],app[0]]}),/Repeated matched/);
});
