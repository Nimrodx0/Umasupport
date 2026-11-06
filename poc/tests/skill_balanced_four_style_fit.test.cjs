'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fit=require('../src/skill_balanced_four_style_fit.cjs');
const verification=require('../tools/verify_balanced_four_style_evidence.cjs');
const c=(type,operator,value)=>({type,operator,value});
const middle=[c('order_rate','>=',40),c('order_rate','<=',80),
 c('phase_random','==',1)];
const profile=(rows,{pre=[],more=[]}={})=>({
 status:'source-structure',sourceNumericId:'TEST:1',
 invokes:[{index:0,conditions:rows,preConditions:pre},
  ...more.map((r,i)=>({index:i+1,conditions:r,preConditions:[]}))]});
test('pinned balanced direction table is canonical, with 164 usable pairs and 100 held',()=>{
 assert.equal(fit.validEvidence(),true);
 assert.deepEqual(fit.EVIDENCE.pairs,fit.codePairs);
 const words=fit.EVIDENCE.directionByPhase.flat();
 assert.equal(words.length,44);
 assert.equal(words.join('').replace(/\?/g,'').length,164);
 assert.equal(words.join('').split('?').length-1,100);
 const altered=JSON.parse(JSON.stringify(fit.EVIDENCE));
 altered.sourceScenario='jan2026';
 assert.equal(fit.validEvidence(altered),false);
 const altered2=JSON.parse(JSON.stringify(fit.EVIDENCE));
 altered2.directionByPhase[1][7]='SSSSS?X';
 assert.equal(fit.validEvidence(altered2),false);
 assert.throws(()=>verification.verify(Buffer.from('{}')),
  /SHA changed/);
});
test('source exact middle40to80 in balanced phase1 has strict 4-style order',()=>{
 const row=middle.slice(0,2);
 const evidence=fit.bandProof(row,middle[2]);
 assert.equal(evidence.bandId,'middle40to80');
 assert.deepEqual(evidence.positionsByField[9],[4,5,6,7]);
 assert.deepEqual(evidence.positionsByField[12],[5,6,7,8,9,10]);
 assert.equal(evidence.sourceScenario,'balanced');
 const expect={
  '差し':{tier:'relative-leader',higherThan:['Nige','Senkou','Oikomi']},
  '先行':{tier:'relative-intermediate',higherThan:['Nige','Oikomi']},
  '追込':{tier:'relative-intermediate',higherThan:['Nige']},
  '逃げ':{tier:'relative-trailer',higherThan:[]}
 };
 for(const [style,check] of Object.entries(expect)){
  const got=evidence.byStyle[style];
  assert.equal(got.tier,check.tier);
  assert.deepEqual(got.higherThan,check.higherThan);
  assert.equal(got.heldAgainst.length,0);
 }
 const full=fit.evaluate(profile([middle]));
 assert.equal(full.status,'research-only-not-production');
 for(const [style,v] of Object.entries(full.styles)){
  assert.equal(v.status,'model-comparative-evidence');
  assert.equal(v.comparison.tier,expect[style].tier);
  assert.equal(v.paths[0].modelRankEvidence.contextsPerPair,24);
  assert(!('probability' in v.comparison));
 }
});
test('balanced evidence is not the old all-scenario gate',()=>{
 const middleBand=[c('order_rate','>=',40),c('order_rate','<=',80)];
 const old=require('../tools/verify_rank_band_model_evidence.cjs');
 assert.equal(old.verifiedBand(middleBand,c('phase_random','==',1)),null);
 assert.equal(fit.bandProof(middleBand,c('phase_random','==',1))
  .byStyle['差し'].tier,'relative-leader');
 const held=fit.bandProof(middleBand,c('phase_random','==',3));
 assert.equal(held.byStyle['差し'].tier,'partial-order-unresolved');
 assert.equal(held.byStyle['差し'].heldAgainst.length>0,true);
});
test('other AND predicates hold the full skill even if rank subcondition is measured',()=>{
 const row=[...middle,c('is_overtake','==',1)];
 const x=fit.evaluate(profile([row]));
 assert.equal(x.styles['差し'].status,'held');
 assert.equal(x.styles['差し'].paths[0].reason,
  'extra-AND-conditions-unmeasured');
 assert.equal(x.styles['差し'].paths[0].partialRankEvidence.bandId,
  'middle40to80');
 assert.equal(x.styles['差し'].paths[0].partialRankEvidence.byStyle.tier,
  'relative-leader');
 for(const unsupported of [
  [c('order_rate','>=',35),c('order_rate','<=',80),
   c('phase_random','==',1)],
  [c('order_rate','>=',40),c('order_rate','<=',80),
   c('phase_firsthalf_random','==',1)],
  [c('order_rate','>=',40),c('order_rate','<=',80)]
 ]){
  assert.equal(fit.evaluate(profile([unsupported])).styles['差し'].status,
   'held');
 }
});
test('explicit style exclusions take precedence; permissions are separate from suitability',()=>{
 const excluded=fit.evaluate(profile([[
  ...middle,c('running_style','==',2),
  c('ground_type','==',2)
 ]]));
 assert.equal(excluded.styles['逃げ'].status,'ineligible');
 assert.equal(excluded.styles['先行'].status,'model-comparative-evidence');
 assert.equal(excluded.styles['差し'].status,'ineligible');
 const one=excluded.styles['先行'].paths[0];
 assert.deepEqual(one.raceRequirements,[c('ground_type','==',2)]);
 assert.equal(one.provisionalSurfaceTransfer,true);
 assert.equal(one.comparison.tier,'relative-intermediate');
 const pre=fit.evaluate(profile([middle],{pre:[
  [c('running_style','==',2)],
  [c('running_style','==',3)]
 ]}));
 assert.equal(pre.styles['逃げ'].status,'ineligible');
 assert.equal(pre.styles['先行'].status,'held');
 assert.equal(pre.styles['差し'].status,'held');
});
test('OR paths stay separate; a single relative rank component cannot prove whole skill',()=>{
 const x=fit.evaluate(profile([middle,[
  ...middle,c('distance_type','==',3)
 ]]));
 assert.equal(x.styles['差し'].status,'held-multiple-OR-or-invoke-paths');
 assert.equal(x.styles['差し'].paths.length,2);
 assert(x.styles['差し'].paths.every(p=>
  p.status==='model-comparative-evidence'));
 const y=fit.evaluate(profile([middle],{more:[[middle]]}));
 assert.equal(y.styles['差し'].status,'held-multiple-OR-or-invoke-paths');
 assert.equal(y.styles['差し'].paths.length,2);
});
test('bad structures, impossible race gates, and empty profiles fail closed',()=>{
 assert.equal(fit.evaluate(null).status,'held');
 assert.throws(()=>fit.evaluate(profile([[{type:'order_rate',
  operator:'=',value:40}]])),/Invalid source/);
 assert.throws(()=>fit.branch(middle,9),/Invalid style ID/);
 assert.equal(fit.evaluate(profile([[
  ...middle,c('ground_type','==',99)
 ]])).styles['差し'].status,'held');
 assert.equal(fit.evaluate(profile([[
  ...middle,c('rotation','==',1)
 ]])).styles['差し'].status,'held');
 assert.equal(fit.evaluate(profile([[]])).styles['差し'].status,'held');
});
