'use strict';
// Public Pages smoke: no interception, no derived labels, fresh browser profiles.
const a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const ROOT=process.argv[2],EXPECTED=process.argv[3];
const BASE='https://nimrodx0.github.io/Umasupport/';
const cat=require('../src/skill_catalog.js');
function productGroup(skill,states){
 const m=cat.masks(skill.activationProfile);if(!m)return 'scopeUnknown';
 const styles=[0,1,2,3].filter(i=>m.slice(i*8,i*8+8).some(Boolean));
 if(!styles.length)return 'outside';
 if(styles.length===1)return 'explicitOnly';
 return states.get(skill.id)||'undetermined';
}

const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function main(){
 a(ROOT&&/^[a-f0-9]{40}$/.test(EXPECTED||''),'expected checkout and commit required');
 const modern=(await fs.readFile(path.join(ROOT,'poc/src/live_app.js'),'utf8')).includes("'apt-positive'");
 const assets=['poc/live.html','poc/src/core.js','poc/src/live_app.js','poc/src/skill_catalog.js','poc/src/skill_suitability.js','poc/src/style.css'];
 // Do not claim the deployment is current merely because HTML responds.
 for(const asset of assets){
  const r=await fetch(BASE+asset+'?verify='+EXPECTED,{cache:'no-store'});a(r.ok,asset+' HTTP '+r.status);
  const actual=hash(Buffer.from(await r.arrayBuffer())),expected=hash(await fs.readFile(path.join(ROOT,asset)));
  a.equal(actual,expected,'Published asset differs from expected checkout: '+asset);
  console.log('PAGES_ASSET',asset,actual);
 }
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/data/skill-suitability-d059.v1.txt',r=>r.abort());
   await page.goto(BASE+'poc/live.html?verify='+EXPECTED,{waitUntil:'load',timeout:60000});
   await page.locator('#app main.app').waitFor({timeout:60000});
   const data=await page.evaluate(()=>({skills:UmaDemoData.skills.length,cards:UmaDemoData.cards.length,sources:UmaDemoData.meta.runtimeSources}));
   a(data.skills>0&&data.cards>0,'live model is nonempty');a.equal(data.sources.events.mode,'reviewed');a.notEqual(data.sources.skills.mode,'unavailable');
   const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
   const saved=await snapshot(),comparison=await page.locator('#table-region').innerText();
   await page.locator('header [data-action="catalog-toggle"]').click();
   const count=page.locator('.catalog-count');
   a.equal(await count.innerText(),data.skills+' / '+data.skills+' 件');
   await page.locator('.catalog-data summary').click();
   await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('適性データ未読込'));
   await page.locator('#catalog-suitability').selectOption('undetermined');
   const model=await page.evaluate(()=>UmaDemoData.skills.map(s=>({id:s.id,activationProfile:s.activationProfile})));a.equal(await count.innerText(),(modern?model.filter(s=>productGroup(s,new Map())==='undetermined').length:data.skills)+' / '+data.skills+' 件');
   await page.locator('#catalog-show-labels').uncheck();a.equal(await page.locator('.catalog-table th').count(),2);
   await page.locator('#catalog-show-labels').check();a.equal(await page.locator('.catalog-table th').count(),3);
   const first=page.locator('[data-catalog-skill]').first(),id=await first.getAttribute('data-catalog-skill');a(id);
   await page.locator('#catalog-query').fill(id);
   const row=page.locator('[data-catalog-skill]').filter({has:page.locator('button[data-id="'+id+'"]')});
   await row.locator('button').click();
   await page.locator('.modal-head h2').waitFor();await page.locator('.modal-head [data-action="close"]').click();
   a.equal(await snapshot(),saved);a.equal(await page.locator('#table-region').innerText(),comparison);a.deepEqual(errors,[]);
   console.log('PAGES_BROWSER',JSON.stringify({expectedCommit:EXPECTED,viewport:width,browser:browser.version(),cards:data.cards,skills:data.skills,eventsMode:data.sources.events.mode,skillsMode:data.sources.skills.mode}));
   await page.close();
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
