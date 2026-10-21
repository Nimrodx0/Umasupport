/* Load only reviewed public event facts; validate atomically before attaching. */
(function(g){
'use strict';
const schema=typeof module!=='undefined'&&module.exports
  ?require('./event_schema.js'):g.UmaEventSchema;
const bridge=typeof module!=='undefined'&&module.exports
  ?require('./skill_bridge.js'):g.UmaSkillBridge;
const URL='./data/reviewed_events.v1.json';
const CACHE_KEY='umasupport/public/reviewed_events.v1.json/v1';
// This uses the same v1 IndexedDB "sources" store as card/skill source data.
// All cached catalogs are validated against the CURRENT runtime card/skill
// model before storing and again after recovery; no other catalog is trusted.
function sourceStore(){
 return g.UmaLiveLoader?.indexedDbStore(g.indexedDB,CACHE_KEY);
}
function preflight(model,catalog,{skillText=null,fullRegistry=false}={}){
 const {prepared,summary}=preflight(model,catalog,{skillText,fullRegistry});
 return {prepared,summary};
}

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

async function loadVerified({
 fetchImpl=g.fetch?.bind(g),store=sourceStore(),url=URL,model,skillText=null,
 now=()=>new Date().toISOString(),timeoutMs=12000
}={}){
 if(!model||!model.skillById||!model.cardById)
  throw Error('公開イベント検証用のカードモデルがありません');
 if(!fetchImpl)throw Error('公開イベントデータのFetch APIが利用できません');
 const fullRegistry=!!skillText;
 const validate=text=>{
  if(typeof text!=='string')throw Error('イベントJSONの本文が不正');
  const parsed=JSON.parse(text);
  preflight(model,parsed,{skillText,fullRegistry});
  return parsed;
 };
 const controller=typeof AbortController!=='undefined'?new AbortController():null;
 const timeout=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
 let failure;
 try{
  const response=await fetchImpl(url,{cache:'no-store',...(controller?{signal:controller.signal}:{})});
  if(!response.ok)throw Error('公開イベントデータ HTTP '+response.status);
  const text=await response.text();
  const catalog=validate(text); // Verify entirely BEFORE altering the cache.
  const fetchedAt=now();
  try{await store?.put({text,fetchedAt,sourceUrl:url});}
  catch(_){/* Private browsing: valid online JSON still works. */}
  return {catalog,mode:'online',fetchedAt,checkedAt:fetchedAt};
 }catch(e){failure=e;}
 finally{if(timeout!==null)clearTimeout(timeout);}
 try{
  const cached=await store?.get();
  if(cached&&cached.sourceUrl===url){
   const catalog=validate(cached.text); // Never trust a stale or corrupt cache.
   return {catalog,mode:'cached',fetchedAt:cached.fetchedAt||null,
    checkedAt:now(),reason:String(failure)};
  }
 }catch(e){failure=new Error(String(failure)+'; cache: '+String(e));}
 throw Error('公開イベントデータの検証・取得に失敗し、利用できる検証済みキャッシュもありません。'+String(failure));
}
const api={URL,CACHE_KEY,attach,load,loadVerified,preflight};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaPublicEventCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
