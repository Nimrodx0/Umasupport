'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {enrich}=require('../src/phase2_gt_30028_correlated_range_overlay.cjs');
const {candidates}=require('../src/phase2_gt_correlated_numeric_range.cjs');
const pin='6e38b54af4fad397ff4491e63007a90705a4fe67';
function setup(){
 const doc={kind:'support',id:30028,events_ja:{
  first:{section:'random',name:'private',choices:[{label:'',effects:[]}]},
  second:{section:'random',name:'private',choices:[{label:'',effects:[]}]},
  third:{section:'random',name:'private',choices:[{label:'',effects:[]}]},
  fourth:{section:'arrows',name:'THIRD_PARTY_TEXT',choices:[
   {label:'secret1',random_either:false,effects:[
    {type:'energy',value:'+10'},{type:'mood',value:'+1'},
    {type:'bond',value:'+5',char_id:1068}]},
   {label:'secret2',random_either:false,effects:[
    {type:'speed',value:'+5/+10'},
    {type:'skill_hint',value:'+1/+3',skill_id:200362},
    {type:'bond',value:'+5',char_id:1068}]}
  ]}
 }};
 const index={dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:pin},
  cards:[{cardId:'30028',sourceMissing:false,gameToraObservedCount:4}]};
 const catalog={schemaVersion:1,cards:[{cardId:'30028',events:[{
  id:'gt-30028-event-004',name:'anonymous',type:'choice',choices:[
   {id:'choice-01',label:'first',rewards:[]},
   {id:'choice-02',label:'second',outcomes:[
    {id:'route-01-or-1',label:'lo',
     rewards:[{skillId:'skill:200362',verifiedSkillName:'private',level:1}]},
    {id:'route-01-or-2',label:'hi',
     rewards:[{skillId:'skill:200362',verifiedSkillName:'private',level:3}]}
   ]}
  ]}]}]};
 const documents=[doc],review=candidates({documents,index});
 return {catalog,documents,review};
}
test('SSR30028 shared speed and skill range results attach to exact corresponding hint tiers',()=>{
 const input=setup(),x=enrich(input);
 assert.equal(x.summary.privateEffectEventAdded,1);
 assert.equal(x.summary.attachedComponents,7);
 assert.deepEqual(x.catalog.cards[0].events[0].choices[0].effects,[
  {kind:'energy',delta:10},{kind:'mood',delta:1},
  {kind:'bond',delta:5,recipientCharId:1068}]);
 const outcomes=x.catalog.cards[0].events[0].choices[1].outcomes;
 assert.deepEqual(outcomes.map(y=>y.effects.map(z=>z.delta)),[[5,5],[10,5]]);
 assert.deepEqual(outcomes.map(y=>y.rewards[0].level),[1,3]);
 assert.equal(input.catalog.cards[0].events[0].choices[1].outcomes[0].effects,undefined);
 assert.equal(x.summary.publicationApproved,false);
 assert.ok(!JSON.stringify(x.summary).includes('THIRD_PARTY_TEXT'));
});
test('invalid tier ancestry, mismatched source hint, or implicit results reject whole event',()=>{
 const base=setup();
 for(const manipulate of [
  f=>{f.catalog.cards[0].events[0].choices[1].outcomes[0].id='route-01-or-2';},
  f=>{f.catalog.cards[0].events[0].choices[1].outcomes[1].rewards[0].level=1;},
  f=>{f.catalog.cards[0].events[0].choices[1].outcomes[1].rewards[0].skillId='skill:999';},
  f=>{f.catalog.cards[0].events[0].choices[1].outcomes=[];},
  f=>{f.catalog.cards[0].events[0].choices[1].effects=[{kind:'speed',delta:10}];},
  f=>{f.documents[0].events_ja.fourth.choices[1].effects[0].value='+7/+10';},
  f=>{f.review.rows[0].canProjectNumericTiers=false;},
  f=>{f.review.publicationApproved=true;}
 ]){
  const x=structuredClone(base);manipulate(x);
  assert.throws(()=>enrich(x),/GT連動範囲スキル同時結果照合/);
 }
});
