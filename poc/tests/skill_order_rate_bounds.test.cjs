'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/skill_order_rate_bounds.cjs');
const pilot=require('../tools/globalsim_position_pilot.cjs');
const rank=(op,v)=>({type:'order_rate',operator:op,value:v});
const time=(type='phase_random',value=1)=>({type,operator:'==',value});
const seq=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
test('9 and 12 runner source examples preserve operator after rounding',()=>{
 const expected=[
  [9,'<=',40,seq(1,4)],[12,'<=',40,seq(1,5)],
  [9,'>=',40,seq(4,9)],[12,'>=',40,seq(5,12)],
  [9,'<=',50,seq(1,5)],[12,'<=',50,seq(1,6)],
  [9,'>',50,seq(6,9)],[12,'>',50,seq(7,12)],
  [9,'>=',50,seq(5,9)],[12,'>=',50,seq(6,12)],
  [9,'<=',80,seq(1,7)],[12,'<=',80,seq(1,10)]
 ];
 for(const [n,op,pct,positions] of expected){
  const got=m.predicate(rank(op,pct),n);
  assert.deepEqual(got.positions,positions,JSON.stringify([n,op,pct]));
  assert.equal(got.boundary,pilot.threshold(n,pct));
 }
 assert.equal(m.VERSION,'order-rate-integer-projection-v1');
 assert.match(m.SOURCE.status,/not-independent-JP/);
});
test('round half-up ties, not floor truncation or ceiling, at 9 runners',()=>{
 assert.equal(m.cutoff(9,50),5); // 4.5 rounds to 5
 assert.equal(m.cutoff(9,75),7); // 6.75 rounds to 7
 assert.equal(m.cutoff(12,75),9); // 9
 assert.equal(m.cutoff(12,30),4); // 3.6 rounds to 4
 assert.equal(m.cutoff(9,20),2); // 1.8 rounds to 2, not 1
 assert.equal(m.cutoff(9,30),3); // 2.7 rounds to 3
 assert.equal(m.cutoff(12,40),5); // 4.8 rounds to 5
 for(const n of [9,12])
  for(let p=6;p<=100;p++){
   assert.equal(m.cutoff(n,p),pilot.threshold(n,p));
  }
});
test('>= 40 means shared midfield as well as rear, not exclusively rear',()=>{
 for(const [n,lower,upper] of [[9,4,7],[12,5,10]]){
  const x=m.andProjection([rank('>=',40),rank('<=',80)],n);
  assert.equal(x.status,'rank-subcondition-projection');
  assert.deepEqual(x.positions,seq(lower,upper));
  const overlap=m.andProjection([rank('>=',40),rank('<=',50)],n);
  assert.deepEqual(overlap.positions,seq(lower,pilot.threshold(n,50)));
  assert(overlap.positions.length>0);
 }
});
test('strict and non-strict operators and two-sided equality are distinct',()=>{
 for(const n of [9,12]){
  const cut=m.cutoff(n,40);
  assert.deepEqual(m.predicate(rank('<',40),n).positions,seq(1,cut-1));
  assert.deepEqual(m.predicate(rank('<=',40),n).positions,seq(1,cut));
  assert.deepEqual(m.predicate(rank('>',40),n).positions,seq(cut+1,n));
  assert.deepEqual(m.predicate(rank('>=',40),n).positions,seq(cut,n));
  assert.deepEqual(m.predicate(rank('==',40),n).positions,[cut]);
  assert.deepEqual(m.predicate(rank('!=',40),n).positions,
   seq(1,n).filter(x=>x!==cut));
  const p=m.andProjection([rank('>',50),rank('<=',50)],n);
  assert.equal(p.status,'rank-subcondition-empty-under-reference-mapping');
  assert.deepEqual(p.positions,[]);
 }
});
test('complements are disjoint and exhaustive for all stable source percentage cutoffs',()=>{
 for(const n of [9,12])for(const pct of [10,20,30,40,50,60,70,75,80,90,100]){
  const a=m.predicate(rank('<=',pct),n),b=m.predicate(rank('>',pct),n);
  assert.equal(a.status,'projected-relative-to-sourced-integer-rounding');
  assert.equal(b.status,'projected-relative-to-sourced-integer-rounding');
  assert.deepEqual([...a.positions,...b.positions].sort((x,y)=>x-y),seq(1,n));
  assert(a.positions.every(x=>!b.positions.includes(x)));
 }
});
test('projection of one condition is not the full skill AND or activation probability',()=>{
 const row=[rank('>=',40),rank('<=',80),time(),{
  type:'blocked_side_continuetime',operator:'>=',value:2
 }];
 const x=m.byField(row);
 assert.deepEqual(x.byField[9].positions,seq(4,7));
 assert.deepEqual(x.byField[12].positions,seq(5,10));
 assert.equal(x.byField[9].otherAndPredicates.length,2);
 assert.match(x.byField[9].caveat,/must also pass/);
 assert.equal(Object.hasOwn(x,'activationProbability'),false);
});
test('OR alternatives are not AND and missing rank info cannot be 0%',()=>{
 const a=m.groupedProjection([
  [rank('<=',30),time()],
  [rank('>=',70),time('phase_random',2)]
 ],9);
 assert.deepEqual(a.positions,[1,2,3,6,7,8,9]);
 assert.equal(a.status,'rank-only-OR-union');
 assert.equal(a.branches.length,2);
 const missing=m.groupedProjection([
  [rank('<=',30)],
  [time()]
 ],9);
 assert.equal(missing.status,'held-unknown-OR-path');
 assert.equal(missing.positions,null);
 assert.equal(m.andProjection([time()],9).status,'no-order-rate');
 assert.equal(m.andProjection([time()],9).positions,null);
});
test('unsupported tiny positive round-to-zero threshold does not assume a rank 0 or 1 clamp',()=>{
 const a=m.predicate(rank('<=',5),9);
 assert.equal(a.status,'held-zero-boundary-game-clamp-unverified');
 assert.equal(a.boundary,0);
 assert.equal(a.positions,null);
 const b=m.andProjection([rank('>=',40),rank('<=',5)],9);
 assert.equal(b.status,'held-unverified-boundary');
 assert.equal(b.positions,null);
 assert.throws(()=>m.cutoff(18,40),/Only reference-checked fields/);
 assert.throws(()=>m.cutoff(9,-1),/Only reference-checked fields/);
 assert.throws(()=>m.predicate(rank('>=',101),9),/Only reference-checked fields/);
 assert.throws(()=>m.predicate({type:'order',operator:'<=',value:4},9),
  /Expected exact original/);
 assert.throws(()=>m.predicate(rank('===',40),9),/Expected exact original/);
});
