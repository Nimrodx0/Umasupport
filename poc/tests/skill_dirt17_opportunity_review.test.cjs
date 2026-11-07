'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../tools/globalsim_dirt_10m.cjs');
const audit=require('../tools/skill_dirt17_opportunity_review.cjs');
const bounds=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const source=require('../src/skill_rank_timing.js');
const c=(type,operator,value)=>({type,operator,value});
function model(kind){
 const rows=[];
 for(const phase of (kind==='full'?[0,1,2,3]:
  ['phase_laterhalf_random:0','phase_firsthalf_random:1',
   'phase_laterhalf_random:1','phase_firsthalf_random:2']))
  for(const band of bounds)
   for(const course of engine.COURSES)
    for(const fieldSize of [9,12])
     for(const mode of ['equal','jitter10'])
      for(const style of ['Nige','Senkou','Sasi','Oikomi']){
       rows.push({courseId:course.id,fieldSize,mode,
        ...(kind==='full'?{phase}:{windowKey:phase}),
        bandId:band.id,style,
        runners:60,pointPercent:30,
        random10mOpportunityPercent:35,upliftPoints:5});
      }
 return {schemaVersion:1,sourceRevision:engine.COURSES.length?
  '80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1':null,
  status:kind==='full'?
   'research-GlobalSim-10m-rank-opportunity-not-game-activation':
   'research-GlobalSim-subphase-random-10m-rank-opportunity-not-game-skill-rate',
  scenario:'balanced',simulations:720,seedsPerCell:30,
  perContextRows:4224,phaseBands:kind==='full'?44:undefined,
  windowBands:kind==='short'?44:undefined,contextRows:rows};
}
test('six actual dirt courses retain original frozen source surface, distance and geometry',()=>{
 const src=Object.fromEntries(engine.COURSES.map(c=>[c.id,{...c}]));
 const geometries=new Set(engine.COURSES.map(c=>c.id+'.json'));
 assert.equal(engine.verifyCourses(src,geometries),true);
 src['10508'].surface=1;
 assert.throws(()=>engine.verifyCourses(src,geometries),/dirt course/);
 src['10508'].surface=2;
 geometries.delete('11302.json');
 assert.throws(()=>engine.verifyCourses(src,geometries),/geometry missing/);
});
test('balanced 720 dirt races preserve A aptitude plan, mode parity and all four distance types',()=>{
 const plans=engine.makePlan();
 assert.equal(plans.length,720);
 assert.deepEqual([...new Set(plans.map(x=>x.course.distanceType))],[1,2,3,4]);
 assert(plans.every(x=>x.scenario==='balanced'));
 assert(plans.every(x=>x.strategies.length===x.fieldSize));
 const pair=plans.filter(x=>x.course.id===10508&&
  x.fieldSize===9&&x.rep===0);
 assert.equal(pair.length,2);
 assert.equal(pair[0].seed,pair[1].seed);
 assert.deepEqual(pair[0].strategies,pair[1].strategies);
 assert.throws(()=>engine.makePlan({seedsPerCell:3}),/even seeds/);
});
test('dirt full and source-half 10m model index reject turf and missing contexts',()=>{
 const a=model('full');
 const x=audit.indexModel(a,{type:'full',courses:engine.COURSES});
 assert.equal(x.size,176);
 assert.equal(x.get('1|top50|Nige').length,24);
 const b=model('short');
 const y=audit.indexModel(b,{type:'short',courses:engine.COURSES});
 assert.equal(y.size,176);
 assert.equal(y.get('phase_laterhalf_random:1|top50|Senkou').length,24);
 const dup=model('short');dup.contextRows[0]=dup.contextRows[1];
 assert.throws(()=>audit.indexModel(dup,
  {type:'short',courses:engine.COURSES}),/Repeated dirt context/);
 const invalid=model('full');invalid.contextRows[0].courseId=10504;
 assert.throws(()=>audit.indexModel(invalid,
  {type:'full',courses:engine.COURSES}),/Dirt reference sample/);
});
test('source dirt prerequisites, original rank AND and exact time window are mandatory',()=>{
 const m=conditions=>({sourceConditions:conditions,bandId:'top50',
  surfaceAssessment:'held-unverified-surface-requirement',
  nonModelledReasons:['held-unverified-surface-requirement']});
 const rank=bounds.find(x=>x.id==='top50').predicates;
 const full=audit.targetPath(m([...rank,c('ground_type','==',2),
  c('phase_random','==',1)]));
 assert.equal(full.modelType,'full');
 assert.equal(full.key,'1');
 const half=audit.targetPath(m([...rank,c('ground_type','==',2),
  c('phase_laterhalf_random','==',0)]));
 assert.equal(half.modelType,'short');
 assert.equal(half.key,'phase_laterhalf_random:0');
 assert.equal(audit.targetPath(m([...rank,c('ground_type','==',1),
  c('phase_random','==',1)])),null);
 assert.equal(audit.targetPath(m([...rank,c('ground_type','==',2),
  c('phase_random','==',1),c('is_overtake','==',1)])),null);
 assert.equal(audit.targetPath(m([...rank,c('ground_type','==',2),
  c('phase_firstquarter_random','==',1)])),null);
});
test('distance gate filters only actual source course distance types',()=>{
 const courses=engine.COURSES;
 assert.equal(audit.selectedCourses([c('distance_type','==',1)],courses).length,1);
 assert.equal(audit.selectedCourses([c('distance_type','==',2)],courses).length,2);
 assert.equal(audit.selectedCourses([c('distance_type','==',3)],courses).length,2);
 assert.equal(audit.selectedCourses([c('distance_type','==',4)],courses).length,1);
 assert.equal(audit.selectedCourses([],courses).length,6);
 assert.deepEqual(audit.selectedCourses([c('distance_type','==',0)],courses),[]);
});
