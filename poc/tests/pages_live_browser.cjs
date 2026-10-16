'use strict';
// Production GitHub Pages verification. Run only on an explicitly changed workflow PR
// or a manual dispatch. Runtime game data is never checked in or printed.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');

const ROOT=path.resolve(__dirname,'../..');
const BASE='https://nimrodx0.github.io/Umasupport';
const APP=BASE+'/poc/live.html';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function checkPublishedFiles(request){
 for(const file of ['poc/live.html','poc/src/core.js','poc/src/skill_hierarchy.js',
                      'poc/src/skill_bridge.js','poc/src/live_app.js']){
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
   for(const key of ['umasupport/umasim/support_card.txt/v1','umasupport/umasim/skill_data.txt/v1']){
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
  const external=[],errors=[];
  page.on('request',req=>{
   if(req.url().includes('raw.githubusercontent.com/mee1080/umasim/') &&
       /(?:support_card|skill_data)\.txt/.test(req.url()))external.push(req.url());
  });
  page.on('pageerror',err=>errors.push(err.message));
  const status=await boot(page);
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
    reviewedEvents:m.meta.reviewedEventRecords,rare:h?.totalRare,linked:h?.linked,
    withoutLower:h?.withoutLower,unresolved:h?.unresolved,
    circle:chain?.name,intermediate:intermediate?.name,base:bottom?.name,
    indirect:window.UmaCore.coverage('hint:右回り○',fake,m),
    candidate:{id:candidate?.id,hint:candidate?.hints[0],name:candidate?.name}};
  });
  assert.ok(actual.cards>=500,'Card count too small: '+actual.cards);
  assert.ok(actual.hints>3000,'Hint count too small: '+actual.hints);
  assert.ok(actual.skills>700,'Skill count too small: '+actual.skills);
  assert.equal(actual.reviewedEvents,0,'Never claim events are verified');
  assert.equal(actual.rare,325);assert.equal(actual.linked,322);
  assert.equal(actual.withoutLower,3);assert.equal(actual.unresolved,0);
  assert.deepEqual([actual.circle,actual.intermediate,actual.base],
   ['右回りの鬼','右回り◎','右回り○']);
  assert.deepEqual(actual.indirect,{kind:'indirect',conditional:false,count:0});
  assert.ok(actual.candidate.id);
  const stored=await cacheInventory(page);
  assert.ok(Object.values(stored).every(r=>r.present&&r.textLength>10000&&r.fetchedAt));
  const cardId=actual.candidate.id,skillId=actual.candidate.hint;
  // Real deck and goal UI, with a card/hint chosen from the live game-data source.
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await page.locator('#picker-search').fill(actual.candidate.name);
  await page.locator('button[data-action="set-card"][data-id="'+cardId+'"]').click();
  const row=page.locator('tr[data-skill="'+skillId+'"]');
  await row.waitFor();assert.match(await row.innerText(),/1/);
  await page.locator('button[data-action="goals"]').click();
  await page.locator('#new-goal-skill').selectOption(skillId);
  await page.locator('#new-goal-scope').selectOption('main');
  await page.locator('button[data-action="add-goal"]').click();
  assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
  await page.locator('button[data-action="close"]').click();
  await page.locator('button[data-action="view"][data-value="split"]').click();
  assert.equal(await page.locator('.split-grid').count(),1);
  await page.locator('button[data-action="view"][data-value="integrated"]').click();
  // Only abort the game-data endpoints. Published HTML/JS/CSS must still reload.
  let blocked=0;
  await page.route('**/data/support_card.txt',r=>{blocked++;return r.abort();});
  await page.route('**/data/skill_data.txt',r=>{blocked++;return r.abort();});
  const cached=await boot(page);
  assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'cached');
  assert.match(cached,/スキル辞書は保存済み版を使用/);
  assert.equal(blocked,2);
  const restored=await page.evaluate(()=>({cards:window.UmaDemoData.cards.length,
   linked:window.UmaDemoData.meta.skillHierarchy.linked}));
  assert.equal(restored.cards,actual.cards);assert.equal(restored.linked,actual.linked);
  assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
  await page.unroute('**/data/support_card.txt');
  await page.unroute('**/data/skill_data.txt');
  // Desktop Chromium resized to a narrow viewport is NOT an actual Android device.
  await page.setViewportSize({width:390,height:844});
  const geometry=await page.evaluate(()=>({width:window.innerWidth,
   documentWidth:document.documentElement.scrollWidth}));
  assert.ok(geometry.documentWidth<=geometry.width+3,
    'Page-wide overflow at mobile width: '+JSON.stringify(geometry));
  await page.locator('button[data-action="pick"][data-deck="inherit"][data-index="0"]').click();
  await page.locator('#picker-search').fill(actual.candidate.name);
  await page.locator('button[data-action="set-card"][data-id="'+cardId+'"]').click();
  assert.ok(await page.locator('section[aria-label="継承育成デッキ"] .slot:not(.empty)').count()>=1);
  await page.locator('button[data-action="goals"]').click();
  await page.locator('button[data-action="close"]').click();

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
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),322);
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
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),322);
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
  assert.equal(await stateless.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),322);
  await noStorage.close();
  console.log('PASS: real Pages publisher recovery, invalid online skill update rejected, damaged skill/support cache isolation, initial-offline error, denied IndexedDB online mode');

  assert.deepEqual(errors,[],'Unexpected JavaScript errors');
  console.log('PASS: real Pages Chromium, source loading/IDB, live card+goal UI, hierarchy/indirect core, data-endpoint-only outage, narrow viewport');
  console.log('VERIFIED SUMMARY:',JSON.stringify({url:APP,ua:await page.evaluate(()=>navigator.userAgent),
   viewport:geometry,cards:actual.cards,hints:actual.hints,skills:actual.skills,
   rare:actual.rare,linked:actual.linked,withoutLower:actual.withoutLower,
   unresolved:actual.unresolved,reviewedEventCount:actual.reviewedEvents,
   cacheKeys:Object.keys(stored),firstNavigationPublisherGETs:2}));
  await context.close();
 }finally{await browser?.close();}
}
main().catch(e=>{console.error('FAIL production browser:',e);process.exitCode=1;});
