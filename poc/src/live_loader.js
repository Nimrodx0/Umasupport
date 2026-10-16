/* Runtime-only data adapter. Source data is fetched from its publisher, never bundled. */
(function (g) {
  'use strict';
  const SOURCE_URL = 'https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt';
  const COLOR = { 'スピード':'#bc6665','スタミナ':'#58959c','パワー':'#bb9148','根性':'#a66d9b','賢さ':'#758bc1','友人':'#6caa89','グループ':'#8b91af' };
  const KEY = 'umasupport/umasim/support_card.txt/v1';
  function normalizeName(s) { return String(s).normalize('NFKC').replace(/\s+/g, ' ').trim(); }
  function parseSupportCards(text) {
    if (typeof text !== 'string' || text.length < 100000) throw new Error('カードデータが短すぎます');
    const cards = new Map();
    let lines = 0;
    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const f = line.split('\t');
      if (f.length !== 62 || !/^\d{5}$/.test(f[0]) || !/^[0-4]$/.test(f[4]) || !COLOR[f[6]] || !['1','2','3'].includes(f[3])) {
        throw new Error('サポカデータの形式が変更されています（行 ' + (lines+1) + '）');
      }
      lines++;
      const id=f[0], stage=f[4], name=f[1], type=f[6], rarity={'1':'R','2':'SR','3':'SSR'}[f[3]];
      const hints=[...new Set(f[59].split(',').map(normalizeName).filter(Boolean))];
      if (!cards.has(id)) cards.set(id, {id,name,type,rarity,stages:{}});
      const card=cards.get(id);
      if (card.name!==name || card.type!==type || card.rarity!==rarity || Object.hasOwn(card.stages,stage)) {
        throw new Error('サポカの段階または属性に矛盾があります：'+id);
      }
      card.stages[stage]=hints;
    }
    if (cards.size < 500) throw new Error('収録カード数が想定より少ないため採用しません：'+cards.size);
    for (const c of cards.values()) if (Object.keys(c.stages).length !== 5 || [0,1,2,3,4].some(i=>!Object.hasOwn(c.stages,String(i)))) {
      throw new Error('性能解放データが不足しています：'+c.id);
    }
    return {cards,lines};
  }
  function buildModel(text, meta={}) {
    const parsed=parseSupportCards(text), skillMap=new Map(), cards=[];
    for (const c of parsed.cards.values()) {
      const hintsByStage={};
      for (let i=0;i<=4;i++) hintsByStage[String(i)]=c.stages[String(i)].map(name=>{
        const id='hint:'+normalizeName(name);
        if (!skillMap.has(id)) skillMap.set(id,{id,name,tier:'unknown',lowerId:null});
        return id;
      });
      cards.push({id:c.id,name:c.name,character:c.name.includes(']')?c.name.split(']').slice(1).join(']'):c.name,
        rarity:c.rarity,type:c.type,accent:COLOR[c.type],hints:hintsByStage['4'],hintsByStage,
        events:[],effects:[],sourceStatus:'verified_hints',
        dataStatus:'通常ヒントは公開データから取得済み。イベント獲得経路は未収録。'});
    }
    const skills=[...skillMap.values()];
    const hintCount=cards.reduce((sum,c)=>sum+c.hints.length,0);
    return {version:'runtime-umasim-1',cards,skills,
      cardById:Object.fromEntries(cards.map(c=>[c.id,c])),
      skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
      meta:{sourceUrl:SOURCE_URL, dataMode:meta.mode||'online', fetchedAt:meta.fetchedAt||null,
        checkedAt:meta.checkedAt||null, verifiedIdCards:cards.length, totalHints:hintCount,
        unknownHintIds:0, eventStatus:'not-loaded', aliasCardIds:{}}};
  }
  function indexedDbStore(indexedDBImpl=g.indexedDB,key=KEY) {
    const open=()=>new Promise((resolve,reject)=>{
      if (!indexedDBImpl) return reject(new Error('IndexedDBを利用できません'));
      const req=indexedDBImpl.open('uma-support-lab-runtime-data',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('sources');
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('キャッシュを開けません'));
    });
    const operation=(mode,action)=>open().then(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction('sources',mode),request=action(tx.objectStore('sources'));
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error('キャッシュ操作に失敗'));
      tx.oncomplete=()=>db.close();
      tx.onerror=()=>{db.close();reject(tx.error||new Error('キャッシュ操作に失敗'));};
    }));
    return {get:()=>operation('readonly',s=>s.get(key)),put:record=>operation('readwrite',s=>s.put(record,key))};
  }
  async function load({fetchImpl=g.fetch?.bind(g),store=indexedDbStore(),now=()=>new Date().toISOString(),timeoutMs=12000}={}) {
    if (!fetchImpl) throw new Error('Fetch APIを利用できません');
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeout=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    let failure;
    try {
      const response=await fetchImpl(SOURCE_URL,{cache:'no-store',...(controller?{signal:controller.signal}:{})});
      if (!response.ok) throw new Error('データ提供元が HTTP '+response.status+' を返しました');
      const text=await response.text();
      buildModel(text); // Reject malformed data BEFORE overwriting the last good cache.
      const fetchedAt=now();
      try {await store.put({text,fetchedAt,sourceUrl:SOURCE_URL});}
      catch (e) { /* Private browsing: usable online even without a cache. */ }
      return {text,mode:'online',fetchedAt,checkedAt:fetchedAt};
    } catch (e) {failure=e;}
    finally {if (timeout!==null) clearTimeout(timeout);}
    try {
      const cached=await store.get();
      if (cached && cached.sourceUrl===SOURCE_URL) {
        buildModel(cached.text); // Never silently use corrupt cache.
        return {text:cached.text,mode:'cached',fetchedAt:cached.fetchedAt,checkedAt:now(),reason:String(failure)};
      }
    } catch (e) {failure=new Error(String(failure)+'; cache: '+String(e));}
    throw new Error('データ取得に失敗し、使用可能な保存データもありません。'+String(failure));
  }
  const api={SOURCE_URL,parseSupportCards,buildModel,indexedDbStore,load};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  g.UmaLiveLoader=api;
})(typeof globalThis!=='undefined'?globalThis:this);
