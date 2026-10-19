/* Pure event overview: only attached, reviewed events, never candidate titles. */
(function(g){
'use strict';
function cardSummary(card,slot,core){
 const out={cardId:card?.id||null,hasCard:!!card,known:0,configured:0,pending:0,
  blocked:0,automatic:0,conditional:0,conditionalRoutes:0,activeEventRoutes:0,events:[],unknown:!card||!Array.isArray(card.events)||card.events.length===0};
 if(!card)return out;
 if(!Array.isArray(card.events)||card.events.length===0)return out;
 out.unknown=false;
 const choices=slot?.choices||{},outcomes=slot?.outcomes||{};
 for(const event of card.events){
  const progress=core.reachability(event,choices,card.events,outcomes);
  const reachable=progress.status!=='blocked';
  const selected=event.type==='choice'&&event.choices.some(c=>c.id===choices[event.id]);
  const status=!reachable?'blocked':progress.status==='conditional'?'conditional':event.type==='auto'?'automatic':selected?'configured':'pending';
  out.known++;out[status]++;
  out.events.push({id:event.id,status,selected:!!selected,reachable});
 }
 for(const r of core.directRoutes(card,slot||{stage:4,choices:{}})){
  if(r.source!=='event')continue;
  out.activeEventRoutes++;
  if(r.conditional)out.conditionalRoutes++;
 }
 return out;
}
function summarize(deck,data,core){
 if(!deck||!Array.isArray(deck.slots)||deck.slots.length!==6)throw Error('Expected six deck slots');
 const cards=deck.slots.map((slot,i)=>({...cardSummary(
  slot?.cardId?data.cardById[slot.cardId]:null,slot,core),index:i}));
 const totals={known:0,configured:0,pending:0,blocked:0,automatic:0,conditional:0,unknown:0,
  empty:0,activeEventRoutes:0,conditionalRoutes:0};
 for(const c of cards){
  for(const k of ['known','configured','pending','blocked','automatic','conditional','activeEventRoutes','conditionalRoutes'])
   totals[k]+=c[k];
  if(!c.hasCard)totals.empty++;
  else if(c.unknown)totals.unknown++;
 }
 return {cards,totals};
}
function clearSlot(deck,index){
 if(!deck||!Array.isArray(deck.slots)||!Number.isInteger(index)||index<0||index>=deck.slots.length)
  throw Error('Invalid event slot');
 const sl=deck.slots[index];if(!sl||!sl.choices||typeof sl.choices!=='object'||Array.isArray(sl.choices))throw Error('Invalid event choices');
 const n=Object.keys(sl.choices).length+Object.keys(sl.outcomes||{}).length;
 sl.choices={};sl.outcomes={};
 return n;
}
function clearDeck(deck){
 if(!deck||!Array.isArray(deck.slots)||deck.slots.length!==6||
   deck.slots.some(sl=>!sl||!sl.choices||typeof sl.choices!=='object'||Array.isArray(sl.choices)))
  throw Error('Invalid event deck');
 let total=0;for(let i=0;i<6;i++)total+=clearSlot(deck,i);
 return total;
}
const api={cardSummary,summarize,clearSlot,clearDeck};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaDeckEvents=api;
})(typeof globalThis!=='undefined'?globalThis:this);
