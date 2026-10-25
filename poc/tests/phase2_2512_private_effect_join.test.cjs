'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {mergeEvent,assemble}=require('../src/phase2_2512_private_effect_join.cjs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
function fixture(){
 const skillEvents=[
  {id:'gt-30001-event-001',name:'技術内部イベント1',type:'auto',
   rewards:[{skillId:'skill:200001',level:1}]},
  {id:'gt-30001-event-002',name:'技術内部イベント2',type:'choice',choices:[
   {id:'choice-01',label:'上',outcomes:[
    {id:'route-01',label:'成功',rewards:[{skillId:'skill:200001',level:3}]},
    {id:'route-02',label:'失敗',rewards:[]}]},
   {id:'choice-02',label:'下',rewards:[],terminal:true}]},
  {id:'gt-30001-event-003',name:'技術内部イベント3',type:'auto',
   requires:{all:[{eventId:'gt-30001-event-002'}]},
   rewards:[{skillId:'skill:200001',level:2}]},
  {id:'usl:30001:extra',name:'特別',type:'auto',rewards:[]}
 ];
 const catalog={schemaVersion:1,cards:[{cardId:'30001',coverageStatus:'partial',events:skillEvents}]};
 const skillRuntime={
  dataKind:'phase2-2512-nonpublishing-with-30180-special-hint',
  publicationApproved:false,noAutomaticRuntimeAdoption:true,
  reviewedEventsPublished:0,sourceNarrativeOrChoiceProseIncluded:false,
  catalog,summary:{totalCandidateEvents:4,catalogSha256:hash(catalog)}
 };
 const effects={schemaVersion:1,cards:[{
  cardId:'30001',coverageStatus:'partial',
  events:[
   {id:'gt:30001:001:effect-only',name:'匿名1',type:'auto',
    effects:[{kind:'guts',delta:3},{kind:'bond',delta:5,recipientCharId:1003}]},
   {id:'gt:30001:002:effect-only',name:'匿名2',type:'choice',choices:[
    {id:'choice-1',label:'番号1',outcomes:[
     {id:'result-1',label:'結果1',effects:[{kind:'energy',delta:-10}]},
     {id:'result-2',label:'結果2',effects:[{kind:'mood',delta:-1}]}]},
    {id:'choice-2',label:'番号2',terminal:true,effects:[{kind:'speed',delta:5}]}]},
   {id:'gt:30001:003:effect-only',name:'匿名3',type:'auto',
    effects:[{kind:'power',delta:10,sourceBundle:'all_stats'}]}
  ]
 }]};
 // Third effect intentionally invalid as partial 5-stat bundle in a
 // synthetic isolated shape? Source inventory enforces schema but passes it
 // in the runtime; choose simple scalar instead for this fixture.
 effects.cards[0].events[2].effects[0]={kind:'power',delta:10};
 const effectInventory={dataKind:'phase2-gt-whole-nonskill-effect-inventory',
  publicationApproved:false,automaticRuntimeAdoption:false,
  sourceProseIncluded:false,chainTopologyVerified:false,
  onlyIsolatedEffectShapePreview:true,
  sourcePins:{gameToraDerived:rev},
  summary:{isolatedPreviewEventRecords:3,sourceEvents:3},
  isolatedPreview:effects};
 return {skillRuntime,effectInventory};
}
test('a same-source 1:1/choice/outcome join leaves all original skill routes and chain flags intact',()=>{
 const f=fixture(),before=structuredClone(f),r=assemble(f);
 assert.equal(r.summary.cards,1);
 assert.equal(r.summary.events,4);
 assert.equal(r.summary.combinedEventRecords,3);
 assert.equal(r.summary.combinedNumericComponents,6);
 assert.equal(r.summary.untouchedEventRecords,1);
 assert.equal(r.summary.cardCoreSkillRouteChecks,1);
 assert.equal(r.summary.publicEventsAdded,0);
 assert.equal(r.publicationApproved,false);
 assert.equal(r.fullEventRewardOrChainCoverageVerified,false);
 const e=r.catalog.cards[0].events;
 assert.deepEqual(e[0].rewards,[{skillId:'skill:200001',level:1}]);
 assert.deepEqual(e[0].effects,[
  {kind:'guts',delta:3},{kind:'bond',delta:5,recipientCharId:1003}]);
 assert.equal(e[1].choices[0].outcomes[0].rewards[0].level,3);
 assert.deepEqual(e[1].choices[0].outcomes[0].effects,[{kind:'energy',delta:-10}]);
 assert.equal(e[1].choices[0].outcomes[1].rewards.length,0);
 assert.deepEqual(e[1].choices[0].outcomes[1].effects,[{kind:'mood',delta:-1}]);
 assert.equal(e[1].choices[1].terminal,true);
 assert.deepEqual(e[1].choices[1].effects,[{kind:'speed',delta:5}]);
 assert.deepEqual(e[2].requires,{all:[{eventId:e[1].id}]});
 assert.deepEqual(e[3],before.skillRuntime.catalog.cards[0].events[3]);
 assert.deepEqual(f,before);
});
test('fail closed when one source route is an OR-skill variant or choice topology shifts',()=>{
 const f=fixture(),e=f.skillRuntime.catalog.cards[0].events[1],s=f.effectInventory.isolatedPreview.cards[0].events[1];
 assert.equal(mergeEvent(e,s).event.type,'choice');
 const copies=[
  x=>{x.choices[0].outcomes[0].id='route-01-or-1'},
  x=>{x.choices[1].id='choice-03'},
  x=>{x.choices.push({...x.choices[1],id:'choice-03'})},
  x=>{x.choices[0].outcomes.splice(1,1)},
  x=>{x.type='auto'},
  x=>{x.choices[0].outcomes[0].effects=[{kind:'energy',delta:5}]}
 ];
 for(const change of copies){
  const m=structuredClone(e);change(m);
  assert.equal(mergeEvent(m,s).event,null,change.toString());
 }
 const nonSkill=structuredClone(s);
 nonSkill.choices[0].outcomes.reverse();
 assert.equal(mergeEvent(e,nonSkill).event,null);
});

test('multiple exclusive skill alternatives inherit stats from their exact original source route, not from a neighboring result',()=>{
 const original={id:'gt-30001-event-002',name:'source',type:'choice',choices:[
  {id:'choice-01',label:'choice',outcomes:[
   {id:'route-01-or-1',label:'A',rewards:[{skillId:'skill:1',level:1}]},
   {id:'route-01-or-2',label:'B',rewards:[{skillId:'skill:2',level:1}]},
   {id:'route-02',label:'failure',rewards:[]}
  ]}
 ]};
 const effect={id:'gt:30001:002:effect-only',name:'private',type:'choice',choices:[
  {id:'choice-1',label:'index 1',outcomes:[
   {id:'result-1',label:'win',effects:[{kind:'guts',delta:10}]},
   {id:'result-2',label:'fail',effects:[{kind:'energy',delta:-5}]}
  ]}
 ]};
 const m=mergeEvent(original,effect);
 assert.ok(m.event);
 assert.equal(m.effectRows,3);
 assert.deepEqual(m.event.choices[0].outcomes.map(x=>x.effects),[
  [{kind:'guts',delta:10}],[{kind:'guts',delta:10}],
  [{kind:'energy',delta:-5}]
 ]);
 assert.deepEqual(original.choices[0].outcomes.map(x=>x.effects),[undefined,undefined,undefined]);
 const single={id:'gt-30001-event-003',name:'source',type:'auto',
  outcomes:[
   {id:'route-01-or-1',label:'one',rewards:[{skillId:'skill:1',level:1}]},
   {id:'route-01-or-2',label:'two',rewards:[{skillId:'skill:2',level:1}]}
  ]};
 const flat={id:'gt:30001:003:effect-only',name:'private',type:'auto',
  effects:[{kind:'bond',delta:5,recipientCharId:111}]};
 assert.deepEqual(mergeEvent(single,flat).event.outcomes.map(x=>x.effects),[
  flat.effects,flat.effects
 ]);
 const invalid=structuredClone(single);
 invalid.outcomes[1].id='route-02-or-2';
 assert.equal(mergeEvent(invalid,flat).event,null);
 const invalid2=structuredClone(original);
 invalid2.choices[0].outcomes[1].id='route-01-or-3';
 assert.equal(mergeEvent(invalid2,effect).event,null);
});

test('ignore unmatched and structurally incompatible source events instead of widening the runtime',()=>{
 const f=fixture(),a=f.effectInventory.isolatedPreview.cards[0].events;
 a[1].choices[0].outcomes[0].id='wrong';
 a[2].id='gt:30001:005:effect-only';
 const r=assemble(f);
 assert.equal(r.summary.combinedEventRecords,1);
 assert.equal(r.summary.matchedSourceEventIdentity,2);
 assert.equal(r.summary.untouchedEventRecords,3);
 assert.equal(r.summary.blockedReasons.SOURCE_RESULT_IDENTITY_AMBIGUOUS,1);
 assert.equal(r.summary.blockedReasons.GT_RUNTIME_EVENT_ID_NOT_FOUND,1);
 assert.deepEqual(r.catalog.cards[0].events[1],f.skillRuntime.catalog.cards[0].events[1]);
});
test('source SHA, publication, variant ancestry and shape mutations must fail safely',()=>{
 for(const mutate of [
  f=>{f.skillRuntime.publicationApproved=true;},
  f=>{f.skillRuntime.catalog.cards[0].events[0].name='changed';},
  f=>{f.effectInventory.publicationApproved=true;},
  f=>{f.effectInventory.sourcePins.gameToraDerived='0'.repeat(40);},
  f=>{f.effectInventory.chainTopologyVerified=true;},
  f=>{f.effectInventory.summary.isolatedPreviewEventRecords=4;},
  f=>{f.effectInventory.isolatedPreview.cards[0].events[0].id='invalid';}
 ]){
  const f=fixture();mutate(f);
  assert.throws(()=>assemble(f),/Phase2スキル非スキル統合/,mutate.toString());
 }
 assert.throws(()=>assemble(fixture(),{strict:true}),/Phase2スキル非スキル統合/);
});
