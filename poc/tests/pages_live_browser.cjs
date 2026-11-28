'use strict';
const {control}=require('./workspace_controls.cjs');
const CURRENT_PUBLIC=require('./current_public_event_fixture.cjs'); // fixed recovery only
const {verifySnapshot,CATALOG,APPROVALS}=require('../src/d074_event_data_branch.cjs');
const {digest}=require('../src/event_release_gate.cjs');
// Production GitHub Pages verification, after main deployment or manual dispatch. Runtime game data is never checked in or printed.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');

const ROOT=path.resolve(__dirname,'../..');
const BASE='https://nimrodx0.github.io/Umasupport';
const APP=BASE+'/';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const RAW='https://raw.githubusercontent.com/Nimrodx0/Umasupport/';
const MANIFEST_URL=RAW+'refs/heads/data/events/manifest.json';
async function readRaw(request,url){
 const response=await request.get(url,{timeout:30000,headers:{'Cache-Control':'no-cache'}});
 assert.equal(response.status(),200,'Public data HTTP '+url);
 return Buffer.from(await response.body());
}
async function readDistributed(request){
 const manifest=JSON.parse(await readRaw(request,MANIFEST_URL));
 assert.match(manifest.snapshotCommit||'',/^[a-f0-9]{40}$/,'Invalid immutable snapshot coordinate');
 const expectedHead=process.env.D074_EXPECTED_HEAD;
 if(expectedHead){
  assert.match(expectedHead,/^[a-f0-9]{40}$/);
  const fixed=JSON.parse(await readRaw(request,RAW+expectedHead+'/manifest.json'));
  assert.equal(digest(manifest),digest(fixed),'Moving manifest does not match published head');
 }
 const [catalogBytes,approvalBytes]=await Promise.all([CATALOG,APPROVALS].map(p=>readRaw(request,RAW+manifest.snapshotCommit+'/'+p)));
 assert.equal(sha(catalogBytes),manifest.catalogSha256,'Distributed catalog byte hash');
 assert.equal(sha(approvalBytes),manifest.approvalSha256,'Distributed approval byte hash');
 verifySnapshot(manifest,catalogBytes.toString('utf8'),approvalBytes.toString('utf8'));
 const catalog=JSON.parse(catalogBytes);
 const baseline=JSON.parse(await fs.readFile(path.join(ROOT,CATALOG),'utf8'));
 if(manifest.revision===1)assert.deepEqual(catalog.cards,baseline.cards,'Initial baseline must remain exact');
 // Later approved revisions may contain explicitly reviewed corrections. The
 // fixed snapshot and approvals above, not the old recovery copy, are authoritative.
 return {manifest,catalog};
}
async function expectedRuntime(){
 const live=await fs.readFile(path.join(ROOT,'poc/live.html'),'utf8');
 const version=/data-release="([a-zA-Z0-9-]+)"/.exec(live)?.[1];
 assert.ok(version,'Missing release identifier');
 const urls=[...live.matchAll(/\.\/src\/([a-zA-Z0-9_.-]+\.(?:js|css))\?v=([a-zA-Z0-9-]+)/g)];
 assert.ok(urls.length>=3&&urls.every(x=>x[2]===version),'Mixed asset versions');
 const assets=new Map();
 for(const [,file] of urls){const relative='poc/src/'+file;assets.set(BASE+'/'+relative+'?v='+version,sha(await fs.readFile(path.join(ROOT,relative))));}
 assert.ok(assets.has(BASE+'/poc/src/live_app.js?v='+version));
 return {version,assets};
}
async function checkPublishedFiles(request){
 for(const file of ['index.html','poc/live.html','poc/src/core.js','poc/src/live_loader.js','poc/src/skill_hierarchy.js',
                      'poc/src/skill_bridge.js','poc/src/live_app.js',
                      'poc/src/public_event_catalog.js','poc/data/reviewed_events.v1.json']){
  const resp=await request.get(BASE+'/'+file,{timeout:30000});
  assert.equal(resp.status(),200,'Published file HTTP '+file);
  assert.equal(sha(Buffer.from(await resp.body())),
    sha(await fs.readFile(path.join(ROOT,file))),
    'Pages does not serve the checkout version: '+file);
 }
}
async function boot(page){
 const resp=await page.goto(APP,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(resp?.status(),200,'Published app HTTP');
 try{await page.locator('#app main.app').waitFor({timeout:55000});}
 catch(e){throw Error('App bootstrap: '+await page.locator('#bootstrap-status').innerText()+'; '+e);}
 return page.locator('#bootstrap-status').innerText();
}
async function cacheInventory(page){
 return page.evaluate(async()=>{
  const req=indexedDB.open('uma-support-lab-runtime-data',1);
  const db=await new Promise((resolve,reject)=>{
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  try{
   const tx=db.transaction('sources','readonly'),store=tx.objectStore('sources'),res={};
   for(const key of ['umasupport/umasim/support_card.txt/v1','umasupport/umasim/skill_data.txt/v1',
                     'umasupport/umasim/skill_data.txt/cf9366f6a487bd8f197b53d8a11981207beb9f6c',
                     'umasupport/public/event-data-snapshot/v1']){
    const request=store.get(key);
    const item=await new Promise((resolve,reject)=>{
     request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    res[key]={present:!!item,textLength:item?.text?.length||0,
     fetchedAt:item?.fetchedAt||null,sourceUrl:item?.sourceUrl||null};
   }
   return res;
  }finally{db.close();}
 });
}

const SUPPORT_KEY='umasupport/umasim/support_card.txt/v1';
const SKILL_KEY='umasupport/umasim/skill_data.txt/v1';
async function readSourceRecords(page){
 return page.evaluate(async(keys)=>{
  const req=indexedDB.open('uma-support-lab-runtime-data',1);
  const db=await new Promise((ok,bad)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error);});
  try{
   const tx=db.transaction('sources','readonly'),records={};
   for(const key of keys){
    const request=tx.objectStore('sources').get(key);
    records[key]=await new Promise((ok,bad)=>{
     request.onsuccess=()=>ok(request.result);request.onerror=()=>bad(request.error);
    });
   }
   return records;
  }finally{db.close();}
 },[SUPPORT_KEY,SKILL_KEY]);
}
async function replaceSourceRecord(page,key,record){
 await page.evaluate(async({key,record})=>{
  const request=indexedDB.open('uma-support-lab-runtime-data',1);
  const db=await new Promise((ok,bad)=>{
   request.onsuccess=()=>ok(request.result);request.onerror=()=>bad(request.error);
  });
  try{
   await new Promise((ok,bad)=>{
    const tx=db.transaction('sources','readwrite');
    tx.objectStore('sources').put(record,key);
    tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);tx.onabort=()=>bad(tx.error);
   });
  }finally{db.close();}
 },{key,record});
}
async function assertBootError(page,fragment){
 const response=await page.goto(APP,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response?.status(),200);
 await page.locator('#bootstrap-status[data-mode="error"]').waitFor({timeout:25000});
 assert.match(await page.locator('#bootstrap-status').innerText(),fragment);
 assert.equal(await page.locator('#app main.app').count(),0);
}

async function main(){
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ja-JP'});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  await checkPublishedFiles(page.request);
  const {manifest,catalog:approved}=await readDistributed(page.request);
  const runtime=await expectedRuntime(),loaded=new Map(),responseChecks=[];
  page.on('response',response=>{
   const url=response.url();
   if(!url.startsWith(BASE+'/poc/src/')||!['script','stylesheet'].includes(response.request().resourceType()))return;
   responseChecks.push((async()=>{
    assert.ok(runtime.assets.has(url),'Unexpected local execution asset: '+url);
    assert.equal(response.status(),200,'Asset HTTP '+url);
    assert.equal(sha(Buffer.from(await response.body())),runtime.assets.get(url),'Actual loaded asset differs: '+url);
    loaded.set(url,true);
   })());
   responseChecks.at(-1).catch(()=>{});
  });
  const external=[],errors=[],warnings=[];
  page.on('console',msg=>{if(['warning','error'].includes(msg.type()))warnings.push(msg.text().slice(0,500));});
  page.on('request',req=>{
   if(req.url().includes('raw.githubusercontent.com/mee1080/umasim/main/') &&
       /(?:support_card|skill_data)\.txt/.test(req.url()))external.push(req.url());
  });
  page.on('pageerror',err=>errors.push(err.message));
  const status=await boot(page);
  await Promise.all(responseChecks);
  assert.deepEqual([...loaded.keys()].sort(),[...runtime.assets.keys()].sort(),'Missing actual runtime assets');
  assert.equal(await page.locator('#app-release').getAttribute('data-release'),runtime.version);
  console.log('D072_PAGES_RUNTIME='+JSON.stringify({version:runtime.version,assetCount:loaded.size,normalEntry:true}));
  assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'online');
  assert.match(status,/金白構造候補/);
  assert.equal(external.filter(u=>u.endsWith('/support_card.txt')).length,1);
  assert.equal(external.filter(u=>u.endsWith('/skill_data.txt')).length,1);
  const actual=await page.evaluate(()=>{
   const m=window.UmaDemoData,h=m.meta.skillHierarchy;
   const chain=m.skillById['skill:200014'];
   const intermediate=m.skillById[chain?.lowerId];
   const bottom=m.skillById[intermediate?.lowerId];
   const candidate=m.cards.find(c=>c.hints.includes('hint:右回り○'))||
                   m.cards.find(c=>c.hints.length);
   const fake={'skill:200014':{count:1,conditionalOnly:false,providers:{}}};
   return {cards:m.cards.length,hints:m.meta.totalHints,skills:m.skills.length,
    reviewedEvents:m.meta.reviewedEventRecords,
    reviewedCards:m.meta.reviewedEventCards,
    eventMode:m.meta.runtimeSources.events.mode,
    eventPick:(()=>{
     const card=m.cards.find(c=>c.events?.some(e=>e.type==='choice'&&!e.requires&&
       e.choices?.some(o=>o.rewards?.length)));
     if(!card)return null;
     const event=card.events.find(e=>e.type==='choice'&&!e.requires&&
       e.choices?.some(o=>o.rewards?.length));
     const choice=event.choices.find(o=>o.rewards?.length);
     return {id:card.id,name:card.name,eventId:event.id,choiceId:choice.id,eventName:event.name};
    })(),rare:h?.totalRare,linked:h?.linked,
    withoutLower:h?.withoutLower,unresolved:h?.unresolved,
    circle:chain?.name,intermediate:intermediate?.name,base:bottom?.name,
    indirect:window.UmaCore.coverage('hint:右回り○',fake,m),
    candidate:{id:candidate?.id,hint:candidate?.hints[0],name:candidate?.name}};
  });
  assert.ok(actual.cards>=500,'Card count too small: '+actual.cards);
  assert.ok(actual.hints>3000,'Hint count too small: '+actual.hints);
  assert.ok(actual.skills>700,'Skill count too small: '+actual.skills);
  assert.equal(actual.reviewedEvents,manifest.eventCount,'Distributed event cohort differs from verified manifest: '+JSON.stringify({status,eventMode:actual.eventMode,warnings}));
  assert.equal(actual.reviewedCards,manifest.cardCount,'Distributed event card coverage differs from verified manifest');
  const expectedIds=approved.cards.map(c=>[c.cardId,c.events.map(e=>e.id).sort()]).sort((a,b)=>a[0].localeCompare(b[0]));
  const runtimeIds=await page.evaluate(ids=>ids.map(id=>[id,(window.UmaDemoData.cardById[id]?.events||[]).map(e=>e.id).sort()]),expectedIds.map(x=>x[0]));
  assert.deepEqual(runtimeIds,expectedIds,'Runtime event identity coverage differs from approved catalog');
  // Exact identity coverage above is authoritative for all current cards.
  // Specific historical event facts are verified in fixed baseline tests; a later correction may change them.
  assert.ok(page.url().includes('/poc/live.html'),'normal entry must reach production app');
  assert.equal(actual.eventMode,'reviewed');
  const provenance=await page.evaluate(()=>window.UmaDemoData.meta.runtimeSources.events);
  assert.equal(provenance.revision,manifest.revision);
  assert.equal(provenance.snapshotCommit,manifest.snapshotCommit);
  assert.equal(provenance.url,RAW+manifest.snapshotCommit+'/'+CATALOG);
  console.log('D074_PAGES_DATA_SOURCE='+JSON.stringify({revision:provenance.revision,snapshotCommit:provenance.snapshotCommit}));

  assert.ok(status.includes(`${manifest.eventCount}件`),'Current event count missing from status');
  assert.ok(actual.eventPick,'No selectable and rewarded real public event found');
  assert.ok(actual.rare>=325,'Current master lost historical rare skill inventory');
  assert.equal(actual.linked,actual.rare-actual.withoutLower);
  assert.equal(actual.withoutLower,3);assert.equal(actual.unresolved,0);
  assert.deepEqual([actual.circle,actual.intermediate,actual.base],
   ['右回りの鬼','右回り◎','右回り○']);
  assert.deepEqual(actual.indirect,{kind:'indirect',conditional:false,count:0});
  assert.ok(actual.candidate.id);
  const stored=await cacheInventory(page);
  assert.ok(Object.values(stored).every(r=>r.present&&r.textLength>10000&&r.fetchedAt));
  const cardId=actual.candidate.id,skillId=actual.candidate.hint;
  // Real deck and goal UI, with a card/hint chosen from the live game-data source.
  await (await control(page,'button[data-action="pick"][data-deck="main"][data-index="0"]')).click();
  await (await control(page,'#picker-search')).fill(actual.candidate.name);
  await (await control(page,'button[data-action="set-card"][data-id="'+cardId+'"]')).click();
  // Newly introduced Phase 1 F-07: source-derived stage modifiers on the actual Pages card dialog.
  const livePerformance=await page.evaluate(cardId=>{
   const p=window.UmaDemoData.cardById[cardId].hintPerformanceByStage;
   return {low:p['0'],high:p['4']};
  },cardId);
  for(const stage of [livePerformance.low,livePerformance.high]){
   assert.ok(Object.values(stage).every(Number.isSafeInteger),'Publisher hint stats must be safe integers');
  }
  await (await control(page,'button[data-action="edit-card"][data-deck="main"][data-index="0"]')).click();
  let hintDescription=await page.locator('.modal-body').innerText();
  assert.match(hintDescription,/ヒント関連性能（4凸）/);
  assert.ok(hintDescription.includes('基礎 Lv.'+(1+livePerformance.high.levelBase+livePerformance.high.levelUnique)));
  assert.ok(hintDescription.includes('基本 '+livePerformance.high.frequencyBase+'% / 固有 '+livePerformance.high.frequencyUnique+'%'));
  await (await control(page,'select[data-stage]')).selectOption('0');
  hintDescription=await page.locator('.modal-body').innerText();
  assert.match(hintDescription,/ヒント関連性能（0凸）/);
  assert.ok(hintDescription.includes('基礎 Lv.'+(1+livePerformance.low.levelBase+livePerformance.low.levelUnique)));
  assert.ok(hintDescription.includes('基本 '+livePerformance.low.frequencyBase+'% / 固有 '+livePerformance.low.frequencyUnique+'%'));
  await (await control(page,'select[data-stage]')).selectOption('4');
  await (await control(page,'button[data-action="close"]')).click();
  const row=await control(page,'tr[data-skill="'+skillId+'"]');
  await row.waitFor();assert.match(await row.innerText(),/1/);
  // A real published GT event must remain usable in the ordinary deck editor.
  await (await control(page,'button[data-action="pick"][data-deck="main"][data-index="1"]')).click();
  await (await control(page,'#picker-search')).fill(actual.eventPick.name);
  await (await control(page,'button[data-action="set-card"][data-id="'+actual.eventPick.id+'"]')).click();
  await (await control(page,'button[data-action="edit-card"][data-deck="main"][data-index="1"]')).click();
  assert.ok((await page.locator('.modal-body').innerText()).includes(actual.eventPick.eventName));
  const eventChoice=page.locator('input[data-event-choice][data-event="'+actual.eventPick.eventId+
    '"][value="'+actual.eventPick.choiceId+'"]');
  await eventChoice.check();
  assert.equal(await eventChoice.isChecked(),true,'Published event choice did not persist');
  await (await control(page,'button[data-action="close"]')).click();
  await (await control(page,'button[data-action="goals"]')).click();
  await (await control(page,'#new-goal-skill')).selectOption(skillId);
  await (await control(page,'#new-goal-scope')).selectOption('main');
  await (await control(page,'button[data-action="add-goal"]')).click();
  assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
  await (await control(page,'button[data-action="close"]')).click();
  await (await control(page,'button[data-action="view"][data-value="split"]')).click();
  assert.equal(await page.locator('.split-grid').count(),1);
  await (await control(page,'button[data-action="view"][data-value="integrated"]')).click();
  // Only abort the game-data endpoints. Published HTML/JS/CSS must still reload.
  let supportBlocked=0,skillBlocked=0,eventBlocked=0;
  await page.route('**/data/support_card.txt',r=>{supportBlocked++;return r.abort();});
  await page.route('**/data/skill_data.txt',r=>{skillBlocked++;return r.abort();});
  await page.route('**/refs/heads/data/events/manifest.json',r=>{eventBlocked++;return r.abort();});
  await page.route('**/poc/data/reviewed_events.v1.json',r=>r.abort());
  const cached=await boot(page);
  assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'cached');
  assert.match(cached,/スキル辞書は保存済み版を使用/);
  assert.ok(supportBlocked>=1,'Support endpoint was not blocked');
  assert.ok(skillBlocked>=1,'Skill endpoint was not blocked');
  assert.ok(eventBlocked>=1,'Event endpoint was not blocked');
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),manifest.eventCount);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventCards),manifest.cardCount);
  assert.deepEqual(await page.evaluate(ids=>ids.map(id=>[id,(window.UmaDemoData.cardById[id]?.events||[]).map(e=>e.id).sort()]),expectedIds.map(x=>x[0])),expectedIds,'Cached distributed event IDs differ');
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.runtimeSources.events.mode),'cached');
  const restored=await page.evaluate(()=>({cards:window.UmaDemoData.cards.length,
   linked:window.UmaDemoData.meta.skillHierarchy.linked}));
  assert.equal(restored.cards,actual.cards);assert.equal(restored.linked,actual.linked);
  assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
  await page.unroute('**/data/support_card.txt');
  await page.unroute('**/data/skill_data.txt');
  await page.unroute('**/poc/data/reviewed_events.v1.json');
  await page.unroute('**/refs/heads/data/events/manifest.json');
  // Desktop Chromium resized to a narrow viewport is NOT an actual Android device.
  await page.setViewportSize({width:390,height:844});
  const geometry=await page.evaluate(()=>({width:window.innerWidth,
   documentWidth:document.documentElement.scrollWidth}));
  assert.ok(geometry.documentWidth<=geometry.width+3,
    'Page-wide overflow at mobile width: '+JSON.stringify(geometry));
  await (await control(page,'button[data-action="pick"][data-deck="inherit"][data-index="0"]')).click();
  await (await control(page,'#picker-search')).fill(actual.candidate.name);
  await (await control(page,'button[data-action="set-card"][data-id="'+cardId+'"]')).click();
  assert.ok(await page.locator('section[aria-label="継承育成デッキ"] .slot:not(.empty)').count()>=1);
  await (await control(page,'button[data-action="goals"]')).click();
  await (await control(page,'button[data-action="close"]')).click();

  // Preserve verified live data in transient test memory only. Never log or persist it.
  const originals=await readSourceRecords(page);
  assert.ok(originals[SUPPORT_KEY]?.text?.length>10000);
  assert.ok(originals[SKILL_KEY]?.text?.length>10000);

  // A syntactically invalid ONLINE skill update must not poison valid IndexedDB.
  await page.route('**/data/support_card.txt',r=>r.abort());
  await page.route('**/data/skill_data.txt',r=>r.fulfill({
   status:200,contentType:'application/json',body:'{}'
  }));
  const rejected=await boot(page);
  assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'cached');
  assert.match(rejected,/スキル辞書は保存済み版を使用/);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),actual.linked);
  const afterRejected=await readSourceRecords(page);
  assert.deepEqual(afterRejected,originals,'Rejected publisher content changed last good cache');

  // A corrupt SKILL cache must not masquerade as a valid hierarchy on outage.
  await page.unroute('**/data/skill_data.txt');
  await page.route('**/data/skill_data.txt',r=>r.abort());
  await replaceSourceRecord(page,SKILL_KEY,{...originals[SKILL_KEY],text:'{}'});
  const noSkill=await boot(page);
  assert.match(noSkill,/金白対応データは未取得/);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy||null),null);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.cards.length),actual.cards);
  await replaceSourceRecord(page,SKILL_KEY,originals[SKILL_KEY]);

  // A corrupt SUPPORT cache must fail closed, rather than show invented cards.
  await replaceSourceRecord(page,SUPPORT_KEY,{...originals[SUPPORT_KEY],text:'{}'});
  await assertBootError(page,/使用可能な保存データもありません/);
  await replaceSourceRecord(page,SUPPORT_KEY,originals[SUPPORT_KEY]);
  const afterRestoredCache=await boot(page);
  assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'cached');
  assert.match(afterRestoredCache,/スキル辞書は保存済み版を使用/);

  // Return to REAL LIVE publisher endpoints. Both caches can refresh automatically.
  await page.unroute('**/data/support_card.txt');
  await page.unroute('**/data/skill_data.txt');
  const restoredOnline=await boot(page);
  assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'online');
  assert.match(restoredOnline,/金白構造候補/);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),actual.linked);
  const refreshed=await readSourceRecords(page);
  assert.ok(refreshed[SUPPORT_KEY]?.text?.length>10000);
  assert.ok(refreshed[SKILL_KEY]?.text?.length>10000);
  assert.equal(external.filter(u=>u.endsWith('/support_card.txt')).length,7);
  assert.equal(external.filter(u=>u.endsWith('/skill_data.txt')).length,6);
  // When support bootstrap fails closed, the separate skill request is not started.
  // Exactly two requests actually reach each publisher: initial boot and online recovery.
  // Other attempts above are intercepted by local Playwright routing.

  // No online data and no cache on a fresh profile: fail visibly and never invent entries.
  const freshContext=await browser.newContext({locale:'ja-JP'});
  const fresh=await freshContext.newPage();
  await fresh.route('**/data/support_card.txt',r=>r.abort());
  await fresh.route('**/data/skill_data.txt',r=>r.abort());
  await assertBootError(fresh,/使用可能な保存データもありません/);
  await freshContext.close();

  // Restricted/private-browser storage: valid online input still loads in a new profile.
  // Fulfill the two source requests with the already obtained verified input in memory.
  const noStorage=await browser.newContext({locale:'ja-JP'});
  await noStorage.addInitScript(()=>{
   Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
  });
  const stateless=await noStorage.newPage();
  await stateless.route('**/data/support_card.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:originals[SUPPORT_KEY].text
  }));
  await stateless.route('**/data/skill_data.txt',r=>r.fulfill({
   status:200,contentType:'application/json',body:originals[SKILL_KEY].text
  }));
  await boot(stateless);
  assert.equal(await stateless.locator('#bootstrap-status').getAttribute('data-mode'),'online');
  assert.equal(await stateless.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),actual.linked);
  // Fresh profile without a distributed cache: pinned local baseline only.
  await stateless.route('**/refs/heads/data/events/manifest.json',r=>r.abort());
  const fallback=await boot(stateless);
  assert.match(fallback,/固定済み旧版/);
  assert.equal(await stateless.evaluate(()=>window.UmaDemoData.meta.runtimeSources.events.mode),'fallback');
  assert.equal(await stateless.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),CURRENT_PUBLIC.events);
  assert.equal(await stateless.evaluate(()=>window.UmaDemoData.meta.reviewedEventCards),CURRENT_PUBLIC.cards);
  await noStorage.close();
  console.log('PASS: real Pages publisher recovery, invalid online skill update rejected, damaged skill/support cache isolation, initial-offline error, denied IndexedDB online mode');

  assert.equal(digest(JSON.parse(await readRaw(page.request,MANIFEST_URL))),digest(manifest),'Distributed manifest changed during acceptance; retry against a stable revision');
  assert.deepEqual(errors,[],'Unexpected JavaScript errors');
  console.log('PASS: real Pages Chromium, verified current published events and 0/4 hint performance UI, source loading/IDB, live card+goal UI, hierarchy/indirect core, data-endpoint-only outage, narrow viewport');
  console.log('VERIFIED SUMMARY:',JSON.stringify({url:APP,ua:await page.evaluate(()=>navigator.userAgent),
   viewport:geometry,cards:actual.cards,hints:actual.hints,skills:actual.skills,
   rare:actual.rare,linked:actual.linked,withoutLower:actual.withoutLower,
   unresolved:actual.unresolved,reviewedEventCount:actual.reviewedEvents,
   cacheKeys:Object.keys(stored),firstNavigationPublisherGETs:2}));
  await context.close();
 }finally{await browser?.close();}
}
main().catch(e=>{console.error('FAIL production browser:',e);process.exitCode=1;});
