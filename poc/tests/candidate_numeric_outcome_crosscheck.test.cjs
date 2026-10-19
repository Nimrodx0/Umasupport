'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compareEvent,validateStored}=require('../src/candidate_numeric_outcome_crosscheck.cjs');
const event=()=>({choices:[
 {ordinal:1,observedHints:[{skillId:'200111',level:2}],needsManualResultReview:false},
 {ordinal:2,observedHints:[{skillId:'200222',level:1}],needsManualResultReview:false}
]});
const single=()=>({selection:'single',choices:[
 {skills:[{skillId:200111,hintLevel:2}]},
 {skills:[{skillId:200222,hintLevel:1}]}
]});
test('matching explicit choice positions compare only numeric pairs, not outcome tiers',()=>{
 const r=compareEvent(event(),single());
 assert.equal(r.pairDifferenceClass,'same-pairs-same-count');
 assert.equal(r.ordinalComparison,'numeric-pairs-positionally-equal');
 assert.equal(r.comparedChoicePositions,2);
 assert.equal(r.outcomeTiersVerified,false);
 assert.equal(r.gameRewardVerified,false);
 assert.equal(r.conditionalChainProgressVerified,false);
});
test('planning-only auto mode may compare numeric mentions but never verifies option index',()=>{
 const r=compareEvent(event(),{selection:'auto',skills:[
  {skillId:200111,hintLevel:2},{skillId:200222,hintLevel:1}]});
 assert.equal(r.pairMultisetAgreement,true);
 assert.equal(r.ordinalComparison,'not-comparable');
 assert.equal(r.comparedChoicePositions,0);
});
test('duplicate hint mentions are separate from genuine numeric ID/level disagreements',()=>{
 const s=event();s.choices[0].observedHints.push({skillId:'200111',level:2});
 const r=compareEvent(s,single());
 assert.equal(r.pairDifferenceClass,'same-pairs-different-multiplicity');
 assert.equal(r.pairSetAgreement,true);
 assert.equal(r.pairMultisetAgreement,false);
 const q=single();q.choices[0].skills[0].hintLevel=3;
 assert.equal(compareEvent(event(),q).pairDifferenceClass,'different-numeric-pairs');
});
test('a positional match must not be declared when the second source has fewer choices',()=>{
 const q=single();q.choices.pop();
 const r=compareEvent(event(),q);
 assert.equal(r.ordinalComparison,'not-comparable');
 assert.equal(r.pairMultisetAgreement,false);
});
test('invalid source IDs, hint levels and unsupported branch styles must fail',()=>{
 assert.throws(()=>compareEvent(event(),{selection:'single',choices:[{skills:[]}]}));
 assert.throws(()=>compareEvent(event(),{selection:'auto',skills:[{skillId:2,hintLevel:1}],choices:[{skills:[]}]}));
 assert.throws(()=>compareEvent(event(),{selection:'auto',skills:[{skillId:2,hintLevel:11}]}));
});
const saved=path.resolve(__dirname,'../data/candidates/checker_first_pass_numeric_crosscheck.v1.json');
test('if committed, complete 171-group numeric comparison is present and unapproved',()=>{
 if(!fs.existsSync(saved))return;
 const db=require('../data/candidates/checker_event_hints.v1.json'),
  classification=require('../data/candidates/checker_route_classification.v1.json'),
  stages=require('../data/candidates/checker_chain_stage_audit.v1.json'),
  crosscheck=require(saved);
 const stats=validateStored({db,classification,stages,crosscheck});
 assert.equal(stats.firstPassGroups,171);
 assert.equal(stats.eventNumericIdOverlap,17);
 assert.equal(stats.samePairsSameCount,16);
 assert.equal(stats.samePairsDifferentMultiplicity,1);
 assert.equal(stats.differentNumericPairs,0);
 assert.equal(stats.ordinalPositionsEqual,3);
 assert.equal(stats.supplementalSelectionAuto,14);
 assert.equal(stats.supplementalSelectionSingle,3);
 assert.equal(stats.independentlyVerifiedGameRewards,0);
 const mutated=structuredClone(crosscheck);
 mutated.firstPassGroups.find(g=>g.supplementalEventCount).events
  .find(e=>e.supplementalPresence==='matching-numeric-story-key').gameRewardVerified=true;
 assert.throws(()=>validateStored({db,classification,stages,crosscheck:mutated}));
});
