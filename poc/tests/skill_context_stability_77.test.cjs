'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const research=require('../tools/skill_context_stability_77.cjs');
const makeRow=(courseId,fieldSize,mode,value)=>({
 courseId,fieldSize,mode,phase:1,
 bandId:'top50',style:'Nige',runners:60,
 pointPercent:value/2,random10mOpportunityPercent:value
});
const cases=[
 makeRow(101,9,'equal',10),makeRow(101,9,'jitter10',20),
 makeRow(101,12,'equal',30),makeRow(101,12,'jitter10',40),
 makeRow(202,9,'equal',50),makeRow(202,9,'jitter10',60),
 makeRow(202,12,'equal',70),makeRow(202,12,'jitter10',80)
];
const examine=(rows=cases,courses=[101,202],refMean=45)=>
 research.oneProfile({sourceNumericId:'001',skillName:'Synthetic only',
 surface:'turf',timing:'phase_random:1',bandId:'top50',
 courseIds:courses,style:'Nige',refMean,rows});
test('per-context distributions preserve exact mean, quantiles and all three distinct factor slices',()=>{
 const x=examine();
 assert.equal(x.contexts,8);
 assert.equal(x.meanPercent,45);
 assert.equal(x.minPercent,10);
 assert.equal(x.maxPercent,80);
 assert.equal(x.rangePoints,70);
 assert.equal(x.medianPercent,45);
 assert.equal(x.p25Percent,27.5);
 assert.equal(x.p75Percent,62.5);
 assert.equal(x.byHeadcount['9'],35);
 assert.equal(x.byHeadcount['12'],55);
 assert.equal(x.byHeadcount.absoluteDifferencePoints,20);
 assert.equal(x.byMode.equal,40);
 assert.equal(x.byMode.jitter10,50);
 assert.equal(x.byMode.absoluteDifferencePoints,10);
 assert.deepEqual(x.byCourse.means,[{courseId:101,meanPercent:25},
  {courseId:202,meanPercent:65}]);
 assert.equal(x.byCourse.rangePoints,40);
 assert.deepEqual(x.byCourse.leaveOneCourseOut,[
  {omittedCourseId:101,meanPercent:65},
  {omittedCourseId:202,meanPercent:25}]);
 assert.equal(x.byCourse.leaveOneCourseOutMeanRangePoints,40);
 assert.equal(x.candidateThresholds['20-80'].meanLabel,'middle');
 assert.equal(x.candidateThresholds['20-80'].contextsSameLabel,false);
 assert.deepEqual(x.candidateThresholds['20-80'].contextClasses,
  {low:1,middle:6,high:1});
});
test('candidate boundaries are explicitly hypothetical and equality semantics are stable',()=>{
 assert.equal(research.category(19.999,20,80),'low');
 assert.equal(research.category(20,20,80),'middle');
 assert.equal(research.category(79.9999,20,80),'middle');
 assert.equal(research.category(80,20,80),'high');
 const x=research.thresholds([1,1,1,1]);
 assert.deepEqual(x['20-80'].contextClasses,{low:4,middle:0,high:0});
 assert.equal(x['20-80'].contextsSameLabel,true);
 assert.equal(x['10-90'].fractionSameAsMean,1);
 const mixed=research.thresholds([94,96]);
 assert.equal(mixed['20-80'].contextsSameLabel,true);
 assert.equal(mixed['5-95'].contextsSameLabel,false);
 assert.throws(()=>research.thresholds([-1]),/Unverified/);
});
test('missing and duplicated model contexts or previous source averages fail closed',()=>{
 assert.throws(()=>examine(cases.slice(0,-1)),/Wrong number/);
 const repeated=[...cases];repeated[1]={...repeated[0]};
 assert.throws(()=>examine(repeated),/Missing\/duplicated/);
 assert.throws(()=>examine(cases,[101,202],46),/does not match previous/);
 assert.throws(()=>examine(cases,[101]),/Wrong number/);
 assert.throws(()=>examine(cases,[]),/Wrong number/);
 const broken=cases.map(x=>({...x}));
 broken[0].random10mOpportunityPercent=101;
 assert.throws(()=>examine(broken),/Missing\/duplicated/);
});
test('one-distance-only model course remains non-extrapolatable for course-out stability',()=>{
 const rows=cases.filter(x=>x.courseId===101);
 const x=examine(rows,[101],25);
 assert.equal(x.contexts,4);
 assert.equal(x.byCourse.means.length,1);
 assert.equal(x.byCourse.rangePoints,0);
 assert.equal(x.byCourse.leaveOneCourseOut,null);
 assert.equal(x.byCourse.leaveOneCourseOutMeanRangePoints,null);
});
