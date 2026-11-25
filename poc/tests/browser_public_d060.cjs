'use strict';
// D060 public product acceptance: actual deployed code and compact data,
// actual moving upstream dictionary, no interception in the success path.
// Independently classify by source ID and raw fixed/live profile structure.
const a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const [ROOT,EXPECTED]=process.argv.slice(2);
const BASE='https://nimrodx0.github.io/Umasupport/';
const FIXED='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/skill_data.txt';
const LIVE='https://raw.githubusercontent.com/mee1080/umasim/main/data/skill_data.txt';
const SUPPORT='https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt';
const DATA='poc/data/skill-suitability-d059.v1.txt';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const matrix=m=>(m||[]).map(and=>and.map(p=>[p.type,p.operator,p.value]));
const structure=(invokes,raw)=>JSON.stringify(invokes.map((v,i)=>[Number.isSafeInteger(v.index)?v.index:i,matrix(v.preConditions),matrix(v.conditions),raw?[...new Set((v.effects||[]).map(e=>e.type))]:v.effectTypes]));
function parsePublic(text){
 const m=new Map();
 for(const line of text.trim().split('\n')){
  const fields=line.split(' '),kind=fields[0],ids=fields.at(-1).split(',');
  a(['g','r','d'].includes(kind));
  for(const id of ids){a(/^\d+$/.test(id)&&!m.has(id));m.set(id,kind==='g'?'general':'targeted');}
 }
 a.equal(m.size,404);a.equal([...m.values()].filter(x=>x==='general').length,304);return m;
}
function expectedGroups(labels,records,skills){
 const bySource=new Map(),accepted=new Map(),reasons={missingOrAmbiguous:0,changedStructure:0};
 for(const s of skills){const id=s.activationProfile?.sourceNumericId;if(!id)continue;if(!bySource.has(id))bySource.set(id,[]);bySource.get(id).push(s);}
 for(const [id,state] of labels){
  const source=records.get(id),matches=bySource.get(id)||[];a(source?.invokes?.length);
  if(matches.length!==1){reasons.missingOrAmbiguous++;continue;}
  const s=matches[0],p=s.activationProfile;
  if(p.status!=='source-structure'||structure(p.invokes,false)!==structure(source.invokes,true)){reasons.changedStructure++;continue;}
  accepted.set(s.id,state);
 }
 const groups={general:[],targeted:[],undetermined:[]};
 for(const s of skills)groups[accepted.get(s.id)||'undetermined'].push(s.id);
 return {groups,reasons,accepted:accepted.size};
}
async function collect(page,state,total){
 await page.locator('#catalog-suitability').selectOption(state);
 const match=/^(\d+) \/ (\d+) 件$/.exec(await page.locator('.catalog-count').innerText());a(match);a.equal(Number(match[2]),total);
 const ids=[];for(let i=0;;i++){ids.push(...await page.locator('[data-catalog-skill]').evaluateAll(rs=>rs.map(r=>r.dataset.catalogSkill)));const next=page.locator('[data-action="catalog-next"]');if(await next.isDisabled())break;a(i<Math.ceil(total/60));await next.click();}
 a.equal(ids.length,Number(match[1]));a.equal(new Set(ids).size,ids.length);return ids.sort();
}
async function deployedAssets(){
 const assets=['poc/live.html','poc/src/core.js','poc/src/live_app.js','poc/src/skill_catalog.js','poc/src/skill_suitability.js','poc/src/card_suitability_view.js','poc/src/skill_condition_profiles.js','poc/src/skill_bridge.js','poc/src/style.css',DATA];
 const hashes=await Promise.all(assets.map(async f=>sha(await fs.readFile(path.join(ROOT,f)))));
 // GitHub Pages is built separately from main. Wait for the exact snapshot,
 // not simply HTTP 200. Bounded attempts, no fabricated deployment success.
 let mismatch=[];
 for(let attempt=0;attempt<30;attempt++){
  mismatch=(await Promise.all(assets.map(async(f,i)=>{try{const r=await fetch(BASE+f+'?verify='+EXPECTED+'&attempt='+attempt,{cache:'no-store',signal:AbortSignal.timeout(15000)});return r.ok&&sha(Buffer.from(await r.arrayBuffer()))===hashes[i]?null:f;}catch{return f;}}))).filter(Boolean);
  if(!mismatch.length)return;
  console.log('PAGES_AWAIT',attempt,mismatch.join(','));
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 throw Error('Expected deployment not observed: '+mismatch.join(','));
}
async function main(){
 a(ROOT&&/^[a-f0-9]{40}$/.test(EXPECTED||''));
 const text=await fs.readFile(path.join(ROOT,DATA),'utf8'),labels=parsePublic(text);
 const response=await fetch(FIXED);a(response.ok);const raw=Buffer.from(await response.arrayBuffer());a.equal(sha(raw),'4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5');
 const records=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 await deployedAssets();
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const getLive=page.waitForResponse(r=>r.url()===LIVE&&r.ok(),{timeout:60000}),getSupport=page.waitForResponse(r=>r.url()===SUPPORT&&r.ok(),{timeout:60000}),getPublic=page.waitForResponse(r=>r.url().split('?')[0]===BASE+DATA&&r.ok(),{timeout:60000});
   await page.goto(BASE+'poc/live.html?verify='+EXPECTED,{waitUntil:'load',timeout:60000});await page.locator('#app main.app').waitFor({timeout:60000});
   const [live,support,pub]=await Promise.all([getLive.then(r=>r.body()),getSupport.then(r=>r.body()),getPublic.then(r=>r.body())]);a.equal(sha(pub),sha(text));
   const model=await page.evaluate(()=>({skills:UmaDemoData.skills.map(s=>({id:s.id,activationProfile:s.activationProfile})),cards:UmaDemoData.cards.length,sources:UmaDemoData.meta.runtimeSources}));a.equal(model.sources.skills.mode,'online');a.equal(model.sources.cards.mode,'online');a.equal(model.sources.events.mode,'reviewed');
   const total=model.skills.length,{groups,reasons,accepted}=expectedGroups(labels,records,model.skills);a(accepted>0);a.equal(accepted+reasons.missingOrAmbiguous+reasons.changedStructure,404);
   const status='検証済み '+accepted+'件 / 変更・未照合 '+(404-accepted)+'件';
   const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
   const saved=await snapshot(),comparison=await page.locator('#table-region').innerText();
   await page.locator('header [data-action="catalog-toggle"]').click();await page.waitForFunction(s=>document.querySelector('#catalog-label-status')?.textContent===s,status,{timeout:40000});
   for(const state of ['general','targeted','undetermined'])a.deepEqual(await collect(page,state,total),groups[state].sort());
   await page.locator('[data-action="pick"]').first().click();await page.locator('[data-picker-fit-axis="running_style"]').selectOption('2');
   const expected=await page.evaluate(async()=>{const d=UmaDemoData,labels=(await UmaSkillCatalog.loadPublicLabels(d)).labels;return Object.fromEntries(d.cards.map(c=>[c.id,UmaCardSuitabilityView.browseCard(c,{stage:4},d,labels,{running_style:2}).potential]));});
   const shown=await page.locator('.picker-card').evaluateAll(rs=>rs.map(r=>({id:r.dataset.id,tier:r.querySelector('[data-picker-fit-tier]')?.textContent})));a(shown.length);
   for(const r of shown){const v=expected[r.id],t=v.matchingByTier;a.equal(r.tier,'一致候補：金 '+t.gold+' · 白 '+t.white+' · その他 '+t.other);a.equal(t.gold+t.white+t.other,v.matching);}
   await page.locator('#picker-sort').selectOption('fit-count-desc');const ids=await page.locator('.picker-card').evaluateAll(rs=>rs.map(r=>r.dataset.id));for(let i=1;i<ids.length;i++)a(expected[ids[i-1]].matching>=expected[ids[i]].matching);
   await page.locator('.modal-head [data-action="close"]').click();a.equal(await snapshot(),saved);a.equal(await page.locator('#table-region').innerText(),comparison);
   await page.reload();await page.locator('#app main.app').waitFor({timeout:60000});await page.locator('header [data-action="catalog-toggle"]').click();await page.waitForFunction(s=>document.querySelector('#catalog-label-status')?.textContent===s,status,{timeout:40000});a.equal(await snapshot(),saved);
   await page.route('**/data/skill-suitability-d059.v1.txt',r=>r.abort());await page.reload();await page.locator('#app main.app').waitFor({timeout:60000});await page.locator('header [data-action="catalog-toggle"]').click();await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('自動取得失敗'),{timeout:40000});await page.locator('#catalog-suitability').selectOption('undetermined');const now=await page.evaluate(()=>UmaDemoData.skills.length);a.equal(await page.locator('.catalog-count').innerText(),now+' / '+now+' 件');a.equal(await snapshot(),saved);a.deepEqual(errors,[]);
   console.log('PAGES_D060_PUBLIC='+JSON.stringify({expectedCommit:EXPECTED,viewport:width,browser:browser.version(),cards:model.cards,skills:total,liveSkillSHA256:sha(live),liveSupportSHA256:sha(support),publicSHA256:sha(pub),accepted,skipped:404-accepted,reasons,general:groups.general.length,targeted:groups.targeted.length,undetermined:groups.undetermined.length}));
   await page.close();
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
