'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const a=require('../tools/rank_band_fit_population_audit.cjs');
const c=(type,operator,value)=>({type,operator,value});
const full=(id,row)=>({id,invokes:[{conditions:[row],preConditions:[]}]});
test('new rank band is source only, 4-style complete, and AND/opportunity proof is never inferred',()=>{
 const r=a.audit([
  full('1',[c('phase_random','==',1),c('order_rate','>=',40)]),
  full('2',[c('phase_random','==',1),c('order_rate','>=',40),
   c('order_rate','<=',80)]),
  full('3',[c('phase_random','==',1),c('order_rate','>=',40),
   c('is_overtake','==',1)]),
  full('4',[c('phase_random','==',1),c('order_rate','<=',50)]),
  full('5',[c('phase_random','==',1),c('order_rate','>=',40),
   c('ground_type','==',2)])
 ]);
 assert.equal(r.stats.sourceSkills,5);
 assert.equal(r.stats.withOrderRate,5);
 assert.equal(r.stats.withVerifiedRankBandPath,2);
 assert.equal(r.stats.fullyResolvedNewRankBandSkills,2);
 assert.equal(r.stats.heldWithVerifiedRankBandPath,0);
 assert.equal(r.stats.withStudiedButNotUniformBand,1);
 assert.equal(r.stats.onlyOldHalfBandProof,1);
 assert.deepEqual(r.exampleSourceIds.fullyResolved,['1','5']);
 const row=r.proofByWindow.find(x=>x.phase===1&&x.bandId==='from40');
 assert.equal(row.uniqueSourceSkills,2);
 assert.equal(Object.hasOwn(r,'sourceRecords'),false);
});
test('OR alternatives and explicit style permissions cannot be reinterpreted as new fully-resolved skills',()=>{
 const r=a.audit([
  {id:'1',invokes:[{conditions:[
   [c('phase_random','==',1),c('order_rate','>=',40)],
   [c('phase_random','==',1),c('is_overtake','==',1)]
  ],preConditions:[]}]},
  {id:'2',invokes:[{conditions:[[
   c('phase_random','==',1),c('order_rate','>=',40),
   c('running_style','==',3)
  ]],preConditions:[]}]}
 ]);
 assert.equal(r.stats.withOrderRate,2);
 assert.equal(r.stats.withVerifiedRankBandPath,1);
 assert.equal(r.stats.fullyResolvedNewRankBandSkills,0);
 assert.equal(r.stats.heldWithVerifiedRankBandPath,1);
 assert.equal(r.exampleSourceIds.partialOrHeld[0],'1');
});
test('duplicate source skill and unknown structure fail closed',()=>{
 const r=full('1',[c('phase_random','==',1),c('order_rate','>=',40)]);
 assert.throws(()=>a.audit([r,r]),/Duplicate or malformed/);
 const x=full('2',[c('phase_random','==',1),c('order_rate','>=',40)]);
 x.invokes[0].conditions=null;
 assert.throws(()=>a.audit([x]),/Malformed source AND\/OR/);
 assert.throws(()=>a.audit([]),/Invalid original/);
});
