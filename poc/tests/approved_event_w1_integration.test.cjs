'use strict';
// W1.2/W1.3: exercise actual approved, published event facts through the
// exact runtime aggregation/overview functions. No additional third-party
// data, invented event records, or true game-activation probabilities.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../src/core.js');
const deckEvents=require('../src/deck_events.js');

const catalog=JSON.parse(fs.readFileSync(
 path.join(__dirname,'../data/reviewed_events.v1.json'),'utf8'));
const entries=catalog.cards;
const cards=Object.fromEntries(entries.map(e=>[e.cardId,
 {id:e.cardId,hints:[],events:e.events}]));
const allEvents=entries.flatMap(entry=>entry.events.map(event=>({entry,event})));
const positive=rewards=>(rewards||[]).filter(r=>r.kind!=='negative');
function makeSlot(cardId,choices={},outcomes={}){
 return {cardId,stage:4,choices:{...choices},outcomes:{...outcomes}};
}
function makeDeck(...slots){
 return {slots:[...slots,...Array.from({length:6-slots.length},()=>makeSlot(null))]};
}
function eventRoutes(card,config,eventId){
 return core.directRoutes(card,config).filter(r=>r.source==='event'&&r.eventId===eventId);
}
function findChoice(){
 for(const {entry,event} of allEvents){
  if(event.type!=='choice'||event.requires)continue;
  for(const option of event.choices||[]){
   if(!option.requires&&positive(option.rewards).length)
    return {card:cards[entry.cardId],event,option};
  }
 }
 return null;
}
function findAuto(){
 return allEvents.find(({event})=>event.type==='auto'&&!event.requires&&
  positive(event.rewards).length&&!event.outcomes?.length);
}
function findOutcome(){
 for(const {entry,event} of allEvents){
  if(event.type!=='choice'||event.requires)continue;
  for(const option of event.choices||[]){
   if(!option.requires&&Array.isArray(option.outcomes)&&option.outcomes.length>=2&&
    option.outcomes.some(outcome=>positive(outcome.rewards).length))
    return {card:cards[entry.cardId],event,option};
  }
 }
 return null;
}
function findChain(){
 for(const {entry,event} of allEvents){
  const prerequisites=event.requires?.all||[];
  for(const r of prerequisites){
   const parent=entry.events.find(x=>x.id===r.eventId);
   if(parent?.type==='choice'&&r.choiceId&&parent.choices.some(c=>c.id===r.choiceId))
    return {card:cards[entry.cardId],parent,child:event,required:r.choiceId};
  }
 }
 return null;
}
test('published cohort is exact, and unselected choices never leak any skill routes',()=>{
 assert.equal(catalog.schemaVersion,1);
 assert.equal(entries.length,559);
 assert.equal(allEvents.length,2487);
 let choices=0,autos=0,checked=0;
 for(const card of Object.values(cards)){
  const config=makeSlot(card.id);
  const routes=core.directRoutes(card,config);
  const choiceIds=new Set(card.events.filter(e=>e.type==='choice').map(e=>e.id));
  assert.ok(routes.every(r=>r.source!=='event'||!choiceIds.has(r.eventId)),card.id);
  const summary=deckEvents.summarize(makeDeck(config),{cardById:cards},core);
  assert.equal(summary.cards[0].known,card.events.length);
  assert.equal(summary.cards[0].activeEventRoutes,routes.filter(r=>r.source==='event').length);
  choices+=card.events.filter(e=>e.type==='choice').length;
  autos+=card.events.filter(e=>e.type==='auto').length;
  checked++;
 }
 assert.equal(checked,559);
 assert.equal(choices+autos,2487);
 assert.ok(choices>0&&autos>0);
});
const automatic=findAuto();
test('an approved auto event contributes only its supported candidate rewards',
 {skip:!automatic&&'No simple auto-reward record exists in this fixed release'},()=>{
 const {entry,event}=automatic,card=cards[entry.cardId],slot=makeSlot(card.id);
 const routes=eventRoutes(card,slot,event.id);
 for(const reward of positive(event.rewards))
  assert.ok(routes.some(r=>r.skillId===reward.skillId),
   'missing approved automatic skill '+reward.skillId);
 assert.ok(routes.every(r=>r.source==='event'));
});
const selected=findChoice();
test('an approved choice starts unset, selects one result path, and can be cleared',
 {skip:!selected&&'No direct rewarded choice exists in this fixed release'},()=>{
 const {card,event,option}=selected,empty=makeSlot(card.id);
 assert.equal(eventRoutes(card,empty,event.id).length,0);
 const chosen=makeSlot(card.id,{[event.id]:option.id});
 const routes=eventRoutes(card,chosen,event.id);
 assert.deepEqual(routes.map(r=>r.skillId),positive(option.rewards).map(r=>r.skillId));
 assert.ok(routes.every(r=>r.source==='event'));
 const next=core.clearDependentState(card,chosen.choices,chosen.outcomes,event.id);
 delete next.choices[event.id];
 assert.equal(eventRoutes(card,makeSlot(card.id,next.choices,next.outcomes),event.id).length,0);
});
const outcome=findOutcome();
test('approved outcome candidates are exclusive when a result is specified',
 {skip:!outcome&&'No multi-outcome rewarded choice exists in this fixed release'},()=>{
 const {card,event,option}=outcome;
 const choice=makeSlot(card.id,{[event.id]:option.id});
 const unresolved=eventRoutes(card,choice,event.id);
 const possibleIds=new Set(option.outcomes.flatMap(o=>positive(o.rewards).map(r=>r.skillId)));
 assert.ok(unresolved.every(r=>possibleIds.has(r.skillId)));
 for(const result of option.outcomes){
  const decided=makeSlot(card.id,{[event.id]:option.id},{[event.id]:result.id});
  const routes=eventRoutes(card,decided,event.id);
  const expected=positive(result.rewards).map(r=>r.skillId);
  assert.deepEqual(routes.map(r=>r.skillId).sort(),expected.sort(),
    'selected outcome must not grant a competing result');
 }
});
const chain=findChain();
test('approved chained choice prerequisite blocks and clears stale child settings',
 {skip:!chain&&'No choice-dependent chain exists in this fixed release'},()=>{
 const {card,parent,child,required}=chain;
 assert.equal(core.reachability(child,{},card.events).status,'blocked');
 const staleChoices={[parent.id]:required,[child.id]:'stale-choice'};
 const staleOutcomes={[child.id]:'stale-outcome'};
 const next=core.clearDependentState(card,staleChoices,staleOutcomes,parent.id);
 assert.equal(next.choices[child.id],undefined);
 assert.equal(next.outcomes[child.id],undefined);
 assert.equal(next.choices[parent.id],required);
});
test('a real event reward overlapping a hint counts one card, not two routes as two cards',
 {skip:!selected&&'No real event reward available for the mixed-source test'},()=>{
 const {card,event,option}=selected,skillId=positive(option.rewards)[0].skillId;
 const withHint={...card,hintsByStage:{'4':[skillId]}};
 const second={id:'synthetic-other-card',events:[],hintsByStage:{'4':[skillId]}};
 const data={cardById:{[card.id]:withHint,[second.id]:second},skills:[]};
 const same=makeDeck(makeSlot(card.id,{[event.id]:option.id}));
 const bySkill=core.aggregate(same,data);
 assert.equal(bySkill[skillId].count,1);
 assert.ok(bySkill[skillId].providers['0'].routes.some(r=>r.source==='hint'));
 assert.ok(bySkill[skillId].providers['0'].routes.some(r=>r.source==='event'));
 assert.equal(bySkill[skillId].conditionalOnly,false);
 assert.deepEqual(core.coverage(skillId,bySkill,data),{
  kind:'direct',conditional:false,count:1});
 const two=makeDeck(makeSlot(card.id,{[event.id]:option.id}),makeSlot(second.id));
 const twoSkills=core.aggregate(two,data);
 assert.equal(twoSkills[skillId].count,2);
 assert.deepEqual(Object.keys(twoSkills[skillId].providers),['0','1']);
});
test('omitted slot configuration defaults to stage four without crashing hint lookup',()=>{
 const card={id:'artificial-stage-regression',events:[],
  hintsByStage:{'0':['hint:stage0'],'4':['hint:stage4']}};
 assert.deepEqual(core.directRoutes(card).map(x=>x.skillId),['hint:stage4']);
 assert.deepEqual(core.directRoutes(card,{stage:0}).map(x=>x.skillId),['hint:stage0']);
});
