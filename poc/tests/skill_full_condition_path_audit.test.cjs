'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const a=require('../src/skill_full_condition_path_audit.cjs');
const c=(type,operator,value)=>({type,operator,value});
const p=(invokes)=>({status:'source-structure',
 sourceNumericId:'202072',source:'current',invokes});
const invoke=(conditions,preConditions=[],index=0)=>({index,
 conditions,preConditions});
const skill=(id,profile)=>({id,name:'テスト'+id,activationProfile:profile});
test('condition and precondition OR are never flattened into one AND or omitted',()=>{
 const s=skill('skill:202072',p([invoke([
  [c('running_style','!=',1),c('distance_type','==',2),
   c('phase_random','==',1),c('order_rate','>=',40)]
 ],[
  [c('running_style','==',2),c('distance_type','==',1)],
  [c('running_style','==',3),c('distance_type','==',2)]
 ])]));
 const out=a.analyzeSkill(s);
 assert.equal(out.paths.length,1);
 assert.equal(out.hasPreconditions,true);
 assert.equal(out.preconditionORInvokes,1);
 assert.equal(out.byStyle['逃げ'].status,'all-recorded-paths-explicitly-exclude-style');
 assert.equal(out.byStyle['先行'].status,
  'all-paths-known-context-conflict-or-style-excluded');
 assert.equal(out.byStyle['差し'].status,'at-least-one-path-not-excluded');
 assert.equal(out.byStyle['追込'].status,'all-recorded-paths-explicitly-exclude-style');
 const mid=out.paths[0].byStyle['先行'];
 assert.equal(mid.status,'known-context-conflict');
 assert.equal(mid.rejectedStyleAlternatives,1);
 assert.equal(mid.rejectedContextAlternatives,1);
 const back=out.paths[0].byStyle['差し'];
 assert.equal(back.compatiblePreconditionAlternatives,1);
 assert.deepEqual(back.unverifiedConditionTypes,['order_rate','phase_random']);
 assert.equal(Object.hasOwn(back,'probability'),false);
});
test('different OR paths and multiple invokes keep exact indexed provenance',()=>{
 const out=a.analyzeSkill(skill('hint:架空',p([
  invoke([
   [c('running_style','==',1),c('is_overtake','==',1)],
   [c('running_style','==',2)]
  ],[],4),
  invoke([[c('running_style','==',3)],[c('running_style','==',4)]],[],6)
 ])));
 assert.deepEqual(out.paths.map(x=>[x.invokeOffset,x.invokeIndex,x.orIndex]),
  [[0,4,0],[0,4,1],[1,6,0],[1,6,1]]);
 assert.equal(out.conditionalORInvokes,2);
 assert.equal(out.invokeCount,2);
 for(const name of ['逃げ','先行','差し','追込'])
  assert.equal(out.byStyle[name].status,'at-least-one-path-not-excluded');
 assert.equal(out.paths[0].byStyle['逃げ'].unverifiedConditionTypes[0],
  'is_overtake');
 assert.equal(out.paths[0].byStyle['先行'].status,'style-excluded');
});
test('cross-side contradictory race predicates block paths without inventing style restriction',()=>{
 const out=a.analyzeSkill(skill('skill:202072',p([invoke([
  [c('ground_type','==',1),c('distance_type','==',2)]
 ],[[c('ground_type','==',2)]])])));
 for(const name of ['逃げ','先行','差し','追込']){
  assert.equal(out.paths[0].byStyle[name].status,'known-context-conflict');
  assert.equal(out.byStyle[name].status,
   'all-paths-known-context-conflict-or-style-excluded');
 }
});
test('zero condition rows are unknown even when a precondition itself excludes one style',()=>{
 const out=a.analyzeSkill(skill('skill:202072',p([
  invoke([],[[c('running_style','==',1)]])
 ])));
 assert.equal(out.emptyConditionInvokes,1);
 assert.equal(out.paths[0].status,'no-source-condition-rows');
 assert.equal(out.byStyle['先行'].status,'unknown-empty-source-invoke');
 assert.equal(out.byStyle['逃げ'].status,'unknown-empty-source-invoke');
});
test('known finite domains support inequalities and eliminate impossible AND intervals',()=>{
 const t=[c('distance_type','>=',3),c('distance_type','<=',2),
  c('ground_condition','!=',1)];
 assert.equal(a.analyzePath(t,[],1).status,'known-context-conflict');
 assert.equal(a.analyzePath([
  c('running_style','!=',1),c('running_style','!=',3)
 ],[],2).status,'not-excluded-by-known-domains');
 assert.equal(a.analyzePath([
  c('running_style','!=',1),c('running_style','!=',3)
 ],[],1).status,'style-excluded');
 assert.equal(a.analyzePath([
  c('is_lastspurt','==',1)
 ],[],4).status,'not-excluded-by-known-domains');
});
test('model inventory stays nonmutating, carries explicit source gaps, and never assigns ratings',()=>{
 const model={cards:[{id:'30001',events:[{id:'e1',rewards:[]}]}],
  skills:[
   skill('skill:202072',p([invoke([
    [c('distance_type','==',2),c('phase_random','==',1)]
   ])])),
   skill('skill:missing',{status:'unavailable',reason:'source-missing'})]
 };
 model.skillById=Object.fromEntries(model.skills.map(s=>[s.id,s]));
 const before=JSON.stringify(model);
 const out=a.audit(model);
 assert.equal(JSON.stringify(model),before);
 assert.equal(out.denominators.appSkills,2);
 assert.equal(out.denominators.sourceMatched,1);
 assert.equal(out.denominators.unavailable,1);
 assert.equal(out.denominators.invokes,1);
 assert.equal(out.denominators.recordedConditionORPaths,1);
 assert.equal(out.denominators.reportedStylePathCells,4);
 assert.equal(out.byStyles['逃げ']['at-least-one-path-not-excluded'],1);
 assert.equal(out.rows[1].status,'source-unavailable');
 assert.equal(out.sourceConditionTypesOnNonExcludedPaths
  .find(x=>x.key==='phase_random').skills,1);
 assert.equal(out.boundaries.some(x=>x.includes('no contradiction')),true);
 assert.equal(Object.hasOwn(out,'cardScores'),false);
});
test('malformed matrices and duplicate app IDs reject before publishing a conclusion',()=>{
 assert.throws(()=>a.analyzePath([c('running_style','>=',2)],
  [{type:'bad'}],1),/invalid precondition/);
 assert.throws(()=>a.analyzeSkill(skill('skill:1',
  p([invoke([[c('running_style','===',1)]])]))),/invalid condition/);
 assert.throws(()=>a.analyzeSkill(skill('skill:1',
  {status:'source-structure',sourceNumericId:'invalid',invokes:[]})),
  /numeric ID/);
 const x=skill('skill:1',p([invoke([[]])]));
 assert.throws(()=>a.audit({skills:[x,x],skillById:{'skill:1':x}}),
  /duplicate app skill ID/);
});
