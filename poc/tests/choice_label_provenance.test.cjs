'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {digest,reviewChoiceProvenance}=
 require('../tools/verify_choice_label_provenance.cjs');
const ledger=require('../review/choice-label-provenance-30001.v1.json');
function ref(){
 const texts=['a','b','c','d','e','f'];
 return {kind:'support',id:30001,events_ja:{
  event1:{choices:[{label:texts[0]},{label:texts[1]}]},
  event2:{choices:[{label:texts[2]},{label:texts[3]}]},
  event3:{choices:[{label:''}]},
  event4:{choices:[{label:texts[4]},{label:texts[5]}]},
  event5:{choices:[{label:''}]}
 }};
}
function matching(){
 const src=ref();
 const choices=ledger.choices.map((x,i)=>({...x,labelSha256:digest('abcdef'[i])}));
 return {src,register:{...ledger,choices}};
}
test('signed review manifest identifies exactly six choices without storing quoted material',()=>{
 const {src,register}=matching();
 const report=reviewChoiceProvenance(register,src);
 assert.equal(report.digestMatches,6);
 assert.equal(report.scopedNonemptyHistoricalChoiceLabels,6);
 assert.equal(report.eventsReviewed,3);
 assert.equal(report.genderVariantsExhaustive,false);
 assert.equal(report.selectedTrainerGender,'male');
 assert.equal(report.maleVariantChoicePositions,6);
 assert.equal(report.femaleDisplayFallbackAllowed,false);
 assert.equal(report.genderSelectionUiEnabled,false);
 assert.equal(report.automaticPublicationAllowed,false);
 assert.doesNotMatch(JSON.stringify(report),/abcdef/);
});
test('a changed label or moved ordinal is flagged, not copied',()=>{
 const {src,register}=matching();
 src.events_ja.event2.choices[1].label='changed';
 assert.equal(reviewChoiceProvenance(register,src).digestMismatches,1);
 const shifted=structuredClone(register);
 shifted.choices[0].choiceOrdinal=2;
 assert.throws(()=>reviewChoiceProvenance(shifted,ref()),/重複/);
});
test('arbitrary external web links, rights escalation, and bad source population rejected',()=>{
 const {src,register}=matching();
 for(const edit of [
  {choices:register.choices.map((x,i)=>i===0?{...x,gameWithEventPage:'https://example.com/raw'}:x)},
  {automaticTextPublicationAllowed:true},
  {publicationApproved:true},
  {choiceDisplayPolicy:{...register.choiceDisplayPolicy,gender:'female'}},
  {choiceDisplayPolicy:{...register.choiceDisplayPolicy,allowFemaleFallback:true}},
  {choices:register.choices.slice(1)}
 ])assert.throws(()=>reviewChoiceProvenance({...register,...edit},src),/不正/);
 assert.throws(()=>reviewChoiceProvenance(register,{...src,id:30322}),/不正/);
});
test('no text stored in the review ledger and only page links + numeric identities',()=>{
 const raw=JSON.stringify(ledger);
 assert.equal(ledger.cardId,'30001');
 assert.equal(ledger.choices.length,6);
 assert.equal(ledger.choices.every(x=>x.selectedGender==='male'&&x.maleLabelVerifiedInGameWithArticle===true),true);
 assert.equal(ledger.choices.every(x=>/^[a-f0-9]{64}$/.test(x.labelSha256)),true);
 assert.equal(raw.includes('ここで全力'),false);
 assert.equal(raw.includes('世界最長'),false);
});

test('individual female/unknown label sourcing cannot silently enter fixed male display ledger',()=>{
 const {src,register}=matching();
 const modified=structuredClone(register);
 modified.choices[0].selectedGender='female';
 assert.throws(()=>reviewChoiceProvenance(modified,src),/不正/);
 modified.choices[0].selectedGender='male';
 modified.choices[0].maleLabelVerifiedInGameWithArticle=false;
 assert.throws(()=>reviewChoiceProvenance(modified,src),/不正/);
});
