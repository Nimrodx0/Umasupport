'use strict';
// Real deployed app, same-run local D-052 bundle, moving upstream dictionary.
// Independently compare raw fixed Invoke structure with the actual model profiles.
// Never publish raw source bytes, local label files or per-skill audit results.
const a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const [ROOT,EXPECTED,FILE]=process.argv.slice(2);
const cat=require('../src/skill_catalog.js');
const BASE='https://nimrodx0.github.io/Umasupport/';
const FIXED='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/skill_data.txt';
const LIVE='https://raw.githubusercontent.com/mee1080/umasim/main/data/skill_data.txt';
const SUPPORT='https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const predicateMatrix=m=>(m||[]).map(and=>and.map(p=>[p.type,p.operator,p.value]));
function structure(invokes,raw){
 return JSON.stringify(invokes.map((v,i)=>[Number.isSafeInteger(v.index)?v.index:i,
  predicateMatrix(v.preConditions),predicateMatrix(v.conditions),
  raw?[...new Set((v.effects||[]).map(e=>e.type))]:v.effectTypes]));
}
function expectedGroups(bundle,records,skills){
 const groups={general:[],targeted:[],undetermined:[]},reasons={missingApp:0,missingProfile:0,changedSourceId:0,changedStructure:0};
 const live=new Map(skills.map(s=>[s.id,s.activationProfile])),accepted=new Map();
 for(const row of bundle.rows){
  const p=live.get(row.appSkillId),source=records.get(row.sourceNumericId);
  a(source&&Array.isArray(source.invokes)&&source.invokes.length,'fixed source identity');
  if(!live.has(row.appSkillId))reasons.missingApp++;
  else if(p?.status!=='source-structure')reasons.missingProfile++;
  else if(p.sourceNumericId!==row.sourceNumericId)reasons.changedSourceId++;
  else if(structure(source.invokes,true)!==structure(p.invokes,false))reasons.changedStructure++;
  else accepted.set(row.appSkillId,row.label.state);
 }
 for(const s of skills)groups[accepted.get(s.id)||'undetermined'].push(s.id);
 return {groups,reasons,accepted:accepted.size};
}
async function collect(page,state,total){
 await page.locator('#catalog-suitability').selectOption(state);
 const count=page.locator('.catalog-count'),match=/^(\d+) \/ (\d+) 件$/.exec(await count.innerText());
 a(match);a.equal(Number(match[2]),total);const ids=[];
 for(let i=0;;i++){
  ids.push(...await page.locator('[data-catalog-skill]').evaluateAll(rs=>rs.map(r=>r.dataset.catalogSkill)));
  const next=page.locator('[data-action="catalog-next"]');
  if(await next.isDisabled())break;
  a(i<Math.ceil(total/60),'pagination loop');await next.click();
 }
 a.equal(ids.length,Number(match[1]));a.equal(new Set(ids).size,ids.length);
 return ids.sort();
}
async function main(){
 a(ROOT&&/^[a-f0-9]{40}$/.test(EXPECTED||'')&&FILE,'checkout, commit and local bundle required');
 const bytes=await fs.readFile(FILE),bundle=JSON.parse(bytes);
 const approved=cat.APPROVED_BUNDLES[sha(bytes)];a(approved,'approved bundle digest');a.equal(bundle.decisionId,approved.decisionId);a.equal(bundle.rows.length,approved.count);a.equal(bundle.policySHA256,approved.policySHA256);const n=approved.count;
 const response=await fetch(FIXED);a(response.ok);const fixed=Buffer.from(await response.arrayBuffer());a.equal(sha(fixed),bundle.sourceRegistrySHA256);
 const records=new Map(JSON.parse(fixed.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 const assets=['poc/live.html','poc/src/core.js','poc/src/live_app.js','poc/src/skill_catalog.js','poc/src/skill_suitability.js','poc/src/skill_condition_profiles.js','poc/src/skill_bridge.js','poc/src/style.css'];
 for(const asset of assets){
  const r=await fetch(BASE+asset+'?verify='+EXPECTED,{cache:'no-store'});a(r.ok,asset+' HTTP '+r.status);
  a.equal(sha(Buffer.from(await r.arrayBuffer())),sha(await fs.readFile(path.join(ROOT,asset))),'deployed asset mismatch: '+asset);
 }
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const dictionary=page.waitForResponse(r=>r.url()===LIVE&&r.ok(),{timeout:60000});
   const supports=page.waitForResponse(r=>r.url()===SUPPORT&&r.ok(),{timeout:60000});
   await page.goto(BASE+'poc/live.html?verify='+EXPECTED,{waitUntil:'load',timeout:60000});
   await page.locator('#app main.app').waitFor({timeout:60000});
   const [liveBytes,supportBytes]=await Promise.all([dictionary.then(r=>r.body()),supports.then(r=>r.body())]);
   const model=await page.evaluate(()=>({skills:UmaDemoData.skills.map(s=>({id:s.id,activationProfile:s.activationProfile})),cards:UmaDemoData.cards.length,sources:UmaDemoData.meta.runtimeSources}));
   a.equal(model.sources.skills.mode,'online');a.equal(model.sources.cards.mode,'online');a.equal(model.sources.events.mode,'reviewed');
   const total=model.skills.length,{groups,reasons,accepted}=expectedGroups(bundle,records,model.skills);
   a.equal(accepted+Object.values(reasons).reduce((a,b)=>a+b,0),n);
   a(accepted>0,'no compatible labels: investigate rather than declare usable');
   const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
   const saved=await snapshot(),comparison=await page.locator('#table-region').innerText();
   await page.locator('header [data-action="catalog-toggle"]').click();
   await page.locator('.catalog-data summary').click();
   await page.locator('#catalog-label-file').setInputFiles(FILE);
   const status='検証済み '+accepted+'件 / 変更・未照合 '+(n-accepted)+'件';
   await page.waitForFunction(s=>document.querySelector('#catalog-label-status')?.textContent===s,status,{timeout:40000});
   for(const state of ['general','targeted','undetermined'])a.deepEqual(await collect(page,state,total),groups[state].sort(),'complete ID partition '+state);
   if(bundle.decisionId==='D-056'){
    await page.locator('#catalog-suitability').selectOption('general');
    await page.locator('#catalog-query').fill('全身全霊');
    const names=await page.locator('.catalog-table tbody tr').allTextContents();
    for(const name of names){a.match(name,/汎用/);a(!name.includes('十分なスタミナを前提'));}
    await page.locator('#catalog-query').fill('');
   }
   await page.locator('#catalog-suitability').selectOption('targeted');
   await page.locator('[data-catalog-axis="ground_type"]').selectOption('2');
   a.equal(await page.locator('.catalog-count').innerText(),'0 / '+total+' 件');
   await page.locator('[data-catalog-axis="ground_type"]').selectOption('');
   await page.locator('#catalog-label-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
   await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('前回の検証済みラベルを維持'));
   a.deepEqual(await collect(page,'targeted',total),groups.targeted.sort());
   a.equal(await snapshot(),saved);a.equal(await page.locator('#table-region').innerText(),comparison);
   await page.reload();await page.locator('#app main.app').waitFor({timeout:60000});
   await page.locator('header [data-action="catalog-toggle"]').click();await page.locator('.catalog-data summary').click();
   a.equal(await page.locator('#catalog-label-status').innerText(),'適性データ未読込');
   const reloaded=await page.evaluate(()=>UmaDemoData.skills.length);
   await page.locator('#catalog-suitability').selectOption('undetermined');
   a.equal(await page.locator('.catalog-count').innerText(),reloaded+' / '+reloaded+' 件');
   a.equal(await snapshot(),saved);a.deepEqual(errors,[]);
   console.log('PAGES_'+bundle.decisionId.replace('-','')+'_LIVE',JSON.stringify({expectedCommit:EXPECTED,viewport:width,browser:browser.version(),cards:model.cards,skills:total,liveSkillSHA256:sha(liveBytes),liveSupportSHA256:sha(supportBytes),accepted,skipped:n-accepted,reasons,general:groups.general.length,targeted:groups.targeted.length,undetermined:groups.undetermined.length}));
   await page.close();
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
