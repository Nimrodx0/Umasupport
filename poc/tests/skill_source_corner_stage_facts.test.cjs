'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const source=require('../src/skill_source_corner_stage_facts.cjs');
const logic=require('../src/skill_source_whole_tick_monitor.cjs');
const rank=require('../src/skill_source_rank_tick_bridge.cjs');
const position=require('../src/skill_source_position_stage_facts.cjs');
const distance=require('../tools/globalsim_p2_15_source_distance_rate_ticks.cjs');
const combined=require('../tools/globalsim_p2_15_source_corner_full_join.cjs');
const pred=(type,operator,value)=>({type,operator,value});
const profile=(id,conditions,preConditions=[])=>({
 status:'source-structure',sourceNumericId:id,
 invokes:[{index:0,conditions,preConditions}]});
const cs={
 10502:{distance:1600,distanceType:2,surface:1,raceTrackId:10005,
  corners:[{start:50,length:450},{start:700,length:350},
   {start:1050,length:240}]},
 10504:{distance:2000,distanceType:3,surface:1,raceTrackId:10005,
  corners:[{start:375,length:250},{start:625,length:250},
   {start:1200,length:250},{start:1450,length:240}]}
};
function evidence(){
 const original={'10005':{name:'東京',courses:cs}};
 const raw='internal val rawCourseData = """\n'+JSON.stringify(original,null,2)+
  '\n"""'+' '.repeat(30001);
 const mod=JSON.stringify(Object.fromEntries(Object.entries(cs).map(([k,c])=>
  [k,{...c,corners:c.corners.map(x=>({length:x.length,start:x.start}))}])));
 return source.verifyPinnedSources(
  source.SOURCE_CHECKER_ANCHORS.join('\n')+'x'.repeat(1300),
  source.SOURCE_STATE_ANCHORS.join('\n')+'x'.repeat(1300),
  raw,mod);
}
function phaseEvidence(){
 return position.verifyPinnedSources(
  position.CHECKER_ANCHORS.join('\n')+'x'.repeat(1300),
  position.STATE_ANCHORS.join('\n')+'x'.repeat(1300),
  position.CALCULATOR_ANCHORS.join('\n')+'x'.repeat(1300));
}
test('source-pinned original and model 10502/10504 corner intervals are compared numerically',()=>{
 const e=evidence();
 assert.equal(e.status,source.STATUS);
 assert.equal(e.originalUmaSimRevision,source.REV);
 assert.equal(e.exactCourseCornersMatched,true);
 assert.deepEqual(e.courseIds,['10502','10504']);
 assert(source.validateEvidence(e));
 const changed=structuredClone(e);
 changed.courses['10502'].corners[0].start=-1;
 assert.throws(()=>source.validateEvidence(changed),/invalid or unsorted corner/);
});
test('3-corner source numbering is 2/3/4, not chronological 1/2/3, outside is 0',()=>{
 const c=evidence().courses['10502'];
 for(const [pos,value] of [[0,0],[10,0],[100,2],[499.7,2],
  [650,0],[701,3],[1049,3],[1050.3,4],[1289,4],[1400,0]]){
  assert.equal(source.numberAtModelPosition(pos,c),value,'position='+pos);
 }
 for(const pos of [50,500,1050,1290,1600,-1,700+1e-7]){
  assert.equal(source.numberAtModelPosition(pos,c),null);
 }
});
test('4-corner source numbering is 1/2/3/4 with same original interval boundaries',()=>{
 const c=evidence().courses['10504'];
 for(const [pos,value] of [[100,0],[400,1],[700,2],[1210,3],
  [1500,4],[1790,0]])assert.equal(source.numberAtModelPosition(pos,c),value);
});
test('original corner predicate identities, comparators and precondition row preserved',()=>{
 const e=evidence();
 const ast=logic.compile(profile('120100',[[
  pred('corner','==',2),pred('corner','!=',3),pred('corner','>=',1),
  pred('distance_rate','>=',10)]],[[pred('corner','==',2)]]));
 assert.deepEqual(source.observations(ast,100,10502,e).map(x=>
  [x.side,x.predicateIndex,x.satisfied]),[
   ['conditions',0,true],['conditions',1,true],
   ['conditions',2,true],['preConditions',0,true]]);
 assert.deepEqual(source.observations(ast,500,10502,e),[]);
 assert.throws(()=>source.observations(ast,100,10503,e),/unverified fixed course/);
 assert.throws(()=>source.observations({},100,10502,e),/original full skill AST/);
});
test('corner preCondition TRUE latches historically; early unobserved preState not assumed false',()=>{
 const e=evidence();
 const m=new logic.WholeTickMonitor(profile('120101',[[
  pred('running_style','==',1),pred('distance_rate','>=',10)]],
  [[pred('corner','==',2)]]));
 m.preState=m.preState.map(()=>logic.UNKNOWN);
 for(const [index,pos] of [1,100,650].entries()){
  const facts=source.observations(m.compiled,pos,10502,e);
  const df=[...m.compiled.lookup.values()].filter(x=>
   x.type==='distance_rate').map(x=>({...x,satisfied:true}));
  const r=m.step({tickIndex:index,staticContext:{running_style:1},
   observations:[...facts,...df]});
  assert.equal(r.invokes[0].preconditionLatched,
   index===0?logic.UNKNOWN:logic.TRUE);
  assert.equal(r.overallCondition,index===0?logic.UNKNOWN:logic.TRUE);
 }
});
const OP=32;
const pack=(a,b,c,d,e,f)=>[a,b,c,d,e,f].reduce((s,v)=>s*OP+v,0);
function fixture(profiles){
 const n=9,seed=123;
 const plan={seed,fieldSize:n,course:{id:10502,distance:1600,
  distanceType:2,surface:'turf'},scenario:'balanced',mode:'equal',
  strategies:['Nige','Nige','Senkou','Senkou','Sasi','Sasi','Sasi','Oikomi','Oikomi']};
 const a={seed,skillEvents:[],frames:[]},b=structuredClone(a),
  c=structuredClone(a);
 for(let t=0;t<3;t++){
  const fA={t,horses:[]},fP={t,horses:[]},fR={t,horses:[]};
  for(let i=0;i<n;i++){
   const now=101-i*10+t,previous=now-1,k=i+1;
   const base=[now,13.5,100,0.2,0,-1];
   fA.horses.push([...base]);
   fP.horses.push(t?[...base.slice(0,4),previous,previous]:[...base]);
   fR.horses.push(t?[...base.slice(0,4),t===1?k:0,
    pack(k,t===1?0:k,k,t===1?0:k,k,k)]:[...base]);
  }
  a.frames.push(fA);b.frames.push(fP);c.frames.push(fR);
 }
 return {plans:[plan],original:[a],positions:[b],ranks:[c],
  profiles,positionEvidence:phaseEvidence(),cornerEvidence:evidence()};
}
test('same runner priority rank+position+corner resolves original AND without moving known verdicts',()=>{
 const f=fixture([profile('100201',[[
  pred('running_style','==',1),pred('distance_rate','>=',1),
  pred('phase','==',0),pred('order_rate','<=',50),
  pred('order','<=',1),pred('corner','==',2)]])]);
 const e=rank.buildEvidence(f.plans,f.original,f.positions,f.ranks);
 const opts={rankEvidence:e,positionSourceEvidence:f.positionEvidence,
  includeAbsoluteOrder:true};
 const before=distance.analyze(f.plans,f.original,f.positions,f.profiles,opts);
 const after=distance.analyze(f.plans,f.original,f.positions,f.profiles,
  {...opts,cornerSourceEvidence:f.cornerEvidence,unknownRouteTriage:true});
 assert.equal(before.raceOpportunity.totals.verdicts['observed-at-least-once-true'],0);
 assert.equal(after.raceOpportunity.totals.verdicts['observed-at-least-once-true'],1);
 assert.equal(after.raceOpportunity.totals.verdicts['observed-all-false'],8);
 assert.equal(after.denominators.sourceCornerSkillsAmongDistanceRate,1);
 assert.equal(after.denominators.sourceCornerPredicateOccurrences,1);
 assert.equal(after.totals.modelSourceCornerPredicateFacts,18);
 const delta=combined.compare(before,after,e,f.cornerEvidence);
 assert.equal(delta.skillStyleCellsWithNewObservations,1);
 assert.equal(delta.actualOriginalUmaSimProcCount,null);
 assert.equal(delta.gameProcRate,null);
 assert.equal(after.gates.realGameCornerSemanticsValidated,false);
});
test('corner cannot manufacture other unknown dynamic AND as true or impersonate original runtime',()=>{
 const f=fixture([profile('100202',[[
  pred('running_style','==',1),pred('distance_rate','>=',1),
  pred('corner','==',2),pred('is_overtake','==',1)]],
  [[pred('corner','==',2)]])]);
 const result=combined.analyze(f.plans,f.original,f.positions,f.ranks,
  f.profiles,f.positionEvidence,f.cornerEvidence);
 assert.equal(result.comparison.afterSourceCornerRunnerRaceVerdicts[
  'observed-at-least-once-true'],0);
 assert(result.comparison.afterSourceCornerRunnerRaceVerdicts[
  'observed-unknown-without-true']>0);
 assert.equal(result.gates.actualGameSkillProcRateMeasured,false);
 assert.equal(result.gates.P3CardScoringApproved,false);
 const forged=structuredClone(f.cornerEvidence);
 forged.modelPositionIsActualUmaSimSimulationPosition=true;
 assert.throws(()=>combined.analyze(f.plans,f.original,f.positions,
  f.ranks,f.profiles,f.positionEvidence,forged),/unverified/);
});
