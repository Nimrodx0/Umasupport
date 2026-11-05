'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fit=require('../src/skill_activation_fit_v1.cjs');
const cond=(type,operator,value)=>({type,operator,value});
const rank=(op,number,phase=1,type='phase_random')=>[
 cond('order_rate',op,number),cond(type,'==',phase)];
const p=(groups,{pre=[],more=[]}={})=>({status:'source-structure',
 sourceNumericId:'TEST:1',invokes:[
 {index:0,conditions:groups,preConditions:pre},
 ...more.map((rows,i)=>({index:i+1,conditions:rows,preConditions:[]}))]});
const statuses=p=>Object.fromEntries(Object.entries(fit.evaluate(p).styles)
 .map(([style,x])=>[style,x.status]));
test('mid-race exact front and back 50% classify relative style fit',()=>{
 assert.deepEqual(statuses(p([rank('<=',50)])),{
  '逃げ':'high','先行':'high','差し':'low','追込':'low'});
 assert.deepEqual(statuses(p([rank('>',50,2)])),{
  '逃げ':'low','先行':'low','差し':'high','追込':'high'});
 const x=fit.evaluate(p([rank('<=',50)]));
 assert.match(x.styles['逃げ'].paths[0].researchBasis,/GlobalSim/);
 assert.equal(x.styles['逃げ'].paths[0].researchScope,'pinned-GlobalSim-only');
 assert.equal(Object.hasOwn(x.styles['逃げ'],'probability'),false);
});
test('early full race phase is measured, final phase subwindows are scoped',()=>{
 for(const row of [
  rank('<=',50,0),
  rank('<=',50,2,'phase_firsthalf_random'),
  rank('<=',50,2,'phase_laterhalf_random')
 ])assert.equal(statuses(p([row]))['逃げ'],'high');
 for(const row of [
  rank('<=',50,0,'phase_laterhalf_random'),
  rank('<=',50,2,'phase'),
  rank('<=',50,1,'phase_corner_random')
 ])assert.equal(statuses(p([row]))['逃げ'],'held');
});
test('late phase has measured exceptions: do not promote it to high or low',()=>{
 for(const op of ['<=','>']){
  assert.deepEqual(statuses(p([rank(op,50,3)])),{
   '逃げ':'dependent','先行':'dependent',
   '差し':'dependent','追込':'dependent'});
 }
});
test('unsupported threshold/operator/AND restrictions remain held with partial rank evidence',()=>{
 const unsupported=[
  rank('<=',40),
  rank('>=',40),
  [...rank('<=',50),cond('order_rate','>',20)],
  [cond('order_rate','<=',50)],
  [...rank('<=',50),cond('is_overtake','==',1)],
  [...rank('>',50),cond('phase_random','==',2)]
 ];
 for(const row of unsupported){
  const x=fit.evaluate(p([row]));
  assert.equal(x.styles['逃げ'].status,'held',JSON.stringify(row));
  assert.equal(x.styles['差し'].status,'held',JSON.stringify(row));
 }
 const partial=fit.evaluate(p([[
  ...rank('<=',50),cond('is_overtake','==',1)
 ]]));
 assert.equal(partial.styles['逃げ'].paths[0].rankOnly.status,'high');
 assert.equal(partial.styles['逃げ'].paths[0].unmodelledPredicates[0].type,'is_overtake');
});
test('race-global distance/ground context does not invent extra style condition',()=>{
 const row=[...rank('<=',50),cond('distance_type','==',2),
  cond('ground_type','==',1)];
 const x=fit.evaluate(p([row]));
 assert.equal(x.styles['逃げ'].status,'high');
 assert.equal(x.styles['追込'].status,'low');
 assert.equal(x.styles['逃げ'].paths[0].contextPredicates.length,2);
 assert.equal(fit.evaluate(p([[cond('distance_type','==',3),
  cond('phase_random','==',1)]])).styles['逃げ'].status,'neutral');
});
test('all known neutral predicates prove absence of a STYLE condition only',()=>{
 const x=fit.evaluate(p([[cond('distance_type','==',3),
  cond('ground_type','==',1)]]));
 assert(Object.values(x.styles).every(v=>v.status==='neutral'));
 for(const row of [
  [],
  [cond('is_overtake','==',1)],
  [cond('phase_corner_random','==',2)]
 ])assert.equal(fit.evaluate(p([row])).styles['逃げ'].status,'held');
});
test('explicit OR-style alternatives allow either style and forbid excluded styles',()=>{
 const x=fit.evaluate(p([
  [cond('running_style','==',1),...rank('<=',50)],
  [cond('running_style','==',2),...rank('<=',50)]
 ]));
 assert.equal(x.styles['差し'].status,'ineligible');
 assert.equal(x.styles['追込'].status,'ineligible');
 assert.equal(x.styles['逃げ'].status,'held');
 assert.equal(x.styles['先行'].status,'held');
 assert(x.styles['逃げ'].paths.some(y=>y.status==='ineligible'));
});
test('explicit style condition in precondition rows is sufficient to exclude only if every OR choice does',()=>{
 const pres=[[cond('running_style','==',1)],
  [cond('running_style','==',2)]];
 const x=fit.evaluate(p([rank('<=',50)],{pre:pres}));
 assert.equal(x.styles['差し'].status,'ineligible');
 assert.equal(x.styles['追込'].status,'ineligible');
 assert.equal(x.styles['逃げ'].status,'held');
 assert.equal(x.styles['先行'].status,'held');
 const mixed=fit.evaluate(p([rank('<=',50)],{pre:[
  [cond('running_style','==',1)],
  [cond('is_overtake','==',1)]
 ]}));
 assert.equal(mixed.styles['差し'].status,'held');
});
test('unknown OR branches and differing style directions withhold whole-skill label',()=>{
 const xs=[
  p([rank('<=',50),[cond('is_overtake','==',1)]]),
  p([rank('<=',50),rank('>',50)]),
  p([rank('<=',50)],{more:[[rank('>',50)]]})
 ];
 for(const x of xs){
  const y=fit.evaluate(x);
  assert.equal(y.styles['逃げ'].status,'held');
  assert.equal(y.styles['差し'].status,'held');
  assert(y.styles['逃げ'].paths.length>=2);
 }
 const same=fit.evaluate(p([rank('<=',50),rank('<=',50,2)]));
 assert.equal(same.styles['逃げ'].status,'high');
 assert.equal(same.styles['差し'].status,'low');
});
test('missing source is held, malformed source cannot be reclassified',()=>{
 const u=fit.evaluate({status:'unavailable'});
 assert.equal(u.styles['逃げ'].status,'held');
 assert.equal(u.status,'held');
 const bad=p([[{type:'order_rate',operator:'???',value:50}]]);
 assert.throws(()=>fit.evaluate(bad),/Invalid source/);
 const corrupt=p([rank('<=',50)]);corrupt.invokes[0].preConditions={};
 assert.throws(()=>fit.evaluate(corrupt),/Invalid source/);
});
