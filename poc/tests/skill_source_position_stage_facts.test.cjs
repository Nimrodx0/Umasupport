'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const bridge=require('../src/skill_source_position_stage_facts.cjs');
const original=require('../src/skill_source_whole_tick_monitor.cjs');
const distance=require('../tools/globalsim_p2_15_source_distance_rate_ticks.cjs');
const joint=require('../tools/globalsim_p2_15_source_position_families_ticks.cjs');
const pred=(type,operator,value)=>({type,operator,value});
const skill=(id,invokes)=>({status:'source-structure',sourceNumericId:id,
 invokes:invokes.map((x,index)=>({index,conditions:x.conditions,
  preConditions:x.preConditions??[]}))});
const iv=(conditions,preConditions=[])=>({conditions,preConditions});
function verified(){
 const pad='\n'+'.'.repeat(1300);
 return bridge.verifyPinnedSources(
  bridge.CHECKER_ANCHORS.join('\n')+pad,
  bridge.STATE_ANCHORS.join('\n')+pad,
  bridge.CALCULATOR_ANCHORS.join('\n')+pad);
}
function fixture(){
 const plan={seed:101,fieldSize:2,scenario:'balanced',mode:'equal',course:{
  id:10502,distance:1600,distanceType:2,surface:'turf'
 },strategies:['Nige','Senkou']};
 const row=x=>[x,12,100,0,0,0];
 const frames=[
  {t:0,horses:[row(191.25),row(400.75)]},
  {t:1,horses:[row(350.25),row(550.75)]},
  {t:2,horses:[row(600.25),row(700.75)]}
 ];
 const control={seed:101,skillEvents:[],frames};
 const probe=structuredClone(control);
 for(let t=1;t<frames.length;t++)for(let i=0;i<plan.fieldSize;i++){
  probe.frames[t].horses[i][4]=frames[t-1].horses[i][0];
  probe.frames[t].horses[i][5]=frames[t-1].horses[i][0];
 }
 const source=skill('555000',[iv([
  [pred('running_style','==',1),pred('distance_rate','>=',10),
   pred('phase','==',0)],
  [pred('running_style','==',1),pred('distance_rate','>=',10),
   pred('remain_distance','<=',1300)]],
  [[pred('furlong','==',0)]])]);
 return {plans:[plan],control:[control],probe:[probe],source:[source]};
}
test('fixed original source identifiers and five formulas are independently anchored',()=>{
 const evidence=verified();
 assert.equal(evidence.originalUmaSimRevision,bridge.ORIGINAL_REV);
 assert.equal(evidence.status,bridge.STATUS);
 assert.deepEqual(evidence.verifiedPredicateTypes,[
  'phase','phase_firsthalf','phase_laterhalf','remain_distance','furlong']);
 assert.equal(evidence.modelPositionIsOriginalUmaSimStartPosition,false);
 assert(bridge.verifyEvidence(evidence));
 assert.throws(()=>bridge.verifyEvidence({...evidence,
  modelPositionIsOriginalUmaSimStartPosition:true}),/unverified/);
 assert.throws(()=>bridge.verifyPinnedSources(
  bridge.CHECKER_ANCHORS.join('\n').replaceAll('currentPhase','noPhase')+'x'.repeat(1400),
  bridge.STATE_ANCHORS.join('\n')+'y'.repeat(1400),
  bridge.CALCULATOR_ANCHORS.join('\n')+'z'.repeat(1400)),
  /source position formulas: fixed original/);
});
test('phase and half phase follow the source startPosition formulas, not simple 2/3 phase split',()=>{
 const z=bridge.derivedAtModelPosition;
 assert.deepEqual(z(200.25,1600),{
  phase:0,phase_firsthalf:-1,phase_laterhalf:0,
  remain_distance:1399,furlong:1
 });
 assert.equal(z(99.25,1600).phase_firsthalf,0);
 assert.equal(z(500.25,1600).phase,1);
 assert.equal(z(500.25,1600).phase_firsthalf,1);
 assert.equal(z(900.25,1600).phase_laterhalf,1);
 assert.equal(z(900.25,1600).phase_firsthalf,-1);
 assert.equal(z(1150.25,1600).phase,2);
 assert.equal(z(1500.25,1600).phase,3);
});
test('numeric model-vs-Double boundaries are held rather than imputed',()=>{
 const b=bridge.derivedAtModelPosition(1600/6,1600);
 assert.equal(b.phase,null);
 assert.equal(b.phase_firsthalf,null);
 assert.equal(b.phase_laterhalf,null);
 const half=bridge.derivedAtModelPosition(1600/12,1600);
 assert.equal(half.phase_firsthalf,null);
 assert.equal(half.phase_laterhalf,null);
 assert.equal(bridge.derivedAtModelPosition(400,1600).furlong,null);
 assert.equal(bridge.derivedAtModelPosition(350,1600).remain_distance,null);
 const out=bridge.derivedAtModelPosition(-1,1600);
 assert(Object.values(out).every(x=>x===null));
 assert.throws(()=>bridge.derivedAtModelPosition(NaN,1600),/invalid/);
 assert.throws(()=>bridge.derivedAtModelPosition(100,0),/invalid/);
});
test('source AST identities, comparisons and preconditions preserve their original terms',()=>{
 const x=skill('555000',[iv([
  [pred('phase','==',1),pred('phase_firsthalf','==',1),
   pred('phase_laterhalf','!=',1),pred('remain_distance','>=',1050),
   pred('furlong','==',2),pred('is_overtake','==',1)]
 ],[[pred('furlong','>=',2)]])]);
 const ast=original.compile(x);
 const fs=bridge.observations(ast,500.25,1600);
 assert.equal(fs.length,6);
 assert(fs.every(x=>x.invokeOffset===0&&
  x.type!=='is_overtake'&&x.satisfied===true));
 assert.deepEqual(fs.map(x=>x.side),[
  'conditions','conditions','conditions','conditions','conditions','preConditions']);
 assert.deepEqual(fs.map(x=>x.predicateIndex),[0,1,2,3,4,0]);
 assert.equal(bridge.observations(ast,1600/6,1600)
  .filter(x=>x.type==='phase').length,0);
 assert.throws(()=>bridge.observations({},500,1600),/compiled original/);
});
test('five new source facts join the SAME runner and priority tick and improve three-valued source logic only',()=>{
 const f=fixture();
 const baseline=distance.analyze(f.plans,f.control,f.probe,f.source);
 const out=joint.analyze(f.plans,f.control,f.probe,f.source,verified());
 assert.equal(out.status,joint.STATUS);
 assert.equal(out.validation.modelRunnerPriorityTicks,4);
 assert.equal(out.comparison.sourceSkillCount,1);
 assert(out.comparison.emittedModelSourcePredicateFacts>0);
 assert(out.comparison.sourceWholeConditionSkillRunnerTickChanges.true>0);
 assert(out.comparison.sourceWholeConditionSkillRunnerTickChanges.unknown<0);
 assert.equal(out.comparison.baselineRunnerRaceVerdicts['observed-at-least-once-true'],0);
 assert.equal(out.comparison.joinedRunnerRaceVerdicts['observed-at-least-once-true'],1);
 assert.equal(out.comparison.joinedRunnerRaceVerdicts['observed-unknown-without-true'],1);
 assert.equal(out.gates.sourceOriginalFiveFormulasPinned,true);
 assert.equal(out.gates.originalSourceFullANDMeasured,false);
 assert.equal(out.comparison.gameRate,null);
 assert.equal(out.comparison.P3Score,null);
 assert.equal(baseline.gates.P3CardScoringApproved,false);
});
test('unobserved source AND conditions and initial historical precondition latch stay unknown',()=>{
 const f=fixture();
 f.source=[skill('555001',[iv([[pred('distance_rate','>=',10),
  pred('phase','==',0),pred('is_overtake','==',1)]],
  [[pred('remain_distance','<',300)]])])];
 const a=joint.analyze(f.plans,f.control,f.probe,f.source,verified());
 assert.equal(a.comparison.joinedRunnerRaceVerdicts['observed-at-least-once-true'],0);
 assert.equal(a.gates.actualGameSkillProcRateMeasured,false);
 const changed=structuredClone(f.probe);
 changed[0].frames[1].horses[0][4]+=1;
 assert.throws(()=>joint.analyze(f.plans,f.control,changed,f.source,verified()),
  /priority-1\/0 position stages do not match/);
 assert.throws(()=>joint.analyze(f.plans,f.control,f.probe,f.source,{
  ...verified(),originalUmaSimRaceStateObserved:true}),/unverified/);
});
