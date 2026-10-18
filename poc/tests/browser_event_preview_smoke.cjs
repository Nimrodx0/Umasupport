'use strict';
// Actual Chromium UI interaction with a five-event, UNAPPROVED preview.
// All support/skill upstream network traffic is mocked using synthetic data.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const PREVIEW_SKILLS=require('../src/efforia30311_review_preview.cjs').SKILLS;
function supports(){
 const out=[];
 for(let n=0;n<563;n++){
  const id=String(30001+n);
  for(let stage=0;stage<5;stage++){
   const v=Array(62).fill('');
   v[0]=id;v[1]='[架空'+id+']サポカ'+n;v[3]='3';v[4]=String(stage);v[6]='スピード';
   for(let k=7;k<=58;k++)v[k]='0';
   v[23]='0';v[24]='10';v[49]='0';v[50]='0';v[59]=n===0?'右回り○':'';
   out.push(v.join('\t'));
  }
 }
 return out.join('\n');
}
const skills=JSON.stringify([
 ...Object.entries(PREVIEW_SKILLS).map(([id,name],i)=>({id,name,rarity:'normal',group:40000+i})),
 ...Array.from({length:120},(_,i)=>({id:String(800000+i),name:'架空スキル'+i,
  rarity:'normal',group:80000+i}))
]);
const fixtureSupports=supports();
function server(){
 return http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   const full=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
   if(!full.startsWith(ROOT+path.sep))throw Error('directory traversal');
   const content=await fs.readFile(full);
   const type=full.endsWith('.js')?'text/javascript':
     full.endsWith('.json')?'application/json':
     full.endsWith('.html')?'text/html':full.endsWith('.css')?'text/css':'text/plain';
   res.writeHead(200,{'Content-Type':type});res.end(content);
  }catch{res.writeHead(404);res.end('Missing');}
 });
}
async function mock(page){
 await page.route('**/data/support_card.txt',r=>r.fulfill({
  status:200,contentType:'text/plain',body:fixtureSupports}));
 await page.route('**/data/skill_data.txt',r=>r.fulfill({
  status:200,contentType:'text/plain',body:skills}));
}
async function boot(page,url){
 await page.goto(url,{waitUntil:'load'});
 await page.locator('#app main.app').waitFor({timeout:25000});
 assert.notEqual(await page.locator('#bootstrap-status').getAttribute('data-mode'),'error');
}
async function main(){
 const web=server();
 await new Promise((resolve,reject)=>{
  web.once('error',reject);web.listen(0,'127.0.0.1',resolve);
 });
 const origin='http://127.0.0.1:'+web.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();
  const page=await context.newPage();await mock(page);
  await boot(page,origin+'/poc/live.html?eventPreview=30311');
  assert.match(await page.locator('#candidate-preview-warning').innerText(),/未承認イベントの試用モード/);
  assert.match(await page.locator('.notice').last().innerText(),/承認済み実イベントは0件/);
  assert.equal(await page.evaluate(()=>window.UmaPreviewActive),true);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.cardById['30311'].events.length),5);
  await page.locator('button[data-action="source-health"]').click();
  assert.match(await page.locator('#source-status-events').innerText(),/未承認イベント試用中/);
  await page.locator('button[data-action="close"]').click();

  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await page.locator('#picker-search').fill('サポカ310');
  await page.locator('button[data-action="set-card"][data-id="30311"]').click();
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  assert.equal(await page.locator('.modal-body .event').count(),5);
  const ids=['830311001','830311002','830311003'];
  for(const id of ids){
   await page.locator('input[data-event-choice][data-deck="main"][data-index="0"][data-event="evt_30311_'+id+'"][value="option1"]').click();
  }
  const actual=await page.evaluate(()=>{
   const key='uma-support-lab-runtime-umasim-v1-event-preview';
   const saved=JSON.parse(localStorage.getItem(key));
   const slot=saved.decks.main[0].slots[0];
   return window.UmaCore.directRoutes(window.UmaDemoData.cardById['30311'],slot)
      .filter(r=>r.source==='event')
      .map(r=>({skillId:r.skillId,level:r.level,conditional:r.conditional}));
  });
  assert.equal(actual.length,7); // stage2 1 hint, finale option1 success/great 6
  assert.equal(actual.filter(r=>r.conditional).length,6);
  assert.ok(actual.some(r=>r.skillId==='skill:204532'&&r.level===5&&r.conditional));
  assert.ok(actual.some(r=>r.skillId==='skill:204532'&&r.level===1&&r.conditional));
  assert.equal(await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1')),null);
  await page.locator('button[data-action="close"]').click();

  // In the SAME browser origin, normal mode must not inherit candidate data.
  await boot(page,origin+'/poc/live.html');
  assert.equal(await page.locator('#candidate-preview-warning').count(),0);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.cardById['30311'].events.length),0);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  assert.equal(await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').count(),0);
  await context.close();

  // Malformed or missing candidate data never appears as a reviewed event.
  const bad=await browser.newContext(),badPage=await bad.newPage();await mock(badPage);
  await badPage.route('**/preview/efforia30311.v1.json',r=>r.abort());
  await boot(badPage,origin+'/poc/live.html?eventPreview=30311');
  assert.equal(await badPage.evaluate(()=>window.UmaDemoData.cardById['30311'].events.length),0);
  assert.equal(await badPage.evaluate(()=>window.UmaPreviewActive),false);
  assert.match(await badPage.locator('.notice').last().innerText(),/試用イベントは適用されませんでした/);
  await bad.close();

  console.log('PASS: opt-in SSR30311 candidate loads, choices affect skill routes, normal storage and release count isolated');
 }finally{
  await browser?.close();
  await new Promise(resolve=>web.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
