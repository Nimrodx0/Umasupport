/* Runtime numeric-skill crosswalk. Never infer a gold/white hierarchy or event route. */
(function(g){
'use strict';
const normalize=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const numericKey=/^skill:([0-9]+)$/;
const hierarchy=typeof module!=='undefined'&&module.exports
  ?require('./skill_hierarchy.js'):g.UmaSkillHierarchy;
const SOURCE_URL='https://raw.githubusercontent.com/mee1080/umasim/main/data/skill_data.txt';
const CACHE_KEY='umasupport/umasim/skill_data.txt/v1';
function parseSource(text){
  if(typeof text!=='string')throw Error('スキル辞書はテキストである必要があります');
  let raw;
  try {raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch(e){throw Error('スキル辞書のJSON形式が不正: '+e.message)}
  if(!Array.isArray(raw)||raw.length<100)throw Error('スキル辞書の収録件数が少なすぎます');
  const byId=new Map(),byName=new Map();
  for(const [index,entry] of raw.entries()){
    if(!isObject(entry)||typeof entry.id!=='string'||!/^\d+$/.test(entry.id)||
      typeof entry.name!=='string'||!normalize(entry.name)||
      typeof entry.rarity!=='string'||!entry.rarity.trim()||!Number.isSafeInteger(entry.group))
      throw Error('スキル辞書のレコードが不正: '+index);
    if(byId.has(entry.id))throw Error('スキル辞書の数値ID重複: '+entry.id);
    const item={id:entry.id,name:normalize(entry.name),rarity:entry.rarity,group:entry.group};
    byId.set(item.id,item);
    const names=byName.get(item.name)||[];names.push(item);byName.set(item.name,names);
  }
  return {byId,byName,count:raw.length};
}
function prepare(model,catalog,text){
  if(!model||!isObject(model.skillById))throw Error('スキル照合用モデルが不正');
  if(!catalog||!Array.isArray(catalog.cards))return {catalog,skills:[],matchedHints:0};
  // JSON-safe public catalogs are cloned, so failed validation never mutates input or model.
  const converted=JSON.parse(JSON.stringify(catalog));
  let source=null,matchedHints=0;
  const skills=new Map();
  function mapReward(reward){
    if(!isObject(reward)||typeof reward.skillId!=='string')return;
    const match=numericKey.exec(reward.skillId);
    if(!match)return;
    if(!source){
      if(typeof text!=='string')throw Error('数値スキルIDを検証するための辞書がありません');
      source=parseSource(text);
    }
    const record=source.byId.get(match[1]);
    if(!record||!['normal','rare'].includes(record.rarity))throw Error('数値スキルIDが未照合: '+reward.skillId);
    // Prevent a changed upstream ID from silently redirecting a reviewed reward.
    if(typeof reward.verifiedSkillName!=='string'||normalize(reward.verifiedSkillName)!==record.name)
      throw Error('数値スキルIDの名称照合が失敗: '+reward.skillId);
    delete reward.verifiedSkillName;
    const hintId='hint:'+record.name;
    if(source.byName.get(record.name).length===1&&Object.hasOwn(model.skillById,hintId)){
      reward.skillId=hintId;
      matchedHints++;
    } else {
      const key='skill:'+record.id;
      if(Object.hasOwn(model.skillById,key)){
        if(normalize(model.skillById[key].name)!==record.name)
          throw Error('既存スキルのIDと名称に矛盾: '+key);
      }else skills.set(key,{id:key,name:record.name,tier:record.rarity==='rare'?'gold':'white',
        lowerId:null,sourceNumericId:record.id,sourceStatus:'umasim-id-matched'});
      reward.skillId=key;
    }
  }
  function mapPart(part){
    if(!isObject(part))return;
    if(Array.isArray(part.rewards))part.rewards.forEach(mapReward);
    if(Array.isArray(part.outcomes))part.outcomes.forEach(mapPart);
  }
  for(const card of converted.cards){
    if(!isObject(card)||!Array.isArray(card.events))continue;
    for(const event of card.events){
      mapPart(event);
      if(Array.isArray(event?.choices))event.choices.forEach(mapPart);
    }
  }
  const reviewed=source?hierarchy.stage({model,source,skills:[...skills.values()]}):
    {skills:[...skills.values()],patches:[],linkedPairs:0};
  return {catalog:converted,skills:reviewed.skills,skillPatches:reviewed.patches,
    reviewedHierarchyPairs:reviewed.linkedPairs,matchedHints};
}
async function load({fetchImpl=g.fetch?.bind(g),store=g.UmaLiveLoader?.indexedDbStore(g.indexedDB,CACHE_KEY),
  now=()=>new Date().toISOString(),timeoutMs=12000}={}){
  if(!fetchImpl)throw Error('スキル辞書のFetch APIが利用できません');
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const timeout=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  let failure;
  try {
    const response=await fetchImpl(SOURCE_URL,{cache:'no-store',...(controller?{signal:controller.signal}:{})});
    if(!response.ok)throw Error('スキル辞書の公開元 HTTP '+response.status);
    const text=await response.text();
    parseSource(text); // Invalid updates must not overwrite the last verified edition.
    const fetchedAt=now();
    try {await store?.put({text,fetchedAt,sourceUrl:SOURCE_URL});}catch(_){/* Online still works. */}
    return {text,mode:'online',fetchedAt};
  } catch(e){failure=e;}
  finally {if(timeout!==null)clearTimeout(timeout);}
  try {
    const cached=await store?.get();
    if(cached?.sourceUrl===SOURCE_URL){
      parseSource(cached.text);
      return {text:cached.text,mode:'cached',fetchedAt:cached.fetchedAt,reason:String(failure)};
    }
  }catch(e){failure=new Error(String(failure)+'; cache: '+String(e));}
  throw Error('スキル辞書を取得できず、検証済みキャッシュもありません。'+String(failure));
}
const api={SOURCE_URL,CACHE_KEY,parseSource,prepare,load};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this);
