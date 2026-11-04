'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/skill_style_tendency.js');
const c=(type,operator,value)=>({type,operator,value});
const invoke=(conditions,preConditions=[],index=0)=>({index,conditions,preConditions,effectTypes:['targetSpeed']});
const profile=(conditions,pre=[],other=[])=>({status:'source-structure',
 sourceNumericId:'201052',invokes:[invoke(conditions,pre),...other]});
const middle=(op,value)=>[c('distance_type','==',2),c('phase_random','==',1),c('order_rate',op,value)];
const end=(op,value)=>[c('distance_type','==',2),c('phase_random','==',2),c('order_rate',op,value)];
test('Gear Shift: middle top 50% is qualitative escape / leader tendency',()=>{
 const got=engine.infer(profile([middle('<=',50)]));
 assert.equal(got.status,'inferred');
 assert.equal(got.label,'逃げ・先行寄り');
 assert.deepEqual(got.styles,[1,2]);
 assert.deepEqual(got.basisRuleIds,['P2-RANK-AT-MOST-50-v1']);
 assert.equal(got.kind,'inferred-not-explicit');
 assert.equal(got.branches[0].timing[0].windows[0].phaseName,'中盤');
 assert.equal(Object.hasOwn(got,'probability'),false);
});
test('Updraft: final-first-half behind 50% is qualitative late / end tendency',()=>{
 const got=engine.infer(profile([end('>',50)]));
 assert.equal(got.status,'inferred');
 assert.equal(got.label,'差し・追込寄り');
 assert.deepEqual(got.styles,[3,4]);
 assert.equal(got.branches[0].timing[0].windows[0].phaseName,'終盤前半');
});
test('Ikigomi Jūbun keeps front-leaning label but exposes the entire final-phase random window',()=>{
 const x=engine.infer(profile([[c('ground_type','==',2),
  c('phase_random','==',2),c('order_rate','<=',50)]]));
 assert.equal(x.status,'inferred');
 assert.equal(x.label,'逃げ・先行寄り');
 assert.deepEqual(x.styles,[1,2]);
 assert.deepEqual(x.primaryStyles,[1,2]);
 assert.deepEqual(x.additionalStyles,[]);
 assert.deepEqual(x.styleNames,['逃げ','先行']);
 assert.equal(x.branches[0].basisRuleId,'P2-RANK-AT-MOST-50-v1');
 assert.equal(x.branches[0].timingContext.latestPossibleRate,0.83333333);
 assert.equal(x.branches[0].timingContext.includesFinalPhase,true);
 assert.match(x.branches[0].timingContext.note,/進出余地/);
 assert.equal(x.ruleVersion,'rank-phase-style-v3');
 assert.equal(Object.hasOwn(x,'probability'),false);
});
test('first half versus whole final phase changes timing evidence, not unsupported suitability tags',()=>{
 const early=engine.infer(profile([[
  c('phase_firsthalf_random','==',2),c('order_rate','<=',50)]]));
 assert.equal(early.status,'inferred');
 assert.deepEqual(early.styles,[1,2]);
 assert.equal(early.branches[0].timingContext.latestPossibleRate,0.75);
 const entire=engine.infer(profile([[
  c('phase_random','==',2),c('order_rate','<=',50)]]));
 assert.equal(entire.status,'inferred');
 assert.deepEqual(entire.styles,[1,2]);
 assert(entire.branches[0].timingContext.latestPossibleRate >
  early.branches[0].timingContext.latestPossibleRate);
 const late=engine.infer(profile([[
  c('phase_laterhalf_random','==',2),c('order_rate','<=',50)]]));
 assert.equal(late.status,'inferred');
 assert.deepEqual(late.styles,[1,2]);
 assert.equal(late.branches[0].timingContext.windows[0].startRate,0.75);
 const deterministic=engine.infer(profile([[
  c('phase','==',2),c('order_rate','<=',50)]]));
 assert.deepEqual(deterministic.styles,[1,2]);
 assert.equal(deterministic.branches[0].timingContext.windows[0].randomWindow,false);
 assert.equal(deterministic.branches[0].timingContext.latestPossibleRate,0.83333333);
 const mid=engine.infer(profile([middle('<=',50)]));
 assert.deepEqual(mid.styles,[1,2]);
 assert.equal(mid.branches[0].timingContext.includesFinalPhase,false);
});
test('OR branches with the same rank direction remain coherent while retaining distinct windows',()=>{
 const mixed=engine.infer(profile([
  [c('phase_firsthalf_random','==',2),c('order_rate','<=',50)],
  [c('phase_random','==',2),c('order_rate','<=',50)]
 ]));
 assert.equal(mixed.status,'inferred');
 assert.deepEqual(mixed.styles,[1,2]);
 assert.equal(mixed.branches.length,2);
 assert.notEqual(mixed.branches[0].timingContext.latestPossibleRate,
  mixed.branches[1].timingContext.latestPossibleRate);
 const uniform=engine.infer(profile([
  [c('ground_type','==',2),c('phase_random','==',2),c('order_rate','<=',50)],
  [c('distance_type','==',2),c('phase_random','==',2),c('order_rate','<=',50)]
 ]));
 assert.equal(uniform.status,'inferred');
 assert.deepEqual(uniform.styles,[1,2]);
});
test('late stage itself is not reason to refuse a behind-half qualitative tendency',()=>{
 const got=engine.infer(profile([[c('phase_random','==',3),c('order_rate','>',50)]]));
 assert.equal(got.status,'inferred');
 assert.deepEqual(got.styles,[3,4]);
});
test('40%-or-lower-from-back spans both halves and must not become rear-only',()=>{
 for(const row of [
  [c('phase_random','==',1),c('order_rate','>=',40)],
  [c('phase','==',1),c('order_rate','>=',30),c('order_rate','<=',80)],
  [c('phase_random','==',1),c('order_rate','>',40)]
 ]){
  const x=engine.infer(profile([row]));
  assert.equal(x.status,'needs-review');
  assert.equal(x.reason,'not-all-or-branches-inferable');
  assert.equal(x.branches[0].reasons[0],'rank-band-overlaps-or-ambiguous');
 }
});
test('additional overtaking or blocked condition postpones inference, not falsely simple',()=>{
 const got=engine.infer(profile([[...end('>',50),c('is_overtake','==',1)]]));
 assert.equal(got.status,'needs-review');
 assert(got.branches[0].reasons.includes('additional-opportunity-conditions'));
});
test('two OR alternatives with identical tendency may be aggregated, not flattened',()=>{
 const got=engine.infer(profile([
  [c('distance_type','==',1),c('phase','>=',2),c('order_rate','>',50)],
  [c('distance_type','==',2),c('phase_random','==',2),c('order_rate','>',50)]
 ]));
 assert.equal(got.status,'inferred');
 assert.deepEqual(got.styles,[3,4]);
 assert.equal(got.branches.length,2);
 assert.deepEqual(got.branches.map(b=>b.orIndex),[0,1]);
});
test('different OR branch direction or rank-free alternative cannot produce skill-wide tendency',()=>{
 const split=engine.infer(profile([middle('<=',50),end('>',50)]));
 assert.equal(split.status,'needs-review');
 assert.equal(split.reason,'different-or-branch-style-tendencies');
 assert.deepEqual(split.branches.map(b=>b.status),['inferred-branch','inferred-branch']);
 const unknown=engine.infer(profile([middle('<=',50),[c('is_overtake','==',1)]]));
 assert.equal(unknown.status,'needs-review');
 assert.equal(unknown.reason,'not-all-or-branches-inferable');
});
test('source-defined explicit style remains explicit-only, never extrapolated',()=>{
 const row=[c('running_style','==',1),...middle('<=',50)];
 const p=engine.infer(profile([row]));
 assert.equal(p.status,'explicit-only');
 assert.deepEqual(p.styles,[]);
 const p2=engine.infer(profile([middle('<=',50)],
  [[c('running_style','==',1)],[c('running_style','==',2)]]));
 assert.equal(p2.status,'explicit-only');
 assert.equal(p2.hasExplicitStyleConstraint,true);
});
test('multiple invokes and other preconditions are not flattened into inferred whole skill',()=>{
 const several=engine.infer(profile([middle('<=',50)],[],[invoke([end('>',50)],[],1)]));
 assert.equal(several.status,'needs-review');
 assert.equal(several.reason,'multiple-invokes-not-merged');
 const pre=engine.infer(profile([middle('<=',50)],[[c('is_overtake','==',1)]]));
 assert.equal(pre.status,'needs-review');
 assert(pre.branches[0].reasons.includes('preconditions-not-interpreted'));
});
test('course geometry and intersecting, impossible source rank conditions are not inferred',()=>{
 const course=engine.infer(profile([[
  c('phase_corner_random','==',1),c('order_rate','<=',50)
 ]]));
 assert.equal(course.status,'needs-review');
 assert(course.branches[0].reasons.includes('course-shape-dependent-timing'));
 const impossible=engine.infer(profile([[
  c('phase_random','==',1),c('order_rate','>',50),c('order_rate','<=',50)
 ]]));
 assert.equal(impossible.status,'needs-review');
});
test('metadata attach is read-only to hint/event data; unknown remains unknown',()=>{
 const skills=[
  {id:'skill:1',activationProfile:profile([middle('<=',50)])},
  {id:'skill:2',activationProfile:profile([end('>',50)])},
  {id:'skill:3',activationProfile:profile([[c('running_style','==',3)]])},
  {id:'hint:unknown',activationProfile:{status:'unavailable',invokes:[]}}
 ];
 const m={skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
  cards:[{id:'300',events:[{id:'evt',rewards:[{skillId:'skill:1'}]}]}],
  meta:{}};
 const before=JSON.stringify(m.cards);
 const result=engine.attach(m);
 assert.equal(result.total,4);
 assert.equal(result.inferred,2);
 assert.equal(result.front,1);
 assert.equal(result.back,1);
 assert.equal(result.explicitOnly,1);
 assert.equal(result.unavailable,1);
 assert.equal(JSON.stringify(m.cards),before);
 assert.equal(m.skills[3].activationTendency.status,'unavailable');
});
test('attach is atomic if a malformed source record appears after a good skill',()=>{
 const skills=[
  {id:'skill:1',activationProfile:profile([middle('<=',50)])},
  {id:'skill:2',activationProfile:profile([[{type:'order_rate',operator:'??',value:50},
   c('phase_random','==',1)]])}
 ];
 const m={skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),meta:{}};
 assert.throws(()=>engine.attach(m),/Invalid source condition row/);
 assert.equal(Object.hasOwn(skills[0],'activationTendency'),false);
});
