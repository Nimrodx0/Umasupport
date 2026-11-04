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
// Release #309 verified its event reward IDs against this immutable 2026 snapshot.
// The moving UmaSim main registry remains authoritative for ordinary live hints.
const PINNED_SOURCE_REVISION='cf9366f6a487bd8f197b53d8a11981207beb9f6c';
const PINNED_URL='https://raw.githubusercontent.com/mee1080/umasim/'+PINNED_SOURCE_REVISION+'/data/skill_data.txt';
const PINNED_SHA256='b7ba1d6c5dd2af9ed1f4e649f16ec1d319198e2f1ac9db07c54e14d29f0b25ec';
const PINNED_CACHE_KEY='umasupport/umasim/skill_data.txt/'+PINNED_SOURCE_REVISION;
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
    // UmaSim info[0] summarizes the effect; every subsequent info element
    // describes an additional activation/effect detail. Preserve source order.
    // Details are display-only, never inputs to skill or event calculation.
    if(Array.isArray(entry.info)){
      const description=typeof entry.info[0]==='string'?entry.info[0].trim():'';
      const detailLines=entry.info.slice(1).filter(x=>typeof x==='string')
        .map(x=>x.trim()).filter(x=>x&&x.length<=4000);
      if(description&&description.length<=1000)item.description=description;
      if(detailLines.length){
        item.technicalDetails=detailLines[0]; // Legacy single-line consumers.
        item.technicalDetailLines=detailLines;
      }
    }
    byId.set(item.id,item);
    const names=byName.get(item.name)||[];names.push(item);byName.set(item.name,names);
  }
  return {byId,byName,count:raw.length};
}
// Thirty numeric skill identities in the exact user-approved GT2487 catalog
// are absent from the frozen 2026 UmaSim dictionary: 28 were independently
// crosschecked with the SHA-pinned 2025 game master and 2 have separate
// ID/name evidence in poc/data/curation/supplemental_skills.v1.json.
// Names below are the unique, already-published, owner-reviewed ID/name pairs,
// NOT an inferred current skill registry. Do not guess rarity/hierarchy.
// Cohort signature: 9cfb7f3241c1c94250605ef418260eef4080404debcfeea46738ba24bc756d2e
const REVIEWED_LEGACY_SKILL_NAMES=Object.freeze({
  "200781": "トリック(後)",
  "200791": "逃げ駆け引き",
  "200801": "先行駆け引き",
  "200811": "差し駆け引き",
  "200821": "追込駆け引き",
  "200831": "逃げけん制",
  "200851": "逃げためらい",
  "200861": "先行けん制",
  "200871": "先行焦り",
  "200881": "先行ためらい",
  "200891": "差しけん制",
  "200901": "差し焦り",
  "200911": "差しためらい",
  "200921": "追込けん制",
  "200931": "追込焦り",
  "200941": "追込ためらい",
  "201012": "後方釘付",
  "201022": "抜け駆け禁止",
  "201121": "千里眼",
  "201122": "ホークアイ",
  "201152": "束縛",
  "201162": "ささやき",
  "201302": "リスタート",
  "201372": "かく乱",
  "201431": "大局観",
  "201432": "読解力",
  "201442": "鋭い眼光",
  "201472": "お見通し",
  "201501": "天命士",
  "201512": "まなざし"
});
function prepare(model,catalog,text,{fullRegistry=false,pinnedSkillText=null,allowReviewedLegacy=false}={}){
  if(!model||!isObject(model.skillById))throw Error('スキル照合用モデルが不正');
  if(!catalog||!Array.isArray(catalog.cards))return {catalog,skills:[],matchedHints:0};
  // JSON-safe public catalogs are cloned, so failed validation never mutates input or model.
  const converted=JSON.parse(JSON.stringify(catalog));
  let source=typeof text==='string'&&fullRegistry?parseSource(text):null,matchedHints=0;
  // The published catalog was checked against this fixed dictionary. Verify the
  // same facts at runtime instead of allowing changes on UmaSim/main to erase it.
  const pinned=typeof pinnedSkillText==='string'?parseSource(pinnedSkillText):null;
  const skills=new Map();
  function mapReward(reward){
    if(!isObject(reward)||typeof reward.skillId!=='string')return;
    const match=numericKey.exec(reward.skillId);
    if(!match)return;
    if(!source&&typeof text==='string')source=parseSource(text);
    const liveRecord=source?.byId.get(match[1]);
    const historicalRecord=pinned?.byId.get(match[1]);
    // If an old ID is removed or reassigned, the reviewed source snapshot wins.
    // Such legacy rewards stay separate from current-hint name reconciliation.
    const historical=!!historicalRecord&&(!liveRecord||
      liveRecord.name!==historicalRecord.name||
      liveRecord.rarity!==historicalRecord.rarity);
    const record=historicalRecord||liveRecord;
    if(!record){
      // A closed, explicitly enumerated compatibility set. Unknown IDs and
      // any altered approved name remain errors. Never merge these ID-only
      // records into hints by name or invent a gold/white rank.
      const reviewed=Object.hasOwn(REVIEWED_LEGACY_SKILL_NAMES,match[1])
        ?REVIEWED_LEGACY_SKILL_NAMES[match[1]]:null;
      if(!allowReviewedLegacy||!reviewed||reward.kind!==undefined&&reward.kind!=='hint'||
          normalize(reward.verifiedSkillName)!==normalize(reviewed))
        throw Error('数値スキルIDが未照合: '+reward.skillId);
      const key='skill:'+match[1];
      if(model.skillById[key]&&normalize(model.skillById[key].name)!==normalize(reviewed))
        throw Error('承認済み旧スキルの名称が現行モデルと矛盾: '+key);
      if(!model.skillById[key])skills.set(key,{
        id:key,name:reviewed,tier:'unknown',lowerId:null,sourceNumericId:match[1],
        sourceStatus:'reviewed-legacy-master-id-only'
      });
      delete reward.verifiedSkillName;
      reward.skillId=key;
      return;
    }
     if(reward.kind==='negative'?record.rarity!=='minus':
        !['normal','rare'].includes(record.rarity))
       throw Error('報酬種別と数値スキル分類が不一致: '+reward.skillId);
    // Prevent a changed upstream ID from silently redirecting a reviewed reward.
    if(typeof reward.verifiedSkillName!=='string'||normalize(reward.verifiedSkillName)!==record.name)
      throw Error('数値スキルIDの名称照合が失敗: '+reward.skillId);
    delete reward.verifiedSkillName;
    const hintId='hint:'+record.name;
    if(reward.kind!=='negative'&&!historical&&!!liveRecord&&
       source.byName.get(record.name)?.length===1&&Object.hasOwn(model.skillById,hintId)){
      reward.skillId=hintId;
      matchedHints++;
    } else {
      const key='skill:'+record.id;
      if(Object.hasOwn(model.skillById,key)){
        if(normalize(model.skillById[key].name)!==record.name)
          throw Error('既存スキルのIDと名称に矛盾: '+key);
      }else skills.set(key,{id:key,name:record.name,tier:record.rarity==='minus'?'negative':record.rarity==='rare'?'gold':'white',
        lowerId:null,sourceNumericId:record.id,
        sourceStatus:historical?'umasim-pinned-event-reward':'umasim-id-matched'});
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
  const reviewed=source?hierarchy.stage({model,source,skills:[...skills.values()],fullRegistry}):
    {skills:[...skills.values()],patches:[],linkedPairs:0};
  return {catalog:converted,skills:reviewed.skills,skillPatches:reviewed.patches,
    reviewedHierarchyPairs:reviewed.linkedPairs,structuralPairs:reviewed.structuralPairs||0,
    unresolvedHierarchyGroups:reviewed.unresolvedGroups||0,
    hierarchyWithoutLower:reviewed.withoutLower||0,totalRareSkills:reviewed.totalRare||0,
    matchedHints};
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
// Only accept the historical skill dictionary when its entire source bytes
// match the release-pinned digest. Cache uses a separate revision-specific key.
async function loadPinned({
 fetchImpl=g.fetch?.bind(g),
 store=g.UmaLiveLoader?.indexedDbStore(g.indexedDB,PINNED_CACHE_KEY),
 sourceUrl=PINNED_URL,expectedSha256=PINNED_SHA256,
 subtle=g.crypto?.subtle,now=()=>new Date().toISOString(),timeoutMs=12000
}={}){
 if(!subtle||typeof subtle.digest!=='function')
  throw Error('固定イベント辞書のSHA-256検証機能がありません');
 const verify=async text=>{
  if(typeof text!=='string')throw Error('固定イベント辞書がテキストではありません');
  const bytes=new TextEncoder().encode(text);
  const digest=Array.from(new Uint8Array(await subtle.digest('SHA-256',bytes)))
   .map(b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==expectedSha256)throw Error('固定イベント辞書のSHA-256が不一致');
  parseSource(text);
  return text;
 };
 // The upstream revision is immutable; verified cache is the first choice.
 try{
  const record=await store?.get();
  if(record?.sourceUrl===sourceUrl){
   await verify(record.text);
   return {text:record.text,mode:'cached',fetchedAt:record.fetchedAt||null};
  }
 }catch(_){/* Reject invalid cache; try the immutable upstream snapshot. */}
 if(!fetchImpl)throw Error('固定イベント辞書のFetch APIが利用できません');
 const controller=typeof AbortController!=='undefined'?new AbortController():null;
 const timeout=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
 try{
  const response=await fetchImpl(sourceUrl,{cache:'no-store',
   ...(controller?{signal:controller.signal}:{})});
  if(!response.ok)throw Error('固定イベント辞書 HTTP '+response.status);
  const text=await verify(await response.text());
  const fetchedAt=now();
  try{await store?.put({text,fetchedAt,sourceUrl});}
  catch(_){/* Verified network data is usable in private browsing. */}
  return {text,mode:'online',fetchedAt};
 }finally{if(timeout!==null)clearTimeout(timeout);}
}
const api={SOURCE_URL,CACHE_KEY,parseSource,prepare,load,loadPinned,PINNED_URL,PINNED_SHA256,PINNED_CACHE_KEY,REVIEWED_LEGACY_SKILL_NAMES};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this);
