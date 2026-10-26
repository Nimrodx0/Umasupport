'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {enrich}=require('../src/phase2_gt_30010_correlated_or_overlay.cjs');
const {candidates}=require('../src/phase2_gt_correlated_numeric_range.cjs');
const pin='6e38b54af4fad397ff4491e63007a90705a4fe67';
function fixture(){
 const effects=[
  {type:'energy',value:'-10'},
  {type:'guts',value:'+5'},
  {type:'wisdom',value:'+5/+10'},
  {type:'skill_points',value:'+15'},
  {type:'skill_hint_or',options:[
   {skill_id:200581,value:'+1/+3'},
   {skill_id:200582,value:'+1'}
  ]}
 ];
 const e={name:'UNPUBLISHED_THIRD_PARTY_NAME',section:'arrows',
  choices:[{label:'',random_either:false,effects}]};
 const source={kind:'support',id:30010,events_ja:{
  a:{section:'random',choices:[]},b:{section:'random',choices:[]},
  c:{section:'random',choices:[]},d:{section:'random',choices:[]},e
 }};
 const index={dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:pin},
  cards:[{cardId:'30010',sourceMissing:false,gameToraObservedCount:5}]};
 const catalog={schemaVersion:1,cards:[{cardId:'30010',events:[{
  id:'gt-30010-event-005',type:'auto',name:'Independent short title',
  requires:{all:[{eventId:'gt-30010-event-004'}]},
  outcomes:[
   ['200581',1],['200582',1],['200581',3],['200582',1]
  ].map(([skillId,level],i)=>({
   id:'route-01-or-'+(i+1),label:'Anonymous result',
   rewards:[{skillId:'skill:'+skillId,level,verifiedSkillName:'verified'}]
  }))
 }]}]};
 const documents=[source],review=candidates({documents,index});
 return {catalog,documents,review};
}
test('GT30010 attaches 4 effects to each preexisting OR x tier outcome; skills and chain stay untouched',()=>{
 const input=fixture(),output=enrich(input);
 const old=input.catalog.cards[0].events[0],e=output.catalog.cards[0].events[0];
 assert.deepEqual(e.requires,old.requires);
 assert.equal(output.summary.privateEffectEventAdded,1);
 assert.equal(output.summary.attachedComponents,16);
 assert.deepEqual(e.outcomes.map(x=>x.effects.map(y=>y.delta)),[
  [-10,5,5,15],[-10,5,5,15],[-10,5,10,15],[-10,5,10,15]
 ]);
 assert.deepEqual(e.outcomes.map(x=>x.rewards),old.outcomes.map(x=>x.rewards));
 assert.equal(old.outcomes[0].effects,undefined);
 assert.equal(output.summary.publicationApproved,false);
 assert.equal(output.summary.sourceNarrativeIncluded,false);
 assert.ok(!JSON.stringify(output.summary).includes('UNPUBLISHED_THIRD_PARTY_NAME'));
});
test('different GT source, hint tiers, outcomes, effects or publication flags are rejected',()=>{
 for(const change of [
  x=>{x.documents[0].events_ja.e.choices[0].effects[2].value='+7/+10';},
  x=>{x.documents[0].events_ja.e.choices[0].effects[4].options[0].value='+1/+5';},
  x=>{x.documents[0].events_ja.e.choices[0].effects[4].options[1].skill_id=999999;},
  x=>{x.documents[0].events_ja.e.choices[0].label='choose';},
  x=>{x.catalog.cards[0].events[0].outcomes[0].rewards[0].level=3;},
  x=>{x.catalog.cards[0].events[0].outcomes[2].id='route-01-or-2';},
  x=>{x.catalog.cards[0].events[0].outcomes[3].rewards.push(
   {skillId:'skill:200581',level:3});},
  x=>{x.catalog.cards[0].events[0].outcomes[2].effects=[{kind:'wisdom',delta:10}];},
  x=>{x.catalog.cards[0].events[0].type='choice';},
  x=>{x.review.rows[0].numericTiers[1][2].delta=15;},
  x=>{x.review.rows[0].canProjectNumericTiers=false;},
  x=>{x.review.publicationApproved=true;}
 ]){
  const input=fixture();change(input);
  assert.throws(()=>enrich(input),/GT30010連動範囲とORの結果照合/);
 }
});
