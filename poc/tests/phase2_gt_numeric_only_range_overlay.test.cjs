'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {enrich}=require('../src/phase2_gt_numeric_only_range_overlay.cjs');
const {candidates}=require('../src/phase2_gt_correlated_numeric_range.cjs');
const pin='6e38b54af4fad397ff4491e63007a90705a4fe67';
const mk=(type,value,recipient)=>({type,value,...(recipient?{char_id:recipient}:{})});
function setup(){
 const specs=[
  {card:30030,ordinal:3,recipient:1062,choice:2,source:[
   [mk('mood','+1'),mk('bond','+5',1062)],
   [mk('energy','+10/+30'),mk('bond','+5',1062)]]},
  {card:30041,ordinal:3,recipient:1059,choice:1,source:[
   [mk('energy','-10'),mk('skill_points','+15/+45'),mk('bond','+5',1059)],
   [mk('guts','+5'),mk('wisdom','+5'),mk('bond','+5',1059)]]}
 ];
 const documents=specs.map(spec=>({kind:'support',id:spec.card,
  events_ja:Object.fromEntries(Array.from({length:spec.ordinal},(_,i)=>['k'+i,
   i===spec.ordinal-1?{section:'arrows',name:'SOURCE_TEXT',
    choices:spec.source.map(effects=>({label:'SOURCE_CHOICE',random_either:false,effects}))}:
    {section:'random',choices:[{label:'',effects:[]}]}
  ]))}));
 const catalog={schemaVersion:1,cards:specs.map(spec=>({cardId:String(spec.card),
  events:[{id:'gt-'+spec.card+'-event-'+String(spec.ordinal).padStart(3,'0'),
   name:'private',type:'choice',choices:[{id:'choice-01',label:'first',rewards:[]},
    {id:'choice-02',label:'second',rewards:[]}]}]}))};
 const index={dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:pin},
  cards:specs.map(spec=>({cardId:String(spec.card),sourceMissing:false,
   gameToraObservedCount:spec.ordinal}))};
 return {catalog,documents,review:candidates({documents,index})};
}
test('numeric-only ranges become linked conditional outcomes without adding skills',()=>{
 const x=setup(),out=enrich(x);
 assert.equal(out.summary.newCorrelatedChoiceEvents,2);
 assert.equal(out.summary.newCorrelatedResultLeaves,4);
 assert.equal(out.summary.addedNumericComponents,15);
 const [a,b]=out.catalog.cards.map(c=>c.events[0]);
 assert.deepEqual(a.choices[1].outcomes.map(r=>r.effects.map(e=>e.delta)),
  [[10,5],[30,5]]);
 assert.deepEqual(b.choices[0].outcomes.map(r=>r.effects.map(e=>e.delta)),
  [[-10,15,5],[-10,45,5]]);
 assert.deepEqual(a.choices[0].effects.map(e=>e.delta),[1,5]);
 assert.deepEqual(b.choices[1].effects.map(e=>e.delta),[5,5,5]);
 assert.ok(a.choices[1].outcomes.every(r=>r.rewards.length===0));
 assert.ok(x.catalog.cards.every(c=>c.events[0].choices.every(ch=>ch.outcomes===undefined)));
 assert.ok(!JSON.stringify(out.summary).includes('SOURCE_TEXT'));
});
test('unverified source ranges and downstream choice-sensitive dependencies fail closed',()=>{
 for(const alter of [
  a=>{a.documents[0].events_ja.k2.choices[1].effects[0].value='+20/+30';},
  a=>{a.catalog.cards[0].events[0].choices[1].outcomes=[];},
  a=>{a.catalog.cards[1].events[0].choices[0].rewards=[{skillId:'skill:2'}];},
  a=>{a.review.publicationApproved=true;},
  a=>{a.catalog.cards[0].events.push({id:'later',type:'auto',
   requires:{all:[{eventId:'gt-30030-event-003',choiceId:'choice-02'}]},rewards:[]});}
 ]){
  const a=structuredClone(setup());alter(a);
  assert.throws(()=>enrich(a),/GT数値限定連動結果/);
 }
});
