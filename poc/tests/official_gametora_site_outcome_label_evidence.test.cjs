'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {markerFromOwnText,siteOutcomeLabelEvidence,
 summarizeSiteOutcomeLabelEvidence}=require('../src/official_gametora_site_outcome_label_evidence.cjs');
const make=(choiceOrdinal,outcomeOrdinal,resultLabelOwnTexts=[],unresolvedOr=false)=>
 ({choiceOrdinal,outcomeOrdinal,resultLabelOwnTexts,unresolvedOr});
const draft=routes=>siteOutcomeLabelEvidence({
 cardId:'30322',siteEventOrdinal:4,routes
});
test('only exact own-text success and failure are eligible, not contextual prose',()=>{
 assert.equal(markerFromOwnText('成功'), 'success');
 assert.equal(markerFromOwnText(' 失敗時 '), 'failure');
 assert.equal(markerFromOwnText('大成功'), 'great-success');
 assert.equal(markerFromOwnText('Great Success'),'great-success');
 assert.equal(markerFromOwnText('成功率+10'),null);
 assert.equal(markerFromOwnText('成功するとスキルを獲得'),null);
 assert.equal(markerFromOwnText('不成功'),null);
 assert.equal(markerFromOwnText('大失敗'),'great-failure');
});
test('one explicit success/failure pair on a separated OR group is an observation only',()=>{
 const d=draft([make(1,1,['成功']),make(1,2,['失敗']),
  make(2,1,[])]);
 const s=summarizeSiteOutcomeLabelEvidence(d);
 assert.equal(s.inspectedResultRoutes,3);
 assert.equal(s.explicitlyLabelledResultRoutes,2);
 assert.equal(s.explicitlyLabelledSuccessFailurePairGroups,1);
 assert.equal(s.orSeparatedGroupCount,1);
 assert.deepEqual(s.labelsByResult.map(x=>x.label),['success','failure',null]);
 assert.equal(d.groups[0].interpretedAsPlayerChoice,false);
 assert.equal(d.nextEventReachabilityVerified,false);
 assert.equal(d.appEventSchemaAdoptable,false);
 assert.equal(d.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(d),/成功|失敗/);
});
test('unlabelled OR does not pretend known game outcomes or single result',()=>{
 const d=draft([make(1,1),make(1,2),make(2,1)]);
 const s=summarizeSiteOutcomeLabelEvidence(d);
 assert.equal(s.orSeparatedGroupCount,1);
 assert.equal(s.explicitlyLabelledSuccessFailurePairGroups,0);
 assert.equal(s.unlabelledResultRoutes,3);
 assert.equal(d.missingLabelMeansSingleGuaranteedResult,false);
});
test('one label without a paired opposite is not a verified success/failure pair',()=>{
 const d=draft([make(1,1,['成功']),make(1,2),
  make(2,1,['失敗'])]);
 assert.equal(d.explicitSuccessFailurePairGroups,0);
 assert.equal(d.explicitLabelledRoutes,2);
});
test('multiple contradictory labels inside a result stay ambiguous',()=>{
 const d=draft([make(1,1,['成功','失敗']),make(1,2,['成功'])]);
 assert.equal(d.ambiguousLabelledRoutes,1);
 assert.equal(d.explicitSuccessFailurePairGroups,0);
 assert.equal(d.routes[0].normalizedResultLabel,null);
});
test('unresolved OR result remains unlocated even with visible label',()=>{
 const d=draft([make(1,1,['失敗'],true)]);
 assert.equal(d.routes[0].observedLabelKind,'unlocated-or-result');
 assert.equal(d.explicitLabelledRoutes,0);
 assert.equal(d.groups[0].interpretedAsPlayerChoice,false);
});
test('out-of-order and duplicated route positions must be rejected',()=>{
 assert.throws(()=>draft([make(1,1),make(1,1)]),/route-location-gap-or-reorder/);
 assert.throws(()=>draft([make(1,1),make(2,2)]),/route-location-gap-or-reorder/);
 assert.throws(()=>draft([make(1,1),make(3,1)]),/route-location-gap-or-reorder/);
});
test('untrusted input and any public promoted evidence is rejected',()=>{
 assert.throws(()=>draft([make(1,1,['a'.repeat(121)])]),/own-label-out-of-bounds/);
 assert.throws(()=>draft([make(1,1,null)]),/route-invalid/);
 assert.throws(()=>summarizeSiteOutcomeLabelEvidence({
  ...draft([make(1,1)]),publicationApproved:true}),/only-unapproved-result-evidence/);
});
