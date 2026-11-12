'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const bridge=require('../src/skill_source_rank_tick_bridge.cjs');
const rankStage=require('../tools/globalsim_change_order_skill_tick.cjs');
const joint=require('../tools/globalsim_p2_15_source_rank_distance_ticks.cjs');
const src=require('../tools/globalsim_p2_15_source_distance_rate_ticks.cjs');
const mon=require('../src/skill_source_whole_tick_monitor.cjs');
const OP=32;
const pack=(a,b,c,d,e,f)=>[a,b,c,d,e,f].reduce((s,v)=>s*OP+v,0);
const p=(type,operator,value)=>({type,operator,value});
const fixture=()=>{
 const n=9,seed=123,course={id:10502,distance:1600,
  distanceType:2,surface:'turf'};
 const plan={seed,fieldSize:n,course,scenario:'balanced',mode:'equal',
  strategies:['Nige','Nige','Senkou','Senkou','Sasi','Sasi','Sasi','Oikomi','Oikomi']};
 const original={seed,skillEvents:[],frames:[]};
 const position={seed,skillEvents:[],frames:[]};
 const rank={seed,skillEvents:[],frames:[]};
 for(let t=0;t<3;t++){
  const fA={t,horses:[]},fP={t,horses:[]},fR={t,horses:[]};
  for(let i=0;i<n;i++){
   const now=101-i*10+t*1.0,initial=[now,13.5,100,0.2,0,-1];
   const p1=101-i*10+(t-1)*1.0,k=i+1;
   const pi=t?[[...initial.slice(0,4),p1,p1]]:[[...initial]];
   const ri=t?[...initial.slice(0,4),0,pack(k,t===1?0:k,k,t===1?0:k,k,k)]:
    initial.slice();
   fA.horses.push(initial);fP.horses.push(pi[0]);fR.horses.push(ri);
  }
  original.frames.push(fA);position.frames.push(fP);rank.frames.push(fR);
 }
 return {plans:[plan],original:[original],positions:[position],ranks:[rank]};
};
test('original GlobalSim rank cached directly at both skill priorities; three physical replays identical',()=>{
 const x=fixture();
 const ev=bridge.buildEvidence(x.plans,x.original,x.positions,x.ranks);
 assert.equal(ev.status,bridge.STATUS);
 assert.equal(ev.totals.modelFrames,3);
 assert.equal(ev.totals.modelPriorityPositionPairsMatched,18);
 assert.equal(ev.totals.rankPriorityPairsMatched,18);
 assert.equal(ev.totals.positionalProbePhysicalValuesMatched,108);
 assert.equal(ev.totals.rankProbePhysicalValuesMatched,108);
 assert.equal(ev.totals.rankFollowingPreviousPostCacheMatched,9);
 assert.equal(ev.totals.firstPriorityPreviousRankZero,9);
 assert.equal(ev.totals.firstUnobservedFrameHeld,9);
 assert.deepEqual(ev.rankByRace[0][0],Array(9).fill(null));
 assert.equal(ev.rankByRace[0][1][3],4);
 assert.equal(bridge.validateEvidence(ev,x.plans),true);
 assert.equal(ev.gates.sourceRankPercentGameSemanticsIndependentlyVerified,false);
});
test('original order_rate thresholds use documented 9/12 mapping and original operator at exact source index',()=>{
 const ast=mon.compile({status:'source-structure',sourceNumericId:'200701',
  invokes:[{index:0,conditions:[[p('order_rate','>',50),
   p('order_rate','<=',80),p('distance_rate','>=',20)]],
   preConditions:[[p('order_rate','>=',40)]]}]});
 const conditions=bridge.observedOrderRateFacts(ast,6,9);
 assert.deepEqual(conditions.map(x=>[
  x.side,x.orIndex,x.predicateIndex,x.satisfied]),[
  ['conditions',0,0,true],['conditions',0,1,true],
  ['preConditions',0,0,true]]);
 assert.equal(bridge.observedOrderRateFacts(ast,5,9)[0].satisfied,false);
 assert.equal(bridge.observedOrderRateFacts(ast,7,12)[0].satisfied,true);
 assert.deepEqual(bridge.observedOrderRateFacts(ast,null,9),[]);
 assert.throws(()=>bridge.observedOrderRateFacts(ast,19,9),/rank outside/);
});
test('position, previous rank-cache and priority order mismatches are fatal, never silently interpreted',()=>{
 const x=fixture();
 const pbad=structuredClone(x.positions);
 pbad[0].frames[1].horses[1][5]+=1;
 assert.throws(()=>bridge.buildEvidence(x.plans,x.original,pbad,x.ranks),
  /position stages differ/);
 const rbad=structuredClone(x.ranks);
 const k=2;
 rbad[0].frames[2].horses[1][5]=pack(k,k,k+1,k,k,k);
 assert.throws(()=>bridge.buildEvidence(x.plans,x.original,x.positions,rbad),
  /rank stage is not identical/);
 const previous=structuredClone(x.ranks);
 previous[0].frames[2].horses[1][5]=pack(1,1,1,1,1,1);
 assert.throws(()=>bridge.buildEvidence(x.plans,x.original,x.positions,previous),
  /rank cache changed/);
 const physics=structuredClone(x.ranks);
 physics[0].frames[2].horses[1][2]=99;
 assert.throws(()=>bridge.buildEvidence(x.plans,x.original,x.positions,physics),
  /observer changed original GlobalSim physics/);
});
test('same-runner same-tick rank data resolves original skill AND, preserving true/false/unknown',()=>{
 const x=fixture();
 const profile={status:'source-structure',sourceNumericId:'200701',
  invokes:[{index:0,conditions:[[p('running_style','!=',4),
   p('distance_rate','>=',1),p('order_rate','<=',50)]],
   preConditions:[]}]};
 const model=joint.analyze(x.plans,x.original,x.positions,x.ranks,[profile]);
 assert.equal(model.status,joint.STATUS);
 assert.equal(model.comparison.sourceWithOrderRate,1);
 assert.equal(model.comparison.sourceOrderRatePredicateOccurrences,1);
 assert.equal(model.comparison.originalModelPriorityRunnerTicks,18);
 assert.equal(model.comparison.recordedRankPredicateFacts,18);
 assert.deepEqual(model.comparison.sourceConditionSkillRunnerTickChanges,
  {true:14,false:4,unknown:-18});
 assert.equal(model.comparison.originalObservedSourceConditionRunnerRaces[
  'observed-unknown-without-true'],9);
 assert.equal(model.comparison.rankJoinedObservedSourceConditionRunnerRaces[
  'observed-at-least-once-true'],7);
 assert.equal(model.comparison.rankJoinedObservedSourceConditionRunnerRaces[
  'observed-all-false'],2);
 assert.equal(model.gates.sourceOrderRateGameSemanticsValidated,false);
 assert.equal(model.gates.P3CardScoringApproved,false);
 assert.equal(model.bySkillStyle.length,4);
});
test('invalid source rank evidence cannot enter full-skill monitor',()=>{
 const x=fixture();
 const e=bridge.buildEvidence(x.plans,x.original,x.positions,x.ranks);
 e.rankByRace[0][1][1]=30;
 assert.throws(()=>bridge.validateEvidence(e,x.plans),/out-of-range or forged/);
 assert.throws(()=>joint.compare({status:'unknown'}, {status:'bad'}, e),
  /wrong source-condition/);
});
test('fixed source order_rate is ignored by UmaSim checker, not called original runtime measurement',()=>{
 assert.equal(bridge.MODEL_PIN,rankStage.PIN);
 assert.equal(bridge.STATUS,'P2.15-independent-GlobalSim-priority-rank-evidence-not-game');
 assert.match(bridge.observedOrderRateFacts.toString(),/bounds\.cutoff/);
});
