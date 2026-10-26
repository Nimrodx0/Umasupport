'use strict';
// Actual Chromium/GitHub Pages-style browser check with publisher-pinned
// runtime card source. Original TSV stays in the runner temp directory.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..'),PREFIX='/Umasupport/';
const CONTENT_TYPES={'.html':'text/html; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8'};
function createServer(){
 return http.createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://127.0.0.1').pathname;
   if(req.method!=='GET'||!pathname.startsWith(PREFIX))throw Error('wrong route');
   const local=path.resolve(ROOT,decodeURIComponent(pathname.slice(PREFIX.length)));
   if(!local.startsWith(ROOT+path.sep))throw Error('outside root');
   const body=await fs.readFile(local);
   res.writeHead(200,{'Content-Type':CONTENT_TYPES[path.extname(local)]||'text/plain',
    'Cache-Control':'no-store'});
   res.end(body);
  }catch(e){res.writeHead(404);res.end('missing');}
 });
}
function fakeSkillData(){
 return JSON.stringify(Array.from({length:140},(_,i)=>({
  id:String(880000+i),name:'検証用スキル'+i,
  rarity:'normal',group:88000+i
 })));
}
async function run(sourcePath){
 if(!sourcePath)throw Error('usage: browser_current_umasim_566.cjs <pinned-new.txt>');
 const cards=await fs.readFile(sourcePath,'utf8');
 const server=createServer();let browser;
 await new Promise((resolve,reject)=>{
  server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
 });
 try{
  const url='http://127.0.0.1:'+server.address().port+PREFIX+'poc/live.html';
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/data/support_card.txt',route=>
   route.fulfill({status:200,contentType:'text/plain',body:cards}));
  await page.route('**/data/skill_data.txt',route=>
   route.fulfill({status:200,contentType:'application/json',body:fakeSkillData()}));
  const response=await page.goto(url,{waitUntil:'load',timeout:25000});
  assert.equal(response.status(),200);
  await page.locator('#app main.app').waitFor({timeout:25000});
  assert.equal(await page.locator('#bootstrap-status').getAttribute('data-mode'),'online');
  assert.match(await page.locator('#bootstrap-status').innerText(),/カード 566枚/);
  const snapshot=await page.evaluate(()=>({
   count:window.UmaDemoData.cards.length,
   names:['10149','30322','30323'].map(id=>window.UmaDemoData.cardById[id]?.name),
   events:['10149','30322','30323'].map(id=>window.UmaDemoData.cardById[id]?.events?.length),
   reviewed:window.UmaDemoData.meta.eventStatus
  }));
  assert.equal(snapshot.count,566);
  assert.deepEqual(snapshot.names,['[巫女]吾妻',
   '[Time of Departure]マヤノトップガン','[いとどめでたき、まつりかな]吾妻']);
  assert.deepEqual(snapshot.events,[0,0,0]);
  await page.locator('button[data-action="source-health"]').click();
  assert.match(await page.locator('#source-status-cards').innerText(),/566 \/ 566枚/);
  await page.locator('button[data-action="close"]').click();
  for(const [deck,index,id] of [
   ['main',3,'30322'],['main',4,'30323'],['inherit',3,'10149']
  ]){
   await page.locator('button[data-action="pick"][data-deck="'+deck+'"][data-index="'+index+'"]').click();
   await page.locator('#picker-search').fill(id);
   await page.locator('button[data-action="set-card"][data-id="'+id+'"]').click();
   const current=await page.evaluate(({deck,index})=>{
    const s=JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1'));
    return s.decks[deck][0].slots[index].cardId;
   },{deck,index});
   assert.equal(current,id);
  }
  assert.deepEqual(errors,[],'no JS exceptions during 566-card interactions');
  process.stdout.write('CHROMIUM_20261026_ROSTER_566='+JSON.stringify({
   sourceCards:566,addedIds:['10149','30322','30323'],
   deckInsertions:3,publicNewEventRecords:0,syntheticSkillRegistry:true,
   browser:'chromium',hostedSubpath:'/Umasupport/',sourceTsvBundled:false
  })+'\n');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
if(require.main===module)run(process.argv[2]).catch(e=>{process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1;});
module.exports={run};
