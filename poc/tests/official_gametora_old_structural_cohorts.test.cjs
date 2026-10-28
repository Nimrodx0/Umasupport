'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectOne,inspectCohort,EXPECTED}=require('../src/official_gametora_old_structural_cohorts.cjs');
function make(id){
 const t=EXPECTED[id],document={kind:'support',id:Number(id),events_ja:{}};
 for(let i=0;i<t.sections.length;i++){
  const choices=Array.from({length:t.choiceCounts[i]},()=>({label:'synthetic',effects:[{type:'speed',value:'+5'}]}));
  let remains=t.resultCounts[i]-t.choiceCounts[i];
  for(let j=0;remains>0;j=(j+1)%choices.length){
   if(!choices[j].outcomes)choices[j].outcomes=[choices[j].effects];
   choices[j].outcomes.push([{type:'guts',value:'+5'}]);remains--;
  }
  document.events_ja['case'+i]={section:t.sections[i],choices};
 }
 if(t.expectedRange){
  const e=document.events_ja.case2.choices[t.expectedRange.choice-1];
  e.effects.push({type:t.expectedRange.type,value:'+10/+30'});
 }else{
  const e=document.events_ja.case7.choices;
  // The expected 30080 four routes must be 2,1,1 rather than
  // the default distribution's first item having two (already satisfied).
  e[0].outcomes[0].push({type:'chain_end'});
 }
 return document;
}
test('three pinned old cards cover independent range and three-choice branch cohorts',()=>{
 const x=inspectCohort(['30041','30080','30030'].map(make));
 assert.deepEqual(x.cards.map(v=>v.cardId),['30030','30041','30080']);
 assert.equal(x.cards[0].numericRangeCount,1);
 assert.equal(x.cards[1].numericRangeCount,1);
 assert.equal(x.cards[2].branch.choices,3);
 assert.equal(x.cards[2].branch.explicitTerminalMentions,1);
 assert.equal(x.originalWebsiteEquivalenceVerified,false);
 assert.equal(x.productionAppJsonEquivalenceVerified,false);
 assert.equal(x.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(x),/synthetic/);
});
test('source change, range misattribution, terminal drift and duplicate cards fail closed',()=>{
 const one=make('30030');
 one.events_ja.case2.choices[1].effects[1].value='+10/+?';
 assert.throws(()=>inspectOne(one),/範囲値/);
 const two=make('30041');
 two.events_ja.case2.choices[0].effects[1].type='energy';
 assert.throws(()=>inspectOne(two),/連動範囲/);
 const three=make('30080');
 three.events_ja.case7.choices[0].outcomes[0].pop();
 assert.throws(()=>inspectOne(three),/分岐／停止/);
 assert.throws(()=>inspectCohort([make('30030'),make('30030'),make('30080')]),/揃っていない/);
});
