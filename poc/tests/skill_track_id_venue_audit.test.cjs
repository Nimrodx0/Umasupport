'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fixed=require('../tools/globalsim_roster32.cjs');
const venue=require('../src/skill_track_id_venue_audit.cjs');
const p=(type,operator,value)=>({type,operator,value});
const skill=(id,invokes)=>({
 id:'skill:'+id,name:'Synthetic '+id,
 activationProfile:{status:'source-structure',sourceNumericId:String(id),invokes}
});
function syntheticSources(){
 const venues={},global={};
 for(const c of fixed.COURSES){
  const vid=[10501,10502,10504,10508].includes(c.id)?10005:
   c.id===11302?10103:10000+Math.floor(c.id/100);
  const detail={raceTrackId:vid,distance:c.distance,
   distanceType:c.distanceType,
   surface:c.surface==='turf'?1:2,turn:1};
  const key=String(vid);
  (venues[key]??={name:'synthetic',courses:{}}).courses[c.id]=detail;
  global[c.id]={...detail};
 }
 return {raw:'package fake\ninternal val rawCourseData = """\n'+
  JSON.stringify(venues)+'\n"""',
  glob:JSON.stringify(global),
  checker:'when (type) {\n"track_id" -> condition.preChecked(baseSetting.trackDetail.raceTrackId)\n}'};
}
function app(){
 const data=[
  skill(100,[{index:0,preConditions:[],
   conditions:[[p('track_id','==',10005),
    p('running_style','==',1),p('distance_type','==',2),
    p('ground_type','==',1)]]}]),
  skill(101,[{index:0,
   preConditions:[[p('track_id','==',10005)],
    [p('track_id','==',10103)]],
   conditions:[[p('running_style','>=',3),
    p('ground_type','==',2)]]}]),
  skill(102,[{index:0,preConditions:[],
   conditions:[[p('track_id','==',99999)]]}]),
  skill(103,[{index:0,preConditions:[],
   conditions:[[p('track_id','==',10005)],
    [p('running_style','==',2)]]}]),
  skill(104,[{index:0,
   preConditions:[[p('ground_condition','>',4)]],
   conditions:[[p('track_id','==',10005)]]}])
 ];
 for(let i=105;i<918;i++){
  if(data.length===818)break;
  data.push(skill(i,[{index:0,preConditions:[],
   conditions:[[p('running_style','==',1)]]}]));
 }
 assert.equal(data.length,818);
 for(let i=0;i<63;i++)
  data.push({id:'missing:'+i,name:'unmatched',
   activationProfile:{status:'no-source-match'}});
 return {skills:data,skillById:true,cards:[{id:'untouched'}]};
}
test('track_id original source is venue raceTrackId, not course key',()=>{
 const {raw,glob,checker}=syntheticSources();
 const courses=venue.verifyFixedCourses(raw,glob,checker);
 const a=courses.find(x=>x.courseId===10501);
 const b=courses.find(x=>x.courseId===10502);
 assert.equal(a.venueId,10005);
 assert.equal(b.venueId,10005);
 assert.notEqual(a.courseId,a.venueId);
 assert.notEqual(b.courseId,b.venueId);
 assert.equal(venue.evaluateSourceFixedCourse([
  p('track_id','==',10005),p('distance_type','==',2)],1,b),true);
 assert.equal(venue.evaluateSourceFixedCourse([
  p('track_id','==',10502)],1,b),false);
 assert.equal(venue.evaluateSourceFixedCourse([
  p('track_id','==',10005),p('distance_type','==',3)],1,b),false);
});
test('same AND plus each precondition alternative is preserved, no imaginary OR conjunction',()=>{
 const q=app(),sources=syntheticSources();
 const before=JSON.stringify(q);
 const routes=venue.conjunctions(q.skills[1]);
 assert.equal(routes.length,2);
 assert.equal(routes[0].preconditionOrIndex,0);
 assert.equal(routes[1].preconditionOrIndex,1);
 assert(routes.every(x=>x.isTrackInPrecondition));
 const report=venue.audit(q,venue.verifyFixedCourses(
  sources.raw,sources.glob,sources.checker));
 assert.equal(JSON.stringify(q),before);
 assert.equal(report.scope.matchedSourceSkills,818);
 assert.equal(report.scope.sourceUnmatchedSkills,63);
 assert.equal(report.summary.provenWholeSkillActivations,0);
 assert.equal(report.status,venue.STATUS);
 const a=report.rows.find(x=>x.sourceNumericId==='100');
 assert.deepEqual(a.byStyle['逃げ'].sourceCompatibleFixedVenueCourseIds,
  [10502]);
 assert.equal(a.byStyle['先行'].hasSomeCompatibleFixedCourse,false);
 const b=report.rows.find(x=>x.sourceNumericId==='101');
 assert(b.byStyle['差し'].branches[0].compatibleFixedCourseIds.includes(10508));
 assert(b.byStyle['差し'].branches[1].compatibleFixedCourseIds.includes(11302));
 assert(!b.byStyle['差し'].branches[0].compatibleFixedCourseIds.includes(11302),
  'One source pre-OR venue must not inherit the other venue match');
 assert(!b.byStyle['差し'].branches[1].compatibleFixedCourseIds.includes(10508),
  'Separate preConditions alternatives must remain independent');
 assert(b.byStyle['追込'].hasSomeCompatibleFixedCourse);
 assert.equal(b.byStyle['逃げ'].hasSomeCompatibleFixedCourse,false);
 const c=report.rows.find(x=>x.sourceNumericId==='102');
 assert(Object.values(c.byStyle).every(x=>!x.hasSomeCompatibleFixedCourse));
 const d=report.rows.find(x=>x.sourceNumericId==='103');
 assert.equal(d.originalTrackBranches,1,'untracked alternative cannot be counted as track requirement');
 const impossible=report.rows.find(x=>x.sourceNumericId==='104');
 assert(Object.values(impossible.byStyle).every(x=>
  !x.hasSomeCompatibleFixedCourse));
 assert(report.limitations.some(x=>x.includes('never proves the whole skill')));
});
test('malformed source semantics, course/venue map drift and source duplicates fail closed',()=>{
 const {raw,glob,checker}=syntheticSources();
 assert.throws(()=>venue.verifyFixedCourses(raw,glob,
  '"track_id" -> condition.preChecked(baseSetting.trackDetail.id)'),
  /semantic changed/);
 const g=JSON.parse(glob);
 g['10502'].raceTrackId=10502;
 assert.throws(()=>venue.verifyFixedCourses(raw,JSON.stringify(g),checker),
  /mapping drift/);
 const mutated=raw.replace('"raceTrackId":10005','"raceTrackId":12345');
 assert.throws(()=>venue.parseSourceCourses(mutated),/mismatch/);
 const appModel=app();
 appModel.skills[1].activationProfile.sourceNumericId='100';
 assert.throws(()=>venue.audit(appModel,venue.verifyFixedCourses(raw,glob,checker)),
  /Duplicate or non-numeric/);
});
