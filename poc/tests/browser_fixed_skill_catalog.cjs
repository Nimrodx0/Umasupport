'use strict';
// Fixed-source browser acceptance of the D-053 catalogue. The derived label
// bundle comes from the same CI run, never from the repository or public Pages.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const bridge=require('../src/skill_bridge.js');
const ROOT=path.resolve(__dirname,'../..');
const BASE='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/';
async function get(url){const r=await fetch(url);assert(r.ok,url);return Buffer.from(await r.arrayBuffer());}
async function main(){
 const file=process.argv[2];assert(file,'same-run compact label bundle required');
 const bundle=JSON.parse(await fs.readFile(file,'utf8'));const n=bundle.rows.length,general=bundle.rows.filter(r=>r.label.state==='general').length,targeted=n-general;
 assert.deepEqual([n,general,targeted],bundle.decisionId==='D-056'?[324,281,43]:[300,257,43]);
 const [supports,skills,historical]=await Promise.all([get(BASE+'support_card.txt'),get(BASE+'skill_data.txt'),get(bridge.PINNED_URL)]);
 const server=http.createServer(async(req,res)=>{try{
  const f=path.resolve(ROOT,'.'+new URL(req.url,'http://localhost').pathname);
  assert(f.startsWith(ROOT+path.sep));
  const buf=await fs.readFile(f);
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'text/plain'});res.end(buf);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const url='http://127.0.0.1:'+server.address().port+'/poc/live.html';
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/data/support_card.txt',r=>r.fulfill({status:200,body:supports}));
   await page.route('**/data/skill_data.txt',r=>r.fulfill({status:200,body:r.request().url()===bridge.PINNED_URL?historical:skills}));
   await page.goto(url);await page.locator('#app main.app').waitFor({timeout:40000});
   const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
   const saved=await snapshot(),comparison=await page.locator('#table-region').innerText();
   await page.locator('header [data-action="catalog-toggle"]').click();
   const count=page.locator('.catalog-count'),filter=page.locator('#catalog-suitability');
   assert.match(await count.innerText(),/^881 \/ 881 件$/);
   await filter.selectOption('undetermined');assert.match(await count.innerText(),/^881 \/ 881 件$/);
   await page.locator('.catalog-data summary').click();
   await page.locator('#catalog-label-file').setInputFiles(file);
   await page.waitForFunction(s=>document.querySelector('#catalog-label-status')?.textContent.includes(s),'検証済み '+n+'件 / 変更・未照合 0件',{timeout:40000});
   assert.equal(await count.innerText(),(881-n)+' / 881 件');
   await filter.selectOption('general');assert.equal(await count.innerText(),general+' / 881 件');
   await page.locator('#catalog-query').fill('アオハル点火');
   assert.equal(await count.innerText(),'5 / 881 件');
   assert.equal(await page.locator('.catalog-table tbody tr').count(),5);
   await page.locator('#catalog-query').fill('アオハル燃焼');
   assert.equal(await count.innerText(),'5 / 881 件');
   if(bundle.decisionId==='D-056'){
    await page.locator('#catalog-query').fill('全身全霊');
    assert.equal(await count.innerText(),'1 / 881 件');
    assert.match(await page.locator('.catalog-table tbody').innerText(),/汎用/);
    assert.match(await page.locator('.catalog-table tbody').innerText(),/十分なスタミナを前提/);
   }
   await page.locator('#catalog-query').fill('');
   await page.locator('#catalog-show-labels').uncheck();
   assert.equal(await page.locator('.catalog-table th').count(),2);assert.equal(await count.innerText(),general+' / 881 件');
   await page.locator('#catalog-show-labels').check();
   assert.equal(await page.locator('.catalog-table th').count(),3);
   await filter.selectOption('targeted');assert.match(await count.innerText(),/^43 \/ 881 件$/);
   await page.locator('[data-catalog-axis="ground_type"]').selectOption('2');
   assert.match(await count.innerText(),/^0 \/ 881 件$/);
   await page.locator('[data-catalog-axis="ground_type"]').selectOption('');
   assert.match(await count.innerText(),/^43 \/ 881 件$/);
   await page.locator('#catalog-label-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
   await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('前回の検証済みラベルを維持'));
   assert.match(await count.innerText(),/^43 \/ 881 件$/);
   await page.locator('[data-catalog-skill] button').first().click();
   await page.locator('.modal-head h2').waitFor();
   await page.locator('.modal-head [data-action="close"]').click();
   assert.equal(await page.locator('#table-region').innerText(),comparison);assert.equal(await snapshot(),saved);
   await page.reload();await page.locator('#app main.app').waitFor({timeout:40000});
   await page.locator('header [data-action="catalog-toggle"]').click();
   // Reload collapses the disclosure; open it before asserting visible status.
   await page.locator('.catalog-data summary').click();
   assert.equal(await page.locator('#catalog-label-status').innerText(),'適性データ未読込');
   assert.match(await count.innerText(),/^881 \/ 881 件$/);
   assert.equal(await snapshot(),saved);assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: fixed catalogue 881 skills, '+n+' local labels '+bundle.decisionId+', Aoharu and natural-spurt checks, scope, visibility, invalid import, deck/settings isolation and reload at 1280/390px');
 }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
