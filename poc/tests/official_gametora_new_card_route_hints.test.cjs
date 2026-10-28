'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {hintSignature,summarizeCandidateRouteHints}=
 require('../src/official_gametora_new_card_route_hints.cjs');
const h=(id,level)=>({status:'unique-verified-name',numericId:id,level});
test('two choices with one OR result bind numeric ID+level independently from whole panel',()=>{
 const r=summarizeCandidateRouteHints([{
  globalHints:[h('201',1),h('202',2),h('203',3)],
  routes:[
   {choiceOrdinal:1,outcomeOrdinal:1,hints:[h('201',1)],unresolvedOr:false},
   {choiceOrdinal:2,outcomeOrdinal:1,hints:[h('202',2)],unresolvedOr:false},
   {choiceOrdinal:2,outcomeOrdinal:2,hints:[h('203',3)],unresolvedOr:false}
  ]
 }]);
 assert.equal(r.eventPanelsCompared,1);
 assert.equal(r.candidateRoutesObserved,3);
 assert.equal(r.hintIdLevelCandidatesBoundToRoute,3);
 assert.equal(r.allCandidateHintIdLevelPairsAssigned,true);
 assert.equal(r.officialGameOutcomeMeaningVerified,false);
 assert.equal(r.chainAndOutingProgressionVerified,false);
 assert.equal(r.publicationApproved,false);
});
test('different hint levels under the same skill ID cannot be silently matched',()=>{
 const r=summarizeCandidateRouteHints([{
  globalHints:[h('201',1)],routes:[
  {choiceOrdinal:1,outcomeOrdinal:1,hints:[h('201',2)],unresolvedOr:false}]
 }]);
 assert.equal(r.missingNormalizedPairs,1);
 assert.equal(r.extraNormalizedPairs,1);
 assert.equal(r.allCandidateHintIdLevelPairsAssigned,false);
});
test('ambiguous OR or unknown id isolates evidence instead of treating it as approved',()=>{
 const r=summarizeCandidateRouteHints([{
  globalHints:[h('201',2),{status:'ambiguous-name-or-id',level:1}],
  routes:[{choiceOrdinal:1,outcomeOrdinal:1,
   hints:[h('201',2),{status:'ambiguous-name-or-id',level:1}],unresolvedOr:true}]
 }]);
 assert.equal(r.unclassifiedWholePanelHintCandidates,1);
 assert.equal(r.eventsWithUnresolvedOrStructure,1);
 assert.equal(r.allCandidateHintIdLevelPairsAssigned,false);
});
test('duplicate route coordinates, impossible groups, nonsensical level are rejected or quarantined',()=>{
 assert.equal(hintSignature(h('201',0)),null);
 assert.equal(hintSignature({status:'unique-verified-name',numericId:'a',level:2}),null);
 assert.throws(()=>summarizeCandidateRouteHints([{
  globalHints:[],routes:[
   {choiceOrdinal:1,outcomeOrdinal:1,hints:[]},
   {choiceOrdinal:1,outcomeOrdinal:1,hints:[]}]
 }]),/重複/);
 assert.throws(()=>summarizeCandidateRouteHints([{globalHints:[],routes:'bad'}]),/不正/);
});
test('no visible groups are a blocker even with zero reported hint facts',()=>{
 const r=summarizeCandidateRouteHints([{globalHints:[],routes:[]}]);
 assert.equal(r.eventsWithAllKnownHintPairsAssigned,0);
 assert.equal(r.eventsWithoutVisibleRouteGroups,1);
 assert.equal(r.allCandidateHintIdLevelPairsAssigned,false);
});
test('empty visible card cannot be mistaken for verified event data',()=>{
 const r=summarizeCandidateRouteHints([]);
 assert.equal(r.eventPanelsCompared,0);
 assert.equal(r.allCandidateHintIdLevelPairsAssigned,false);
 assert.equal(r.publicationApproved,false);
});
