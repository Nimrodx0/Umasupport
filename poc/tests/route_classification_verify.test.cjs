'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../data/candidates/checker_event_hints.v1.json');
const classified=require('../data/candidates/checker_route_classification.v1.json');
const {verify}=require('../src/route_classification_verify.cjs');
const copy=x=>structuredClone(x);
test('all 2109 saved events have corresponding immutable provisional status records',()=>{
 const s=verify(db,classified);
 assert.equal(s.classifiedEvents,2109);
 assert.equal(s.strictProvisionalLinks,954);
 assert.equal(s.typographySuggestions,29);
 assert.equal(s.historicalGapHypotheses,63);
 assert.equal(s.historicalUnlinkedAfterTypography,34);
 assert.equal(s.verifiedRoutes,0);
 assert.equal(s.emptySourceCards,3);
});
test('no historical ID match can silently promote a route to verified skill grant',()=>{
 const d=copy(classified);
 const e=d.cards.find(x=>x.events.length).events[0];
 e.status='verified-route';
 assert.throws(()=>verify(db,d),/Unsafe route approval/);
});
test('historical links and source digest are inseparable from exact saved candidate version',()=>{
 const wrongDigest=copy(classified);
 wrongDigest.cards.find(x=>x.events.length).events[0].sourceDigest='sha256:'+'0'.repeat(64);
 assert.throws(()=>verify(db,wrongDigest),/invalid identity/);
 const wrongDb=copy(db);
 const hint=wrongDb.cards.flatMap(x=>x.events).flatMap(e=>e.choices)
  .flatMap(c=>c.observedHints).find(h=>h.skillId);
 assert.ok(hint);
 hint.level=hint.level===10?9:hint.level+1;
 // The candidate index changed without changing source-key/ordinal or its row totals.
 assert.throws(()=>verify(wrongDb,classified),/exact current candidate database/);
});
test('historical source-only story is never classified as a confirmed modern game gap',()=>{
 const d=copy(classified);
 d.historicalPossibleGaps[0].confirmedMissingIn2026=true;
 assert.throws(()=>verify(db,d),/bounded hypothesis/);
});
