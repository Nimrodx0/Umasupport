'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decideNumericEffect}=require('../src/event_source_precedence.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const withUrl='https://gamewith.jp/uma-musume/article/show/573288';
const eightUrl='https://game8.jp/umamusume/811059';
const gt=value=>({source:'GameTora-derived',revision:POLICY.baselineRevision,value});
const withClaim=value=>({source:'GameWith',value,url:withUrl});
const eightClaim=value=>({source:'Game8',value,url:eightUrl});
test('baseline GameTora value is chosen without requiring complete GameWith article',()=>{
 const r=decideNumericEffect([gt(3)]);
 assert.equal(r.status,'baseline-accepted');
 assert.equal(r.selected.source,'GameTora-derived');
 assert.equal(r.selected.value,3);
 assert.equal(r.publicationApproved,false);
 assert.equal(r.gameVerified,false);
});
test('GameWith adjudicates numeric disagreements, never rebuilds baseline wholesale',()=>{
 const r=decideNumericEffect([gt(1),eightClaim(3),withClaim(2)]);
 assert.equal(r.status,'adjudicated-by-gamewith');
 assert.equal(r.selected.source,'GameWith');
 assert.equal(r.selected.value,2);
 assert.equal(r.baseline.value,1);
 assert.deepEqual(r.disagreements.map(x=>x.source).sort(),['Game8','GameWith']);
});
test('GameWith corroboration does not replace accepted identical GameTora baseline',()=>{
 const r=decideNumericEffect([withClaim(3),gt(3)]);
 assert.equal(r.status,'baseline-corroborated-by-gamewith');
 assert.equal(r.selected.source,'GameTora-derived');
});
test('a discrepancy without GameWith remains localized, never auto-picks Game8',()=>{
 const a=decideNumericEffect([gt(2),eightClaim(5)]);
 assert.equal(a.status,'pending-gamewith-adjudication');
 assert.equal(a.selected,null);
 assert.equal(a.baseline.value,2);
 const b=decideNumericEffect([gt(2)],{suspected:true});
 assert.equal(b.status,'pending-gamewith-adjudication');
 assert.equal(b.selected,null);
});
test('a missing GameTora event is a scoped coverage gap; explicit GameWith facts adjudicate it',()=>{
 const a=decideNumericEffect([withClaim(2),eightClaim(2)]);
 assert.equal(a.status,'adjudicated-missing-baseline-by-gamewith');
 assert.equal(a.baselineCoverageGap,true);
 assert.equal(a.selected.source,'GameWith');
 assert.equal(a.selected.value,2);
 assert.equal(a.baseline,null);
 assert.equal(a.publicationApproved,false);
 assert.equal(a.gameVerified,false);
 const b=decideNumericEffect([eightClaim(2)]);
 assert.equal(b.status,'unresolved-baseline-missing');
 assert.equal(b.baselineCoverageGap,true);
 assert.equal(b.selected,null);
});
test('invalid urls, duplicate contradictory sources, unpinned GT or invalid numeric claim fail closed',()=>{
 assert.throws(()=>decideNumericEffect([]),/数値出典/);
 assert.throws(()=>decideNumericEffect([gt(1),gt(2)]),/矛盾/);
 assert.throws(()=>decideNumericEffect([{...gt(1),revision:'0'.repeat(40)}]),/基準版/);
 assert.throws(()=>decideNumericEffect([gt(1),{...withClaim(3),url:'https://gamewith.jp.evil.test/a'}]),/出典URL/);
 assert.throws(()=>decideNumericEffect([gt(1),{...eightClaim(2),value:NaN}]),/数値/);
 assert.throws(()=>decideNumericEffect([gt(1)],{suspected:'yes'}),/疑義/);
});
