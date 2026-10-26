'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const schema=require('../src/event_schema.js');
const {apply}=require('../src/phase2_gt_nonskill_only_range_overlay.cjs');
const {candidates}=require('../src/phase2_gt_correlated_numeric_range.cjs');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const eff=(type,value,char_id)=>({type,value,...(char_id?{char_id}:{})});
function setup(){
 const configs=[
  {id:30030,ranged:1,effects:[
   [eff('mood','+1'),eff('bond','+5',1062)],
   [eff('energy','+10/+30'),eff('bond','+5',1062)]]},
  {id:30041,ranged:0,effects:[
   [eff('energy','-10'),eff('skill_points','+15/+45'),eff('bond','+5',1059)],
   [eff('guts','+5'),eff('wisdom','+5'),eff('bond','+5',1059)]]}
 ];
 const documents=configs.map(c=>({kind:'support',id:c.id,events_ja:{
  one:{section:'random',choices:[]},two:{section:'random',choices:[]},
  third:{section:'arrows',name:'PROPRIETARY_TEXT',choices:c.effects.map(e=>({
   label:'PRIVATE_CHOICE_TEXT',random_either:false,effects:e}))}
 }}));
 const index={dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:rev},
  cards:configs.map(c=>({cardId:String(c.id),sourceMissing:false,
   gameToraObservedCount:3}))};
 const catalog={schemaVersion:1,cards:configs.map(c=>({
  cardId:String(c.id),events:[{id:'gt-'+c.id+'-event-003',
   name:'Source-independent name',type:'choice',
   requires:{all:[{eventId:'gt-'+c.id+'-event-002'}]},
   choices:[1,2].map(j=>({id:'choice-0'+j,label:'anonymous',rewards:[]}))}]
 }))};
 return {catalog,documents,review:candidates({documents,index})};
}
test('30030 and 30041 split only selected numeric-range choice into two mutually exclusive results',()=>{
 const input=setup(),res=apply(input);
 assert.equal(res.summary.eventsWithNumericTierOverlay,2);
 assert.equal(res.summary.addedComponents,15);
 assert.equal(res.summary.twoResultChoices,2);
 const card30=res.catalog.cards.find(c=>c.cardId==='30030'),e30=card30.events[0];
 const card41=res.catalog.cards.find(c=>c.cardId==='30041'),e41=card41.events[0];
 assert.deepEqual(e30.choices[1].outcomes.map(o=>o.effects.map(x=>[x.kind,x.delta])),[
  [['energy',10],['bond',5]],[['energy',30],['bond',5]]
 ]);
 assert.deepEqual(e41.choices[0].outcomes.map(o=>o.effects.map(x=>[x.kind,x.delta])),[
  [['energy',-10],['skill_points',15],['bond',5]],
  [['energy',-10],['skill_points',45],['bond',5]]
 ]);
 assert.deepEqual(e30.requires,input.catalog.cards[0].events[0].requires);
 assert.deepEqual(e41.requires,input.catalog.cards[1].events[0].requires);
 assert.equal(input.catalog.cards[0].events[0].choices[1].outcomes,undefined);
 assert.equal(input.catalog.cards[1].events[0].choices[0].outcomes,undefined);
 assert.equal(res.summary.publicationApproved,false);
 assert.ok(!JSON.stringify(res.summary).includes('PROPRIETARY_TEXT'));
 const mini={cards:res.catalog.cards.map(c=>({id:c.cardId}))};
 mini.cardById=Object.fromEntries(mini.cards.map(c=>[c.id,c]));
 mini.skillById={};
 // Add a no-award previous stage to preserve exact parent prerequisites.
 const schemas={schemaVersion:1,cards:res.catalog.cards.map(c=>({
  ...c,events:[{id:'gt-'+c.cardId+'-event-002',name:'prior',type:'auto',rewards:[]},
   ...c.events]}))};
 assert.equal(schema.validateCatalog(schemas,mini).eventsWithRecords,4);
 for(const c of res.catalog.cards){
  const e=c.events[0],r=e.choices.find(x=>x.outcomes);
  const isolated={id:c.cardId,events:[{...e,requires:undefined}]};
  const unresolved=core.directEffectRoutes(isolated,{choices:{[e.id]:r.id}});
  const low=core.directEffectRoutes(isolated,{choices:{[e.id]:r.id},
   outcomes:{[e.id]:'range-tier-1'}});
  const high=core.directEffectRoutes(isolated,{choices:{[e.id]:r.id},
   outcomes:{[e.id]:'range-tier-2'}});
  assert.equal(unresolved.length,low.length+high.length);
  assert.ok(unresolved.every(x=>x.conditional));
  assert.ok(!low.some(x=>x.outcomeId==='range-tier-2'));
  assert.ok(!high.some(x=>x.outcomeId==='range-tier-1'));
  assert.equal(core.directEffectRoutes(isolated,{choices:{}}).length,0);
  assert.deepEqual(core.directRoutes(isolated,{choices:{[e.id]:r.id}}),[]);
 }
});
test('any mismatch in source values, choice identities, existing rewards or source pin rejects both events',()=>{
 const variants=[
  a=>a.catalog.cards[0].events[0].choices[1].rewards=[{skillId:'skill:99',level:1}],
  a=>a.catalog.cards[1].events[0].choices[0].id='choice-02',
  a=>a.catalog.cards[0].events[0].choices[1].outcomes=[{id:'fake',rewards:[]}],
  a=>a.documents[0].events_ja.third.choices[1].effects[0].value='+10/+50',
  a=>a.documents[1].events_ja.third.choices[0].effects[1].value='+15/+40',
  a=>a.documents[1].events_ja.third.choices[0].random_either=true,
  a=>a.review.rows[0].canProjectNumericTiers=false,
  a=>a.review.publicationApproved=true,
  a=>a.review.sourcePin='changed'
 ];
 for(const edit of variants){
  const args=setup();edit(args);
  assert.throws(()=>apply(args),/GT数値のみ連動結果/);
 }
});
