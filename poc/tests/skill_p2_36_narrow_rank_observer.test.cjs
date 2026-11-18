'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const narrow=require('../tools/skill_p2_36_narrow_rank_observer.cjs');
const windows=require('../tools/globalsim_subphase_random_10m.cjs').WINDOWS;
test('original narrow rank is AND of absolute >=2 and relative top50, not top50 alone',()=>{
 assert.deepEqual(narrow.eligibleRanks(9),[2,3,4,5]);
 assert.deepEqual(narrow.eligibleRanks(12),[2,3,4,5,6]);
 assert.throws(()=>narrow.eligibleRanks(10),/Only reference-checked fields/);
});
test('observer measures the SAME rank trajectory W and O across fixed 15+15 and 4 styles',()=>{
 const o=narrow.collect();
 const window=windows.find(w=>w.key===narrow.windowKey);
 const start=1200*window.startRate,end=1200*window.endRate;
 for(const n of [9,12])for(const mode of ['equal','jitter10'])
  for(const style of ['Nige','Senkou','Sasi','Oikomi'])
   for(let rep=0;rep<30;rep++){
    const plan={course:{id:10501,distance:1200},
     fieldSize:n,mode,rep};
    const fragments=[{start,end,rank:3}];
    const hist={rankFractions:Array.from({length:n},(_,i)=>i===2?1:0)};
    o.observe(plan,window,fragments,hist,style);
   }
 const x=o.report();
 assert.equal(x.status,narrow.STATUS);
 assert.equal(x.contextRows.length,16);
 assert(x.contextRows.every(x=>x.all.W===100&&x.all.O===100&&
  x.first15.W===100&&x.last15.O===100));
 assert.equal(x.contextRows[0].ranks[0],2);
 assert(x.contextRows.every(x=>Math.abs(x.all.D-
  (100-x.all.U))<0.00001));
});
test('invalid source occupancy is not waved through as measured narrow opportunity',()=>{
 const o=narrow.collect();
 const window=windows.find(w=>w.key===narrow.windowKey);
 const start=1200*window.startRate,end=1200*window.endRate;
 const plan={course:{id:10501,distance:1200},fieldSize:9,mode:'equal',rep:0};
 const hist={rankFractions:Array.from({length:9},(_,i)=>i===0?1:0)};
 assert.throws(()=>o.observe(plan,window,[{start,end,rank:3}],hist,'Nige'),
  /occupancy disagrees/);
 assert.throws(()=>o.report(),/missing 16/);
});
