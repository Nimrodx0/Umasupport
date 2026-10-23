'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const PREFIX='/Umasupport/';
const CONTENT={'.html':'text/html; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
function server(){
 return http.createServer(async (req,res)=>{
  try{
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(req.method!=='GET'||!pathname.startsWith(PREFIX))throw Error('route');
   const local=decodeURIComponent(pathname.slice(PREFIX.length));
   const target=path.resolve(ROOT,local);
   if(!target.startsWith(ROOT+path.sep))throw Error('escape');
   const bytes=await fs.readFile(target);
   res.writeHead(200,{'Content-Type':CONTENT[path.extname(target)]||'application/octet-stream',
    'Cache-Control':'no-store'});res.end(bytes);
  }catch{
   res.writeHead(404);res.end('Not found');
  }
 });
}
async function main(){
 const srv=server();
 await new Promise((yes,no)=>{srv.once('error',no);srv.listen(0,'127.0.0.1',yes)});
 let browser;
 const base='http://127.0.0.1:'+srv.address().port;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url())});
  const r=await page.goto(base+PREFIX+'poc/phase2-eight-preview.html',{waitUntil:'load'});
  assert.equal(r.status(),200);
  await page.locator('html[data-ready="true"]').waitFor({timeout:20000});
  assert.equal(await page.locator('#card-tabs button').count(),4);
  assert.equal(await page.locator('article.event').count(),2);
  assert.equal(await page.locator('button[data-choice="option1"]').count(),2);
  assert.equal(await page.locator('button[data-choice="option2"]').count(),2);
  assert.match(await page.locator('.notice').innerText(),/正式承認は0件/);
  assert.match(await page.locator('h3').first().innerText(),/お花屋さんでの1ページ/);
  assert.equal(await page.locator('output[data-hint-count="0"]').count(),2);
  for(const [card,expectedTitle,selected,expectedHint] of [
   ['30318','曇りの日の1ページ','option2','良バ場○'],
   ['30319','孤狼','option2','一匹狼'],
   ['30320','ひとりが好きなクラスメイトさん','option1','ワンチャンス'],
   ['30321','追うべき背中','option2','イグニッション']
  ]){
   await page.locator('#card-tabs button[data-card-id="'+card+'"]').click();
   const block=page.locator('article.event[data-event="5"]');
   assert.match(await block.locator('h3').innerText(),new RegExp(expectedTitle));
   assert.equal(await block.locator('button.choice[data-choice]').count(),3);
   await block.locator('button[data-choice="'+selected+'"]').click();
   assert.match(await block.locator('output').innerText(),new RegExp(expectedHint));
   assert.equal(await block.locator('output').getAttribute('data-hint-count'),'1');
   const other=selected==='option1'?'option2':'option1';
   await block.locator('button[data-choice="'+other+'"]').click();
   assert.equal(await block.locator('output').getAttribute('data-hint-count'),'0');
   await block.locator('button[data-choice="'+selected+'"]').click();
   assert.equal(await block.locator('button[data-choice="'+selected+'"]').getAttribute('aria-pressed'),'true');
   await block.locator('button[data-choice=""]').click();
   assert.match(await block.locator('output').innerText(),/未選択/);
   assert.equal(await block.locator('output').getAttribute('data-hint-count'),'0');
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:1280,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('article.event').count(),2);

  const bad=await browser.newPage({viewport:{width:390,height:844}});
  await bad.route('**/preview/phase2-eight-events.v1.json',async route=>{
   const original=JSON.parse(await fs.readFile(path.join(ROOT,'poc/preview/phase2-eight-events.v1.json')));
   original.formallyApproved=true;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(original)});
  });
  await bad.goto(base+PREFIX+'poc/phase2-eight-preview.html');
  await bad.locator('html[data-ready="error"]').waitFor({timeout:20000});
  assert.match(await bad.locator('#bootstrap').innerText(),/データの状態が不正/);
  await bad.close();await page.close();
  console.log('Pages-path eight-event browser preview PASS: 4 cards, 8 events, 16 choices, all hint branches, 390px/1280px, tamper reject, no external requests.');
 }finally{await browser?.close();await new Promise(ok=>srv.close(ok))}
}
main().catch(e=>{console.error(e);process.exitCode=1});
