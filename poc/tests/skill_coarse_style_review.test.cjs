'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const rough=require('../src/skill_coarse_style_review.cjs');
const c=(type,operator,value)=>({type,operator,value});
const profile=(conditions,preConditions=[])=>({
 status:'source-structure',sourceNumericId:'201052',
 invokes:[{index:0,conditions,preConditions,effectTypes:['targetSpeed']}]
});
const skill=(id,activationProfile)=>({id:String(id),name:'テスト'+id,activationProfile});
test('full-phase exact rank-band only: show four distinct style comparisons, not numeric proc rates',()=>{
 const p=profile([[c('distance_type','==',2),c('phase_random','==',1),
   c('order_rate','<=',50)]]);
 const s=rough.summarize(skill('skill:201052',p));
 for(const name of rough.STYLES){
  const x=s.styles[name];
  assert.equal(x.status,'four-style-direction');
  assert(['relative-leader','relative-intermediate',
    'relative-trailer','partial-order-unresolved'].includes(x.modelTier));
  assert.equal(x.scope,'model-balanced-comparative-rank-only');
  assert.equal(Object.hasOwn(x,'probability'),false);
 }
});
test('extra AND including overtaking: do not promote rank subcondition to whole skill',()=>{
 const p=profile([[c('distance_type','==',2),c('phase_random','==',1),
  c('order_rate','<=',50),c('is_overtake','==',1)]]);
 const s=rough.summarize(skill('skill:201051',p));
 for(const name of rough.STYLES){
  assert.equal(s.styles[name].status,'partial-four-style-direction');
  assert(s.styles[name].supportedRankBranches.length===1);
  assert.equal(s.styles[name].supportedRankBranches[0].status,
   'partial-rank-only-other-conditions-unchecked');
  assert.equal(Object.hasOwn(s.styles[name],'modelTier'),false);
 }
});
test('different OR alternative: known rank branch remains partial, never whole-skill suitability',()=>{
 const p=profile([[c('phase_random','==',1),c('order_rate','<=',50)],
  [c('is_overtake','==',1)]]);
 const s=rough.summarize(skill('skill:200001',p));
 assert(rough.STYLES.every(x=>
  s.styles[x].status==='partial-four-style-direction'));
});
test('source running_style exclusion outranks a rank direction, only for styles ruled out',()=>{
 const p=profile([[c('running_style','==',2),c('phase_random','==',1),
  c('order_rate','<=',50)]]);
 const s=rough.summarize(skill('skill:200001',p));
 for(const name of ['逃げ','差し','追込'])
  assert.equal(s.styles[name].status,'explicit-ineligible');
 assert.equal(s.styles['先行'].status,'four-style-direction');
});
test('race-global-only, unavailable and old two-group evidence are distinct',()=>{
 const neutral=rough.summarize(skill('skill:1',profile([[
  c('distance_type','==',2),c('phase_random','==',1)]])));
 assert(rough.STYLES.every(x=>neutral.styles[x].status==='race-global-only'));
 const unknown=rough.summarize(skill('skill:2',{status:'unavailable'}));
 assert(rough.STYLES.every(x=>unknown.styles[x].status==='unavailable'));
 const group=rough.summarize(skill('skill:3',profile([[
  c('phase_firsthalf_random','==',2),c('order_rate','<=',50)]])));
 assert(rough.STYLES.every(x=>group.styles[x].status==='two-group-reference'));
});
test('single style does not become inaccessible because another OR branch is unknown',()=>{
 const p=profile([
 [c('running_style','==',1)],
 [c('is_overtake','==',1)]
 ]);
 const s=rough.summarize(skill('skill:4',p));
 assert.notEqual(s.styles['先行'].status,'explicit-ineligible');
});
test('full app cohort remains four independent rows and unknowns do not become generic',()=>{
 const entries=[
  skill('skill:201052',profile([[c('phase_random','==',1),
   c('order_rate','<=',50)]])),
  skill('skill:200702',profile([[c('is_overtake','==',1)]])),
  skill('skill:unknown',{status:'unavailable'})
 ];
 const before=JSON.stringify(entries);
 const report=rough.report({skills:entries});
 assert.equal(JSON.stringify(entries),before);
 assert.equal(report.appSkillCount,3);
 assert.equal(report.sourceMatchedSkills,2);
 assert.equal(report.rows.length,3);
 assert.equal(Object.values(report.perStyleCounts).reduce((a,b)=>a+b,0),12);
 assert.equal(report.skillCoverage.unavailable,1);
 assert.equal(report.rows[2].styles['逃げ'].status,'unavailable');
});

test('held research gaps count distinct skills not repeated four-style cells',()=>{
 const x=skill('skill:5',profile([[
  c('phase_random','==',1),c('order_rate','<=',50),
  c('is_overtake','==',1)]]));
 const a=rough.report({skills:[x,{...x,id:'skill:6'}]});
 assert.equal(a.heldGapInventory.heldSkillCount,2);
 const blocker=a.heldGapInventory.blockedReviewReasons
  .find(v=>v.key==='extra-AND-conditions-unmeasured');
 assert.equal(blocker.skills,2);
 const overtaking=a.heldGapInventory.sourceConditionTypesInHeldSkills
  .find(v=>v.key==='is_overtake');
 assert.equal(overtaking.skills,2);
 assert.match(a.heldGapInventory.caveat,/not the number/);
});
test('an unresolved OR is recorded separately from condition-type prevalence',()=>{
 const p=profile([
  [c('phase_random','==',1),c('order_rate','<=',50)],
  [c('is_overtake','==',1)]]);
 const r=rough.report({skills:[skill('skill:6',p)]});
 assert.equal(r.heldGapInventory.heldSkillCount,1);
 const reasons=r.heldGapInventory.blockedReviewReasons.map(x=>x.key);
 assert(reasons.includes('multiple-source-OR-or-invoke-paths'));
 assert.equal(r.heldGapInventory.sourceConditionTypesInHeldSkills
  .find(x=>x.key==='is_overtake').skills,1);
});
