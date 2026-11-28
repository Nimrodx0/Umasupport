/* Load only reviewed public event facts; validate atomically before attaching. */
(function(g){
'use strict';
const schema=typeof module!=='undefined'&&module.exports
  ?require('./event_schema.js'):g.UmaEventSchema;
const bridge=typeof module!=='undefined'&&module.exports
  ?require('./skill_bridge.js'):g.UmaSkillBridge;
const URL='./data/reviewed_events.v1.json';
const RAW='https://raw.githubusercontent.com/Nimrodx0/Umasupport/';
const MANIFEST_URL=RAW+'refs/heads/data/events/manifest.json';
const DISTRIBUTED_CACHE_KEY='umasupport/public/event-data-snapshot/v1';
const INITIAL_CATALOG_SHA='91058eac70775c38aa46802c5f65d9917249ab4242c45ac1ed48a609639eaefa';
const INITIAL_COUNTS={cards:564,events:2521};
const HASH=/^[a-f0-9]{64}$/,SHA=/^[a-f0-9]{40}$/;
const CACHE_KEY='umasupport/public/reviewed_events.v1.json/v1';
// This uses the same v1 IndexedDB "sources" store as card/skill source data.
// All cached catalogs are validated against the CURRENT runtime card/skill
// model before storing and again after recovery; no other catalog is trusted.
function sourceStore(){
 return g.UmaLiveLoader?.indexedDbStore(g.indexedDB,CACHE_KEY);
}
function preflight(model,catalog,{skillText=null,pinnedSkillText=null,fullRegistry=false,allowReviewedLegacy=false}={}){
 const prepared=bridge.prepare(model,catalog,skillText,{fullRegistry,pinnedSkillText,allowReviewedLegacy});
 const candidateSkills={...model.skillById,
   ...Object.fromEntries(prepared.skills.map(s=>[s.id,s]))};
 for(const patch of prepared.skillPatches||[]){
   if(!candidateSkills[patch.id]||(patch.lowerId!==undefined&&!candidateSkills[patch.lowerId]))
     throw Error('レビュー済み上下関係のIDが辞書にありません');
   candidateSkills[patch.id]={...candidateSkills[patch.id],...patch};
 }
 const candidateModel={...model,skillById:candidateSkills};
 const summary=schema.validateCatalog(prepared.catalog,candidateModel);
 return {prepared,summary};
}

function attach(model,catalog,{skillText=null,pinnedSkillText=null,fullRegistry=false,allowReviewedLegacy=false}={}){
 // Resolve numeric rewards before validation, but do not modify model if any check fails.
 const {prepared,summary}=preflight(model,catalog,{skillText,pinnedSkillText,fullRegistry,allowReviewedLegacy});
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
 fetchImpl=g.fetch?.bind(g),store=sourceStore(),url=URL,model,skillText=null,pinnedSkillText=null,allowReviewedLegacy=false,
 now=()=>new Date().toISOString(),timeoutMs=12000
}={}){
 if(!model||!model.skillById||!model.cardById)
  throw Error('公開イベント検証用のカードモデルがありません');
 if(!fetchImpl)throw Error('公開イベントデータのFetch APIが利用できません');
 const fullRegistry=!!skillText;
 const validate=text=>{
  if(typeof text!=='string')throw Error('イベントJSONの本文が不正');
  const parsed=JSON.parse(text);
  preflight(model,parsed,{skillText,pinnedSkillText,fullRegistry,allowReviewedLegacy});
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
// The trusted publisher is the fixed repository over HTTPS. SHA-256
// detects byte/version mismatch, not independent authorization or signatures.
function manifestShape(m){
 if(!m||Object.keys(m).sort().join(',')!=='approvalContentSha256,approvalSha256,cardCount,catalogContentSha256,catalogSchemaVersion,catalogSha256,codeCommit,dataKind,eventCount,previousManifestCommit,revision,schemaVersion,snapshotCommit'||
    m.dataKind!=='umasupport-event-data-manifest'||m.schemaVersion!==1||m.catalogSchemaVersion!==1||
    !Number.isSafeInteger(m.revision)||m.revision<1||
    ![m.snapshotCommit,m.codeCommit].every(x=>typeof x==='string'&&SHA.test(x))||
    (m.revision===1?m.previousManifestCommit!==null:typeof m.previousManifestCommit!=='string'||!SHA.test(m.previousManifestCommit))||
    ![m.catalogSha256,m.approvalSha256,m.catalogContentSha256,m.approvalContentSha256].every(x=>typeof x==='string'&&HASH.test(x))||
    !Number.isSafeInteger(m.cardCount)||m.cardCount<INITIAL_COUNTS.cards||
    !Number.isSafeInteger(m.eventCount)||m.eventCount<0||
    (m.revision===1&&(m.catalogSha256!==INITIAL_CATALOG_SHA||m.cardCount!==INITIAL_COUNTS.cards||m.eventCount!==INITIAL_COUNTS.events)))
  throw Error('イベント配信版情報が不正または非対応');
 return m;
}
const snapshotUrl=m=>RAW+m.snapshotCommit+'/poc/data/reviewed_events.v1.json';
async function sha256(bytes){
 const crypto=g.crypto||(typeof module!=='undefined'&&module.exports?require('node:crypto').webcrypto:null);
 if(!crypto?.subtle)throw Error('SHA-256検証を利用できません');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
async function checkBytes(bytes,hash){
 if(bytes.byteLength>15000000||await sha256(bytes)!==hash)throw Error('イベントDBのSHA-256不一致');
 return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
}
function isProduction(location=g.location){
 return location?.origin==='https://nimrodx0.github.io'&&location.pathname==='/Umasupport/poc/live.html';
}
async function loadDistributed({
 fetchImpl=g.fetch?.bind(g),store=g.UmaLiveLoader?.indexedDbStore(g.indexedDB,DISTRIBUTED_CACHE_KEY),
 legacyStore=sourceStore(),model,skillText=null,pinnedSkillText=null,allowReviewedLegacy=false,
 now=()=>new Date().toISOString(),timeoutMs=12000
}={}){
 if(!model?.skillById||!model?.cardById||!fetchImpl)throw Error('イベントデータ検証環境が不正');
 const validate=(text,counts)=>{
  const catalog=JSON.parse(text);
  if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||catalog.cards.length!==counts.cards||
     catalog.cards.reduce((n,c)=>n+(Array.isArray(c.events)?c.events.length:0),0)!==counts.events)throw Error('イベントDB件数不一致');
  preflight(model,catalog,{skillText,pinnedSkillText,fullRegistry:!!skillText,allowReviewedLegacy});
  return catalog;
 };
 const decode=async(text,hash)=>checkBytes(new TextEncoder().encode(text),hash);
 const get=async(url,limit,signal)=>{
  const res=await fetchImpl(url,{cache:'no-store',redirect:'error',...(signal?{signal}:{})});
  if(!res.ok)throw Error('イベント配信 HTTP '+res.status);
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(bytes.byteLength>limit)throw Error('イベント配信サイズ超過');
  return bytes;
 };
 const withTimeout=async fn=>{
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=ctl?setTimeout(()=>ctl.abort(),timeoutMs):null;
  try{return await fn(ctl?.signal);}finally{if(timer!==null)clearTimeout(timer);}
 };
 let cached=null,failure;
 try{
  const item=await store?.get();
  if(item?.sourceUrl===MANIFEST_URL&&typeof item.text==='string'){
   const m=manifestShape(item.manifest);
   const text=await decode(item.text,m.catalogSha256);
   cached={item,m,catalog:validate(text,{cards:m.cardCount,events:m.eventCount})};
  }
 }catch(e){failure=e;}
 const result=(catalog,mode,m,fetchedAt,reason)=>({catalog,mode,revision:m?.revision??1,snapshotCommit:m?.snapshotCommit??null,
  sourceUrl:m?snapshotUrl(m):URL,fetchedAt,checkedAt:now(),...(reason?{reason:String(reason)}:{})});
 try{
  const online=await withTimeout(async signal=>{
   const m=manifestShape(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await get(MANIFEST_URL,16384,signal))));
   if(cached&&(m.cardCount<cached.m.cardCount||m.revision<cached.m.revision||m.revision===cached.m.revision&&
      Object.keys(m).some(k=>m[k]!==cached.m[k])))throw Error('配信版の巻き戻り・同一版不一致');
   // If the already verified bytes are exactly the same, no second network
   // download is necessary. The current model was revalidated above.
   if(cached&&m.revision===cached.m.revision&&m.catalogSha256===cached.m.catalogSha256)
    return result(cached.catalog,'online',m,cached.item.fetchedAt);
   const text=await checkBytes(await get(snapshotUrl(m),15000000,signal),m.catalogSha256);
   const catalog=validate(text,{cards:m.cardCount,events:m.eventCount}),fetchedAt=now();
   try{await store?.put({text,manifest:m,sourceUrl:MANIFEST_URL,fetchedAt});}catch(_){}
   return result(catalog,'online',m,fetchedAt);
  });
  return online;
 }catch(e){failure=e;}
 if(cached)return result(cached.catalog,'cached',cached.m,cached.item.fetchedAt,failure);
 // Fixed, already published migration baseline only. Never overwrite the
 // distributed cache with this older snapshot; explicitly identify fallback.
 try{
  const text=await withTimeout(async signal=>checkBytes(await get(URL,15000000,signal),INITIAL_CATALOG_SHA));
  const catalog=validate(text,INITIAL_COUNTS),fetchedAt=now();
  try{await legacyStore?.put({text,sourceUrl:URL,fetchedAt});}catch(_){}
  return result(catalog,'fallback',null,fetchedAt,failure);
 }catch(e){failure=String(failure)+'; baseline: '+String(e);}
 try{
  const item=await legacyStore?.get();
  if(item?.sourceUrl===URL&&typeof item.text==='string'){
   const text=await decode(item.text,INITIAL_CATALOG_SHA);
   return result(validate(text,INITIAL_COUNTS),'fallback',null,item.fetchedAt||null,failure);
  }
 }catch(e){failure=String(failure)+'; baseline cache: '+String(e);}
 throw Error('公開イベントデータの検証・取得に失敗し、利用できる検証済みキャッシュもありません。'+String(failure));
}
const api={URL,CACHE_KEY,MANIFEST_URL,DISTRIBUTED_CACHE_KEY,attach,load,loadVerified,preflight,loadDistributed,isProduction,manifestShape};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaPublicEventCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
