'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectVisibleRange,signedValues}=require('../src/official_gametora_old_range_dom.cjs');
const {EXPECTED}=require('../src/official_gametora_old_structural_cohorts.cjs');
function doc(id){
 const p=EXPECTED[id],events_ja={};
 for(let i=0;i<p.eventCount;i++){
  const choices=Array.from({length:p.choiceCounts[i]},()=>({
   label:'test choice',effects:[{type:'speed',value:'+5'}]
  }));
  let extra=p.resultCounts[i]-p.choiceCounts[i];
  for(let j=0;extra>0;j=(j+1)%choices.length){
   if(!choices[j].outcomes)choices[j].outcomes=[choices[j].effects];
   choices[j].outcomes.push([{type:'power',value:'+5'}]);extra--;
  }
  events_ja['e'+i]={name:'synthetic '+i,section:p.sections[i],choices};
 }
 const a=p.expectedRange,choice=events_ja['e'+(a.event-1)].choices[a.choice-1];
 choice.effects.push({type:a.type,value:id==='30030'?'+10/+30':'+15/+45'});
 return {kind:'support',id:Number(id),events_ja};
}
function observation(id,fragments){
 const spec=EXPECTED[id].expectedRange;
 const choiceGroups=Array.from({length:2},()=>({fragments:[]}));
 choiceGroups[spec.choice-1]={fragments};
 return {cardId:id,targetSourceOrdinal:spec.event,titleMatchCount:1,choiceGroups};
}
test('two old card source ranges match only independently visible typed numbers within the selected choice',()=>{
 for(const id of ['30030','30041']){
  const kind=id==='30030'?'体力':'スキルPt';
  const pair=id==='30030'?[10,30]:[15,45];
  const x=inspectVisibleRange(doc(id),observation(id,[kind+' +'+pair[0]+'/'+('+'+pair[1])]));
  assert.equal(x.exactBothNumericAlternativesVisibleInTargetGroup,true);
  assert.equal(x.bothValuesCooccurInOneTypedFragment,true);
  assert.equal(x.fullChoiceAndOutcomeSemanticsVerified,false);
  assert.equal(x.publicationApproved,false);
  assert.doesNotMatch(JSON.stringify(x),/synthetic|test choice/);
 }
});
test('a numeric amount from a different choice or effect kind cannot prove a range',()=>{
 const id='30030',o=observation(id,['体力 +10','絆 +30']);
 let q=inspectVisibleRange(doc(id),o);
 assert.equal(q.exactBothNumericAlternativesVisibleInTargetGroup,false);
 o.choiceGroups[0].fragments=['体力 +30'];
 q=inspectVisibleRange(doc(id),o);
 assert.equal(q.exactBothNumericAlternativesVisibleInTargetGroup,false);
 o.choiceGroups[1].fragments=['体力 +10','体力 +30','体力 +50'];
 q=inspectVisibleRange(doc(id),o);
 assert.equal(q.exactBothNumericAlternativesVisibleInTargetGroup,false);
});
test('strict source/DOM identity rejects wrong card, duplicate heading, missing ordinal, source drift',()=>{
 const d=doc('30041'),o=observation('30041',['スキルPt +15','スキルPt +45']);
 o.titleMatchCount=2;
 assert.throws(()=>inspectVisibleRange(d,o),/不正/);
 o.titleMatchCount=1;
 o.targetSourceOrdinal=4;
 assert.throws(()=>inspectVisibleRange(d,o),/不正/);
 o.targetSourceOrdinal=3;
 d.events_ja.e2.choices[0].effects[1].value='+5/+99';
 assert.throws(()=>inspectVisibleRange(d,o),/範囲|変化/);
});
test('signed parser keeps negatives, multiple alternatives and rejects excessively long text',()=>{
 assert.deepEqual(signedValues('体力 -10/+30'),[-10,30]);
 assert.deepEqual(signedValues('スキルPt +15／+45'),[15,45]);
 assert.deepEqual(signedValues('x'.repeat(351)),[]);
});
