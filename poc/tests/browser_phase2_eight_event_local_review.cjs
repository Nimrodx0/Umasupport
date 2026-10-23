'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {makeServer}=require('../tools/preview_phase2_standalone_local.cjs');
async function main(){
 const srv=makeServer();
 await new Promise((ok,bad)=>{
  srv.once('error',bad);srv.listen(0,'127.0.0.1',ok);
 });
 let browser;
 try{
  const base='http://127.0.0.1:'+srv.address().port;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/',{waitUntil:'load'});
  await page.locator('html[data-ready="true"]').waitFor({timeout:20000});
  assert.equal(await page.locator('section.card').count(),4);
  assert.equal(await page.locator('article.event').count(),8);
  assert.equal(await page.locator('button[data-choice="option1"]').count(),8);
  assert.equal(await page.locator('button[data-choice="option2"]').count(),8);
  assert.match(await page.locator('.notice').innerText(),/未確認/);
  for(const [card,ordinal,title] of [
   ['30318',4,'お花屋さんでの1ページ'],['30318',5,'曇りの日の1ページ'],
   ['30319',4,'生徒会役員！'],['30319',5,'孤狼'],
   ['30320',4,'窓側が好きなお客さん'],['30320',5,'ひとりが好きなクラスメイトさん'],
   ['30321',4,'流すべきこの汗'],['30321',5,'追うべき背中']
  ]){
   const item=page.locator('section.card[data-card-id="'+card+'"] article.event[data-event="'+ordinal+'"]');
   assert.ok((await item.locator('h3').innerText()).includes(title));
  }
  assert.match(await page.locator('#bootstrap').innerText(),/承認済み0/);
  assert.equal((await page.locator('article.event .route-result').allTextContents())
   .filter(t=>t.includes('未選択')).length,8);
  for(const [card,choice,id] of [
   ['30318','option2','良バ場'],['30319','option2','一匹狼'],
   ['30320','option1','ワンチャンス'],['30321','option2','イグニッション']
  ]){
   const area=page.locator('section.card[data-card-id="'+card+'"] article.event[data-event="5"]');
   await area.locator('button[data-choice="'+choice+'"]').click();
   assert.match(await area.locator('output').innerText(),new RegExp(id));
   assert.equal(await area.locator('output').getAttribute('data-hint-count'),'1');
   const opposite=choice==='option2'?'option1':'option2';
   await area.locator('button[data-choice="'+opposite+'"]').click();
   assert.equal(await area.locator('output').getAttribute('data-hint-count'),'0');
   await area.locator('button[data-choice=""]').click();
   assert.match(await area.locator('output').innerText(),/未選択/);
  }
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.close();
  console.log('Local-only 8-event review: Chromium 390px, 4 cards, 8 events, 16 choices, 4 hint branches PASSED. No publish.');
 }finally{
  await browser?.close();
  await new Promise(ok=>srv.close(ok));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
