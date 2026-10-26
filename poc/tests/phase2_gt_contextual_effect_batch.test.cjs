'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const pin='6e38b54af4fad397ff4491e63007a90705a4fe67';
const fx=(cards)=>{
 const num=cards.reduce((n,c)=>n+c.events.length,0);
 return {documents:cards.map(c=>({id:c.id,kind:'support',
   events_ja:Object.fromEntries(c.events.map((event,i)=>['ev'+(i+1),event]))})),
  index:{dataKind:'umasupport-whole-event-provisional-index',
   publicationApproval:false,stats:{gameToraEventRecords:num},
   sourcePins:{gameToraDerived:pin},
   cards:cards.map(c=>({cardId:String(c.id),sourceMissing:false,
    gameToraObservedCount:c.events.length}))}};
};
const e=(type,value)=>({type,...(value===undefined?{}:{value})});
const event=(n,options,type='dates')=>({id:n,section:type,
 name:'ORIGINAL_PRIVATE_NOT_EXPORTED',choices:options.map((effects,index)=>({
 label:index?'CHOICE_COPYRIGHTED_B':'CHOICE_COPYRIGHTED_A',
 random_either:false,effects}))});
const fakeModel=(ids)=>({cards:ids.map(id=>({id:String(id)})),
 cardById:Object.fromEntries(ids.map(id=>[String(id),{id:String(id)}])),
 skillById:{}});
test('Tucker next-turn +20/+30/+120 other-deck support specialty rates retain exact values',()=>{
 const docs=fx([{id:10128,events:[
  event(1,[[e('stamina','+5'),e('ntsr','+20')]],'special'),
  event(2,[[e('ntsr','+30')],[e('ntsr','+30')]]),
  event(3,[[e('ntsr','+120'),e('skill_points','+10')]])
 ]}]);
 const r=analyze(docs);
 assert.equal(r.summary.sourceEvents,3);
 assert.equal(r.summary.eligibleEvents,3);
 assert.equal(r.summary.contextOperationTypes.ntsr,4);
 assert.equal(r.summary.validContextOperationMentions,4);
 assert.equal(r.summary.isolatedPreviewEventRecords,3);
 assert.equal(schema.validateCatalog(r.isolatedPreview,fakeModel([10128])).eventsWithRecords,3);
 const cards=r.isolatedPreview.cards[0].events;
 const extract=(evt,choice)=>core.directDynamicEffectRoutes({id:'10128',events:[evt]},{
  choices:{[evt.id]:choice},outcomes:{}});
 assert.equal(extract(cards[0],'choice-1')[0].delta,20);
 assert.equal(extract(cards[1],'choice-1')[0].delta,30);
 assert.equal(extract(cards[1],'choice-2')[0].delta,30);
 assert.equal(extract(cards[2],'choice-1')[0].delta,120);
 for(const evt of cards){
  assert.equal(extract(evt,'bad').length,0);
  const found=extract(evt,'choice-1');
  assert.equal(found.length,1);
  assert.equal(found[0].duration,'next-turn');
  assert.equal(found[0].targetSelection,'other-supports-next-turn');
  assert.equal(found[0].conditional,true);
  assert.equal(found[0].unresolvedTargets,true);
  assert.equal(found[0].possible,true);
 }
 assert.equal(JSON.stringify(r).includes('ORIGINAL_PRIVATE_NOT_EXPORTED'),false);
 assert.equal(JSON.stringify(r).includes('CHOICE_COPYRIGHTED'),false);
});
test('Yukoma bathing tickets +1/+2 and next-bath recovery are independent, co-occurring conditions',()=>{
 const r=analyze(fx([{id:10138,events:[
  event(1,[[e('yhs_tix','+1'),e('yhs_sr'),e('mood','+1')]]),
  event(2,[[e('yhs_tix','+1'),e('yhs_sr')],[e('yhs_tix','+1'),e('yhs_sr')]]),
  event(3,[[e('yhs_tix','+2'),e('yhs_sr')]])
 ]}]));
 assert.equal(r.summary.eligibleEvents,3);
 assert.deepEqual(r.summary.contextOperationTypes,{yhs_sr:4,yhs_tix:4});
 const evs=r.isolatedPreview.cards[0].events;
 assert.equal(schema.validateCatalog(r.isolatedPreview,fakeModel([10138])).eventsWithRecords,3);
 for(const evt of evs){
  assert.equal(core.directDynamicEffectRoutes({id:'10138',events:[evt]},{choices:{},outcomes:{}}).length,0);
  const x=core.directDynamicEffectRoutes({id:'10138',events:[evt]},
   {choices:{[evt.id]:'choice-1'},outcomes:{}});
  assert.equal(x.length,2);
  const ticket=x.find(y=>y.dynamicKind==='onsen-bathing-tickets');
  const force=x.find(y=>y.dynamicKind==='onsen-next-bath-super-recovery');
  assert.equal(ticket.delta,evt===evs[2]?2:1);
  assert.equal(ticket.scenario,'yukoma-onsen');
  assert.equal(force.activation,'next-bath');
  assert.equal(force.scenario,'yukoma-onsen');
  assert.equal(force.delta,undefined);
  assert.equal(force.conditional,true);
  assert.equal(force.unresolvedTargets,true);
 }
 const e2=evs[1];
 assert.equal(core.directDynamicEffectRoutes({id:'10138',events:[e2]},
  {choices:{[e2.id]:'choice-2'},outcomes:{}}).length,2);
});
test('source structure fail-closed for context effect values, flag payload, and duplicated semantics',()=>{
 for(const input of [
  [e('ntsr','+10/+20')], [e('ntsr','a lot')],
  [{type:'ntsr',value:'+20',stat_count:1}],
  [e('ntsr','+20'),e('ntsr','+30')],
  [e('yhs_tix','+1/+2')], [{type:'yhs_tix',value:'+1',chara_id:1001}],
  [e('yhs_tix','+1'),e('yhs_tix','+2')],
  [e('yhs_sr','+1')], [{type:'yhs_sr',chance:0.5}],
  [e('yhs_sr'),e('yhs_sr')]
 ]){
  const x=analyze(fx([{id:10138,events:[event(1,[input])]}]));
  assert.equal(x.summary.blockedEvents,1,JSON.stringify(input));
  assert.equal(x.summary.isolatedPreviewEventRecords,0);
  assert.equal(x.publicationApproved,false);
 }
 const zero=analyze(fx([{id:10138,events:[event(1,[[e('ntsr','0')]])]}]));
 assert.equal(zero.summary.zeroContextOperationMentions,1);
 assert.equal(zero.summary.isolatedPreviewDynamicRecords,0);
});
test('schema enforces context, duration, numeric versus flag effects',()=>{
 const defs=[
  {kind:'next-turn-other-support-specialty-rate',delta:20,
   duration:'next-turn',targetSelection:'other-supports-next-turn',possible:true},
  {kind:'onsen-bathing-tickets',delta:2,scenario:'yukoma-onsen',
   targetSelection:'bath-ticket-count',possible:true},
  {kind:'onsen-next-bath-super-recovery',scenario:'yukoma-onsen',
   activation:'next-bath',targetSelection:'next-bath-super-recovery',possible:true}
 ];
 const model=fakeModel([10138]);
 for(const def of defs){
  const cat={schemaVersion:1,cards:[{cardId:'10138',events:[{
   id:'test',name:'test',type:'auto',dynamicEffects:[def]}]}]};
  assert.equal(schema.validateCatalog(cat,model).eventsWithRecords,1);
  const changes=[
   x=>{x.targetSelection='unknown'},
   x=>{x.possible=false},
   x=>{x.sourceEffectOrdinal=1},
   x=>{x.scenario='wrong'}
  ];
  if(def.delta===undefined)changes.push(x=>{x.delta=1});
  else changes.push(x=>{x.delta=0},x=>{x.delta=1.5});
  for(const mutate of changes){
   const bad=structuredClone(cat);
   mutate(bad.cards[0].events[0].dynamicEffects[0]);
   assert.throws(()=>schema.validateCatalog(bad,model),/イベント検証/);
  }
 }
});
