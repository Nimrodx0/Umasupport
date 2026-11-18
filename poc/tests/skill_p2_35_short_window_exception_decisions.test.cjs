'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const g4=require('../src/skill_p2_35_short_window_exception_decisions.cjs');
const c=(type,operator,value)=>({type,operator,value});
const style=['逃げ','先行','差し','追込'];
function fixture(){
 const orRows=[3,4].map((dist,orIndex)=>({
  invokeIndex:0,orIndex,bandId:'middle30to80',
  phaseIndex:2,timeType:'phase_firsthalf_random',
  direct:false,hasAlternativePaths:true,extraAndTypes:[],
  eligibleStyles:style,
  sourceConditions:[
   c('distance_type','==',dist),c('phase_firsthalf_random','==',2),
   c('order_rate','>=',30),c('order_rate','<=',80)]
 }));
 const rankRow={
  invokeIndex:0,orIndex:0,bandId:'top50',
  phaseIndex:1,timeType:'phase_laterhalf_random',
  direct:false,hasAlternativePaths:false,extraAndTypes:['order'],
  eligibleStyles:style,
  sourceConditions:[
   c('distance_type','==',1),c('phase_laterhalf_random','==',1),
   c('order','>=',2),c('order_rate','<=',50)]
 };
 const family=(p,num)=>({
  invokeIndex:1,invokeOffset:p.invokeIndex,conditionOrIndex:p.orIndex,
  preconditionOrIndex:null,conditionOrCount:num,preconditionOrCount:0,
  hasOtherInvokes:false,finiteCompatibleStyles:style
 });
 const half={status:'P2-source-only-half-phase-rank-feasibility-not-style-rating',
  source:{sha256:g4.SOURCE_SHA},
  baseline:{appSkills:881,sourceMatched:818},
  counts:{halfTimeAndExactBand:87,halfTimeExactBandDirect:75},
  examples:[
   {skillId:'skill:202662',sourceNumericId:'202662',name:'込み上げる熱',
    paths:orRows},
   {skillId:'hint:善後策',sourceNumericId:'200992',name:'善後策',
    paths:[rankRow]}
  ]};
 const rows=[
  {sourceNumericId:'202662',skillId:'skill:202662',
   routeFamilies:orRows.map(p=>family(p,2))},
  {sourceNumericId:'200992',skillId:'hint:善後策',
   routeFamilies:[family(rankRow,1)]}
 ];
 for(let i=0;i<816;i++)rows.push({sourceNumericId:String(300000+i),
  skillId:'skill:'+String(300000+i),routeFamilies:[]});
 const queue={status:'P2.32-source-route-research-selection-not-complete-skill-suitability',
  denominators:{appSkills:881,sourceMatchedSkills:818},
  rows:[...rows,{sourceNumericId:null,skillId:'hint:unknown',routeFamilies:[]}]};
 return {half,queue};
}
test('source-exact mid/long OR becomes mutually exclusive distance eligibility, not a dynamic OR event',()=>{
 const {half,queue}=fixture(),old=JSON.stringify({half,queue});
 const x=g4.audit(half,queue);
 assert.equal(JSON.stringify({half,queue}),old,'do not modify source');
 assert.equal(x.rows[0].decision,'source-logic-adopt-distance-exclusive-OR');
 assert.deepEqual(x.rows[0].permittedDistanceTypes,[3,4]);
 assert.deepEqual(x.rows[0].branches.map(p=>p.distanceType),[3,4]);
 assert.equal(x.rows[0].modelWAndD,'not-calculated-for-this-source-skill');
 assert.equal(x.summary.distinctDistanceORRankTimingMechanisms,1);
 assert.equal(x.summary.productSuitabilityScores,0);
 assert(x.rows.every(p=>p.eligibleForP3CardScoring===false));
});
test('absolute rank>=2 intersects the original top50 integer rank set, cannot reuse top50 W',()=>{
 const {half,queue}=fixture(),x=g4.audit(half,queue).rows[1];
 assert.equal(x.decision,'source-logic-adopt-intersection-but-hold-original-W-D');
 assert.deepEqual(x.projectedRanksByFieldSize[9].sourceConjunctionRankPositions,
  [2,3,4,5]);
 assert.deepEqual(x.projectedRanksByFieldSize[12].sourceConjunctionRankPositions,
  [2,3,4,5,6]);
 assert.deepEqual(x.projectedRanksByFieldSize[9].unrestrictedRankOnly,
  [1,2,3,4,5]);
 assert.equal(x.modelWAndD,'not-calculated-for-conjoined-rank-band');
 assert.equal(x.wholeSkillSuitability,'not-established');
});
test('similar-looking OR containing unknown dynamic AND is not simplified',()=>{
 const {half,queue}=fixture();
 half.examples[0].paths[1].sourceConditions.push(c('is_overtake','==',1));
 half.examples[0].paths[1].extraAndTypes=['is_overtake'];
 const x=g4.audit(half,queue);
 assert.equal(x.rows[0].decision,'hold-other-source-branch-interaction');
 assert.equal(x.summary.otherHeld,1);
});
test('overlapping alternative distance conditions never count as mutually exclusive OR',()=>{
 const {half,queue}=fixture();
 const p=half.examples[0].paths[1];
 p.sourceConditions[0].value=3;
 const x=g4.audit(half,queue);
 assert.equal(x.rows[0].decision,'hold-other-source-branch-interaction');
});
test('source path structure or identity mismatch fails instead of inventing a G4 resolution',()=>{
 const {half,queue}=fixture();
 queue.rows[0].routeFamilies[0].preconditionOrCount=1;
 assert.equal(g4.audit(half,queue).rows[0].decision,
  'hold-other-source-branch-interaction');
 const f=fixture();f.queue.rows[1].skillId='skill:swap';
 assert.throws(()=>g4.audit(f.half,f.queue),/unmatched original/);
 const t=fixture();t.queue.rows[0].routeFamilies.pop();
 assert.throws(()=>g4.audit(t.half,t.queue),/unmatched original/);
});
