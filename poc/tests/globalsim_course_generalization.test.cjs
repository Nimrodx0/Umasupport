'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_course_generalization.cjs');
const pin=require('../tools/globalsim_position_pilot.cjs').PIN;
const C=[10501,10502,10304,10504,10604,10506];
const row=(courseId,style,p,scenario='balanced')=>({courseId,fieldSize:9,
 scenario,mode:'equal',windowId:'middle-full',style,status:'estimate',
 pTopHalf:p,pBackHalf:1-p,minValidRunners:30,maxValidRunners:30});
const report=windows=>({schemaVersion:1,sourceRevision:pin,
 status:'model-window-rank-occupancy-estimate-not-skill-activation-rate',
 sourceRaceCount:2160,sourceSeedCount:15,windows});
const sample=(f=()=>[.95,.85,.4,.2])=>C.flatMap((id,i)=>{
 const p=f(i);return ['Nige','Senkou','Sasi','Oikomi']
  .map((style,j)=>row(id,style,p[j]));
});
test('all six courses preserve direction while course percentages remain different',()=>{
 const a=m.analyze(report(sample(i=>[.95,.81+i*.01,.4,.2])));
 assert.equal(a.counts.courseContexts,6);
 assert.equal(a.counts.frontAhead,6);
 assert.equal(a.counts.allSixCourseFrontAhead,1);
 assert.equal(a.weakestFrontRear.gapPercentagePoints,41);
 assert.equal(a.courseSpreadByStyle.Senkou.spread.max,5);
 assert.equal(a.withinSameDistance['1600'].Senkou.difference.max,1);
 assert.equal(a.generalization.adopted,false);
});
test('inside-group ordering can reverse without reversing front-vs-rear difference',()=>{
 const a=m.analyze(report(sample(i=>i<3?[.81,.91,.4,.2]:[.93,.82,.4,.2])));
 assert.equal(a.counts.frontAhead,6);
 assert.equal(a.withinStylePairOrdering.nigeVsSenkou.nigeAhead,3);
 assert.equal(a.withinStylePairOrdering.nigeVsSenkou.senkouAhead,3);
 assert.equal(a.courseSpreadByStyle.Nige.spread.max,12);
});
test('no-front population does not invent a zero-probability Nige runner',()=>{
 const w=['Senkou','Sasi','Oikomi'].map((style,i)=>
  row(10501,style,[.8,.4,.1][i],'noFront'));
 const a=m.analyze(report(w));
 assert.equal(a.counts.noNige,1);
 assert.equal(a.counts.frontAhead,1);
 assert.equal(a.counts.bothFrontStyles,0);
 assert.equal(a.courseSpreadByStyle.Nige.spread.n,0);
 assert.throws(()=>m.analyze(report([...w,row(10501,'Nige',1,'noFront')])),
  /Unexpected model group identity/);
});
test('any counterexample is explicitly measured rather than hidden in a mean',()=>{
 const a=m.analyze(report(sample(i=>i===2?[.5,.2,.6,.1]:[.95,.85,.4,.2])));
 assert.equal(a.counts.counterexample,1);
 assert.equal(a.counts.allSixCourseFrontAhead,0);
 assert.equal(a.weakestFrontRear.gapPercentagePoints,-40);
});
test('duplicates, unresolved values and incomplete six-course evidence fail closed',()=>{
 const a=row(10501,'Nige',.8);
 assert.throws(()=>m.analyze(report([a,a])),/Duplicate model cell/);
 assert.throws(()=>m.analyze(report([{...a,status:'no-valid-ranks'}])),
  /Unresolved or invalid/);
 assert.throws(()=>m.analyze(report([{...a,pBackHalf:0.5}])),
  /Unresolved or invalid/);
 assert.throws(()=>m.analyze(report([a]),{strict:true}),
  /Missing expected 2160-race evidence/);
 assert.throws(()=>m.analyze({...report([a]),sourceRevision:'wrong'}),
  /source-pinned/);
});
