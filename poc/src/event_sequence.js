/* Label only event sequences supported by reviewed prerequisite/terminal facts.
 * Do not infer chains from event title, source index, or neighboring cards. */
(function(g){
'use strict';
function referencedIds(condition,out){
 if(!condition||typeof condition!=='object')return;
 if(typeof condition.eventId==='string')out.add(condition.eventId);
 if(Array.isArray(condition.all))for(const x of condition.all)referencedIds(x,out);
 if(Array.isArray(condition.any))for(const x of condition.any)referencedIds(x,out);
}
function isTerminal(part){
 return !!part&&(part.terminal===true||
   (Array.isArray(part.outcomes)&&part.outcomes.some(o=>o.terminal===true)));
}
function classifiedEvents(events){
 const list=Array.isArray(events)?events:[],known=new Set(list.map(e=>e.id));
 const chain=new Set();
 for(const event of list){
  const predecessors=new Set();
  referencedIds(event.requires,predecessors);
  const parts=event.type==='choice'?event.choices||[]:[event];
  for(const part of parts){
   referencedIds(part.requires,predecessors);
   for(const result of part.outcomes||[])referencedIds(result.requires,predecessors);
  }
  for(const id of predecessors)if(id!==event.id&&known.has(id)){
   chain.add(id);chain.add(event.id);
  }
  // A verified chain_end is evidence of an internal sequence even if its
  // following stage is absent from the public, reviewed subset.
  if(parts.some(isTerminal)||event.availabilityKind==='outing-sequence')
   chain.add(event.id);
 }
 return chain;
}
const api={classifiedEvents};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaEventSequence=api;
})(typeof globalThis!=='undefined'?globalThis:this);
