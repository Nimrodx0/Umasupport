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
   const url=new URL(req.url,'http://127.0.0.1').pathname;
   if(req.method!=='GET'||!url.startsWith(PREFIX))throw Error('invalid route');
   const target=path.resolve(ROOT,decodeURIComponent(url.slice(PREFIX.length)));
   if(!target.startsWith(ROOT+path.sep))throw Error('invalid path');
   const body=await fs.readFile(target);
   res.writeHead(200,{'Content-Type':TYPES[path.extname(target)]||'application/octet-stream',
    'Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
 });
}
async function main(){
 const srv=server();
 await new Promise((ok,fail)=>{srv.once('error',fail);srv.listen(0,'127.0.0.1',ok)});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const base='http://127.0.0.1:'+srv.address().port;
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[],requests=[];
  page.on('pageerror',x=>errors.push(x.message));
  page.on('request',x=>{if(!x.url().startsWith(base))requests.push(x.url())});
  const response=await page.goto(base+PREFIX+'poc/phase2-chain-preview.html',{waitUntil:'load'});
  assert.equal(response.status(),200);
  await page.locator('html[data-ready="true"]').waitFor({timeout:20000});
  assert.match(await page.locator('.notice').innerText(),/連続分岐は未確定/);
  assert.equal(await page.locator('#card-tabs button').count(),4);
  assert.equal(await page.locator('article.event').count(),3);
  assert.match(await page.locator('article.event[data-event="1"] h3').innerText(),/見上げた空は眩しくて/);
  assert.match(await page.locator('article.event[data-event="3"] h3').innerText(),/届けた幸せは、甘く花開いて/);

  assert.equal(await page.locator('article.event[data-observed="false"]').count(),3);
  assert.equal(await page.locator('.choice:disabled').count(),6);
  assert.equal(await page.locator('output[data-hint-count="0"]').count(),3);
  // Selecting a manually observed final stage NEVER fills in earlier stages.
  await page.locator('article.event[data-event="3"] .arrived').click();
  assert.equal(await page.locator('article.event[data-observed="true"]').count(),1);
  assert.equal(await page.locator('article.event[data-observed="false"]').count(),2);
  assert.equal(await page.locator('article.event[data-event="3"] output').getAttribute('data-hint-count'),'1');
  assert.match(await page.locator('article.event[data-event="3"] output').innerText(),/勇迅円刃/);
  assert.doesNotMatch(await page.locator('article.event[data-event="3"] output').innerText(),/201323/);
  await page.locator('article.event[data-event="3"] .arrived').click();
  assert.equal(await page.locator('output[data-hint-count="0"]').count(),3);
  for(const [card,stage3,stage2Hint] of [
   ['30319',2,'憂いなし'],['30320',2,'スリップストリーム'],['30321',1,null]
  ]){
   await page.locator('#card-tabs button[data-card-id="'+card+'"]').click();
   assert.equal(await page.locator('article.event').count(),3);
   assert.equal(await page.locator('article.event[data-observed="true"]').count(),0);
   await page.locator('article.event[data-event="3"] .arrived').click();
   assert.equal(await page.locator('article.event[data-event="3"] output')
    .getAttribute('data-hint-count'),String(stage3));
   const sourceSkillNames={
    '30319':['アンストッパブル','ぶっちぎり！'],
    '30320':['解き放つ情念','一往直前'],
    '30321':['月影円刃']
   };
   for(const name of sourceSkillNames[card]){
    const actual=await page.locator('article.event[data-event="3"] output').innerText();
    assert.ok(actual.includes(name),'Expected reviewed skill name '+name+' in '+actual);
   }

   if(stage2Hint){
    const second=page.locator('article.event[data-event="2"]');
    assert.equal(await second.locator('button[data-choice="option1"]').isDisabled(),true);
    await second.locator('.arrived').click();
    assert.equal(await second.locator('output').getAttribute('data-hint-count'),'0');
    await second.locator('button[data-choice="option1"]').click();
    assert.equal(await second.locator('output').getAttribute('data-hint-count'),'1');
    assert.match(await second.locator('output').innerText(),new RegExp(stage2Hint));
    await second.locator('button[data-choice="option2"]').click();
    assert.equal(await second.locator('output').getAttribute('data-hint-count'),'0');
    await second.locator('button[data-choice="option1"]').click();
    await second.locator('.arrived').click();
    assert.equal(await second.locator('output').getAttribute('data-hint-count'),'0');
    assert.equal(await second.locator('button[data-choice="option1"]').isDisabled(),true);
    assert.equal(await page.locator('article.event[data-event="3"] output')
     .getAttribute('data-hint-count'),String(stage3));
   }else{
    const second=page.locator('article.event[data-event="2"]');
    assert.equal(await second.locator('button[data-choice="option1"]').count(),0);
    await second.locator('.arrived').click();
    assert.equal(await second.locator('output').getAttribute('data-hint-count'),'0');
    assert.equal(await page.locator('article.event[data-event="3"] output')
     .getAttribute('data-hint-count'),String(stage3));
   }
  }
  // User-visible text must not expose internal skill IDs.
  assert.doesNotMatch(await page.locator('main').innerText(),/スキルID\\s*\\d+/);
  assert.deepEqual(errors,[]);
  assert.deepEqual(requests,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:1280,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('article.event').count(),3);
  await page.close();
  // Even a forged release or a forged verified transition prevents rendering.
  for(const [field,value] of [['formallyApproved',true],['inferredChainTransitions',1]]){
   const tamper=await browser.newPage();
   await tamper.route('**/preview/phase2-chain-stages.v1.json',async route=>{
    const doc=JSON.parse(await fs.readFile(path.join(ROOT,'poc/preview/phase2-chain-stages.v1.json')));
    doc[field]=value;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(doc)});
   });
   await tamper.goto(base+PREFIX+'poc/phase2-chain-preview.html');
   await tamper.locator('html[data-ready="error"]').waitFor({timeout:20000});
   assert.match(await tamper.locator('#bootstrap').innerText(),/未承認・未確定条件が不正/);
   await tamper.close();
  }
  console.log('Pages-path chain manual stage browser PASS: four cards x three independently asserted stages, 19 alternatives, 8 hints, unknown transitions, narrow/wide view, forged release rejection.');
 }finally{
  await browser?.close();
  await new Promise(ok=>srv.close(ok));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
