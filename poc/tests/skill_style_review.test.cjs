'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const style=require('../src/skill_style_tendency.js');
const {summarize}=require('../src/skill_style_review.cjs');
const c=(type,operator,value)=>({type,operator,value});
const profile=(id,conditions)=>({status:'source-structure',
 sourceNumericId:id,angleTags:[],invokes:[{index:0,conditions,preConditions:[],effectTypes:[]}]});
const skill=(id,name,conditions)=>({id:'skill:'+id,name,activationProfile:profile(id,conditions)});
test('P2 review groups preserve evidence, names, whole cohort and OR structure',()=>{
 const skills=[
  skill('1','中盤前方A',[[c('phase_random','==',1),c('order_rate','<=',50)]]),
  skill('2','中盤前方B',[[c('phase_random','==',1),c('order_rate','<=',50)]]),
  skill('3','終盤後方',[[c('phase_random','==',2),c('order_rate','>',50)]]),
  skill('4','例外OR',[[c('phase_random','==',2),c('order_rate','>',50)],
    [c('distance_type','==',2),c('phase_random','==',2),c('order_rate','>',50)]])
 ];
 const model={skills,skillById:Object.fromEntries(skills.map(x=>[x.id,x])),meta:{}};
 style.attach(model);
 const out=summarize(model);
 assert.equal(out.total,4);
 assert.equal(out.groupCount,3);
 assert.equal(out.groups.reduce((n,x)=>n+x.count,0),4);
 const mid=out.groups.find(x=>x.count===2);
 assert.deepEqual(mid.skills.map(s=>s.name),['中盤前方A','中盤前方B']);
 assert.equal(mid.skills[0].paths[0].periods[0].phaseName,'中盤');
 const split=out.groups.find(x=>x.skills.some(s=>s.name==='例外OR'));
 assert.equal(split.skills[0].paths.length,2);
 assert.equal(split.skills[0].paths[1].explicitOther[0].type,'distance_type');
 assert.deepEqual(split.skills[0].paths[0].rank.operatorValues,[{operator:'>',value:50}]);
});
test('P2 review does not invent cases and requires attached evidence',()=>{
 const result=summarize({skills:[{id:'hint:unknown',name:'未収録',
  activationTendency:{status:'unavailable'}}]});
 assert.equal(result.total,0);
 assert.equal(result.groupCount,0);
 assert.throws(()=>summarize({skills:[{id:'skill:1',activationTendency:
  {status:'inferred',branches:[]}}]}),/No P2 evidence branches/);
});
