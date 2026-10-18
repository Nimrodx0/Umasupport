const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decideNumericEffect}=require('../src/event_source_precedence.cjs');
const withUrl='https://gamewith.jp/uma-musume/article/show/573288';
const eightUrl='https://game8.jp/umamusume/811059';
const withClaim=value=>({source:'GameWith',value,url:withUrl});
const eightClaim=value=>({source:'Game8',value,url:eightUrl});
test('three localized SSR30311 discrepancies resolve to the requested GameWith default',()=>{
 // Numbers only, never ingest/copied event prose. These are guide-site
 // values, not independently confirmed official game effects.
 for(const [withValue,eightValue] of [[10,5],[10,5],[10,15]]){
  const x=decideNumericEffect([eightClaim(eightValue),withClaim(withValue)]);
  assert.equal(x.status,'provisional');
  assert.equal(x.selected.source,'GameWith');
  assert.equal(x.selected.value,10);
  assert.equal(x.disagreements.length,1);
  assert.equal(x.disagreements[0].value,eightValue);
  assert.equal(x.gameVerified,false);
  assert.equal(x.publicationApproved,false);
 }
});
test('agreeing sites do not independently certify a result',()=>{
 const x=decideNumericEffect([withClaim(5),eightClaim(5)]);
 assert.equal(x.selected.value,5);
 assert.deepEqual(x.disagreements,[]);
 assert.equal(x.gameVerified,false);
});
test('absence of primary source stays unresolved, never silently falls back',()=>{
 const x=decideNumericEffect([eightClaim(15)]);
 assert.equal(x.status,'unresolved-primary-missing');
 assert.equal(x.selected,null);
 assert.equal(x.gameVerified,false);
 assert.equal(x.publicationApproved,false);
});
test('duplicate contradictory source values and forged domains are rejected',()=>{
 assert.throws(()=>decideNumericEffect([withClaim(10),withClaim(5)]),/矛盾/);
 assert.throws(()=>decideNumericEffect([withClaim(10),{source:'GameWith',value:3,
  url:'https://gamewith.jp.attacker.test/fake'}]),/不正/);
 assert.throws(()=>decideNumericEffect([{...withClaim(10),value:NaN}]),/不正/);
 assert.throws(()=>decideNumericEffect([]),/必要/);
 assert.throws(()=>decideNumericEffect([{...withClaim(10),source:'unknown'}]),/不正/);
});
