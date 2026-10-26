'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const schema=require('../src/event_schema.js');
const {enrich}=require('../src/phase2_gt_30090_terminal_bond_overlay.cjs');
const {candidates}=require('../src/phase2_gt_correlated_numeric_range.cjs');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const evt='gt-30090-event-004';
function setup(){
 const originalEvent={name:'SOURCE_TEXT_NOT_FOR_PUBLICATION',section:'arrows',
  choices:[
   {label:'THIRD_PARTY_CHOICE_1',random_either:false,effects:[
    {type:'energy',value:'+10'},{type:'skill_points',value:'+10'},
    {type:'skill_hint',value:'+1',skill_id:201142},
    {type:'bond',value:'+5',char_id:1017}
   ]},
   {label:'THIRD_PARTY_CHOICE_2',random_either:false,effects:[
    {type:'energy',value:'-10'},{type:'stamina',value:'+25'},
    {type:'guts',value:'+25'},{type:'bond',value:'-5/+5',char_id:1017},
    {type:'chain_end'}
   ]}
  ]};
 const documents=[{id:30090,kind:'support',events_ja:{
  a:{section:'random',choices:[]},b:{section:'random',choices:[]},
  c:{section:'random',choices:[]},d:originalEvent
 }}];
 const index={dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:rev},
  cards:[{cardId:'30090',sourceMissing:false,gameToraObservedCount:4}]};
 const review=candidates({documents,index});
 const catalog={schemaVersion:1,cards:[{cardId:'30090',events:[
  {id:'gt-30090-event-003',name:'Earlier',type:'auto',rewards:[]},
  {id:evt,name:'Non-source title',type:'choice',
   requires:{all:[{eventId:'gt-30090-event-003'}]},choices:[
    {id:'choice-01',label:'Choice 1',rewards:[
     {skillId:'skill:201142',level:1,verifiedSkillName:'Verified'}]},
    {id:'choice-02',label:'Choice 2',rewards:[],terminal:true}
   ]},
  {id:'gt-30090-event-005',name:'Later stage',type:'auto',
   requires:{all:[{eventId:evt,choiceId:'choice-02'}]},rewards:[]}
 ]}]};
 return {catalog,documents,review};
}
test('GT30090 splits -5/+5 bond while BOTH results continue to terminate the chain',()=>{
 const f=setup(),out=enrich(f);
 const original=f.catalog.cards[0].events[1],e=out.catalog.cards[0].events[1];
 assert.equal(out.summary.numericComponentsAdded,11);
 assert.equal(out.summary.skillCardChecks,1);
 assert.deepEqual(e.requires,original.requires);
 assert.equal(e.choices[1].terminal,undefined);
 assert.deepEqual(e.choices[1].outcomes.map(x=>x.terminal),[true,true]);
 assert.deepEqual(e.choices[1].outcomes.map(x=>x.effects.map(y=>y.delta)),[
  [-10,25,25,-5],[-10,25,25,5]
 ]);
 assert.deepEqual(e.choices[0].effects.map(x=>x.delta),[10,10,5]);
 assert.deepEqual(e.choices[0].rewards,original.choices[0].rewards);
 assert.equal(original.choices[1].terminal,true);
 assert.equal(original.choices[1].outcomes,undefined);
 for(const suffix of ['', 'bond-tier-1','bond-tier-2']){
  const state={choices:{[evt]:'choice-02'},outcomes:suffix?{[evt]:suffix}:{}};
  const reachable=core.isReachable(out.catalog.cards[0].events[2],
   state.choices,out.catalog.cards[0].events,state.outcomes);
  assert.equal(reachable,false,'no successor after either terminal outcome');
 }
 const mini={cards:[{id:'30090'}]};mini.cardById={'30090':mini.cards[0]};
 mini.skillById={'skill:201142':{id:'skill:201142'}};
 assert.equal(schema.validateCatalog(out.catalog,mini).eventsWithRecords,3);
 assert.equal(out.summary.publicationApproved,false);
 assert.equal(out.summary.sourceNarrativeIncluded,false);
 assert.ok(!JSON.stringify(out.summary).includes('THIRD_PARTY'));
});
test('GT30090 rejects any altered chain end, bond target, scalar effect, reward, or provenance',()=>{
 const mutations=[
  x=>x.documents[0].events_ja.d.choices[1].effects[3].value='+5/+10',
  x=>x.documents[0].events_ja.d.choices[1].effects[3].char_id=999,
  x=>x.documents[0].events_ja.d.choices[1].effects.pop(),
  x=>x.documents[0].events_ja.d.choices[1].effects[4].value='+1',
  x=>x.documents[0].events_ja.d.choices[0].effects[2].skill_id=201143,
  x=>x.catalog.cards[0].events[1].choices[1].terminal=false,
  x=>x.catalog.cards[0].events[1].choices[1].rewards=[{skillId:'skill:999'}],
  x=>x.catalog.cards[0].events[1].choices[1].outcomes=[{id:'bogus'}],
  x=>x.catalog.cards[0].events[1].choices[0].rewards[0].level=3,
  x=>x.catalog.cards[0].events[1].choices[0].effects=[{kind:'energy',delta:10}],
  x=>x.review.rows[0].blockers=[],
  x=>x.review.publicationApproved=true
 ];
 for(const mutate of mutations){
  const f=setup();mutate(f);
  assert.throws(()=>enrich(f),/GT30090絆幅・両結果打ち切り/);
 }
});
