'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..'),PREFIX='/Umasupport/';
const TYPES={'.html':'text/html; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
function server(){
 return http.createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(req.method!=='GET'||!pathname.startsWith(PREFIX))throw Error('invalid route');
   const target=path.resolve(ROOT,decodeURIComponent(pathname.slice(PREFIX.length)));
   if(!target.startsWith(ROOT+path.sep))throw Error('invalid path');
   const data=await fs.readFile(target);
   res.writeHead(200,{'Content-Type':TYPES[path.extname(target)]||
    'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found')}
 });
}
async function main(){
 const svr=server();
 await new Promise((ok,reject)=>{svr.once('error',reject);svr.listen(0,'127.0.0.1',ok)});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const base='http://127.0.0.1:'+svr.address().port;
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url())});
  const result=await page.goto(base+PREFIX+'poc/phase2-chain-plan.html',{waitUntil:'load'});
  assert.equal(result.status(),200);
  await page.locator('html[data-ready="true"]').waitFor({timeout:20000});
  assert.match(await page.locator('.notice').innerText(),/明示的な打ち切りがない選択肢は次段階のフラグを立てます/);
  assert.match(await page.locator('#bootstrap').innerText(),/通常継続フラグ17件/);
  assert.equal(await page.locator('#card-tabs button').count(),5);
  assert.equal(await page.locator('article.event').count(),3);
  assert.equal(await page.locator('.arrived').count(),0,
   'manual arrived controls must not be needed in default planning view');
  let first=page.locator('article.event[data-event="1"]');
  let second=page.locator('article.event[data-event="2"]');
  let third=page.locator('article.event[data-event="3"]');
  assert.equal(await first.getAttribute('data-eligible'),'true');
  assert.equal(await second.getAttribute('data-eligible'),'false');
  assert.equal(await third.getAttribute('data-eligible'),'false');
  assert.equal(await second.locator('button[data-choice="option1"]').isDisabled(),true);
  await first.locator('button[data-choice="option2"]').click();
  assert.equal(await second.getAttribute('data-eligible'),'true');
  assert.equal(await third.getAttribute('data-eligible'),'false');
  await second.locator('button[data-choice="option1"]').click();
  assert.equal(await third.getAttribute('data-eligible'),'true');
  assert.match(await third.locator('output').innerText(),/勇迅円刃/);
  assert.equal(await third.locator('output').getAttribute('data-hint-count'),'1');
  assert.doesNotMatch(await third.locator('output').innerText(),/201323/);
  await first.locator('button[data-choice="option1"]').click();
  assert.equal(await second.getAttribute('data-eligible'),'true');
  assert.equal(await third.getAttribute('data-eligible'),'false');
  await first.locator('button[data-choice=""]').click();
  assert.equal(await second.getAttribute('data-eligible'),'false');
  assert.equal(await third.locator('output').getAttribute('data-hint-count'),'0');

  await page.locator('#card-tabs button[data-card-id="30319"]').click();
  first=page.locator('article.event[data-event="1"]');
  second=page.locator('article.event[data-event="2"]');
  third=page.locator('article.event[data-event="3"]');
  await first.locator('button[data-choice="option1"]').click();
  await second.locator('button[data-choice="option1"]').click();
  assert.match(await second.locator('output').innerText(),/憂いなし/);
  assert.match(await third.locator('output').innerText(),/アンストッパブル/);
  assert.match(await third.locator('output').innerText(),/ぶっちぎり！/);
  await second.locator('button[data-choice="option2"]').click();
  assert.equal(await second.locator('output').getAttribute('data-hint-count'),'0');
  assert.equal(await third.getAttribute('data-eligible'),'true');

  await page.locator('#card-tabs button[data-card-id="30321"]').click();
  first=page.locator('article.event[data-event="1"]');
  second=page.locator('article.event[data-event="2"]');
  third=page.locator('article.event[data-event="3"]');
  assert.equal(await second.getAttribute('data-eligible'),'false');
  await first.locator('button[data-choice="option1"]').click();
  assert.equal(await second.getAttribute('data-eligible'),'true');
  assert.equal(await third.getAttribute('data-eligible'),'true',
   'second no-choice stage is an eligible prospective stage');
  assert.match(await third.locator('output').innerText(),/月影円刃/);

  await page.locator('#card-tabs button[data-card-id="30221"]').click();
  first=page.locator('article.event[data-event="1"]');
  second=page.locator('article.event[data-event="2"]');
  third=page.locator('article.event[data-event="3"]');
  assert.equal(await first.getAttribute('data-eligible'),'true');
  assert.equal(await second.getAttribute('data-eligible'),'true');
  assert.equal(await third.getAttribute('data-eligible'),'true');
  assert.match(await third.locator('output').innerText(),/食いしん坊/);
  assert.match(await third.locator('output').innerText(),/獲得可能スキル/);
  assert.doesNotMatch(await third.locator('output').innerText(),/201351/);

  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:1280,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.close();

  for(const [attribute,value] of [
   ['publicationApproved',true],['enabledContinuationFlags',0],
   ['flagSetUnlessTerminated',false]
  ]){
   const tamper=await browser.newPage();
   await tamper.route('**/preview/phase2-chain-plan.v1.json',async route=>{
    const v=JSON.parse(await fs.readFile(path.join(ROOT,'poc/preview/phase2-chain-plan.v1.json')));
    v[attribute]=value;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)});
   });
   await tamper.goto(base+PREFIX+'poc/phase2-chain-plan.html');
   await tamper.locator('html[data-ready="error"]').waitFor({timeout:20000});
   assert.match(await tamper.locator('#bootstrap').innerText(),/検証フラグが不正/);
   await tamper.close();
  }
  console.log('Phase2 chain plan browser PASS: 5 cards, 17 enabled continuation flags, choice-based unlock, no reached toggles, 390/1280px, tamper rejection');
 }finally{await browser?.close();await new Promise(ok=>svr.close(ok))}
}
main().catch(err=>{console.error(err);process.exitCode=1});
