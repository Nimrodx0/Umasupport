'use strict';
// Real Chromium DOM/IndexedDB smoke with synthetic data, never a production-data audit.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const CARDS=563,SKILL_NORMALS=120;

function supportFixture(){
 const lines=[];
 for(let n=0;n<CARDS;n++){
  const id=String(30001+n);
  for(let stage=0;stage<=4;stage++){
   const f=Array(62).fill('');
   f[0]=id;f[1]='[架空'+id+']サポカ'+n;f[3]='3';f[4]=String(stage);
   f[6]='スピード';
   for(let k=7;k<=58;k++)f[k]='0';
   f[23]=String(stage>=2?2:0);f[24]=String(10+stage*5);
   f[49]='1';f[50]='5';
   f[59]=n===0?'右回り○':'';
   lines.push(f.join('\t'));
  }
 }
 return lines.join('\n');
}
function skillFixture(){
 const skills=[
  {id:'700004',name:'右回りの鬼',rarity:'rare',group:70000},
  {id:'700002',name:'右回り◎',rarity:'normal',group:70000},
  {id:'700001',name:'右回り○',rarity:'normal',group:70000},
  {id:'700014',name:'架空の金スキル',rarity:'rare',group:70001},
  {id:'700012',name:'架空の下位白',rarity:'normal',group:70001},
  {id:'700024',name:'架空の白なし金',rarity:'rare',group:70002}
 ];
 for(let i=0;i<SKILL_NORMALS;i++){
  skills.push({id:String(800000+i),name:'無関係な架空スキル'+i,
   rarity:'normal',group:Math.floor((800000+i)/10)});
 }
 return JSON.stringify(skills);
}
const supports=supportFixture(),skills=skillFixture();
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
function makeServer(){
 return http.createServer(async (req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   const file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
   if(!file.startsWith(ROOT+path.sep))throw Error('outside root');
   const content=await fs.readFile(file);
   res.writeHead(200,{'Content-Type':contentTypes[path.extname(file)]||'text/plain'});
   res.end(content);
  }catch(e){res.writeHead(404);res.end('Not found');}
 });
}
async function boot(page,base){
 await page.goto(base+'/poc/live.html',{waitUntil:'load'});
 await page.locator('#app main.app').waitFor({timeout:20000});
 const mode=await page.locator('#bootstrap-status').getAttribute('data-mode');
 assert.notEqual(mode,'error');
 return await page.locator('#bootstrap-status').innerText();
}
async function mockSources(page,{eventFailure=false}={}){
 await page.route('**/data/support_card.txt',r=>r.fulfill({status:200,contentType:'text/plain',body:supports}));
 await page.route('**/data/skill_data.txt',r=>r.fulfill({status:200,contentType:'text/plain',body:skills}));
 if(eventFailure)await page.route('**/reviewed_events.v1.json',r=>r.abort());
}
async function main(){
 const server=makeServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext(),page=await context.newPage();
  await mockSources(page);
  let status=await boot(page,base);
  assert.match(status,/金白構造候補 2\/3組/);
  let notice=await page.locator('.notice').innerText();
  assert.match(notice,/金白の構造上の対応候補 2\/3組/);
  assert.match(notice,/承認済み実イベントは0件/);
  assert.doesNotMatch(notice,/金スキル階層、カード性能は未照合/);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),2);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.skillById['skill:700004'].lowerId),'skill:700002');
  assert.equal(await page.evaluate(()=>window.UmaDemoData.skillById['skill:700002'].lowerId),'hint:右回り○');
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await page.locator('button[data-action="set-card"][data-id="30001"]').click();
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  let perf=await page.locator('.modal-body').innerText();
  assert.match(perf,/ヒント関連性能（4凸）/);
  assert.match(perf,/基礎 Lv.4/);
  assert.match(perf,/基本 30% \/ 固有 5%/);
  await page.locator('select[data-stage]').selectOption('0');
  perf=await page.locator('.modal-body').innerText();
  assert.match(perf,/ヒント関連性能（0凸）/);
  assert.match(perf,/基礎 Lv.2/);
  assert.match(perf,/基本 10% \/ 固有 5%/);
  await page.locator('button[data-action="close"]').click();
  const row=page.locator('tr[data-skill="hint:右回り○"]');
  await row.waitFor();assert.match(await row.innerText(),/右回り○/);
  // Goal-only white skill: keep gold/white relationships in the model, not as noisy table text.
  await page.locator('button[data-action="goals"]').click();
  await page.locator('#new-goal-skill').selectOption('skill:700002');
  await page.locator('#new-goal-scope').selectOption('main');
  await page.locator('button[data-action="add-goal"]').click();
  await page.locator('button[data-action="close"]').click();
  const orphanWhite=page.locator('tr[data-skill="skill:700002"]');
  await orphanWhite.waitFor();
  assert.match(await orphanWhite.innerText(),/右回り◎/);
  assert.doesNotMatch(await orphanWhite.innerText(),/対応する金スキル/);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.skillById['skill:700004'].lowerId),'skill:700002');
  // Phase 3: ownership registry uses all 563 cards, not the first 120 picker entries.
  await page.locator('button[data-action="owned-manage"]').click();
  assert.equal(await page.locator('.owned-card').count(),36);
  assert.match(await page.locator('#owned-results').innerText(),/563枚/);
  await page.locator('#owned-search').fill('サポカ0');
  assert.equal(await page.locator('.owned-card').count(),1);
  assert.equal(await page.locator('.owned-card').getAttribute('data-owned-id'),'30001');
  await page.locator('[data-owned-id="30001"] [data-action="owned-status"][data-status="owned"]').click();
  await page.locator('[data-owned-id="30001"] [data-owned-stage]').selectOption('3');
  let savedOwnership=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.deepEqual(savedOwnership.ownedCards['30001'],{status:'owned',stage:3});
  assert.equal(savedOwnership.decks.main[0].slots[0].stage,0,'owned stage must not edit deck stage');
  await page.locator('[data-owned-id="30001"] [data-action="owned-status"][data-status="unowned"]').click();
  assert.equal(await page.locator('[data-owned-id="30001"] [data-owned-stage]').count(),0);
  await page.locator('[data-owned-id="30001"] [data-action="owned-status"][data-status="unregistered"]').click();
  savedOwnership=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(savedOwnership.ownedCards['30001'],undefined);
  await page.locator('[data-owned-id="30001"] [data-action="owned-status"][data-status="owned"]').click();
  await page.locator('[data-owned-id="30001"] [data-owned-stage]').selectOption('3');
  await page.locator('#owned-search').fill('サポカ1');
  await page.locator('#owned-filter').selectOption('all');
  const matchCount=await page.locator('#owned-results .tiny-note').first().innerText();
  assert.match(matchCount,/条件一致 111枚/);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="owned-bulk"][data-status="owned"]').click();
  savedOwnership=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(Object.values(savedOwnership.ownedCards).filter(x=>x.status==='owned').length,112);
  assert.equal(savedOwnership.ownedCards['30002'].stage,0);
  await page.locator('#owned-filter').selectOption('owned');
  assert.match(await page.locator('#owned-results .tiny-note').first().innerText(),/条件一致 111枚/);
  await page.locator('[data-action="owned-next"]').click();
  assert.match(await page.locator('#owned-results').innerText(),/2 \/ 4ページ/);
  await page.locator('#owned-filter').selectOption('unowned');
  assert.equal(await page.locator('.owned-card').count(),0);
  await page.locator('#owned-filter').selectOption('all');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('[data-action="owned-bulk"][data-status="unowned"]').click();
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')))).ownedCards['30002'].status,'owned');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="owned-bulk"][data-status="unowned"]').click();
  await page.locator('#owned-filter').selectOption('unowned');
  assert.match(await page.locator('#owned-results .tiny-note').first().innerText(),/条件一致 111枚/);
  await page.locator('#owned-rarity').selectOption('SSR');
  await page.locator('#owned-type').selectOption('スピード');
  await page.locator('button[data-action="close"]').click();
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="1"]').click();
  await page.locator('#picker-only-owned').check();
  assert.equal(await page.locator('button[data-action="set-card"]').count(),1);
  assert.equal(await page.locator('button[data-action="set-card"]').first().getAttribute('data-id'),'30001');
  await page.locator('#picker-only-owned').uncheck();
  assert.equal(await page.locator('button[data-action="set-card"]').count(),120);
  await page.locator('button[data-action="close"]').click();
  await page.reload();
  await page.locator('#app main.app').waitFor();
  savedOwnership=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(savedOwnership.version,3);
  assert.deepEqual(savedOwnership.ownedCards['30001'],{status:'owned',stage:3});
  assert.equal(savedOwnership.ownedCards['30002'].status,'unowned');
  assert.equal(savedOwnership.decks.main[0].slots[0].stage,0);

  // Search routes are verified hints only while the reviewed events catalog is empty.
  await page.locator('button[data-action="owned-manage"]').click();
  await page.locator('#owned-skill-search').fill('右回り○');
  assert.equal(await page.locator('.owned-card').count(),1);
  assert.equal(await page.locator('.owned-card').first().getAttribute('data-owned-id'),'30001');
  await page.locator('#owned-route').selectOption('event');
  assert.equal(await page.locator('.owned-card').count(),0);
  await page.locator('#owned-route').selectOption('hint');
  assert.equal(await page.locator('.owned-card').count(),1);
  await page.locator('#owned-skill-search').fill('');
  await page.locator('#owned-skill-search').fill('');
  await page.locator('#owned-route').selectOption('all');
  await page.locator('#owned-rarity').selectOption('SSR');
  await page.locator('#owned-type').selectOption('スピード');
  assert.match(await page.locator('#owned-results .tiny-note').first().innerText(),/条件一致 563枚/);
  await page.locator('button[data-action="close"]').click();
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="1"]').click();
  await page.locator('#picker-skill-search').fill('右回り○');
  assert.equal(await page.locator('button[data-action="set-card"]').count(),1);
  await page.locator('#picker-route').selectOption('event');
  assert.equal(await page.locator('button[data-action="set-card"]').count(),0);
  await page.locator('#picker-route').selectOption('hint');
  assert.equal(await page.locator('button[data-action="set-card"]').count(),1);
  await page.locator('#picker-skill-search').fill('');
  await page.locator('#picker-route').selectOption('all');
  assert.equal(await page.locator('button[data-action="set-card"]').count(),120);
  await page.locator('button[data-action="picker-next"]').click();
  assert.equal(await page.locator('button[data-action="set-card"]').first().getAttribute('data-id'),'30121');
  await page.locator('button[data-action="picker-next"]').click();
  await page.locator('button[data-action="picker-next"]').click();
  await page.locator('button[data-action="picker-next"]').click();
  assert.equal(await page.locator('button[data-action="set-card"]').last().getAttribute('data-id'),'30563');
  await page.locator('#picker-search').fill('サポカ562');
  assert.equal(await page.locator('button[data-action="set-card"]').count(),1);
  assert.equal(await page.locator('button[data-action="set-card"]').first().getAttribute('data-id'),'30563');
  await page.locator('button[data-action="set-card"][data-id="30563"]').click();
  assert.match(await page.locator('button.slot[data-action="edit-card"][data-deck="main"][data-index="1"]').innerText(),/サポカ562/);
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="1"]').click();
  await page.locator('button[data-action="remove-card"][data-deck="main"][data-index="1"]').click();

  // Skill comparison filters are view-only, with root/child groups unchanged in model.
  await page.locator('#skill-coverage').selectOption('uncovered');
  assert.equal(await page.locator('tr[data-skill="hint:右回り○"]').count(),0);
  assert.equal(await page.locator('tr[data-skill="skill:700002"]').count(),1);
  await page.locator('#skill-coverage').selectOption('all');
  await page.locator('#skill-route').selectOption('event');
  assert.equal(await page.locator('#table-region tr[data-skill]').count(),0);
  await page.locator('#skill-route').selectOption('hint');
  assert.equal(await page.locator('tr[data-skill="hint:右回り○"]').count(),1);
  await page.locator('#skill-sort').selectOption('total-desc');
  assert.equal(await page.locator('tr[data-skill="hint:右回り○"]').count(),1);
  await page.locator('#skill-tier').selectOption('gold');
  assert.equal(await page.locator('tr[data-skill="hint:右回り○"]').count(),0);
  await page.locator('#skill-tier').selectOption('all');
  await page.locator('#skill-route').selectOption('all');
  await page.locator('tr[data-skill="hint:右回り○"]').click();
  assert.match(await page.locator('.modal-body').innerText(),/全カードから逆引き/);
  assert.match(await page.locator('.modal-body').innerText(),/通常ヒント（0～4凸のいずれか）/);
  assert.equal(await page.locator('.modal-body button[data-action="assign"]').count(),1);
  await page.locator('#reverse-only-owned').check();
  assert.equal(await page.locator('.modal-body button[data-action="assign"]').count(),1);
  await page.locator('#reverse-route').selectOption('event');
  assert.equal(await page.locator('.modal-body button[data-action="assign"]').count(),0);
  assert.match(await page.locator('.modal-body').innerText(),/情報未収録とゲーム内に存在しないことは別/);
  await page.locator('#reverse-route').selectOption('hint');
  assert.equal(await page.locator('.modal-body button[data-action="assign"]').count(),1);
  await page.locator('button[data-action="close"]').click();
  await page.locator('#skill-sort').selectOption('name');

  // Phase 3: both deck libraries remain independent across create/copy/rename/delete.
  await page.locator('button[data-action="deck-manage"][data-deck="main"]').click();
  await page.locator('#deck-name').fill('試験デッキA');
  await page.locator('button[data-action="deck-rename"][data-deck="main"]').click();
  assert.match(await page.locator('#deck-select-main').innerText(),/試験デッキA/);
  await page.locator('button[data-action="deck-copy"][data-deck="main"]').click();
  assert.equal(await page.locator('#deck-select-main').inputValue(),'deck-1');
  let setting=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(setting.version,3);
  assert.equal(setting.decks.main.length,2);
  assert.equal(setting.decks.main[1].slots[0].cardId,'30001');
  assert.equal(setting.decks.main[1].slots[0].stage,0);
  await page.locator('button[data-action="deck-new"][data-deck="main"]').click();
  assert.equal(await page.locator('#deck-select-main').inputValue(),'deck-2');
  assert.equal(await page.locator('button.slot.empty[data-deck="main"]').count(),6);
  await page.locator('#deck-name').fill('空の試験編成');
  await page.locator('button[data-action="deck-rename"][data-deck="main"]').click();
  await page.locator('button[data-action="close"]').click();
  await page.locator('#deck-select-main').selectOption('deck-1');
  assert.match(await page.locator('button.slot[data-action="edit-card"][data-deck="main"][data-index="0"]').innerText(),/0凸/);
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  await page.locator('select[data-stage]').selectOption('4');
  await page.locator('button[data-action="close"]').click();
  await page.locator('#deck-select-main').selectOption('main-default');
  assert.match(await page.locator('button.slot[data-action="edit-card"][data-deck="main"][data-index="0"]').innerText(),/0凸/);
  await page.locator('#deck-select-main').selectOption('deck-2');
  assert.equal(await page.locator('button.slot.empty[data-deck="main"]').count(),6);
  await page.locator('button[data-action="deck-manage"][data-deck="inherit"]').click();
  await page.locator('button[data-action="deck-new"][data-deck="inherit"]').click();
  assert.equal(await page.locator('#deck-select-inherit').inputValue(),'deck-3');
  assert.equal(await page.locator('#deck-select-main').inputValue(),'deck-2');
  await page.locator('button[data-action="close"]').click();
  await page.locator('#deck-select-main').selectOption('deck-1');
  setting=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(setting.goalSets[0].goals.length,1);
  assert.equal(setting.decks.main[0].slots[0].stage,0);
  assert.equal(setting.decks.main[1].slots[0].stage,4);
  assert.equal(setting.decks.inherit.length,2);
  status=await boot(page,base);
  assert.equal(await page.locator('#deck-select-main').inputValue(),'deck-1');
  assert.equal(await page.locator('#deck-select-inherit').inputValue(),'deck-3');
  assert.match(await page.locator('button.slot[data-action="edit-card"][data-deck="main"][data-index="0"]').innerText(),/4凸/);
  const multiDeckBackup=await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1'));
  await page.locator('button[data-action="deck-manage"][data-deck="main"]').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('button[data-action="deck-delete"][data-deck="main"]').click();
  assert.equal(await page.locator('#deck-select-main').inputValue(),'main-default');
  assert.equal(await page.locator('#deck-select-main option').count(),2);
  await page.locator('button[data-action="close"]').click();
  await page.locator('#deck-select-main').selectOption('deck-2');
  await page.locator('button[data-action="deck-manage"][data-deck="main"]').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('button[data-action="deck-delete"][data-deck="main"]').click();
  assert.equal(await page.locator('#deck-select-main option').count(),1);
  assert.equal(await page.locator('button[data-action="deck-delete"][data-deck="main"]').isDisabled(),true);
  await page.locator('button[data-action="close"]').click();
  assert.match(await page.locator('button.slot[data-action="edit-card"][data-deck="main"][data-index="0"]').innerText(),/0凸/);
  // Verify the actual JSON import path restores BOTH libraries and selected IDs.
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-file').setInputFiles({
   name:'backup.json',mimeType:'application/json',buffer:Buffer.from(multiDeckBackup)
  });
  await page.waitForFunction(()=>document.querySelectorAll('#deck-select-main option').length===3);
  assert.equal(await page.locator('#deck-select-main option').count(),3);
  assert.equal(await page.locator('#deck-select-main').inputValue(),'deck-1');
  assert.equal(await page.locator('#deck-select-inherit').inputValue(),'deck-3');
  assert.match(await page.locator('button.slot[data-action="edit-card"][data-deck="main"][data-index="0"]').innerText(),/4凸/);
  // Invalid imported JSON must not overwrite the last good saved state.
  const beforeBadImport=await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1'));
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-file').setInputFiles({
   name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":2,"decks":{}}')
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1')),beforeBadImport);
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1,'mobile deck selector overflow '+overflow);
  await page.setViewportSize({width:1280,height:720});

  // The browser must really have persisted both published source records.
  const stored=await page.evaluate(async()=>{
   const r=indexedDB.open('uma-support-lab-runtime-data',1);
   const db=await new Promise((ok,fail)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)});
   const tx=db.transaction('sources','readonly'),keys=tx.objectStore('sources').getAllKeys();
   const ids=await new Promise((ok,fail)=>{keys.onsuccess=()=>ok(keys.result);keys.onerror=()=>fail(keys.error)});
   db.close();return ids;
  });
  assert.ok(stored.some(x=>String(x).includes('support_card.txt')));
  assert.ok(stored.some(x=>String(x).includes('skill_data.txt')));
  await page.unroute('**/data/support_card.txt');
  await page.route('**/data/support_card.txt',r=>r.abort());
  status=await boot(page,base);
  assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'cached');
  assert.match(status,/保存済みデータを利用中/);
  await page.unroute('**/data/skill_data.txt');
  await page.route('**/data/skill_data.txt',r=>r.fulfill({status:200,contentType:'text/plain',body:'{}'}));
  status=await boot(page,base);
  assert.match(status,/スキル辞書は保存済み版を使用/);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),2);
  await context.close();

  const failureContext=await browser.newContext(),failurePage=await failureContext.newPage();
  await mockSources(failurePage,{eventFailure:true});
  status=await boot(failurePage,base);
  assert.match(status,/イベントデータの検証に失敗/);
  assert.match(status,/金白構造候補 2\/3組/);
  assert.equal(await failurePage.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),2);
  assert.equal(await failurePage.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  notice=await failurePage.locator('.notice').innerText();
  assert.match(notice,/金白の構造上の対応候補 2\/3組/);
  await failureContext.close();
  console.log('PASS: Chromium DOM, full synthetic 563-card load, hierarchy, IndexedDB fallback, bad skill update, event outage');
 } finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
