'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspect,reasonedPath}=require('../src/skill_rank_corner_source_cohort.cjs');
const c=(type,operator='==',value=1)=>({type,operator,value});
const sk=(id,rows)=>({id:String(id),name:'case-'+id,invokes:[{
 conditions:rows,preConditions:[],effects:[]}]});
test('absolute order and phase_random is a measurable condition subset only',()=>{
 const p=reasonedPath([
  c('order','==',1),c('phase_random','==',1),
  c('distance_type','==',2)]);
 assert.equal(p.candidate,'absolute-order');
 assert.equal(p.feasibility,'source-absolute-rank-phase-random-subcondition-candidate');
 assert.equal(p.fullyModeledSkill,false);
 assert.deepEqual(p.explicitTypes,['distance_type']);
});
test('source corner_random uses 1..4 and does not silently reinterpret unsupported values',()=>{
 const good=reasonedPath([c('corner_random','==',3),c('order_rate','<=',50)]);
 assert.equal(good.feasibility,'source-corner-rank-subcondition-candidate');
 for(const p of [c('corner_random','==',0),c('corner_random','>',3)]){
  assert.equal(reasonedPath([p,c('order_rate','<=',50)]).feasibility,
   'held-source-window-or-compound');
 }
});
test('corner rank path with extra AND remains partial even when geometry can be measured',()=>{
 const found=reasonedPath([c('corner_random','==',1),
  c('order_rate','<=',50),c('blocked_side_continuetime','>=',2)]);
 assert.equal(found.feasibility,'source-corner-rank-subcondition-candidate');
 assert.deepEqual(found.otherAndTypes,['blocked_side_continuetime']);
 assert.equal(found.fullyModeledSkill,false);
});
test('phase must not be modeled as random and a second random timing path is held',()=>{
 const simple=reasonedPath([c('order','<=',3),c('phase','==',1)]);
 assert.equal(simple.feasibility,'held-source-window-or-compound');
 const multiple=reasonedPath([c('order','==',1),
  c('phase_random','==',1),c('phase_random','==',2)]);
 assert.equal(multiple.feasibility,'held-source-window-or-compound');
});
test('source path metadata retains OR, Invoke and precondition boundaries',()=>{
 const report=inspect([
  sk(1,[[c('order','<=',2),c('phase_random','==',1)],
   [c('distance_type','==',2)]]),
  sk(2,[[c('corner_random','==',1),c('order_rate','>=',40)]])
 ]);
 assert.equal(report.summary.absoluteOrder.distinctSkills,1);
 assert.equal(report.summary.cornerRank.distinctSkills,1);
 assert.equal(report.paths[0].siblingORCount,2);
 assert.equal(report.paths[0].invokeCount,1);
 assert.equal(report.paths[0].fullyModeledSkill,false);
 assert.equal(report.summary.noFullSkillRatings,true);
});
test('duplicate source IDs fail closed',()=>{
 const s=sk(1,[[c('order','==',1)]]);
 assert.throws(()=>inspect([s,s]),/duplicate/);
});
