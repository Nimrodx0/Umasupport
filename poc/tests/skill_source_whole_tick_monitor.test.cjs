'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/skill_source_whole_tick_monitor.cjs');
const p=(type,operator,value)=>({type,operator,value});
const source=invokes=>({status:'source-structure',sourceNumericId:'200701',invokes});
const inv=(conditions,preConditions=[],index=0)=>({index,conditions,preConditions});
const obs=(invokeOffset,side,orIndex,predicateIndex,predicate,satisfied)=>({
 invokeOffset,side,orIndex,predicateIndex,...predicate,satisfied
});
const frame=(tickIndex,staticContext={},observations=[])=>({
 tickIndex,staticContext,observations
});
test('three-valued AND only becomes true when all same-tick source predicates are true',()=>{
 const rank=p('order_rate','>',50),random=p('phase_random','==',2);
 const skill=source([inv([[p('running_style','==',2),rank,random]])]);
 const monitor=new m.WholeTickMonitor(skill);
 const first=monitor.step(frame(0,{running_style:2},[
  obs(0,'conditions',0,1,rank,true)]));
 assert.equal(first.overallCondition,'unknown');
 assert.equal(first.invokes[0].conditionAlternatives[0],'unknown');
 const second=monitor.step(frame(1,{running_style:2},[
  obs(0,'conditions',0,1,rank,false),
  obs(0,'conditions',0,2,random,true)]));
 assert.equal(second.overallCondition,'false');
 const third=monitor.step(frame(2,{running_style:2},[
  obs(0,'conditions',0,1,rank,true),
  obs(0,'conditions',0,2,random,true)]));
 assert.equal(third.overallCondition,'true');
 assert.equal(third.gameProcMeasured,false);
 assert.equal(third.eligibleForP3CardScoring,false);
 assert.equal(third.suitabilityLabel,null);
});
test('AND/OR rows and different Invoke records are never collapsed or multiplied',()=>{
 const a=p('is_overtake','==',1),b=p('is_lastspurt','==',1);
 const skill=source([
  inv([[p('running_style','==',1),a],[p('running_style','==',2),b]],[],5),
  inv([[p('running_style','==',4),a]],[],9)
 ]);
 const track=new m.WholeTickMonitor(skill);
 let r=track.step(frame(0,{running_style:2},[
  obs(0,'conditions',1,1,b,true)]));
 assert.equal(r.overallCondition,'true');
 assert.deepEqual(r.invokes.map(x=>x.conditionConjunction),['true','false']);
 assert.deepEqual(r.invokes[0].conditionAlternatives,['false','true']);
 r=track.step(frame(1,{running_style:2},[
  obs(0,'conditions',1,1,b,false)]));
 assert.equal(r.overallCondition,'false');
 assert.equal(r.everConditionSatisfied,'true');
 assert.deepEqual(r.invokes.map(x=>x.invokeIndex),[5,9]);
});
test('preConditions OR is historical latch, but an unknown historical tick is never overwritten by false',()=>{
 const trigger=p('phase_random','==',1);
 const overtook=p('is_overtake','==',1);
 const prereq=p('order_rate','>=',40);
 const skill=source([inv([[trigger]],[
  [p('running_style','==',3),overtook],
  [p('running_style','==',2),prereq]
 ])]);
 const monitor=new m.WholeTickMonitor(skill);
 let r=monitor.step(frame(0,{running_style:2},[
  obs(0,'conditions',0,0,trigger,true)]));
 assert.equal(r.invokes[0].preconditionNow,'unknown');
 assert.equal(r.invokes[0].preconditionLatched,'unknown');
 assert.equal(r.overallCondition,'unknown');
 r=monitor.step(frame(1,{running_style:2},[
  obs(0,'conditions',0,0,trigger,false),
  obs(0,'preConditions',1,1,prereq,false)]));
 assert.equal(r.invokes[0].preconditionNow,'false');
 assert.equal(r.invokes[0].preconditionLatched,'unknown');
 assert.equal(r.overallCondition,'false');
 r=monitor.step(frame(2,{running_style:2},[
  obs(0,'conditions',0,0,trigger,false),
  obs(0,'preConditions',1,1,prereq,true)]));
 assert.equal(r.invokes[0].preconditionLatched,'true');
 r=monitor.step(frame(3,{running_style:2},[
  obs(0,'conditions',0,0,trigger,true),
  obs(0,'preConditions',1,1,prereq,false)]));
 assert.equal(r.overallCondition,'true');
 assert.equal(r.invokes[0].preconditionNow,'false');
 assert.equal(r.invokes[0].preconditionLatched,'true');
});
test('source-matched explicit track ID is venue ID; finite context cannot infer nonobserved predicate',()=>{
 const skill=source([inv([[p('track_id','==',10005),
  p('distance_type','>=',3),p('ground_type','==',2),
  p('is_lastspurt','==',1)]])]);
 const unknown=m.run(skill,[frame(0,{track_id:10005,distance_type:4,ground_type:2})]);
 assert.equal(unknown.tallies.unknown,1);
 assert.equal(unknown.actualUmaSimRuntimeObserved,false);
 assert.equal(unknown.skillProcRate,null);
 const blocked=m.run(skill,[frame(0,{track_id:10502,distance_type:4,ground_type:2})]);
 assert.equal(blocked.tallies.false,1);
 const finiteKnown=m.run(source([inv([[p('running_style','!=',4),
  p('ground_condition','<=',2)]])]),[
  frame(0,{running_style:1,ground_condition:1})
 ]);
 assert.equal(finiteKnown.tallies.true,1);
 assert.equal(finiteKnown.eligibleForP3CardScoring,false);
});
test('unknown prerequisite may later resolve to true, but missing current AND cannot',()=>{
 const pre=p('is_overtake','==',1),now=p('phase_random','==',2);
 const track=new m.WholeTickMonitor(source([inv([[now]],[[pre]])]));
 let r=track.step(frame(0,{},[
  obs(0,'preConditions',0,0,pre,true)]));
 assert.equal(r.invokes[0].preconditionLatched,'true');
 assert.equal(r.overallCondition,'unknown');
 r=track.step(frame(1,{},[
  obs(0,'conditions',0,0,now,true)]));
 assert.equal(r.overallCondition,'true');
 const second=new m.WholeTickMonitor(source([inv([[now]],[[pre]])]));
 r=second.step(frame(0,{},[
  obs(0,'conditions',0,0,now,true),
  obs(0,'preConditions',0,0,pre,false)]));
 assert.equal(r.overallCondition,'false');
});
test('source checks an empty AND or empty pre-OR as true but no historical data is synthesized',()=>{
 const a=m.run(source([inv([[]])]),[frame(0)]);
 assert.equal(a.tallies.true,1);
 const b=m.run(source([inv([],[])]),[frame(0)]);
 assert.equal(b.tallies.true,1);
 const c=m.run(source([inv([[p('order_rate','>=',50)]])]),[frame(0)]);
 assert.equal(c.tallies.unknown,1);
});
test('source predicate identity and source comparison operators must match, no forged measurements',()=>{
 const rank=p('order_rate','<=',50);
 const skill=source([inv([[rank]])]);
 const base=new m.WholeTickMonitor(skill);
 assert.throws(()=>base.step(frame(0,{},[
  obs(0,'conditions',0,0,{...rank,operator:'>='},true)])),/does not match/);
 assert.throws(()=>base.step(frame(0,{},[
  obs(0,'conditions',1,0,rank,true)])),/absent source predicate/);
 assert.throws(()=>base.step(frame(0,{},[
  obs(0,'conditions',0,0,rank,true),
  obs(0,'conditions',0,0,rank,false)])),/duplicate observation/);
 assert.throws(()=>base.step(frame(0,{order_rate:50},[
  obs(0,'conditions',0,0,rank,true),
  {invokeOffset:0,side:'conditions',orIndex:0,predicateIndex:2}])),
  /incomplete source predicate observation/);
 const ctx=source([inv([[p('running_style','==',2)]])]);
 assert.throws(()=>m.run(ctx,[frame(0,{running_style:2},[
  obs(0,'conditions',0,0,p('running_style','==',2),false)])]),
  /contradicts explicit race context/);
});
test('reject missing/out-of-order ticks, malformed source and unsupported unknown types',()=>{
 assert.throws(()=>m.compile({status:'unmatched',sourceNumericId:'1',invokes:[]}),
  /complete source profile/);
 assert.throws(()=>m.compile(source([inv([[p('x','===',1)]])])),/invalid original predicate/);
 assert.throws(()=>m.compile(source([inv([[p('x','==',1)]],[],0),null])),/invalid original invoke/);
 const track=new m.WholeTickMonitor(source([inv([[p('x','==',1)]])]));
 assert.throws(()=>track.step(frame(1)),/tickIndex/);
 const r=track.step(frame(0));assert.equal(r.overallCondition,'unknown');
 assert.throws(()=>track.step(frame(0)),/tickIndex/);
 assert.throws(()=>track.step(frame(2)),/tickIndex/);
});
