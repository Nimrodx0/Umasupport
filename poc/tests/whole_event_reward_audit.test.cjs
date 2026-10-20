'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {analyzeChoice,numericHint,sourceHint,compareChoiceLabel}=require('../tools/audit_whole_event_rewards.cjs');
const ch=(parts,structure='unspecified',diagnostics=[])=>
 ({structure,diagnostics,results:parts.map((skillHints,i)=>({
  resultKind:structure==='unspecified'?'unspecified':i===0?'success':'failure',
  skillHints,terminalObserved:false}))});
const choice=(groups)=>groups.length===1?{effects:groups[0]}:{outcomes:groups,random_either:true};
const hint=(id,lv)=>({type:'skill_hint',skill_id:id,value:'+'+lv});
test('equal numeric multisets signal provisional publication agreement, not result proof',()=>{
 const result=analyzeChoice(ch([[{skillId:'200512',level:1}]]),choice([[hint(200512,1)]]));
 assert.equal(result.status,'numeric-multiset-agreement');
 assert.equal(result.outcomeEvidence,'not-comparable');
 assert.equal(result.checkerNumericHints,1);
});
test('both empty hint lists never count as confirmed no-skill outcomes',()=>{
 const result=analyzeChoice(ch([[]]),choice([[{type:'speed',value:'+7'}]]));
 assert.equal(result.status,'no-numeric-hints-observed');
});
test('absence on exactly one editorial source is flagged, not inferred as no skill',()=>{
 const a=analyzeChoice(ch([[]]),choice([[hint(200512,1)]]));
 const b=analyzeChoice(ch([[{skillId:'200512',level:1}]]),choice([[{type:'bond',value:'+5'}]]));
 assert.equal(a.status,'source-only-numeric-hints');
 assert.equal(b.status,'checker-only-numeric-hints');
 assert.deepEqual(a.hintDifference,{checker:[],gameTora:['200512:1']});
});
test('numeric skill ID or hint Lv disagreements are exact multiset exceptions',()=>{
 const a=analyzeChoice(ch([[{skillId:'200512',level:1}]]),choice([[hint(200512,2)]]));
 assert.equal(a.status,'numeric-multiset-disagreement');
 assert.deepEqual(a.hintDifference,{checker:['200512:1'],gameTora:['200512:2']});
});
test('random outcomes require unordered per-outcome comparison; order is not success mapping',()=>{
 const chk=ch([[{skillId:'200512',level:1}],[{skillId:'200512',level:3}]],'explicit-result-headings');
 const result=analyzeChoice(chk,choice([[hint(200512,3)],[hint(200512,1)]]));
 assert.equal(result.status,'numeric-multiset-agreement');
 assert.equal(result.outcomeEvidence,'unlabeled-outcome-signature-agreement');
 assert.equal(result.sourceOutcomeCount,2);
 const other=analyzeChoice(chk,choice([[hint(200512,1),hint(200512,3)],[]]));
 assert.equal(other.status,'numeric-multiset-agreement');
 assert.equal(other.outcomeEvidence,'unlabeled-outcome-signature-disagreement');
});
test('cumulative result markers do not get flattened to independent guaranteed reward',()=>{
 const result=analyzeChoice(ch([[{skillId:'200461',level:3},{skillId:'200461',level:2},{skillId:'200461',level:1}]]),
  choice([[{type:'both_previous_chain_good'},hint(200461,3),
    {type:'one_previous_chain_good'},hint(200461,2),
    {type:'both_previous_chain_bad'},hint(200461,1)]]));
 assert.equal(result.status,'prior-conditional-needs-review');
 assert.equal(result.conditionalSource,true);
});
test('unresolved Checker IDs, ranges and source OR-hints are never equated silently',()=>{
 assert.equal(analyzeChoice(ch([[{unresolvedSkillName:'X',level:1}]]),
  choice([[hint(200512,1)]])).status,'unresolved-hint-representation');
 assert.equal(analyzeChoice(ch([[{skillId:'200512',levelMin:1,levelMax:3}]]),
  choice([[hint(200512,1)]])).status,'unresolved-hint-representation');
 assert.equal(analyzeChoice(ch([[{skillId:'200512',level:1}]]),
  choice([[{type:'skill_hint_or',skill_ids:[200512,200513],value:'+1'}]])).status,
  'unresolved-hint-representation');
});
test('outcomes can have numerically same union but not same individual branches',()=>{
 const chk=ch([[{skillId:'2',level:1}],[{skillId:'3',level:1}]],'explicit-result-headings');
 const src=choice([[hint(2,1),hint(3,1)],[]]);
 const a=analyzeChoice(chk,src);
 assert.equal(a.status,'numeric-multiset-agreement');
 assert.equal(a.outcomeEvidence,'unlabeled-outcome-signature-disagreement');
});
test('malformed numeric facts fail closed',()=>{
 assert.throws(()=>numericHint({skillId:'not-number',level:2}));
 assert.throws(()=>numericHint({skillId:'234',level:0}));
 assert.deepEqual(sourceHint({type:'skill_hint',value:'non-numeric',skill_id:20}),{unresolved:true});
});

test('choice label concordance requires text rather than matching mere ordinals',()=>{
 assert.equal(compareChoiceLabel('同じ選択肢','同じ選択肢'),'label-exact-provisional');
 assert.equal(compareChoiceLabel('  全力！','全力!'),'label-exact-provisional');
 assert.equal(compareChoiceLabel('全力！','全力'),'label-typographic-provisional');
 assert.equal(compareChoiceLabel('左へ進む','右へ進む'),'label-disagreement');
 assert.equal(compareChoiceLabel('',''), 'label-not-comparable');
 assert.equal(compareChoiceLabel('左へ進む',''), 'label-not-comparable');
});
