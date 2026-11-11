'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../tools/skill_halfphase_two_axis_review.cjs');
const original=require('../tools/globalsim_subphase_random_10m.cjs');
const expanded=require('../tools/globalsim_position_expanded.cjs');
const bands=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const r6=x=>Number(x.toFixed(6));
const STYLES=expanded.STYLES;
const basePoint={Nige:65,Senkou:55,Sasi:30,Oikomi:20};
function fixture(){
 const full=[],split=[];
 const windows=original.WINDOWS.map(x=>x.key);
 for(const windowKey of windows)
  for(const b of bands)
   for(const course of expanded.COURSES)
    for(const n of [9,12])
     for(const mode of expanded.MODES)
      for(const style of STYLES){
       const O=basePoint[style],W=O+5;
       const p={courseId:course.id,fieldSize:n,mode,windowKey,
        bandId:b.id,style,runners:60,pointPercent:O,
        random10mOpportunityPercent:W};
       full.push(p);
       for(const [half,shift] of [['first15',1],['last15',-1]]){
        split.push({...p,runners:30,half,
         pointPercent:O+shift,random10mOpportunityPercent:W+shift});
       }
      }
 const rows=Array.from({length:75},(_,i)=>({
  skillId:'skill:'+String(i+1),
  sourceNumericId:String(200000+i),name:'test skill '+i,
  paths:[{
   direct:true,invokeIndex:0,orIndex:0,
   bandId:'top50',phaseIndex:1,timeType:'phase_firsthalf_random',
   eligibleStyles:['逃げ','先行','差し','追込'],
   extraAndTypes:[],hasAlternativePaths:false,
   sourceConditions:[
    {type:'phase_firsthalf_random',operator:'==',value:1},
    {type:'order_rate',operator:'<=',value:50}]
  }]
 }));
 return {
  short:{schemaVersion:1,status:
   'research-GlobalSim-subphase-random-10m-rank-opportunity-not-game-skill-rate',
   sourceRevision:expanded.PIN,scenario:'balanced',simulations:720,
   seedsPerCell:30,contextsPerWindow:24,perContextRows:full.length,
   windows:original.WINDOWS,contextRows:full},
  split:{schemaVersion:1,status:
   'p2-fixed-15-plus-15-short-window-bands-not-game-activation',
   sourceRevision:expanded.PIN,seedsPerHalf:15,baseRaces:720,
   perContextRows:split.length,contextRows:split},
  source:{status:'P2-source-only-half-phase-rank-feasibility-not-style-rating',
   source:{sha256:model.SOURCE_SHA},
   baseline:{appSkills:881,sourceMatched:818},
   counts:{halfTimeExactBandDirect:75},examples:rows}
 };
}
test('D=point occupancy minus integer-rank U, not 10m-window opportunity minus U',()=>{
 const {short,split,source}=fixture();
 const x=model.evaluate(short,split,source);
 assert.equal(x.summary.directCandidates,75);
 assert.equal(x.summary.modeled,75);
 assert.equal(x.summary.heldRaceQualifiers,0);
 const first=x.items[0];
 const nige=first.styles.Nige;
 assert.equal(nige.byFieldSize[9].WPercent.min,70);
 assert.equal(nige.byFieldSize[9].OPercent.min,65);
 assert.equal(nige.byFieldSize[9].UPercent.min,r6(5/9*100));
 assert.equal(nige.byFieldSize[9].DPoints.min,r6(65-5/9*100));
 assert.equal(nige.byFieldSize[12].DPoints.min,15);
 assert.equal(nige.deviationDirection.direction,'+');
 assert.equal(first.pairs.find(p=>p.first==='Nige'&&p.second==='Senkou')
  .WDirection.direction,'+');
 assert.equal(first.pairs.find(p=>p.first==='Nige'&&p.second==='Senkou')
  .DDirection.direction,'+');
 assert(!Object.hasOwn(first,'realSkillActivationRate'));
});
test('source distance/type gates are enforced, unsupported dirt remains held',()=>{
 const {short,split,source}=fixture();
 source.examples[0].paths[0].sourceConditions.push(
  {type:'distance_type',operator:'==',value:2});
 source.examples[1].paths[0].sourceConditions.push(
  {type:'ground_type',operator:'==',value:2});
 source.examples[2].paths[0].eligibleStyles=['先行'];
 const x=model.evaluate(short,split,source);
 assert.equal(x.summary.modeled,74);
 assert.equal(x.summary.heldRaceQualifiers,1);
 assert.equal(x.items[0].styles.Nige.contexts,8);
 assert.deepEqual(x.items[0].modelCourses,[10502,10304]);
 assert.equal(x.items[1].status,'held-source-race-qualifier');
 assert.equal(x.items[2].styles.Nige.status,'explicit-style-ineligible');
 assert.equal(x.items[2].styles.Senkou.status,'model-contexts-only');
 assert(x.items[2].pairs.every(p=>p.status==='held-explicit-ineligible-pair'));
});
test('a single first-half reversal retains the original W but holds the pairwise direction',()=>{
 const {short,split,source}=fixture();
 const cell=split.contextRows.filter(x=>x.courseId===10502&&
  x.fieldSize===9&&x.mode==='equal'&&
  x.windowKey==='phase_firsthalf_random:1'&&
  x.bandId==='top50'&&x.style==='Nige');
 assert.equal(cell.length,2);
 cell.find(x=>x.half==='first15').pointPercent=45;
 cell.find(x=>x.half==='first15').random10mOpportunityPercent=50;
 cell.find(x=>x.half==='last15').pointPercent=85;
 cell.find(x=>x.half==='last15').random10mOpportunityPercent=90;
 const x=model.evaluate(short,split,source);
 const pair=x.items[0].pairs.find(p=>p.first==='Nige'&&p.second==='Senkou');
 assert.equal(pair.WDirection.status,'held-tie-or-context-reversal');
 assert.equal(pair.WDirection.direction,null);
 assert.equal(x.summary.skillsWithStableWPair,75); // other style pairs still confirmed
});
test('missing/duplicate rows or split drift fail closed',()=>{
 const x=fixture();
 x.split.contextRows[0].random10mOpportunityPercent+=1;
 assert.throws(()=>model.evaluate(x.short,x.split,x.source),/do not reconstruct/);
 const z=fixture();
 z.source.examples.pop();
 assert.throws(()=>model.evaluate(z.short,z.split,z.source),/direct 75-skill/);
 const y=fixture();
 y.short.contextRows[10].pointPercent=100;
 assert.throws(()=>model.evaluate(y.short,y.split,y.source),/10m event W/);
});
test('strict comparison gate holds ties and missing data; no rating threshold',()=>{
 assert.equal(model.stableDirection([0,0]).status,'held-tie-or-context-reversal');
 assert.equal(model.stableDirection([1,-1]).status,'held-tie-or-context-reversal');
 assert.equal(model.stableDirection([2,1,.2]).direction,'+');
 assert.equal(model.stableDirection([-1,-2,-.2]).direction,'-');
 assert.equal(model.stableDirection([NaN]).status,'unresolved-data');
 assert.equal(model.sign(0.000001),'=');
});
