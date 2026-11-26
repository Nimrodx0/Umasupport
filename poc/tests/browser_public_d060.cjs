'use strict';
// D060 public product acceptance: actual deployed code and compact data,
// actual moving upstream dictionary, no interception in the success path.
// Independently classify by source ID and raw fixed/live profile structure.
const a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const cat=require('../src/skill_catalog.js');
function productGroup(skill,states){
 const m=cat.masks(skill.activationProfile);if(!m)return 'scopeUnknown';
 const styles=[0,1,2,3].filter(i=>m.slice(i*8,i*8+8).some(Boolean));
 if(!styles.length)return 'outside';
 if(styles.length===1)return 'explicitOnly';
 return states.get(skill.id)||'undetermined';
}

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
 const groups={general:[],targeted:[],undetermined:[],explicitOnly:[],scopeUnknown:[],outside:[]};
 for(const s of skills)groups[productGroup(s,accepted)].push(s.id);
 return {groups,reasons,accepted:accepted.size};
}
async function collect(page,state,total){
 await page.locator('#catalog-suitability').selectOption(state);
 const match=/^(\d+) \/ (\d+) 件$/.exec(await page.locator('.catalog-count').innerText());a(match);a.equal(Number(match[2]),total);
 const ids=[];for(let i=0;;i++){ids.push(...await page.locator('[data-catalog-skill]').evaluateAll(rs=>rs.map(r=>r.dataset.catalogSkill)));const next=page.locator('[data-action="catalog-next"]');if(await next.isDisabled())break;a(i<Math.ceil(total/60));await next.click();}
 a.equal(ids.length,Number(match[1]));a.equal(new Set(ids).size,ids.length);return ids.sort();
}
async function deployedAssets(){
 const assets=['index.html','poc/live.html','poc/src/core.js','poc/src/live_app.js','poc/src/skill_catalog.js','poc/src/skill_suitability.js','poc/src/card_suitability_view.js','poc/src/skill_condition_profiles.js','poc/src/skill_bridge.js','poc/src/style.css',DATA];
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
 const html=await fs.readFile(path.join(ROOT,'poc/live.html'),'utf8'),root=await fs.readFile(path.join(ROOT,'index.html'),'utf8');
 const version=/data-release="([^"]+)"/.exec(html)?.[1];a(version&&/^[a-zA-Z0-9-]+$/.test(version));
 a(root.includes('url=./poc/live.html?v='+version));
 const runtimeAssets=[...html.matchAll(/(?:src|href)="\.\/(src\/[^"?]+)\?v=([^"]+)"/g)].map(m=>{a.equal(m[2],version);return 'poc/'+m[1];});
 const dynamic=/script\.src='\.\/(src\/[^'?]+)\?v=([^']+)'/.exec(html);a(dynamic);a.equal(dynamic[2],version);runtimeAssets.push('poc/'+dynamic[1]);
 a.equal(new Set(runtimeAssets).size,runtimeAssets.length);
 a(runtimeAssets.includes('poc/src/live_app.js')&&runtimeAssets.includes('poc/src/style.css'));
 const expectedAssets=new Map(await Promise.all(runtimeAssets.map(async f=>[BASE+f+'?v='+version,sha(await fs.readFile(path.join(ROOT,f)))])));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const getLive=page.waitForResponse(r=>r.url()===LIVE&&r.ok(),{timeout:60000}),getSupport=page.waitForResponse(r=>r.url()===SUPPORT&&r.ok(),{timeout:60000}),getPublic=page.waitForResponse(r=>r.url().split('?')[0]===BASE+DATA&&r.ok(),{timeout:60000});
   // Enter through exactly the ordinary public link, no verify query.
   const actualAssets=new Map();
   page.on('response',r=>{if(expectedAssets.has(r.url()))actualAssets.set(r.url(),r.body().then(b=>sha(b)));});
   await page.goto(BASE,{waitUntil:'load',timeout:60000});await page.waitForURL(BASE+'poc/live.html?v='+version,{timeout:60000});
   await page.locator('#app main.app').waitFor({timeout:60000});
   a.equal(await page.locator('#app-release').getAttribute('data-release'),version);
   a.equal(actualAssets.size,expectedAssets.size,'ordinary entry loaded every versioned asset');
   for(const [url,hash] of expectedAssets)a.equal(await actualAssets.get(url),hash,'actual runtime response '+url);
   console.log('PAGES_NORMAL_ENTRY='+JSON.stringify({version,viewport:width,url:page.url(),assets:actualAssets.size}));
   const [live,support,pub]=await Promise.all([getLive.then(r=>r.body()),getSupport.then(r=>r.body()),getPublic.then(r=>r.body())]);a.equal(sha(pub),sha(text));
   const model=await page.evaluate(()=>({skills:UmaDemoData.skills.map(s=>({id:s.id,activationProfile:s.activationProfile})),cards:UmaDemoData.cards.length,sources:UmaDemoData.meta.runtimeSources}));a.equal(model.sources.skills.mode,'online');a.equal(model.sources.cards.mode,'online');a.equal(model.sources.events.mode,'reviewed');
   const total=model.skills.length,{groups,reasons,accepted}=expectedGroups(labels,records,model.skills);a(accepted>0);a.equal(accepted+reasons.missingOrAmbiguous+reasons.changedStructure,404);
   const status='検証済み '+accepted+'件 / 変更・未照合 '+(404-accepted)+'件';
   const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
   const saved=await snapshot(),comparison=await page.locator('#table-region').innerText();
   const openHealth=async()=>{await page.locator('header [data-action="source-health"]').click();};
   const closeModal=async()=>{await page.locator('.modal-head [data-action="close"]').click();};
   const healthStatus=page.locator('#source-status-suitability .source-health-state');
   await openHealth();await page.waitForFunction(s=>document.querySelector('#source-status-suitability .source-health-state')?.textContent===s,status,{timeout:40000});await closeModal();
   await page.locator('header [data-action="catalog-toggle"]').click();await page.waitForFunction(s=>document.querySelector('#catalog-label-status')?.textContent===s,status,{timeout:40000});
   for(const state of ['general','targeted','undetermined','explicitOnly'])a.deepEqual(await collect(page,state,total),groups[state].sort());
   a.deepEqual(await collect(page,'apt-positive',total),[...groups.explicitOnly,...groups.targeted].sort());
   await page.locator('header [data-action="card-library"]').click();const card=page.locator('.picker-card[data-action="card-detail"]').first(),cardId=await card.getAttribute('data-id');await card.click();await page.locator('#card-skill-list').waitFor();
   await page.locator('#library-stage').selectOption('0');
   const expectedIds=await page.evaluate(id=>{const c=UmaDemoData.cardById[id];return [...new Set([...(c.sourceStatus?.startsWith('verified_hints')?(c.hintsByStage?.['0']??c.hints??[]):[]),...UmaCardSearch.approvedEventSkillIds(c,UmaDemoData)])].filter(id=>UmaDemoData.skillById[id]).sort();},cardId);
   a.deepEqual(await page.locator('[data-card-skill-id]').evaluateAll(rs=>rs.map(r=>r.dataset.cardSkillId).sort()),expectedIds);await page.getByRole('button',{name:'戻る',exact:true}).click();await closeModal();a.equal(await snapshot(),saved);a.equal(await page.locator('#table-region').innerText(),comparison);
   await page.locator('[data-action="pick"]').first().click();await page.locator('[data-picker-fit-axis="running_style"]').selectOption('2');
   const expected=await page.evaluate(async()=>{const d=UmaDemoData,labels=(await UmaSkillCatalog.loadPublicLabels(d)).labels;return Object.fromEntries(d.cards.map(c=>[c.id,UmaCardSuitabilityView.browseCard(c,{stage:4},d,labels,{running_style:2}).potential]));});
   const shown=await page.locator('.picker-card').evaluateAll(rs=>rs.map(r=>({id:r.dataset.id,tier:r.querySelector('[data-picker-fit-tier]')?.textContent})));a(shown.length);
   for(const r of shown){const v=expected[r.id],t=v.matchingByTier;a.equal(r.tier,'金 '+t.gold+' · 白 '+t.white+' · その他 '+t.other);a.equal(t.gold+t.white+t.other,v.matching);a.equal(v.rows.filter(x=>x.scopePending&&x.matching).length,0);}
   await page.locator('#picker-sort').selectOption('fit-count-desc');const ids=await page.locator('.picker-card').evaluateAll(rs=>rs.map(r=>r.dataset.id));for(let i=1;i<ids.length;i++)a(expected[ids[i-1]].matching>=expected[ids[i]].matching);
   await page.locator('.modal-head [data-action="close"]').click();a.equal(await snapshot(),saved);a.equal(await page.locator('#table-region').innerText(),comparison);
   // Exercise a real nonempty deck, not just the untouched default settings.
   await page.locator('[data-action="pick"][data-deck="main"][data-index="0"]').click();
   const first=page.locator('.picker-card').first(),id=await first.getAttribute('data-id');a(id);await first.click();
   const slot=page.locator('[data-action="edit-card"][data-deck="main"][data-index="0"]');
   await slot.click();
   const verifyDetail=async stage=>{
    const v=await page.evaluate(async({id,stage})=>{const d=UmaDemoData,l=(await UmaSkillCatalog.loadPublicLabels(d)).labels;return UmaCardSuitabilityView.browseCard(d.cardById[id],{stage,choices:{},outcomes:{}},d,l,{running_style:2});},{id,stage});
    const tier=x=>'金 '+x.gold+'・白 '+x.white+'・その他 '+x.other;
    for(const [k,cur,pot] of [['inside',v.current.counts.total-v.current.counts.outside-v.current.counts.scopeUnknown-v.current.counts.scopePending,v.potential.counts.total-v.potential.counts.outside-v.potential.counts.scopeUnknown-v.potential.counts.scopePending],['matching',v.current.matching,v.potential.matching]]){const cells=page.locator('[data-fit-group="'+k+'"] td');a.equal(await cells.nth(1).innerText(),String(cur));a.equal(await cells.nth(2).innerText(),String(pot));}
    a.equal(await page.locator('[data-fit-tiers]').innerText(),'一致候補の内訳：現在 '+tier(v.current.matchingByTier)+' ／ 全分岐 '+tier(v.potential.matchingByTier));
   };
   await verifyDetail(4);await page.locator('#stage-select').selectOption('0');await verifyDetail(0);await closeModal();
   const populated=await snapshot(),populatedComparison=await page.locator('#table-region').innerText();a.notEqual(populated,saved);a.match(await slot.innerText(),/0凸/);
   await page.reload();await page.locator('#app main.app').waitFor({timeout:60000});await openHealth();await page.waitForFunction(s=>document.querySelector('#source-status-suitability .source-health-state')?.textContent===s,status,{timeout:40000});await closeModal();
   a.equal(await snapshot(),populated);a.equal(await page.locator('#table-region').innerText(),populatedComparison);a.match(await slot.innerText(),/0凸/);
   const blocked='**/data/skill-suitability-d059.v1.txt';await page.route(blocked,r=>r.abort());await page.reload();await page.locator('#app main.app').waitFor({timeout:60000});await openHealth();
   await page.waitForFunction(()=>document.querySelector('#source-status-suitability .source-health-state')?.textContent.includes('自動取得失敗'),{timeout:40000});a.match(await healthStatus.innerText(),/自動取得失敗/);await closeModal();
   await page.locator('header [data-action="catalog-toggle"]').click();await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('自動取得失敗'),{timeout:40000});await page.locator('#catalog-suitability').selectOption('undetermined');const now=await page.evaluate(()=>UmaDemoData.skills.map(s=>({id:s.id,activationProfile:s.activationProfile})));a.equal(await page.locator('.catalog-count').innerText(),now.filter(s=>productGroup(s,new Map())==='undetermined').length+' / '+now.length+' 件');
   a.equal(await snapshot(),populated);a.equal(await page.locator('#table-region').innerText(),populatedComparison);
   await page.unroute(blocked);await page.reload();await page.locator('#app main.app').waitFor({timeout:60000});await openHealth();await page.waitForFunction(s=>document.querySelector('#source-status-suitability .source-health-state')?.textContent===s,status,{timeout:40000});await closeModal();
   a.equal(await snapshot(),populated);a.equal(await page.locator('#table-region').innerText(),populatedComparison);a.match(await slot.innerText(),/0凸/);a.deepEqual(errors,[]);
   console.log('PAGES_D060_PUBLIC='+JSON.stringify({expectedCommit:EXPECTED,viewport:width,browser:browser.version(),cards:model.cards,skills:total,liveSkillSHA256:sha(live),liveSupportSHA256:sha(support),publicSHA256:sha(pub),accepted,skipped:404-accepted,reasons,general:groups.general.length,targeted:groups.targeted.length,undetermined:groups.undetermined.length,explicitOnly:groups.explicitOnly.length,scopeUnknown:groups.scopeUnknown.length,outside:groups.outside.length}));
   await page.close();
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
