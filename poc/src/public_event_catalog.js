/* Load only reviewed public event facts; validate atomically before attaching. */
(function(g){
'use strict';
const schema=typeof module!=='undefined'&&module.exports
  ?require('./event_schema.js'):g.UmaEventSchema;
const URL='./data/reviewed_events.v1.json';
function attach(model,catalog){
 const summary=schema.validateCatalog(catalog,model); // throws before any mutation
 for(const entry of catalog.cards){
   const card=model.cardById[entry.cardId];
   card.events=entry.events.map(e=>JSON.parse(JSON.stringify(e)));
   card.eventCoverage='partial';
 }
 if(!model.meta)model.meta={};
 model.meta.eventStatus=summary.eventsWithRecords?'reviewed-partial':'reviewed-empty';
 model.meta.reviewedEventCards=summary.cardsWithRecords;
 model.meta.reviewedEventRecords=summary.eventsWithRecords;
 return summary;
}
async function load({fetchImpl=g.fetch?.bind(g),url=URL}={}){
 if(!fetchImpl)throw Error('イベントデータのFetch APIが利用できません');
 const r=await fetchImpl(url,{cache:'no-store'});
 if(!r.ok)throw Error('公開イベントデータ HTTP '+r.status);
 return r.json();
}
const api={URL,attach,load};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaPublicEventCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
