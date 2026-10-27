'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectRenderedChoices}=require('../src/official_gametora_choice_outcome_semantics.cjs');
function group(label,routeCandidateCount=1,orSeparatorCount=0,extra=[]){
 return {visibleText:label,routeCandidateCount,orSeparatorCount,ownTextFragments:extra};
}
test('2 distinct site choice labels bind to two authored choices, not two chance outcomes',()=>{
 const ref={choices:[
  {label:'最初の選択',effects:[{type:'speed',value:10}]},
  {label:'次の選択',effects:[{type:'guts',value:10},{type:'chain_end'}]}
 ]};
 const r=inspectRenderedChoices(ref,{groups:[group('最初の選択 スピード+10'),group('次の選択 根性+10',[''],0)]});
 // Recreate with fully valid group arguments to avoid conflating semantics.
 assert.equal(r.choiceCardinalityAgrees,true);
 assert.equal(r.labelMatchCount,2);
 assert.equal(r.sourceTerminalCount,1);
 assert.equal(r.sourceTerminalHasOfficialVisibleEvidence,false);
 assert.equal(r.observedTerminalRouteBindingVerified,false);
 assert.equal(r.everySourceChoiceMeaningVerified,false);
});
test('same one user choice with two OR results is not mislabeled as a 2-choice event',()=>{
 const ref={choices:[{label:'',random_either:true,outcomes:[
  [{type:'speed',value:10}],[{type:'speed',value:20}]
 ]}]};
 const r=inspectRenderedChoices(ref,{groups:[group('スピード+10 OR スピード+20',2,1)]});
 assert.equal(r.sourceChoiceCount,1);
 assert.equal(r.sourceOutcomeRoutes,2);
 assert.equal(r.visibleTopLevelGroups,1);
 assert.equal(r.visibleCandidateRoutes,2);
 assert.equal(r.alternativeOutcomeStructureAgrees,true);
 assert.equal(r.randomOutcomeMeaningVerified,false);
});
test('site text explicitly describing chain end gives evidence, not validated branch ID',()=>{
 const ref={choices:[{label:'下',effects:[{type:'chain_end'}]}]};
 const r=inspectRenderedChoices(ref,{groups:[group('下の選択肢',1,0,['連続イベント打ち切り'])]});
 assert.equal(r.siteExplicitTerminalGroups,1);
 assert.equal(r.sourceTerminalHasOfficialVisibleEvidence,true);
 assert.equal(r.observedTerminalRouteBindingVerified,false);
 assert.equal(r.nextStageDependenceVerified,false);
});
test('missing and duplicate labels, and absent OR, are not accepted',()=>{
 const ref={choices:[{label:'A',effects:[]},{label:'B',effects:[]}]};
 const missing=inspectRenderedChoices(ref,{groups:[group('A'),group('A')]});
 assert.deepEqual(missing.labelStatuses,['ambiguous-multiple-groups','label-not-found']);
 assert.equal(missing.nonemptyChoiceLabelsUnambiguouslyLocated,false);
 const alternatives={choices:[{label:'',outcomes:[[],[]],random_either:true}]};
 assert.equal(inspectRenderedChoices(alternatives,{groups:[group('just one route')]}).alternativeOutcomeStructureAgrees,false);
});
test('do not return original source labels or page text, even for unique matches',()=>{
 const r=inspectRenderedChoices({choices:[{label:'架空の選択肢',effects:[]}]},
 {groups:[group('架空の選択肢 報酬スピード+10')]});
 assert.equal(r.nonemptyChoiceLabelsUnambiguouslyLocated,true);
 assert.doesNotMatch(JSON.stringify(r),/架空/);
 assert.equal(r.publicationApproved,false);
 assert.throws(()=>inspectRenderedChoices({choices:[]},{groups:[]}),/不正/);
});
