'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const corner=require('../src/skill_source_corner_stage_facts.cjs');
const rank=require('../src/skill_source_rank_tick_bridge.cjs');
const full=require('../src/skill_source_whole_tick_monitor.cjs');
const pos=require('../src/skill_source_position_stage_facts.cjs');
const distance=require('../tools/globalsim_p2_15_source_distance_rate_ticks.cjs');
const joined=require('../tools/globalsim_p2_15_source_rank_position_full_join.cjs');
const OP=32;
const pack=(a,b,c,d,e,f)=>[a,b,c,d,e,f].reduce((s,v)=>s*OP+v,0);
const pred=(type,operator,value)=>({type,operator,value});
const courseIds=[10502,10504];
const geometry={
 '10502':{raceTrackId:10005,distance:1600,surface:1,distanceType:2,
  corners:[{start:50,length:450},{start:700,length:350},{start:1050,length:240}]},
 '10504':{raceTrackId:10005,distance:2000,surface:1,distanceType:3,
  corners:[{start:100,length:300},{start:450,length:350},
   {start:1050,length:300},{start:1400,length:300}]}
};
function evidence(){
 const src={'10005':{courses:Object.fromEntries(courseIds.map(id=>[
  String(id),geometry[String(id)]]))}};
 const kotlin='internal val rawCourseData = """'+JSON.stringify(src)+'""".trimIndent()';
 return {data:kotlin,model:JSON.stringify(geometry),
  state:corner.STATE_ANCHORS.join('\n')+' '.repeat(1200),
  checker:corner.CHECKER_ANCHOR+' '.repeat(1200)};
}
function fixture(source){
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
 const ps=pos.verifyPinnedSources(pos.CHECKER_ANCHORS.join('\n')+' '.repeat(1200),
  pos.STATE_ANCHORS.join('\n')+' '.repeat(1200),
  pos.CALCULATOR_ANCHORS.join('\n')+' '.repeat(1200));
 const cdata=evidence();
 const cs=corner.verifyPinnedSources(cdata.state,cdata.checker,
  cdata.data,cdata.model);
 return {plans:[plan],original:[a],positions:[b],ranks:[c],
  profiles:source,ps,cs};
}
test('source corner is last-four offset, including noncorner zero, not index+1',()=>{
 const e=evidence(),c=corner.verifyPinnedSources(e.state,e.checker,e.data,e.model);
 corner.validateEvidence(c,[{course:{id:10502,distance:1600}}]);
 assert.equal(c.verifiedCourseIds.length,2);
 const course=c.verifiedCourses['10502'];
 assert.equal(corner.atModelPosition(100,course),2);
 assert.equal(corner.atModelPosition(780,course),3);
 assert.equal(corner.atModelPosition(1180,course),4);
 assert.equal(corner.atModelPosition(600,course),0);
 assert.equal(corner.atModelPosition(50,course),null);
 assert.equal(corner.atModelPosition(500,course),null);
 assert.equal(corner.atModelPosition(1050,course),null);
 assert.equal(corner.atModelPosition(1600,course),null);
 assert.equal(corner.atModelPosition(-1,course),null);
 const four=c.verifiedCourses['10504'];
 assert.equal(corner.atModelPosition(200,four),1);
 assert.equal(corner.atModelPosition(500,four),2);
 assert.equal(corner.atModelPosition(1100,four),3);
 assert.equal(corner.atModelPosition(1500,four),4);
});
test('pinned source and model course geometry drift rejects all projection',()=>{
 const e=evidence();
 assert.throws(()=>corner.verifyPinnedSources(e.state.replace('indexOfFirst','indexOfLast'),
  e.checker,e.data,e.model),/cornerNumber changed/);
 const wrong=JSON.parse(e.model);wrong['10502'].corners[0].length++;
 assert.throws(()=>corner.verifyPinnedSources(e.state,e.checker,e.data,
  JSON.stringify(wrong)),/geometry mismatch/);
 const c=corner.verifyPinnedSources(e.state,e.checker,e.data,e.model);
 assert.throws(()=>corner.validateEvidence(c,[{course:{id:11202,distance:1600}}]),
  /unverified fixed course/);
 assert.throws(()=>corner.validateEvidence({...c,originalUmaSimPositionObserved:true},
  [{course:{id:10502,distance:1600}}]),/unverified pinned/);
});
test('original corner predicate identity, comparison and preConditions are kept',()=>{
 const compiled=full.compile({status:'source-structure',sourceNumericId:'200001',
  invokes:[{index:0,conditions:[[
   pred('corner','==',2),pred('corner','!=',0),
   pred('order','<=',3)]],preConditions:[[pred('corner','>=',2)]]}]});
 const e=evidence();
 const c=corner.verifyPinnedSources(e.state,e.checker,e.data,e.model);
 assert.equal(c.status,corner.STATUS);
 const obs=corner.observations(compiled,100,c.verifiedCourses['10502']);
 assert.deepEqual(obs.map(x=>[x.side,x.predicateIndex,x.satisfied]),[
  ['conditions',0,true],['conditions',1,true],['preConditions',0,true]]);
 assert.equal(corner.observations(compiled,50,c.verifiedCourses['10502']).length,0);
});
test('corner same-tick AND enriches existing direct rank/position evidence monotonically',()=>{
 const profile={status:'source-structure',sourceNumericId:'200001',
  invokes:[{index:0,conditions:[[
   pred('running_style','==',1),pred('distance_rate','>=',1),
   pred('phase','==',0),pred('order_rate','<=',50),
   pred('order','<=',1),pred('corner','==',2)
  ]],preConditions:[]}]};
 const f=fixture([profile]);
 const ranks=rank.buildEvidence(f.plans,f.original,f.positions,f.ranks);
 const before=distance.analyze(f.plans,f.original,f.positions,f.profiles,
  {rankEvidence:ranks,positionSourceEvidence:f.ps,includeAbsoluteOrder:true,
   unknownRouteTriage:true});
 const after=distance.analyze(f.plans,f.original,f.positions,f.profiles,
  {rankEvidence:ranks,positionSourceEvidence:f.ps,includeAbsoluteOrder:true,
   unknownRouteTriage:true,cornerSourceEvidence:f.cs});
 assert.equal(before.raceOpportunity.totals.verdicts['observed-at-least-once-true'],0);
 assert.equal(after.raceOpportunity.totals.verdicts['observed-at-least-once-true'],1);
 assert.equal(after.raceOpportunity.totals.verdicts['observed-unknown-without-true'],0);
 assert.equal(after.raceOpportunity.totals.verdicts['observed-all-false'],8);
 assert.equal(after.denominators.sourceCornerPredicateOccurrences,1);
 assert.equal(after.totals.modelSourceCornerPredicateFacts,18);
 assert.equal(after.gates.actualOriginalUmaSimCornerRuntimeObserved,false);
 const comparison=joined.compareCorner(before,after);
 assert.equal(comparison.sourceSkillsWithCorner,1);
 assert.equal(comparison.changedOriginalSkillStyleCells,1);
 assert.equal(comparison.actualSourceSkillProcObserved,false);
 assert.equal(comparison.gameRate,null);
});
test('unknown historical precondition and unrelated AND remain unknown with corner available',()=>{
 const profile={status:'source-structure',sourceNumericId:'200002',
  invokes:[{index:0,conditions:[[
   pred('distance_rate','>=',1),pred('corner','==',2),
   pred('order','<=',3),pred('is_overtake','==',1)
  ]],preConditions:[[pred('corner','==',4)]]}]};
 const f=fixture([profile]);
 const result=joined.analyze(f.plans,f.original,f.positions,f.ranks,
  f.profiles,f.ps,f.cs);
 assert.equal(result.gates.actualOriginalUmaSimCornerStateDirectlyObserved,false);
 assert.equal(result.cornerComparison.afterRunnerRaceVerdicts[
  'observed-at-least-once-true'],0);
 assert(result.cornerComparison.afterRunnerRaceVerdicts[
  'observed-unknown-without-true']>0);
 assert.equal(result.gates.historicalPreconditionsStillTernary,true);
 assert.equal(result.gates.P3CardScoringApproved,false);
});
