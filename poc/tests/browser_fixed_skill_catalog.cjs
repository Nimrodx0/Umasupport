'use strict';
// Fixed-source browser acceptance of the D-053 catalogue. The derived label
// bundle comes from the same CI run, never from the repository or public Pages.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const bridge=require('../src/skill_bridge.js');
const cat=require('../src/skill_catalog.js');
function productGroup(skill,states){
 const m=cat.masks(skill.activationProfile);if(!m)return 'scopeUnknown';
 const styles=[0,1,2,3].filter(i=>m.slice(i*8,i*8+8).some(Boolean));
 if(!styles.length)return 'outside';
 if(styles.length===1)return 'explicitOnly';
 return states.get(skill.id)||'undetermined';
}

const ROOT=path.resolve(__dirname,'../..');
const BASE='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/';
async function get(url){const r=await fetch(url);assert(r.ok,url);return Buffer.from(await r.arrayBuffer());}
async function main(){
 const auto=process.argv.includes('--auto');
 const file=process.argv[2];assert(file,'same-run compact label bundle required');
 const bundle=JSON.parse(await fs.readFile(file,'utf8'));const n=bundle.rows.length,general=bundle.rows.filter(r=>r.label.state==='general').length,targeted=n-general;
 assert.deepEqual([n,general,targeted],({'D-052':[300,257,43],'D-056':[324,281,43],'D-059':[404,304,100]})[bundle.decisionId]);
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
   if(!auto)await page.route('**/data/skill-suitability-d059.v1.txt',r=>r.abort());
   await page.goto(url);await page.locator('#app main.app').waitFor({timeout:40000});
   const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
   const saved=await snapshot(),comparison=await page.locator('#table-region').innerText();
   const modelSkills=await page.evaluate(()=>UmaDemoData.skills.map(s=>({id:s.id,activationProfile:s.activationProfile})));
   const countsFor=rows=>{const states=new Map(rows.map(r=>[r.appSkillId,r.label.state])),counts={};for(const s of modelSkills){const k=productGroup(s,states);counts[k]=(counts[k]||0)+1;}return counts;};
   const loaded=countsFor(bundle.rows),empty=countsFor([]);
   await page.locator('header [data-action="card-library"]').click();
   const card=page.locator('.picker-card[data-action="card-detail"]').first(),cardId=await card.getAttribute('data-id');
   await card.click();await page.locator('#card-skill-list').waitFor();
   const verifyList=async stage=>{
    const expected=await page.evaluate(({cardId,stage})=>{const c=UmaDemoData.cardById[cardId];return [...new Set([...(c.sourceStatus?.startsWith('verified_hints')?(c.hintsByStage?.[String(stage)]??c.hints??[]):[]),...UmaCardSearch.approvedEventSkillIds(c,UmaDemoData)])].filter(id=>UmaDemoData.skillById[id]).sort();},{cardId,stage});
    const actual=await page.locator('[data-card-skill-id]').evaluateAll(rs=>rs.map(r=>r.dataset.cardSkillId).sort());assert.deepEqual(actual,expected);
   };
   await verifyList(4);await page.locator('#library-stage').selectOption('0');await verifyList(0);
   const link=page.locator('#card-skill-list [data-action="skill"]').first();if(await link.count()){await link.click();await page.getByRole('button',{name:'カード詳細へ戻る'}).click();assert.equal(await page.locator('#library-stage').inputValue(),'0');}
   await page.getByRole('button',{name:'戻る',exact:true}).click();assert(await page.locator('.picker-card[data-action="card-detail"]').count()>0);
   await page.locator('.modal-head [data-action="close"]').click();assert.equal(await snapshot(),saved);assert.equal(await page.locator('#table-region').innerText(),comparison);
   await page.locator('header [data-action="catalog-toggle"]').click();
   const count=page.locator('.catalog-count'),filter=page.locator('#catalog-suitability');
   if(auto){
    assert.equal(bundle.decisionId,'D-059');
    await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent==='検証済み 404件 / 変更・未照合 0件',{timeout:40000});
    await page.locator('header [data-action="source-health"]').click();
    assert.equal(await page.locator('#source-status-suitability .source-health-state').innerText(),'検証済み 404件 / 変更・未照合 0件');
    await page.locator('.modal-head [data-action="close"]').click();
    const expected=await page.evaluate(async()=>{
     const r=await UmaSkillCatalog.loadPublicLabels(UmaDemoData);
     return [...r.labels].map(([id,row])=>[id,row.label.state,row.label.styles]).sort();
    });
    assert.deepEqual(expected,bundle.rows.map(r=>[r.appSkillId,r.label.state,r.label.styles]).sort());
    for(const [state,n] of [['general',loaded.general||0],['targeted',loaded.targeted||0],['explicitOnly',loaded.explicitOnly||0],['apt-positive',(loaded.explicitOnly||0)+(loaded.targeted||0)],['undetermined',loaded.undetermined||0]]){await filter.selectOption(state);assert.equal(await count.innerText(),n+' / 881 件');}
    await page.locator('[data-action="pick"]').first().click();
    await page.locator('[data-picker-fit-axis="running_style"]').selectOption('2');
    const tiers=await page.locator('[data-picker-fit-tier]').allTextContents();assert(tiers.length>0);for(const t of tiers)assert.match(t,/一致候補：金 \d+ · 白 \d+ · その他 \d+/);
    await page.locator('.modal-head [data-action="close"]').click();
    assert.equal(await snapshot(),saved);assert.equal(await page.locator('#table-region').innerText(),comparison);
    await page.reload();await page.locator('#app main.app').waitFor({timeout:40000});await page.locator('header [data-action="catalog-toggle"]').click();
    await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent==='検証済み 404件 / 変更・未照合 0件',{timeout:40000});
    await page.route('**/data/skill-suitability-d059.v1.txt',r=>r.fulfill({status:200,body:'tampered'}));
    await page.reload();await page.locator('#app main.app').waitFor({timeout:40000});await page.locator('header [data-action="catalog-toggle"]').click();
    await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('自動取得失敗'),{timeout:40000});
    await page.locator('header [data-action="source-health"]').click();
    assert.match(await page.locator('#source-status-suitability .source-health-state').innerText(),/自動取得失敗/);
    await page.locator('.modal-head [data-action="close"]').click();
    await filter.selectOption('undetermined');assert.equal(await count.innerText(),(empty.undetermined||0)+' / 881 件');
    assert.equal(await snapshot(),saved);assert.deepEqual(errors,[]);await page.close();continue;
   }
   await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('適性データ未読込'));
   assert.match(await count.innerText(),/^881 \/ 881 件$/);
   await filter.selectOption('undetermined');assert.equal(await count.innerText(),(empty.undetermined||0)+' / 881 件');
   await page.locator('.catalog-data summary').click();
   await page.locator('#catalog-label-file').setInputFiles(file);
   await page.waitForFunction(s=>document.querySelector('#catalog-label-status')?.textContent.includes(s),'検証済み '+n+'件 / 変更・未照合 0件',{timeout:40000});
   assert.equal(await count.innerText(),(loaded.undetermined||0)+' / 881 件');
   await filter.selectOption('general');assert.equal(await count.innerText(),(loaded.general||0)+' / 881 件');
   await page.locator('#catalog-query').fill('アオハル点火');
   assert.equal(await count.innerText(),'5 / 881 件');
   assert.equal(await page.locator('.catalog-table tbody tr').count(),5);
   await page.locator('#catalog-query').fill('アオハル燃焼');
   assert.equal(await count.innerText(),'5 / 881 件');
   if(bundle.decisionId!=='D-052'){
    await page.locator('#catalog-query').fill('全身全霊');
    assert.equal(await count.innerText(),'1 / 881 件');
    assert.match(await page.locator('.catalog-table tbody').innerText(),/汎用/);
    assert.equal(await page.locator('.catalog-table tbody tr td').last().innerText(),'汎用');
    assert.equal(await page.locator('.catalog-table tbody .catalog-evidence-note').count(),0);
   }
   if(bundle.decisionId==='D-059'){
    for(const name of ['あふれる活力','気丈夫','遊び心','阿吽の呼吸','聖女の挑戦','一張一弛','想い焦がれて']){
     await page.locator('#catalog-query').fill(name);const row=page.locator('.catalog-table tbody tr').filter({has:page.getByRole('button',{name,exact:true})});assert.equal(await row.count(),1);assert.match(await row.innerText(),/汎用/);
    }
    await filter.selectOption('targeted');
    for(const name of ['豪脚','上昇気流','前途洋々','スタミナイーター']){
     await page.locator('#catalog-query').fill(name);const row=page.locator('.catalog-table tbody tr').filter({has:page.getByRole('button',{name,exact:true})});assert.equal(await row.count(),1);
     assert.match(await row.innerText(),name==='前途洋々'?/逃げ向け/:/差し向け・追込向け/);
    }
    await filter.selectOption('general');
   }
   await page.locator('#catalog-query').fill('');
   await page.locator('#catalog-show-labels').uncheck();
   assert.equal(await page.locator('.catalog-table th').count(),2);assert.equal(await count.innerText(),(loaded.general||0)+' / 881 件');
   await page.locator('#catalog-show-labels').check();
   assert.equal(await page.locator('.catalog-table th').count(),3);
   await filter.selectOption('all');await page.locator('[data-catalog-axis="running_style"]').selectOption('2');await page.locator('#catalog-scope').selectOption('outside');assert(await filter.isDisabled());assert.equal(await page.locator('.catalog-table [data-aptitude]:not([data-aptitude="not-applicable"])').count(),0);await page.locator('#catalog-scope').selectOption('unknown');assert.equal(await page.locator('.catalog-table [data-aptitude]:not([data-aptitude="not-applicable"])').count(),0);await page.locator('#catalog-scope').selectOption('possible');assert(await filter.isEnabled());await filter.selectOption('explicitOnly');assert(await page.locator('.catalog-table [data-aptitude="explicitOnly"]').count()>0);await page.locator('[data-catalog-axis="running_style"]').selectOption('');
   await filter.selectOption('targeted');assert.equal(await count.innerText(),(loaded.targeted||0)+' / 881 件');
   await page.locator('[data-catalog-axis="ground_type"]').selectOption('2');
   assert.match(await count.innerText(),/^0 \/ 881 件$/);
   await page.locator('[data-catalog-axis="ground_type"]').selectOption('');
   assert.equal(await count.innerText(),(loaded.targeted||0)+' / 881 件');
   await page.locator('#catalog-label-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
   await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('前回の検証済みラベルを維持'));
   assert.equal(await count.innerText(),(loaded.targeted||0)+' / 881 件');
   await page.locator('[data-catalog-skill] button').first().click();
   await page.locator('.modal-head h2').waitFor();
   await page.locator('.modal-head [data-action="close"]').click();
   assert.equal(await page.locator('#table-region').innerText(),comparison);assert.equal(await snapshot(),saved);
   // Browse the same verified labels on actual support-card candidates,
   // independently of deck selection or the catalogue's filter state.
   await page.locator('[data-action="pick"]').first().click();
   await page.locator('[data-picker-fit-axis="running_style"]').selectOption('2');
   await page.locator('[data-picker-fit-axis="distance_type"]').selectOption('3');
   await page.locator('[data-picker-fit-axis="ground_type"]').selectOption('1');
   const expected=await page.evaluate(rows=>{
    const d=UmaDemoData,labels=new Map(rows.map(r=>[r.appSkillId,r])),ctx={running_style:2,distance_type:3,ground_type:1};
    return Object.fromEntries(d.cards.map(c=>[c.id,UmaCardSuitabilityView.browseCard(c,{stage:4},d,labels,ctx).potential]));
   },bundle.rows);
   const summary=page.locator('[data-picker-fit-summary]');
   assert(await summary.count()>0);
   const readShown=()=>page.locator('.picker-card').evaluateAll(rs=>rs.map(r=>({id:r.dataset.id,counts:Object.fromEntries([...r.querySelectorAll('[data-fit-count]')].map(n=>[n.dataset.fitCount,n.innerText]))})));
   const verifyShown=async only=>{for(const x of await readShown()){
    const v=expected[x.id],c=v.counts;assert(v);
    assert.match(x.counts.inside,new RegExp((c.total-c.outside-c.scopeUnknown)+' / '+c.total+'件'));assert.match(x.counts.matching,new RegExp(v.matching+'件'));assert.equal(x.counts.otherTargeted,'他脚質向け '+c.otherTargeted+'件');assert.equal(x.counts.undetermined,'適性未判定 '+c.undetermined+'件');assert.equal(x.counts.outside,'範囲外 '+c.outside+'件');assert.equal(x.counts.scopeUnknown,'範囲未確認 '+c.scopeUnknown+'件');
    if(only)assert(v.matching>0);
   }};
   await verifyShown(false);
   await page.locator('#picker-sort').selectOption('fit-count-desc');
   const sorted=await readShown();for(let i=1;i<sorted.length;i++)assert(expected[sorted[i-1].id].matching>=expected[sorted[i].id].matching);
   await page.locator('#picker-fit-only').check();await verifyShown(true);
   assert.match(await page.locator('#picker-cards > p').first().innerText(),new RegExp('候補 '+Object.values(expected).filter(v=>v.matching>0).length+' 件'));
   await page.locator('.modal-head [data-action="close"]').click();
   assert.equal(await snapshot(),saved);assert.equal(await page.locator('#table-region').innerText(),comparison);
   await page.reload();await page.locator('#app main.app').waitFor({timeout:40000});
   await page.locator('header [data-action="catalog-toggle"]').click();
   // Reload collapses the disclosure; open it before asserting visible status.
   await page.locator('.catalog-data summary').click();
   await page.waitForFunction(()=>document.querySelector('#catalog-label-status')?.textContent.includes('適性データ未読込'));
   assert.match(await count.innerText(),/^881 \/ 881 件$/);
   assert.equal(await snapshot(),saved);assert.deepEqual(errors,[]);
   // Exercise detail separately after the no-mutation assertions.
   await page.locator('#catalog-label-file').setInputFiles(file);
   await page.waitForFunction(s=>document.querySelector('#catalog-label-status')?.textContent.includes(s),'検証済み '+n+'件');
   await page.locator('[data-action="pick"]').first().click();
   await page.locator('[data-picker-fit-axis="running_style"]').selectOption('2');
   await page.locator('[data-picker-fit-axis="ground_condition"]').selectOption('1');
   const first=page.locator('.picker-card').first(),id=await first.getAttribute('data-id');await first.click();
   await page.locator('[data-action="edit-card"]').first().click();
   const detail=page.locator('#card-fit-detail');await detail.waitFor();
   const verifyDetail=async stage=>{
    const v=await page.evaluate(({id,stage,rows})=>UmaCardSuitabilityView.browseCard(UmaDemoData.cardById[id],{stage},UmaDemoData,new Map(rows.map(r=>[r.appSkillId,r])),{running_style:2,ground_condition:1}),{id,stage,rows:bundle.rows});
    for(const [k,cur,pot] of [['total',v.current.counts.total,v.potential.counts.total],['inside',v.current.counts.total-v.current.counts.outside-v.current.counts.scopeUnknown,v.potential.counts.total-v.potential.counts.outside-v.potential.counts.scopeUnknown],['matching',v.current.matching,v.potential.matching]]){const cells=detail.locator('[data-fit-group="'+k+'"] td');assert.equal(await cells.nth(1).innerText(),String(cur));assert.equal(await cells.nth(2).innerText(),String(pot));}
    for(const k of Object.keys(v.current.counts).filter(x=>x!=='total')){
     const cells=detail.locator('[data-fit-category="'+k+'"] td');
     assert.equal(await cells.nth(1).innerText(),String(v.current.counts[k]));assert.equal(await cells.nth(2).innerText(),String(v.potential.counts[k]));
    }
   };
   await verifyDetail(4);await page.locator('#stage-select').selectOption('0');await verifyDetail(0);
   const prior=await snapshot();await detail.locator('summary').click();assert(await detail.locator('.fit-name-tree').isVisible());assert(await page.locator('#card-skill-list').isVisible());assert.equal(await snapshot(),prior);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log((auto?'PASS: automatic D059 load, reload, tier counts and corrupt public data fallback; ':'PASS: manual compatibility; ')+'fixed catalogue 881 skills, '+n+' local labels '+bundle.decisionId+', Aoharu and natural-spurt checks, scope, visibility, invalid import, deck/settings isolation and reload at 1280/390px');
 }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
