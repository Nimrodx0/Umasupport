'use strict';
const a=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright'),ROOT=path.resolve(__dirname,'../..');
const bridge=require('../src/skill_bridge.js');
const base='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/';
async function main(){
 const file=process.argv[2];a(file);const bundle=JSON.parse(await fs.readFile(file,'utf8'));
 const get=async url=>{const res=await fetch(url);a(res.ok);return res.text();};
 const [supports,skills,historical]=await Promise.all([get(base+'support_card.txt'),get(base+'skill_data.txt'),get(bridge.PINNED_URL)]);
 const server=http.createServer(async(req,res)=>{try{const f=path.resolve(ROOT,'.'+new URL(req.url,'http://localhost').pathname);a(f.startsWith(ROOT+path.sep));const buf=await fs.readFile(f);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'text/plain'});res.end(buf);}catch{res.writeHead(404);res.end();}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port+'/poc/live.html';
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/data/support_card.txt',r=>r.fulfill({status:200,body:supports}));
   await page.route('**/data/skill_data.txt',r=>r.fulfill({status:200,body:r.request().url()===bridge.PINNED_URL?historical:skills}));
   await page.goto(url);await page.locator('#app main.app').waitFor({timeout:40000});
   a.equal(await page.locator('#fit-file').count(),0);
   await page.goto(url+'?suitability=local');await page.locator('#fit-file').waitFor({timeout:40000});
   await page.locator('#fit-file').setInputFiles(file);
   await page.locator('#fit-show').waitFor({timeout:20000});
   a.equal(await page.locator('#fit-show').isChecked(),false);
   const target=await page.evaluate(rows=>{
    const general=new Set(rows.filter(r=>r.label.state==='general').map(r=>r.appSkillId));
    for(const c of UmaDemoData.cards)for(const id of c.hintsByStage['4'])if(general.has(id))return {card:c.id,skill:id};
   },bundle.rows);a(target);
   await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
   await page.locator('#picker-search').fill(target.card);
   await page.locator('.picker-card[data-id="'+target.card+'"]').click();
   const row=page.locator('tr[data-skill="'+target.skill+'"]');await row.waitFor();
   a.equal(await row.locator('.fit-label').count(),0);
   const scope=await row.locator('.fit-scope').innerText(),n=await page.locator('tr[data-skill]').count();a.match(scope,/適用範囲：/);
   await page.locator('#fit-show').check();
   a.equal(await row.locator('.fit-label').innerText(),'汎用');
   a.equal(await row.locator('.fit-scope').innerText(),scope);a.equal(await page.locator('tr[data-skill]').count(),n);
   await page.locator('#fit-show').uncheck();a.equal(await row.locator('.fit-label').count(),0);
   await page.locator('#fit-mode').selectOption('confirmed');
   await row.waitFor();await page.locator('#fit-mode').selectOption('all');
   a.equal(await page.locator('tr[data-skill]').count(),n);
   await page.locator('#fit-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
   await page.waitForFunction(()=>document.querySelector('#fit-message')?.textContent.includes('拒否'));
   a.equal(await page.locator('.fit-label').count(),0);a.equal(await page.locator('tr[data-skill]').count(),n);
   await page.goto(url);await page.locator('#app main.app').waitFor({timeout:40000});
   a.equal(await page.locator('#fit-file').count(),0);a.equal(await page.locator('tr[data-skill]').count(),0);
   a.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: local suitability import, visibility, filters, invalid file and normal settings isolation at 1280/390px');
 }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
