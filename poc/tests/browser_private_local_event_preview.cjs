'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const {fixture}=require('./private_local_2512_fixture.cjs');
const ROOT=path.resolve(__dirname,'../..');
const sample=fixture();
const supports=()=>{
 const out=[];
 for(let i=0;i<563;i++){
  const id=String(30001+i);
  for(let stage=0;stage<5;stage++){
   const v=Array(62).fill('');
   v[0]=id;v[1]='[架空'+id+']サポカ'+i;
   v[3]='3';v[4]=String(stage);v[6]='スピード';
   for(let k=7;k<=58;k++)v[k]='0';
   v[23]='0';v[24]='10';v[49]='0';v[50]='0';
   v[59]=i===0?'架空ヒント':'';
   out.push(v.join('\t'));
  }
 }
 return out.join('\n');
};
function server(){
 return http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://127.0.0.1');
   const target=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));
   if(!target.startsWith(ROOT+path.sep))throw Error('path traversal');
   const text=await fs.readFile(target);
   const contentType=target.endsWith('.html')?'text/html':
    target.endsWith('.js')?'text/javascript':
    target.endsWith('.json')?'application/json':
    target.endsWith('.css')?'text/css':'text/plain';
   res.writeHead(200,{'Content-Type':contentType});res.end(text);
  }catch{res.writeHead(404);res.end('Missing');}
 });
}
async function main(){
 const web=server();await new Promise((resolve,reject)=>{
  web.once('error',reject);web.listen(0,'127.0.0.1',resolve);
 });
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[],uploaded=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('private-events'))uploaded.push(r.url());});
  await page.route('**/data/support_card.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:supports()}));
  await page.route('**/data/skill_data.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:sample.skillText}));
  const base='http://127.0.0.1:'+web.address().port;
  await page.goto(base+'/poc/live.html?eventPreview=local',{waitUntil:'load'});
  await page.locator('#private-local-event-file').waitFor();
  assert.equal(await page.locator('main.app').count(),0);
  const corrupt=structuredClone(sample.bundle);
  corrupt.catalogSha256='0'.repeat(64);
  await page.locator('#private-local-event-file').setInputFiles({
   name:'invalid-private.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(corrupt))
  });
  await page.locator('#private-local-import-feedback').getByText(/読込を拒否しました/).waitFor();
  assert.equal(await page.locator('main.app').count(),0);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.cardById['30001'].events.length),0);
  await page.locator('#private-local-event-file').setInputFiles({
   name:'private-events.local.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(sample.bundle))
  });
  await page.locator('main.app').waitFor({timeout:20000});
  assert.equal(await page.evaluate(()=>window.UmaPreviewActive),true);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.previewEvents.records),2512);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.previewEvents.cards),563);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.cardById['30001'].events.length),5);
  assert.match(await page.locator('#candidate-preview-warning').innerText(),/未承認イベントの試用モード/);
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await page.locator('#picker-search').fill('サポカ0');
  await page.locator('button[data-action="set-card"][data-id="30001"]').click();
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  await page.locator('input[data-event-choice][data-event="synthetic-30001-event-0"][value="option1"]').click();
  const selected=await page.evaluate(()=>{
   const digest=window.UmaPrivateLocalEventDigest;
   const key='uma-support-lab-runtime-umasim-v1-event-preview-local-'+digest.slice(0,16);
   const saved=JSON.parse(localStorage.getItem(key));
   const slot=saved.decks.main[0].slots[0];
   return {found:!!saved,normal:localStorage.getItem('uma-support-lab-runtime-umasim-v1'),
    events:window.UmaCore.directRoutes(window.UmaDemoData.cardById['30001'],slot)
      .filter(x=>x.source==='event').map(x=>[x.skillId,x.level])};
  });
  assert.deepEqual(selected.events,[['hint:架空ヒント',2]]);
  assert.equal(selected.normal,null);
  await page.goto(base+'/poc/live.html',{waitUntil:'load'});
  await page.locator('main.app').waitFor();
  assert.equal(await page.evaluate(()=>window.UmaDemoData.cardById['30001'].events.length),0);
  assert.equal(await page.locator('#candidate-preview-warning').count(),0);
  assert.deepEqual(errors,[]);
  assert.deepEqual(uploaded,[]);
  console.log('PRIVATE_2512_BROWSER_LOCAL_IMPORT=PASS; files_uploaded=0; local_settings_isolated=true; published_events=0');
  await context.close();
 }finally{
  await browser?.close();await new Promise(r=>web.close(r));
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
