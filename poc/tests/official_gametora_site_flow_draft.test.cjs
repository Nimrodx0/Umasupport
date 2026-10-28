'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {routeFlowCandidates,summarizeFlowDraft}=
 require('../src/official_gametora_site_flow_draft.cjs');
const r=(choiceGroupOrdinal,resultOrdinal,flowOwnTexts,unresolvedOr=false)=>({
 choiceGroupOrdinal,resultOrdinal,flowOwnTexts,unresolvedOr
});
const draft=(routes)=>routeFlowCandidates({cardId:'30323',siteEventOrdinal:8,routes});
test('explicit outing unlock markers are local to two independent result groups',()=>{
 const x=draft([
  r(1,1,['お出かけができるようになる']),
  r(2,1,['おでかけが可能になる'])
 ]);
 assert.equal(x.visibleMarkerKinds,2);
 assert.equal(x.locatedVisibleMarkerKinds,2);
 assert.deepEqual(summarizeFlowDraft(x).markerCounts,{'explicit-outing-unlock':2});
 assert.equal(x.routes[0].safelyAttributedToResult,true);
 assert.equal(x.appEventSchemaAdoptable,false);
 assert.equal(x.everyContinuationAndDependencyVerified,false);
 assert.doesNotMatch(JSON.stringify(x),/お出かけが|おでかけが/);
});
test('explicit chain termination is distinct from an outing stop and a numeric reward',()=>{
 const x=draft([
  r(1,1,['連続イベント打ち切り','体力 -10']),
  r(1,2,['お出かけイベント終了']),
  r(2,1,['体力 +10'])
 ]);
 assert.deepEqual(x.routes[0].visibleMarkerKinds,['explicit-chain-stop']);
 assert.deepEqual(x.routes[1].visibleMarkerKinds,['explicit-outing-stop']);
 assert.deepEqual(x.routes[2].visibleMarkerKinds,[]);
 assert.equal(x.missingMarkersMeanContinuation,false);
});
test('unresolved OR never attributes an explicit stop to one result',()=>{
 const x=draft([r(1,1,['連続イベント終了'],true)]);
 assert.equal(x.unlocatedVisibleMarkerKinds,1);
 assert.equal(x.locatedVisibleMarkerKinds,0);
 assert.equal(x.routes[0].safelyAttributedToResult,false);
 assert.equal(x.routes[0].nextEventReachabilityVerified,false);
});
test('no stop visible is not evidence of future chain continuation',()=>{
 const x=draft([r(1,1,['スタミナ +15'])]);
 assert.equal(x.visibleMarkerKinds,0);
 assert.equal(x.missingMarkersMeanContinuation,false);
 assert.equal(summarizeFlowDraft(x).allContinuationVerified,false);
});
test('similar non-explicit sentences do not become unlock or stop flags',()=>{
 const x=draft([r(1,1,['お出かけについて相談した',
  '連続イベントの感想','イベントがおわったと思う'])]);
 assert.deepEqual(x.routes[0].visibleMarkerKinds,[]);
});
test('duplicate route and malformed text fail closed',()=>{
 assert.throws(()=>draft([r(1,1,[]),r(1,1,[])]),/duplicate/);
 assert.throws(()=>draft([r(1,1,['x'.repeat(301)])]),/invalid/);
 assert.throws(()=>routeFlowCandidates({cardId:'unknown',siteEventOrdinal:1,routes:[]}),/invalid/);
});
