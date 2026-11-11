'use strict';
// W1.4 A-gate: real approved public JSON, SHA-pinned UmaSim and real
// Chromium persistence/JSON workflows. No published Pages or device claim.
// The two external source files exist only in CI memory and are never emitted.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const {getSources,server,boot,chooseCard,SAVE_KEY}=
 require('./browser_w1_pinned_public_integration.cjs');

const EVENT_CACHE='umasupport/public/reviewed_events.v1.json/v1';
const getSaved=page=>page.evaluate(key=>localStorage.getItem(key),SAVE_KEY);
async function importJSON(page,body,name='w1-settings.json'){
 await page.locator('#import-file').setInputFiles({
  name,mimeType:'application/json',buffer:Buffer.from(body)
 });
}
async function cachedEvent(page,edit){
 return page.evaluate(async({key,edit})=>{
  const request=indexedDB.open('uma-support-lab-runtime-data',1);
  const db=await new Promise((ok,bad)=>{
   request.onsuccess=()=>ok(request.result);request.onerror=()=>bad(request.error);
  });
  try{
   const get=db.transaction('sources','readonly').objectStore('sources').get(key);
   const prior=await new Promise((ok,bad)=>{get.onsuccess=()=>ok(get.result);get.onerror=()=>bad(get.error);});
   if(edit){
    await new Promise((ok,bad)=>{
     const tx=db.transaction('sources','readwrite');
     tx.objectStore('sources').put(edit,key);
     tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);
     tx.onabort=()=>bad(tx.error);
    });
   }
   return prior||null;
  }finally{db.close();}
 },{key:EVENT_CACHE,edit});
}
async function reload(page,url,mode='online'){
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('#app main.app').waitFor({timeout:40000});
 assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),mode);
}
async function acceptNext(page,pattern){
 const listener=page.waitForEvent('dialog');
 return async fn=>{
  const triggered=listener;
  const action=fn();
  const dialog=await triggered;
  assert.match(dialog.message(),pattern);
  await dialog.accept();
  await action;
 };
}
async function main(){
 const inputs=await getSources(),srv=server();
 await new Promise((ok,bad)=>{srv.once('error',bad);srv.listen(0,'127.0.0.1',ok);});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({locale:'ja-JP',acceptDownloads:true});
  const page=await context.newPage();
  await page.route('**/data/support_card.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:inputs.supports
  }));
  await page.route('**/data/skill_data.txt',r=>r.fulfill({
   status:200,contentType:'application/json',body:inputs.skills
  }));
  const app='http://127.0.0.1:'+srv.address().port+'/poc/live.html';
  await boot(page,app);
  // Select an approved choice whose reward is not already an ordinary hint.
  const choice=await page.evaluate(()=>{
   const core=window.UmaCore;
   for(const card of window.UmaDemoData.cards)
    for(const event of card.events||[]){
     if(event.type!=='choice'||event.requires)continue;
     for(const option of event.choices){
      if(option.requires||!option.rewards?.length)continue;
      const before=new Set(core.directRoutes(card,{stage:4,choices:{},outcomes:{}})
       .map(r=>r.skillId));
      const found=core.directRoutes(card,{stage:4,choices:{[event.id]:option.id},outcomes:{}})
       .find(r=>r.source==='event'&&r.eventId===event.id&&
        !r.conditional&&!before.has(r.skillId));
      if(found)return {card:{id:card.id,name:card.name},
       eventId:event.id,choiceId:option.id,skillId:found.skillId};
     }
    }
   return null;
  });
  assert.ok(choice,'No real public choice to test saving');
  await chooseCard(page,'main',0,choice.card);
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  await page.locator('input[data-event-choice][data-deck="main"][data-index="0"][data-event="'+
   choice.eventId+'"][value="'+choice.choiceId+'"]').check();
  await page.locator('button[data-action="close"]').click();
  await page.locator('button[data-action="goals"]').click();
  await page.locator('#new-goal-skill-search').fill(choice.skillId);
  await page.locator('#new-goal-skill').selectOption(choice.skillId);
  await page.locator('#new-goal-scope').selectOption('main');
  await page.locator('button[data-action="add-goal"]').click();
  await page.locator('button[data-action="close"]').click();
  assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
  await page.locator('button[data-action="view"][data-value="split"]').click();
  await page.locator('button[data-action="density"][data-value="detailed"]').click();
  const initial=JSON.parse(await getSaved(page));
  assert.equal(initial.decks.main[0].slots[0].choices[choice.eventId],choice.choiceId);
  assert.equal(initial.view,'split');
  // The real export action must yield exactly the persisted structured data.
  const downloadWait=page.waitForEvent('download');
  await page.locator('button[data-action="export"]').click();
  const download=await downloadWait;
  assert.match(download.suggestedFilename(),/\.json$/);
  const backup=await fs.readFile(await download.path(),'utf8');
  assert.deepEqual(JSON.parse(backup),initial);
  // Invalid syntax and unknown IDs must be rejected without touching storage.
  const before=await getSaved(page);
  const badSyntax=page.waitForEvent('dialog');
  await importJSON(page,'{unclosed');
  const syntaxAlert=await badSyntax;
  assert.match(syntaxAlert.message(),/JSONを読み取れませんでした/);
  await syntaxAlert.accept();
  assert.equal(await getSaved(page),before);
  const bad=structuredClone(initial);
  bad.goalSets[0].goals[0].skillId='never-published-skill-id';
  const invalidDialog=page.waitForEvent('dialog');
  await importJSON(page,JSON.stringify(bad));
  const invalidAlert=await invalidDialog;
  assert.match(invalidAlert.message(),/存在しないスキルID/);
  await invalidAlert.accept();
  assert.equal(await getSaved(page),before);
  // Preview is non-destructive, including cancellation.
  await importJSON(page,backup);
  await page.locator('button[data-action="import-cancel"]').waitFor();
  assert.equal(await getSaved(page),before);
  await page.locator('button[data-action="import-cancel"]').click();
  assert.equal(await getSaved(page),before);
  // Merge creates independent copies and must not replace active deck/goal/display.
  await importJSON(page,backup);
  await page.locator('button[data-action="import-merge"]').click();
  const merged=JSON.parse(await getSaved(page));
  assert.equal(merged.decks.main.length,2);
  assert.equal(merged.decks.inherit.length,2);
  assert.equal(merged.goalSets.length,2);
  assert.equal(merged.activeDecks.main,initial.activeDecks.main);
  assert.equal(merged.view,initial.view);
  assert.equal(merged.density,initial.density);
  assert.deepEqual(merged.decks.main[0].slots,initial.decks.main[0].slots);
  const mergedBackup=JSON.stringify(merged);
  // Replacement requires explicit user confirmation, then restores exact backup.
  await importJSON(page,backup);
  await page.locator('button[data-action="import-replace"]').waitFor();
  const reject=page.waitForEvent('dialog');
  const rejectAction=page.locator('button[data-action="import-replace"]').click();
  const rejectDialog=await reject;
  assert.match(rejectDialog.message(),/置き換え/);
  await rejectDialog.dismiss();
  await rejectAction;
  assert.equal(await getSaved(page),mergedBackup);
  const accept=page.waitForEvent('dialog');
  const acceptAction=page.locator('button[data-action="import-replace"]').click();
  const acceptDialog=await accept;
  await acceptDialog.accept();await acceptAction;
  assert.deepEqual(JSON.parse(await getSaved(page)),initial);
  await reload(page,app);
  assert.equal(await getSaved(page),JSON.stringify(initial));
  // All source endpoints fail; verified IndexedDB must recover all three
  // sources without a single loss of event choices or goals.
  const block=r=>r.abort();
  for(const uri of ['**/data/support_card.txt','**/data/skill_data.txt',
   '**/reviewed_events.v1.json'])await page.route(uri,block);
  await reload(page,app,'cached');
  assert.equal(await getSaved(page),JSON.stringify(initial));
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),2487);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.runtimeSources.events.mode),'cached');
  assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
  // Invalid online event JSON must not replace the already-verified cached JSON.
  await page.unroute('**/reviewed_events.v1.json',block);
  const invalidEvent=r=>r.fulfill({status:200,
   contentType:'application/json',body:'{broken-JSON'});
  await page.route('**/reviewed_events.v1.json',invalidEvent);
  await reload(page,app,'cached');
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.runtimeSources.events.mode),'cached');
  assert.equal(await getSaved(page),JSON.stringify(initial));
  await page.unroute('**/reviewed_events.v1.json',invalidEvent);
  await page.route('**/reviewed_events.v1.json',block);
  // Corrupt both network and event cache: failure must not erase user settings.
  const lastGood=await cachedEvent(page);
  assert.ok(lastGood?.text?.length>10000);
  await cachedEvent(page,{...lastGood,text:'{}'});
  await page.goto(app,{waitUntil:'domcontentloaded'});
  await page.locator('#app main.app').waitFor({timeout:40000});
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.runtimeSources.events.mode),'failed');
  assert.equal(await getSaved(page),JSON.stringify(initial),
   'Event source+cache failures must not destroy saved user data');
  await cachedEvent(page,lastGood);
  await reload(page,app,'cached');
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),2487);
  assert.deepEqual(JSON.parse(await getSaved(page)),initial);
  assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
  for(const uri of ['**/data/support_card.txt','**/data/skill_data.txt',
   '**/reviewed_events.v1.json'])await page.unroute(uri,block);
  await reload(page,app);
  assert.equal(await getSaved(page),JSON.stringify(initial));
  // Damaged settings are not silently replaced. Rejecting reset preserves bytes.
  const raw='{broken-settings';
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:SAVE_KEY,raw});
  await page.goto(app,{waitUntil:'domcontentloaded'});
  await page.locator('button[data-action="reset"]').waitFor({timeout:40000});
  assert.match(await page.locator('#app').innerText(),/保存設定を読み込めませんでした/);
  assert.equal(await getSaved(page),raw);
  const resetDialog=page.waitForEvent('dialog');
  const resetClick=page.locator('button[data-action="reset"]').click();
  const dialog=await resetDialog;
  assert.match(dialog.message(),/初期状態/);
  await dialog.dismiss();await resetClick;
  assert.equal(await getSaved(page),raw);
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),
   {key:SAVE_KEY,raw:JSON.stringify(initial)});
  await reload(page,app);
  assert.match(await page.locator('.goal-pill').first().innerText(),/直接カバー/);
  await context.close();

  // A truly fresh, source-blocked browser must fail visibly, not create
  // placeholder cards, hint routes, or user settings.
  const cold=await browser.newContext();
  const empty=await cold.newPage();
  for(const uri of ['**/data/support_card.txt','**/data/skill_data.txt',
   '**/reviewed_events.v1.json'])await empty.route(uri,r=>r.abort());
  await empty.goto(app,{waitUntil:'domcontentloaded'});
  await empty.locator('#bootstrap-status[data-mode="error"]').waitFor({timeout:30000});
  assert.equal(await empty.locator('#app main.app').count(),0);
  assert.equal(await getSaved(empty),null);
  await cold.close();
  console.log('W1_SETTINGS_RESILIENCE_PASS='+JSON.stringify({
   cohort:2487,pinnedSource:true,exportAndReplace:true,cancelAndMerge:true,
   invalidImportAtomic:true,offlineVerifiedCache:true,corruptEventCacheFailClosed:true,
   invalidOnlineEventKeptCache:true,corruptSettingsPreserved:true,coldOfflineFailClosed:true,
   realWindowsAndroidTested:false,publishedPagesTested:false
  }));
 }finally{
  await browser?.close();
  await new Promise(ok=>srv.close(ok));
 }
}
main().catch(e=>{console.error('W1 settings browser test failed:',e);process.exitCode=1;});
