'use strict';
// Actual Chromium UI interaction with a five-event, UNAPPROVED preview.
// All support/skill upstream network traffic is mocked using synthetic data.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const PREVIEW_SKILLS=require('../src/efforia30311_review_preview.cjs').SKILLS;
function supports(){
 const out=[];
 for(let n=0;n<563;n++){
  const id=String(30001+n);
  for(let stage=0;stage<5;stage++){
   const v=Array(62).fill('');
   v[0]=id;v[1]='[架空'+id+']サポカ'+n;v[3]='3';v[4]=String(stage);v[6]='スピード';
   for(let k=7;k<=58;k++)v[k]='0';
   v[23]='0';v[24]='10';v[49]='0';v[50]='0';v[59]=n===0?'右回り○':'';
   out.push(v.join('\t'));
  }
 }
 return out.join('\n');
}
const skills=JSON.stringify([
 ...Object.entries(PREVIEW_SKILLS).map(([id,name],i)=>({id,name,rarity:'normal',group:40000+i})),
 ...Array.from({length:120},(_,i)=>({id:String(800000+i),name:'架空スキル'+i,
  rarity:'normal',group:80000+i}))
]);
const fixtureSupports=supports();
function server(){
 return http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   const full=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
   if(!full.startsWith(ROOT+path.sep))throw Error('directory traversal');
   const content=await fs.readFile(full);
   const type=full.endsWith('.js')?'text/javascript':
     full.endsWith('.json')?'application/json':
     full.endsWith('.html')?'text/html':full.endsWith('.css')?'text/css':'text/plain';
   res.writeHead(200,{'Content-Type':type});res.end(content);
  }catch{res.writeHead(404);res.end('Missing');}
 });
}
async function mock(page){
 await page.route('**/data/support_card.txt',r=>r.fulfill({
  status:200,contentType:'text/plain',body:fixtureSupports}));
 await page.route('**/data/skill_data.txt',r=>r.fulfill({
  status:200,contentType:'text/plain',body:skills}));
}
async function boot(page,url){
 await page.goto(url,{waitUntil:'load'});
 try {
  await page.locator('#app main.app').waitFor({timeout:12000});
 }catch(e){
  console.error('BOOT FAILURE URL',url);
  console.error('BOOT STATUS',await page.locator('#bootstrap-status').innerText().catch(()=>'<missing>'));
  console.error('BOOT BODY',((await page.locator('body').innerText().catch(()=>''))||'').slice(0,450));
  throw e;
 }
 assert.notEqual(await page.locator('#bootstrap-status').getAttribute('data-mode'),'error');
}
async function main(){
 const web=server();
 await new Promise((resolve,reject)=>{
  web.once('error',reject);web.listen(0,'127.0.0.1',resolve);
 });
 const origin='http://127.0.0.1:'+web.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();
  const page=await context.newPage();await mock(page);
  await boot(page,origin+'/poc/live.html?eventPreview=30311');
  assert.match(await page.locator('#candidate-preview-warning').innerText(),/未承認イベントの試用モード/);
  assert.match(await page.locator('.notice').last().innerText(),/承認済み実イベントは0件/);
  assert.equal(await page.evaluate(()=>window.UmaPreviewActive),true);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.cardById['30311'].events.length),5);
  await page.locator('button[data-action="source-health"]').click();
  assert.match(await page.locator('#source-status-events').innerText(),/未承認イベント試用中/);
  await page.locator('button[data-action="close"]').click();

  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await page.locator('#picker-search').fill('サポカ310');
  await page.locator('button[data-action="set-card"][data-id="30311"]').click();
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  assert.equal(await page.locator('.modal-body .event').count(),5);
  const ids=['830311001','830311002','830311003'];
  for(const id of ids){
   await page.locator('input[data-event-choice][data-deck="main"][data-index="0"][data-event="evt_30311_'+id+'"][value="option1"]').click();
  }
  const actual=await page.evaluate(()=>{
   const key='uma-support-lab-runtime-umasim-v1-event-preview';
   const saved=JSON.parse(localStorage.getItem(key));
   const slot=saved.decks.main[0].slots[0];
   return window.UmaCore.directRoutes(window.UmaDemoData.cardById['30311'],slot)
      .filter(r=>r.source==='event')
      .map(r=>({skillId:r.skillId,level:r.level,conditional:r.conditional}));
  });
  assert.equal(actual.length,7); // stage2 1 hint, finale option1 success/great 6
  assert.equal(actual.filter(r=>r.conditional).length,6);
  assert.ok(actual.some(r=>r.skillId==='skill:204532'&&r.level===5&&r.conditional));
  assert.ok(actual.some(r=>r.skillId==='skill:204532'&&r.level===1&&r.conditional));
  assert.equal(await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1')),null);
  await page.locator('button[data-action="close"]').click();

  // In the SAME browser origin, normal mode must not inherit candidate data.
  await boot(page,origin+'/poc/live.html');
  assert.equal(await page.locator('#candidate-preview-warning').count(),0);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.cardById['30311'].events.length),0);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  assert.equal(await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').count(),0);
  await context.close();

  // Malformed or missing candidate data never appears as a reviewed event.
  const bad=await browser.newContext(),badPage=await bad.newPage();await mock(badPage);
  await badPage.route('**/preview/efforia30311.v1.json',r=>r.abort());
  await boot(badPage,origin+'/poc/live.html?eventPreview=30311');
  assert.equal(await badPage.evaluate(()=>window.UmaDemoData.cardById['30311'].events.length),0);
  assert.equal(await badPage.evaluate(()=>window.UmaPreviewActive),false);
  assert.match(await badPage.locator('.notice').last().innerText(),/試用イベントは適用されませんでした/);
  await bad.close();

  // Expanded mode: independently generated 126 candidate input records, used
  // only in tests. The actual runtime uses pinned SHA-256 raw GitHub fetch.
  const expandedContext=await browser.newContext(),expandedPage=await expandedContext.newPage();
  expandedPage.on('pageerror',error=>console.error('EXPANDED SCRIPT ERROR',error.message));
  expandedPage.on('console',message=>{
   if(message.type()==='error')console.error('EXPANDED CONSOLE ERROR',message.text());
  });
  await mock(expandedPage);
  const sample=require('./community_candidate_fixture.cjs').fixture();
  await expandedPage.unroute('**/data/skill_data.txt');
  await expandedPage.route('**/data/skill_data.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:sample.dict
  }));
  const communityJs=await fs.readFile(path.resolve(ROOT,'poc/src/community_candidate_preview.js'),'utf8');
  await expandedPage.route('**/src/community_candidate_preview.js',r=>r.fulfill({
   status:200,contentType:'text/javascript',
   body:communityJs+'\nwindow.UmaCommunityCandidatePreview.load=async()=>('+JSON.stringify(sample.source)+');'
  }));
  await boot(expandedPage,origin+'/poc/live.html?eventPreview=expanded');
  assert.equal(await expandedPage.evaluate(()=>window.UmaPreviewActive),true);
  assert.equal(await expandedPage.evaluate(()=>window.UmaDemoData.meta.previewEvents.cards),45);
  assert.equal(await expandedPage.evaluate(()=>window.UmaDemoData.meta.previewEvents.records),124);
  assert.equal(await expandedPage.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  assert.equal(await expandedPage.evaluate(()=>window.UmaDemoData.cardById['30311'].events.length),5);
  assert.equal(await expandedPage.evaluate(()=>window.UmaDemoData.cardById['30201'].events.length>0),true);
  await expandedPage.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await expandedPage.locator('#picker-route').selectOption('event');
  await expandedPage.locator('#picker-search').fill('サポカ200');
  await expandedPage.locator('button[data-action="set-card"][data-id="30201"]').click();
  await expandedPage.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  const candidateEvent=expandedPage.locator('.modal-body .event').first();
  assert.match(await candidateEvent.innerText(),/候補1/);
  const eventId=await candidateEvent.locator('input[data-event-choice][value="option1"]').getAttribute('data-event');
  await candidateEvent.locator('input[data-event-choice][value="option1"]').click();
  const routes=await expandedPage.evaluate((id)=>{
   const slot=JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1-event-preview-expanded'))
      .decks.main[0].slots[0];
   const c=window.UmaDemoData.cardById[slot.cardId];
   return window.UmaCore.directRoutes(c,slot).map(x=>x.skillId);
  },eventId);
  assert.ok(routes.includes('skill:700002')||routes.includes('skill:700001'));
  assert.equal(await expandedPage.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1-event-preview')),null);
  assert.equal(await expandedPage.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1')),null);
  await boot(expandedPage,origin+'/poc/live.html');
  assert.equal(await expandedPage.evaluate(()=>window.UmaDemoData.cardById['30201'].events.length),0);
  assert.equal(await expandedPage.locator('#candidate-preview-warning').count(),0);
  await expandedContext.close();
  // Real Chromium acceptance for cumulative OR-of-AND result restrictions.
  // This model is an isolated test injection, NOT public event publication.
  const cumulativeCtx=await browser.newContext(),cumulativePage=await cumulativeCtx.newPage();
  await mock(cumulativePage);
  await boot(cumulativePage,origin+'/poc/live.html?eventPreview=30311');
  const cumulativeFixture=require('../src/editorial_cumulative_result_30103.cjs').auditFixture({
    candidate:require('../data/candidates/checker_event_hints.v1.json'),
    facts:require('../data/candidates/checker_explicit_result_facts.v1.json'),
    p0Queue:require('../data/candidates/checker_explicit_result_review_queue.v1.json'),
    audit:require('../data/candidates/editorial_cumulative_result_30103.v1.json')
  });
  await cumulativePage.evaluate((events)=>{
    const data=window.UmaDemoData,card=data.cardById['30103'];
    card.events=events;
    data.skillById['200461']={id:'200461',name:'獲得候補１'};
    data.skillById['200462']={id:'200462',name:'獲得候補２'};
  },cumulativeFixture.events);
  await cumulativePage.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await cumulativePage.locator('#picker-search').fill('サポカ102');
  await cumulativePage.locator('button[data-action="set-card"][data-id="30103"]').click();
  await cumulativePage.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  const [firstStage,secondStage,thirdStage]=cumulativeFixture.events.map(e=>e.id);
  const outcomeSelect=id=>cumulativePage.locator('select[data-event-outcome][data-event="'+id+'"]');
  await outcomeSelect(firstStage).selectOption('success');
  await outcomeSelect(secondStage).selectOption('failure');
  console.log('CUMULATIVE-DEBUG',JSON.stringify(await cumulativePage.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1-event-preview'));
    const slot=saved.decks.main[0].slots[0],card=window.UmaDemoData.cardById['30103'];
    const three=card.events[2];
    return {selected:slot.outcomes,ids:card.events.map(e=>e.id),
     conditions:three.outcomes.map(r=>({kind:r.id,
      status:window.UmaCore.outcomeReachability(r,three,slot.choices,card.events,slot.outcomes)})),
     options:[...document.querySelectorAll('select[data-event-outcome]')].map(sel=>({
      event:sel.dataset.event,selected:sel.value,
      opts:[...sel.options].map(o=>({value:o.value,disabled:o.disabled}))
     }))};
  })));
  assert.equal(await outcomeSelect(thirdStage).locator('option[value="great"]').isDisabled(),true);
  assert.equal(await outcomeSelect(thirdStage).locator('option[value="success"]').isDisabled(),false);
  assert.equal(await outcomeSelect(thirdStage).locator('option[value="failure"]').isDisabled(),true);
  await outcomeSelect(thirdStage).selectOption('success');
  const firstResult=await cumulativePage.evaluate(()=>{
    const settings=JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1-event-preview'));
    const slot=settings.decks.main[0].slots[0];
    return window.UmaCore.directRoutes(window.UmaDemoData.cardById['30103'],slot)
      .filter(r=>r.skillId==='200461').map(r=>r.level);
  });
  assert.deepEqual(firstResult,[2]);
  await outcomeSelect(secondStage).selectOption('success');
  assert.equal(await outcomeSelect(thirdStage).inputValue(),'');
  assert.equal(await outcomeSelect(thirdStage).locator('option[value="great"]').isDisabled(),false);
  assert.equal(await outcomeSelect(thirdStage).locator('option[value="success"]').isDisabled(),true);
  await outcomeSelect(thirdStage).selectOption('great');
  const secondResult=await cumulativePage.evaluate(()=>{
    const settings=JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1-event-preview'));
    return window.UmaCore.directRoutes(window.UmaDemoData.cardById['30103'],settings.decks.main[0].slots[0])
      .filter(r=>r.skillId==='200461').map(r=>r.level);
  });
  assert.deepEqual(secondResult,[3]);
  await cumulativeCtx.close();

  console.log('PASS: opt-in SSR30311 candidate loads, choices affect skill routes, normal storage and release count isolated');
 }finally{
  await browser?.close();
  await new Promise(resolve=>web.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
