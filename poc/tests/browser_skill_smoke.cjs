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
  {id:'700001',name:'右回り○',rarity:'normal',group:70000,info:['右回りコースが少し得意になる','コーナーでの条件を判定','追加の持続条件','再発動時の条件 <em>後半</em>'],
   invokes:[{index:0,preConditions:[],conditions:[[
    {type:'running_style',operator:'==',value:1},
    {type:'distance_type',operator:'==',value:3}]],
    effects:[{type:'targetSpeed',value:1500}]}]},
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
 // This test deliberately uses SYNTHETIC cards and skills, so the real
 // 2487-event public catalog MUST NOT be mixed into this artificial model.
 // Mock a well-formed empty event catalog as part of the synthetic fixture.
 // Separate live-publication tests verify the actual 2487-event artifact.
 await page.route('**/reviewed_events.v1.json',r=>eventFailure?r.abort():
  r.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({schemaVersion:1,cards:[]})}));
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
  assert.equal(await page.locator('#bootstrap-status').isHidden(),true);
  assert.equal(await page.locator('.notice').count(),0,
   'Data provenance must not be a permanent dashboard banner');
  const initialScreen=await page.locator('main.app').innerText();
  for(const internal of ['本育成と継承育成のスキル獲得候補を比較します。',
   'イベント経路は承認済みデータのみ反映します。','LIVE SOURCE PROTOTYPE',
   'UmaSimの通常ヒントを利用しています。','検証用PoC']){
   assert.equal(initialScreen.includes(internal),false,
    'Developer-facing note remained on the page: '+internal);
  }
  // Fresh browser context: filters survive a card pick, modal close,
  // subsequent slots, switching decks and a non-first results page.
  const pickerContext=await browser.newContext();
  try{
   const pickerPage=await pickerContext.newPage();
   await mockSources(pickerPage);
   await boot(pickerPage,base);
   await pickerPage.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
   assert.equal(await pickerPage.locator('.picker-card .card-character').first().innerText(),'サポカ0');
   assert.equal(await pickerPage.locator('.picker-card .card-variant').first().innerText(),'架空30001');
   assert.equal(await pickerPage.locator('#picker-sort').inputValue(),'source');
   assert.equal(await pickerPage.locator('#picker-sort option[value="release-desc"]').count(),0,
    'Release dates absent from current runtime source must not offer fake chronological sorting');
   await pickerPage.locator('#picker-sort').selectOption('id-desc');
   assert.equal(await pickerPage.locator('.picker-card').first().getAttribute('data-id'),'30563');
   await pickerPage.locator('#picker-sort').selectOption('id-asc');
   assert.equal(await pickerPage.locator('.picker-card').first().getAttribute('data-id'),'30001');
   await pickerPage.locator('#picker-sort').selectOption('source');
   await pickerPage.locator('#picker-search').fill('サポカ0');
   await pickerPage.locator('#picker-skill-search').fill('右回り○');
   await pickerPage.locator('#picker-route').selectOption('hint');
   await pickerPage.locator('#picker-rarity').selectOption('SSR');
   await pickerPage.locator('#picker-type').selectOption('スピード');
   assert.equal(await pickerPage.locator('button[data-action="set-card"]').count(),1);
   await pickerPage.locator('button[data-action="set-card"][data-id="30001"]').click();
   await pickerPage.locator('button[data-action="pick"][data-deck="main"][data-index="1"]').click();
   assert.equal(await pickerPage.locator('#picker-search').inputValue(),'サポカ0');
   const retainedSelection=await pickerPage.locator('#picker-search').evaluate(input=>({
    focused:document.activeElement===input,
    start:input.selectionStart,
    end:input.selectionEnd,
    length:input.value.length
   }));
   assert.deepEqual(retainedSelection,{focused:true,start:0,end:4,length:4},
    'Opening the next picker must select the complete retained search query');
   await pickerPage.keyboard.type('サポカ1');
   assert.equal(await pickerPage.locator('#picker-search').inputValue(),'サポカ1',
    'Typing replaces the selected query rather than prefixing/appending');
   await pickerPage.locator('#picker-search').fill('サポカ0');
   assert.equal(await pickerPage.locator('#picker-skill-search').inputValue(),'右回り○');
   assert.equal(await pickerPage.locator('#picker-route').inputValue(),'hint');
   assert.equal(await pickerPage.locator('#picker-rarity').inputValue(),'SSR');
   assert.equal(await pickerPage.locator('#picker-type').inputValue(),'スピード');
   assert.equal(await pickerPage.locator('#picker-sort').inputValue(),'source');
   assert.equal(await pickerPage.locator('button[data-action="set-card"]').count(),1);
   await pickerPage.locator('#picker-only-owned').check();
   assert.equal(await pickerPage.locator('button[data-action="set-card"]').count(),0);
   await pickerPage.locator('button[data-action="close"]').click();
   await pickerPage.locator('button[data-action="pick"][data-deck="inherit"][data-index="0"]').click();
   assert.deepEqual(await pickerPage.locator('#picker-search').evaluate(input=>({
    start:input.selectionStart,end:input.selectionEnd,length:input.value.length
   })),{start:0,end:4,length:4},
   'Switching decks must also select the retained search text');
   assert.equal(await pickerPage.locator('#picker-only-owned').isChecked(),true);
   assert.equal(await pickerPage.locator('#picker-skill-search').inputValue(),'右回り○');
   assert.equal(await pickerPage.locator('button[data-action="set-card"]').count(),0);
   await pickerPage.locator('#picker-only-owned').uncheck();
   await pickerPage.locator('#picker-search').fill('サポカ');
   await pickerPage.locator('#picker-skill-search').fill('');
   await pickerPage.locator('#picker-route').selectOption('all');
   await pickerPage.locator('button[data-action="picker-next"]').click();
   assert.match(await pickerPage.locator('#picker-cards .tiny-note').first().innerText(),/2 \/ 5 ページ/);
   const cardPage2=await pickerPage.locator('button[data-action="set-card"]').first().getAttribute('data-id');
   await pickerPage.locator('button[data-action="set-card"]').first().click();
   await pickerPage.locator('button[data-action="pick"][data-deck="inherit"][data-index="1"]').click();
   assert.equal(await pickerPage.locator('#picker-search').inputValue(),'サポカ');
   assert.match(await pickerPage.locator('#picker-cards .tiny-note').first().innerText(),/2 \/ 5 ページ/);
   assert.equal(await pickerPage.locator('button[data-action="set-card"]').first().getAttribute('data-id'),cardPage2);
   await pickerPage.locator('#picker-search').fill('サポカ562');
   assert.equal(await pickerPage.locator('button[data-action="set-card"]').count(),1);
   await pickerPage.locator('button[data-action="close"]').click();
   await pickerPage.locator('button[data-action="pick"][data-deck="inherit"][data-index="2"]').click();
   assert.equal(await pickerPage.locator('#picker-search').inputValue(),'サポカ562');
   assert.equal(await pickerPage.locator('button[data-action="set-card"]').count(),1);
   await pickerPage.locator('button[data-action="close"]').click();
  }finally{await pickerContext.close();}
  // F-08: source status must report genuinely validated empty events.
  await page.locator('button[data-action="source-health"]').click();
  assert.match(await page.locator('#source-status-cards').innerText(),/563枚/);
  assert.match(await page.locator('#source-status-cards').innerText(),/563 \/ 563枚/);
  assert.match(await page.locator('#source-status-skills').innerText(),/公開元から取得・検証/);
  assert.match(await page.locator('#source-status-events').innerText(),/公開JSONの検証成功/);
  assert.match(await page.locator('#source-status-events').innerText(),/検証済みイベント\s+0件/);
  assert.match(await page.locator('.modal-body').innerText(),/受信した日時/);
  await page.locator('button[data-action="close"]').click();
  assert.deepEqual(await page.evaluate(()=>
   window.UmaDemoData.skillById['hint:右回り○'].activationProfile.invokes[0]
    .conditions[0].map(p=>p.valueLabel)),['逃げ','中距離'],
   'The real browser must attach source-verified categorized predicates');
  assert.equal(await page.evaluate(()=>
   window.UmaDemoData.meta.skillConditionProfiles.inference),'not-calculated',
   'P1 must not infer suitability or activation probability');
  assert.equal(await page.evaluate(()=>
   window.UmaDemoData.skillById['hint:右回り○'].activationTendency.status),'explicit-only',
   'P2 must not convert an explicit running-style condition to inferred suitability');
  assert.equal(await page.evaluate(()=>
   window.UmaDemoData.meta.skillStyleTendencies.ruleVersion),'rank-phase-style-v2',
   'P2 read-only metadata must attach in real Chromium');
  assert.equal(await page.evaluate(()=>
   Object.values(window.UmaDemoData.skillById).every(skill=>
    skill.activationTendency===undefined||
    !Object.hasOwn(skill.activationTendency,'probability'))),true,
   'P2 never invents skill activation probabilities');
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),2);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.skillById['skill:700004'].lowerId),'skill:700002');
  assert.equal(await page.evaluate(()=>window.UmaDemoData.skillById['skill:700002'].lowerId),'hint:右回り○');
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'picker-search',
   'Opening the picker must focus the card search box');
  const palette=async locator=>locator.evaluate(element=>({
   background:getComputedStyle(element).backgroundColor,
   foreground:getComputedStyle(element).color
  }));
  const speedColors={background:'rgb(41, 172, 235)',foreground:'rgb(17, 36, 54)'};
  assert.deepEqual(await palette(page.locator('.picker-card .card-icon').first()),speedColors,
   'Picker support card must use blue Speed hue and legible dark text');
  await page.locator('button[data-action="set-card"][data-id="30001"]').click();
  assert.deepEqual(await palette(page.locator('.slot .card-icon').first()),speedColors,
   'Selected deck card must use the same palette as the picker');
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
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.action),'close',
   'Modal must focus an accessible control when opened');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.action),'add-goal',
   'Shift+Tab must wrap to last modal control');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.action),'close',
   'Tab must stay inside the modal');
  await page.locator('#new-goal-skill-search').fill('右回り');
  assert.equal(await page.locator('#new-goal-skill option').count(),3);
  await page.locator('#new-goal-skill-search').fill('存在しない架空のスキル');
  assert.equal(await page.locator('#new-goal-skill option').count(),0);
  assert.equal(await page.locator('[data-action="add-goal"]').isDisabled(),true);
  await page.locator('#new-goal-skill-search').fill('右回り');
  assert.equal(await page.locator('#new-goal-skill option').count(),3);
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
  assert.equal(await page.locator('#owned-sort').inputValue(),'source');
  await page.locator('#owned-sort').selectOption('id-desc');
  assert.equal(await page.locator('.owned-card').first().getAttribute('data-owned-id'),'30563');
  await page.locator('#owned-sort').selectOption('source');
  assert.equal(await page.locator('.owned-card').first().getAttribute('data-owned-id'),'30001');
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
  await page.locator('#owned-search').fill('サポカ42');
  await page.locator('button[data-action="close"]').click();
  await page.locator('button[data-action="owned-manage"]').click();
  assert.equal(await page.locator('#owned-search').inputValue(),'サポカ42',
   'Owned-card filters must persist after closing the modal');
  await page.locator('[data-action="owned-filters-reset"]').click();
  assert.equal(await page.locator('#owned-search').inputValue(),'');
  assert.equal(await page.locator('#owned-route').inputValue(),'all');
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
  assert.match(await page.locator('.skill-effect-description').innerText(),/右回りコースが少し得意になる/);
  await page.locator('.skill-effect-detail summary').click();
  assert.match(await page.locator('.skill-effect-detail').innerText(),/コーナーでの条件を判定/);
  assert.match(await page.locator('.skill-effect-detail summary').innerText(),/3件/);
  const effectSteps=page.locator('.skill-effect-steps li');
  assert.equal(await effectSteps.count(),3,'All later publisher info entries must be rendered');
  assert.deepEqual(await effectSteps.allInnerTexts(),[
   'コーナーでの条件を判定','追加の持続条件','再発動時の条件 <em>後半</em>'
  ]);
  assert.equal(await page.locator('.skill-effect-steps em').count(),0,
   'Angle brackets in publisher text must be escaped, not parsed as HTML');
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
  // Readonly until choosing replace or merge. Cancel should leave localStorage unchanged.
  const currentBeforeImport=await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1'));
  const sourceFile={name:'backup.json',mimeType:'application/json',buffer:Buffer.from(multiDeckBackup)};
  await page.locator('#import-file').setInputFiles(sourceFile);
  await page.locator('[data-action="import-merge"]').waitFor();
  assert.match(await page.locator('.modal-body').innerText(),/読み込むファイル/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1')),currentBeforeImport);
  await page.locator('[data-action="import-cancel"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1')),currentBeforeImport);
  await page.locator('#import-file').setInputFiles(sourceFile);
  await page.locator('[data-action="import-merge"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#deck-select-main option').length===4);
  assert.equal(await page.locator('#deck-select-main').inputValue(),'main-default');
  assert.equal(await page.locator('#deck-select-inherit').inputValue(),'deck-3');
  assert.equal(await page.locator('#deck-select-main option').count(),4);
  let imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(imported.goalSets.length,2);
  assert.equal(imported.decks.inherit.length,4);
  assert.equal(new Set([...imported.decks.main,...imported.decks.inherit].map(d=>d.id)).size,8);
  assert.equal(imported.decks.main[0].slots[0].stage,0);
  assert.equal(imported.decks.main[1].slots[0].stage,0,'imported default deck');
  assert.equal(imported.decks.main[2].slots[0].stage,4,'imported copied deck');
  // Load the same file again and explicitly select full replacement.
  await page.locator('#import-file').setInputFiles(sourceFile);
  await page.locator('[data-action="import-replace"]').waitFor();
  assert.equal(await page.locator('#deck-select-main option').count(),4);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="import-replace"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#deck-select-main option').length===3);
  assert.equal(await page.locator('#deck-select-main option').count(),3);
  assert.equal(await page.locator('#deck-select-main').inputValue(),'deck-1');
  assert.equal(await page.locator('#deck-select-inherit').inputValue(),'deck-3');
  assert.match(await page.locator('button.slot[data-action="edit-card"][data-deck="main"][data-index="0"]').innerText(),/4凸/);
  // Invalid imported JSON must not overwrite the last good saved state.
  const beforeBadImport=await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1'));
  await page.locator('#import-file').setInputFiles({
   name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":2,"decks":{}}')
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1')),beforeBadImport);
  // Repeated rapid goal actions must assign unique IDs without Date.now collisions.
  await page.locator('button[data-action="goals"]').click();
  await page.locator('button[data-action="duplicate-goal-set"]').click();
  await page.locator('button[data-action="new-goal-set"]').click();
  let goalsSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(goalsSaved.goalSets.length,3);
  assert.equal(new Set(goalsSaved.goalSets.map(g=>g.id)).size,3);
  assert.equal(await page.locator('#goals-modal-select option').count(),3);
  await page.locator('#goals-modal-select').selectOption(goalsSaved.goalSets[1].id);
  assert.match(await page.locator('#goal-set-name').inputValue(),/複製/);
  await page.locator('#goal-set-name').fill('保存した周回目標');
  await page.locator('button[data-action="rename-goal-set"]').click();
  assert.match(await page.locator('#goal-set').innerText(),/保存した周回目標/);
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('button[data-action="delete-goal-set"]').click();
  goalsSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(goalsSaved.goalSets.length,3);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('button[data-action="delete-goal-set"]').click();
  goalsSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(goalsSaved.goalSets.length,2);
  await page.locator('button[data-action="close"]').click();
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
  await page.locator('button[data-action="source-health"]').click();
  assert.match(await page.locator('#source-status-cards').innerText(),/保存済み検証データを利用/);
  assert.match(await page.locator('#source-status-events').innerText(),/公開JSONの検証成功/);
  await page.locator('button[data-action="close"]').click();
  assert.match(status,/保存済みデータを利用中/);
  await page.unroute('**/data/skill_data.txt');
  await page.route('**/data/skill_data.txt',r=>r.fulfill({status:200,contentType:'text/plain',body:'{}'}));
  status=await boot(page,base);
  assert.match(status,/スキル辞書は保存済み版を使用/);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),2);
  await context.close();

  // Synthetic events in an isolated real browser; public reviewed DB stays EMPTY.
  const eventContext=await browser.newContext(),eventPage=await eventContext.newPage();
  await mockSources(eventPage);
  await boot(eventPage,base);
  for(const [kind,index,id] of [['main',0,'30001'],['main',1,'30002'],['main',2,'30003'],['inherit',0,'30001']]){
   await eventPage.locator('button[data-action="pick"][data-deck="'+kind+'"][data-index="'+index+'"]').click();
   await eventPage.locator('button[data-action="set-card"][data-id="'+id+'"]').click();
  }
  await eventPage.evaluate(()=>{
   window.UmaDemoData.cardById['30001'].events=[
    {id:'synthetic-start',name:'人工開始',type:'choice',choices:[
     {id:'go',label:'続行',rewards:[{skillId:'hint:右回り○'}]},
     {id:'stop',label:'打ち切り',terminal:true}]},
    {id:'synthetic-follow',name:'人工後編',type:'auto',
     requires:{all:[{eventId:'synthetic-start',choiceId:'go'}]},
     outcomes:[{id:'ok',label:'成功',rewards:[{skillId:'hint:右回り○'}]},
      {id:'ng',label:'失敗',rewards:[]}]}];
   window.UmaDemoData.cardById['30002'].events=[
    {id:'synthetic-second',name:'人工独立',type:'choice',choices:[
     {id:'yes',label:'承認'},{id:'no',label:'辞退'}]}];
  });
  await eventPage.locator('button[data-action="deck-events"][data-deck="main"]').click();
  assert.equal(await eventPage.locator('[data-event-card-fold]').count(),3,
   'All filled cards should be individually collapsible');
  assert.equal(await eventPage.locator('[data-event-item-fold]').count(),3,
   'All attached events should have individual disclosure headers');
  assert.equal(await eventPage.locator('[data-event-item-fold] .event-sequence-badge').count(),2,
   'Only the evidence-linked two-stage event gets a sequence badge');
  assert.equal(await eventPage.locator('[data-event-item-fold]').nth(2).locator('.event-sequence-badge').count(),0,
   'Independent event must not be labelled continuous');
  const firstEvent=eventPage.locator('[data-event-item-fold]').first();
  assert.equal(await firstEvent.getAttribute('open'),'',
   'The first event awaiting a choice should be expanded by default');
  await firstEvent.locator('summary').click();
  assert.equal(await firstEvent.getAttribute('open'),null);
  await firstEvent.locator('summary').click();
  assert.equal(await firstEvent.getAttribute('open'),'');
  await eventPage.locator('[data-action="events-collapse-all"]').click();
  assert.equal(await eventPage.locator('[data-event-item-fold][open]').count(),0);
  assert.equal(await eventPage.locator('[data-event-card-fold][open]').count(),0);
  await eventPage.locator('[data-action="events-expand-all"]').click();
  assert.equal(await eventPage.locator('[data-event-item-fold][open]').count(),3);
  assert.equal(await eventPage.locator('[data-event-card-fold][open]').count(),3);
  let overview=await eventPage.locator('.modal-body').innerText();
  assert.match(overview,/選択肢の未設定\s*2/);
  assert.match(overview,/到達不可\s*1/);
  assert.match(overview,/イベント未収録のカード\s*1/);
  assert.match(overview,/イベント未収録/);
  await eventPage.locator('#event-status-filter').selectOption('blocked');
  assert.equal(await eventPage.locator('#deck-event-results .event').count(),1);
  assert.match(await eventPage.locator('#deck-event-results').innerText(),/人工後編/);
  await eventPage.locator('#event-status-filter').selectOption('pending');
  assert.equal(await eventPage.locator('#deck-event-results .event').count(),2);
  await eventPage.evaluate(()=>window.__rootBeforeEventChange=document.querySelector('main.app'));
  await eventPage.locator('input[data-event-choice][data-deck="main"][data-index="0"][data-event="synthetic-start"][value="go"]').click();
  assert.equal(await eventPage.evaluate(()=>window.__rootBeforeEventChange===document.querySelector('main.app')),true,
   'Event selection must not discard the whole main screen');
  assert.equal(await eventPage.evaluate(()=>document.activeElement?.dataset?.action),'close',
   'When the pending-only filter removes a configured item, focus must stay in the dialog');
  await eventPage.locator('#event-status-filter').selectOption('all');
  await eventPage.locator('input[data-event-choice][data-deck="main"][data-index="0"][data-event="synthetic-start"][value="stop"]').click();
  assert.equal(await eventPage.evaluate(()=>document.activeElement?.dataset?.event),'synthetic-start',
   'When the event remains visible, the changed choice must regain keyboard focus');
  await eventPage.locator('input[data-event-choice][data-deck="main"][data-index="0"][data-event="synthetic-start"][value="go"]').click();
  await eventPage.locator('#event-status-filter').selectOption('pending');
  overview=await eventPage.locator('.modal-body').innerText();
  assert.match(overview,/自動候補\s*1/);
  assert.match(overview,/条件付きの報酬経路\s*1/);
  await eventPage.locator('#event-status-filter').selectOption('all');
  const visibleConditions=await eventPage.locator('[data-event-slot="0"]').innerText();
  assert.match(visibleConditions,/必要条件：人工開始 → 続行/);
  assert.equal(visibleConditions.includes('synthetic-start'),false,
   'Internal event IDs should not be printed in prerequisites');
  await eventPage.locator('#event-status-filter').selectOption('pending');
  await eventPage.locator('input[data-event-choice][data-deck="main"][data-index="1"][data-event="synthetic-second"][value="yes"]').click();
  let saved=await eventPage.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(saved.decks.main[0].slots[0].choices['synthetic-start'],'go');
  assert.equal(saved.decks.main[0].slots[1].choices['synthetic-second'],'yes');
  assert.deepEqual(saved.decks.inherit[0].slots[0].choices,{});
  // Even re-selecting the identical card must not silently erase event choices.
  await eventPage.locator('button[data-action="close"]').click();
  await eventPage.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  await eventPage.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await eventPage.locator('button[data-action="set-card"][data-id="30001"]').click();
  saved=await eventPage.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(saved.decks.main[0].slots[0].choices['synthetic-start'],'go');
  await eventPage.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  await eventPage.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  eventPage.once('dialog',dialog=>dialog.dismiss());
  await eventPage.locator('button[data-action="set-card"][data-id="30002"]').click();
  saved=await eventPage.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(saved.decks.main[0].slots[0].cardId,'30001');
  assert.equal(saved.decks.main[0].slots[0].choices['synthetic-start'],'go');
  await eventPage.locator('button[data-action="close"]').click();
  await eventPage.locator('button[data-action="deck-events"][data-deck="main"]').click();
  await eventPage.locator('#event-status-filter').selectOption('configured');
  await eventPage.locator('button[data-action="close"]').click();
  await eventPage.locator('button[data-action="deck-events"][data-deck="main"]').click();
  assert.equal(await eventPage.locator('#event-status-filter').inputValue(),'configured',
   'Event overview filter must persist across openings');
  await eventPage.locator('#event-status-filter').selectOption('all');
  eventPage.once('dialog',d=>d.dismiss());
  await eventPage.locator('[data-action="deck-event-slot-reset"][data-index="0"]').click();
  saved=await eventPage.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(saved.decks.main[0].slots[0].choices['synthetic-start'],'go');
  eventPage.once('dialog',d=>d.accept());
  await eventPage.locator('[data-action="deck-event-slot-reset"][data-index="0"]').click();
  saved=await eventPage.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.deepEqual(saved.decks.main[0].slots[0].choices,{});
  assert.equal(saved.decks.main[0].slots[1].choices['synthetic-second'],'yes');
  await eventPage.locator('button[data-action="close"]').click();
  await eventPage.locator('button[data-action="deck-events"][data-deck="inherit"]').click();
  await eventPage.locator('input[data-event-choice][data-deck="inherit"][data-index="0"][data-event="synthetic-start"][value="go"]').click();
  await eventPage.locator('button[data-action="close"]').click();
  await eventPage.locator('button[data-action="deck-events"][data-deck="main"]').click();
  eventPage.once('dialog',d=>d.accept());
  await eventPage.locator('[data-action="deck-events-reset"]').click();
  saved=await eventPage.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.deepEqual(saved.decks.main[0].slots[1].choices,{});
  assert.equal(saved.decks.inherit[0].slots[0].choices['synthetic-start'],'go');
  assert.equal(saved.decks.main[0].slots[2].cardId,'30003');
  assert.equal(await eventPage.locator('[data-action="deck-events-reset"]').isDisabled(),true);
  await eventPage.setViewportSize({width:390,height:844});
  assert.ok(await eventPage.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=1,
   'event overview mobile horizontal overflow');
  await eventPage.locator('button[data-action="close"]').click();
  // F-04 regression: two physical slots with the SAME card ID count as one
  // distinct provider. Both slots remain independently editable and visible.
  await eventPage.locator('button[data-action="edit-card"][data-deck="main"][data-index="1"]').click();
  await eventPage.locator('button[data-action="pick"][data-deck="main"][data-index="1"]').click();
  await eventPage.locator('button[data-action="set-card"][data-id="30001"]').click();
  await eventPage.locator('button[data-action="edit-card"][data-deck="main"][data-index="1"]').click();
  await eventPage.locator('select[data-stage]').selectOption('0');
  await eventPage.locator('button[data-action="close"]').click();
  const duplicatedRow=eventPage.locator('tr[data-skill="hint:右回り○"]');
  await duplicatedRow.waitFor();
  assert.match(await duplicatedRow.innerText(),/同カード複数枠/);
  assert.match(await duplicatedRow.locator('td').nth(1).innerText(),/^1/);
  await eventPage.locator('button[data-action="density"][data-value="detailed"]').click();
  assert.equal(await eventPage.locator('tr[data-skill="hint:右回り○"] button.mini[data-deck="main"]').count(),2);
  await eventPage.locator('tr[data-skill="hint:右回り○"] td').first().click();
  const detailText=await eventPage.locator('.modal-body').innerText();
  assert.match(detailText,/直接提供：1枚/);
  assert.match(detailText,/同じサポカが複数枠/);
  assert.match(detailText,/スロット1/);
  assert.match(detailText,/スロット2/);
  assert.match(detailText,/Lv.2/);
  assert.match(detailText,/Lv.4/);
  await eventPage.locator('button[data-action="close"]').click();
  await eventPage.locator('#only-duplicate').check();
  assert.equal(await eventPage.locator('tr[data-skill="hint:右回り○"]').count(),1,'also provided in inheritance deck: cross-deck common');
  await eventPage.locator('#only-duplicate').uncheck();
  const duplicateSaved=await eventPage.evaluate(()=>JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1')));
  assert.equal(duplicateSaved.decks.main[0].slots[0].stage,4);
  assert.equal(duplicateSaved.decks.main[0].slots[1].stage,0);
  await eventContext.close();

  // F-08: real Chromium IndexedDB, verified published JSON and network
  // recovery. Synthetic 563 cards and synthetic review events ONLY.
  const recoveredContext=await browser.newContext();
  const recoveredPage=await recoveredContext.newPage();
  await mockSources(recoveredPage);
  const emptyOnline=await boot(recoveredPage,base);
  assert.match(emptyOnline,/レビュー済みイベントを公開JSONから取得 0件/);
  const eventCacheRecord=await recoveredPage.evaluate(async key=>{
   const req=indexedDB.open('uma-support-lab-runtime-data',1);
   const db=await new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   try{
    const t=db.transaction('sources','readonly'),r=t.objectStore('sources').get(key);
    return await new Promise((resolve,reject)=>{
     r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
   }finally{db.close();}
  },'umasupport/public/reviewed_events.v1.json/v1');
  assert.equal(eventCacheRecord.sourceUrl,'./data/reviewed_events.v1.json');
  assert.equal(JSON.parse(eventCacheRecord.text).schemaVersion,1);
  await recoveredPage.route('**/reviewed_events.v1.json',r=>r.abort());
  const emptyCached=await boot(recoveredPage,base);
  assert.match(emptyCached,/レビュー済みイベントは保存済み検証版を使用 0件/);
  await recoveredPage.locator('button[data-action="source-health"]').click();
  assert.match(await recoveredPage.locator('#source-status-events').innerText(),/保存済みの検証済み公開イベントJSONを利用/);
  assert.match(await recoveredPage.locator('#source-status-events').innerText(),/検証済みイベント\s+0件/);
  await recoveredPage.locator('button[data-action="close"]').click();
  await recoveredPage.unroute('**/reviewed_events.v1.json');
  await recoveredPage.route('**/reviewed_events.v1.json',r=>r.fulfill({
   status:200,contentType:'application/json',body:'{"schemaVersion":1,"cards":[{"cardId":"99999","events":[]}]}'
  }));
  const invalidOnline=await boot(recoveredPage,base);
  assert.match(invalidOnline,/レビュー済みイベントは保存済み検証版を使用 0件/);
  const stillCached=await recoveredPage.evaluate(async key=>{
   const req=indexedDB.open('uma-support-lab-runtime-data',1);
   const db=await new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   try{
    const t=db.transaction('sources','readonly'),r=t.objectStore('sources').get(key);
    return await new Promise((resolve,reject)=>{
     r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
   }finally{db.close();}
  },'umasupport/public/reviewed_events.v1.json/v1');
  assert.deepEqual(stillCached,eventCacheRecord,'Invalid new event catalog must not poison verified cache');
  await recoveredPage.unroute('**/reviewed_events.v1.json');
  await recoveredPage.route('**/reviewed_events.v1.json',r=>r.abort());
  await recoveredPage.evaluate(async key=>{
   const req=indexedDB.open('uma-support-lab-runtime-data',1);
   const db=await new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   try{
    await new Promise((resolve,reject)=>{
     const t=db.transaction('sources','readwrite');
     t.objectStore('sources').put({
      text:'{"schemaVersion":1,"cards":[{"cardId":"99999","events":[]}]}',
      sourceUrl:'./data/reviewed_events.v1.json',fetchedAt:'2026-10-22T00:00:00.000Z'
     },key);
     t.oncomplete=resolve;t.onerror=()=>reject(t.error);
    });
   }finally{db.close();}
  },'umasupport/public/reviewed_events.v1.json/v1');
  const damagedCache=await boot(recoveredPage,base);
  assert.match(damagedCache,/イベントデータの検証に失敗/);
  assert.equal(await recoveredPage.evaluate(()=>window.UmaDemoData.meta.runtimeSources.events.mode),'failed');
  await recoveredContext.close();

  const failureContext=await browser.newContext(),failurePage=await failureContext.newPage();
  await mockSources(failurePage,{eventFailure:true});
  status=await boot(failurePage,base);
  assert.match(status,/イベントデータの検証に失敗/);
  assert.match(await failurePage.locator('.notice').innerText(),/イベント情報を読み込めませんでした/);
  await failurePage.locator('button[data-action="source-health"]').click();
  assert.match(await failurePage.locator('#source-status-events').innerText(),/公開JSONの検証失敗・未反映/);
  assert.match(await failurePage.locator('#source-status-events').innerText(),/検証不能・件数未確定/);
  assert.doesNotMatch(await failurePage.locator('#source-status-events').innerText(),/検証済みイベント\s+0件/);
  await failurePage.locator('button[data-action="close"]').click();
  assert.match(status,/金白構造候補 2\/3組/);
  assert.equal(await failurePage.evaluate(()=>window.UmaDemoData.meta.skillHierarchy.linked),2);
  assert.equal(await failurePage.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  assert.equal(await failurePage.locator('.notice').count(),1,
    'A failure warning must remain visible without raw diagnostics');
  await failureContext.close();
  console.log('PASS: Chromium DOM, full synthetic 563-card load, hierarchy, IndexedDB fallback, bad skill update, event outage');
 } finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
