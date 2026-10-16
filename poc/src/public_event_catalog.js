/* Load only reviewed public event facts; validate atomically before attaching. */
(function(g){
'use strict';
const schema=typeof module!=='undefined'&&module.exports
  ?require('./event_schema.js'):g.UmaEventSchema;
const bridge=typeof module!=='undefined'&&module.exports
  ?require('./skill_bridge.js'):g.UmaSkillBridge;
const URL='./data/reviewed_events.v1.json';
function attach(model,catalog,{skillText=null,fullRegistry=false}={}){
 // Resolve numeric rewards before validation, but do not modify model if any check fails.
 const prepared=bridge.prepare(model,catalog,skillText,{fullRegistry});
 const candidateSkills={...model.skillById,
   ...Object.fromEntries(prepared.skills.map(s=>[s.id,s]))};
 for(const patch of prepared.skillPatches||[]){
   if(!candidateSkills[patch.id]||(patch.lowerId!==undefined&&!candidateSkills[patch.lowerId]))
     throw Error('レビュー済み上下関係のIDが辞書にありません');
   candidateSkills[patch.id]={...candidateSkills[patch.id],...patch};
 }
 const candidateModel={...model,skillById:candidateSkills};
 const summary=schema.validateCatalog(prepared.catalog,candidateModel);
 for(const skill of prepared.skills){
   if(!Array.isArray(model.skills))model.skills=[];
   model.skills.push(skill);
   model.skillById[skill.id]=skill;
 }
 for(const patch of prepared.skillPatches||[])Object.assign(model.skillById[patch.id],patch);
 for(const entry of prepared.catalog.cards){
   const card=model.cardById[entry.cardId];
   card.events=entry.events.map(e=>JSON.parse(JSON.stringify(e)));
   card.eventCoverage='partial';
 }
 if(!model.meta)model.meta={};
 model.meta.eventStatus=summary.eventsWithRecords?'reviewed-partial':'reviewed-empty';
 model.meta.reviewedEventCards=summary.cardsWithRecords;
 model.meta.reviewedEventRecords=summary.eventsWithRecords;
 model.meta.numericRewardsMatchedToHints=prepared.matchedHints;
 model.meta.reviewedHierarchyPairs=prepared.reviewedHierarchyPairs;
 if(fullRegistry&&skillText){
   model.meta.skillHierarchy={source:'UmaSim skill_data.txt',totalRare:prepared.totalRareSkills,
     linked:prepared.structuralPairs,unresolved:prepared.unresolvedHierarchyGroups,
     withoutLower:prepared.hierarchyWithoutLower,relationshipBasis:'group-rarity-structure'};
 }
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
