'use strict';
/* Verify actual no-file-chooser Pages-style auto-loading with a wholly invented
 * FULL-SIZE catalog after the same approval-gated bulk compiler. Neither
 * GameTora/GameWith data nor rights approvals are used here. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const {fixture}=require('./private_local_2512_fixture.cjs');
const {project}=require('../src/phase2_title_choice_projection.cjs');
const {inventory}=require('../src/event_release_cohorts.cjs');
const {prepare}=require('../src/approved_event_release_build.cjs');
const ROOT=path.resolve(__dirname,'../..');
function supports(){
 const lines=[];
 for(let i=0;i<563;i++)for(let stage=0;stage<5;stage++){
  const f=Array(62).fill('0');
  f[0]=String(30001+i);f[1]='サポカ'+f[0];f[3]='3';
  f[4]=String(stage);f[6]='スピード';f[59]='架空ヒント';
  lines.push(f.join('\t'));
 }
 return lines.join('\n');
}
const FIELDS=['card','event','choices','outcomes','dependencies','publication',
 'sourceAccessTerms','databaseReuse','gameMaterialAndTitles','choiceWording'];
function makeApproved(c){
 const selected=inventory(c,[{eventIdPrefix:'synthetic-'}]).groups[0];
 const review={
  reviewer:'Synthetic tests only',reviewedAt:'2026-11-02',
  sourceRevision:'6e38b54af4fad397ff4491e63007a90705a4fe67',
  accessMethod:'reviewed-no-new-access',
  checks:Object.fromEntries(FIELDS.map(k=>[k,true])),
  evidence:Object.fromEntries(FIELDS.map(k=>[k,['https://example.org/'+k]])),
  publicationBasis:{kind:'original-factual-description',
   reason:'Invented data, zero external proprietary expressions',
   scope:'Fictional 563-card full-size browser suite'}
 };
 return {schemaVersion:2,cohorts:[{id:'synthetic-only',selector:{eventIdPrefix:'synthetic-'},
  expectedEvents:selected.events,eventsSha256:selected.eventsSha256,review}],entries:[]};
}
function server(){
 return http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://127.0.0.1');
   const target=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));
   if(!target.startsWith(ROOT+path.sep))throw Error('path');
   const body=await fs.readFile(target);
   res.writeHead(200,{'Content-Type':target.endsWith('.html')?'text/html; charset=utf-8':
    target.endsWith('.js')?'text/javascript; charset=utf-8':
    target.endsWith('.json')?'application/json; charset=utf-8':
    'text/plain; charset=utf-8'});
   res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
 });
}
async function main(){
 const f=fixture(),approvedShape=project(f.bundle.catalog).catalog;
 const approved=prepare({candidate:f.bundle.catalog,approvals:makeApproved(approvedShape),
  model:f.model,skillText:f.skillText});
 assert.equal(approved.report.events,2512);
 const web=server();await new Promise((ok,fail)=>{
  web.once('error',fail);web.listen(0,'127.0.0.1',ok);
 });
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext(),page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e.message)));
  await page.route('**/data/support_card.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:supports()}));
  await page.route('**/data/skill_data.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:f.skillText}));
  let fetched=0;
  await page.route('**/reviewed_events.v1.json',r=>{
   fetched++;
   return r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(approved.catalog)});
  });
  const base='http://127.0.0.1:'+web.address().port;
  await page.goto(base+'/poc/live.html',{waitUntil:'load'});
  await page.locator('#app main.app').waitFor({timeout:35000});
  const meta=await page.evaluate(()=>window.UmaDemoData.meta);
  assert.equal(meta.reviewedEventRecords,2512);
  assert.equal(meta.reviewedEventCards,563);
  assert.equal(meta.eventStatus,'reviewed-partial');
  assert.equal(await page.locator('#private-local-event-file').count(),0,
   'the public user must not need to provide a JSON file');
  assert.ok(fetched>=1,'the public same-origin JSON was never fetched');
  const cardId='30001',eventId='synthetic-30001-event-0';
  const card=await page.evaluate(id=>window.UmaDemoData.cardById[id],cardId);
  const ev=card.events.find(e=>e.id===eventId);
  assert.equal(ev.name,'架空の選択式');
  assert.equal(ev.choices[0].label,'選択肢1（仮）');
  assert.equal(ev.choices[1].label,'選択肢2（仮）');
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await page.locator('button[data-action="set-card"][data-id="'+cardId+'"]').click();
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  await page.locator('input[data-event-choice][data-event="'+eventId+'"][value="option1"]').click();
  const routes=await page.evaluate(({cardId,eventId})=>{
   const saved=JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1'));
   return window.UmaCore.directRoutes(window.UmaDemoData.cardById[cardId],
    saved.decks.main[0].slots[0]).filter(r=>r.source==='event'&&r.eventId===eventId)
    .map(r=>({skillId:r.skillId,level:r.level}));
  },{cardId,eventId});
  assert.deepEqual(routes,[{skillId:'hint:架空ヒント',level:2}]);
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('APPROVED_BULK_SYNTHETIC_PAGES_AUTOLOAD='+JSON.stringify({
   status:'PASS',cards:563,events:2512,publicSameOriginFetch:true,
   noManualFileChooser:true,branchChoiceAndSkillRouteChecked:true,
   onlyInventedRecords:true,realEventRightsApproved:false
  }));
 }finally{
  await browser?.close();
  await new Promise(ok=>web.close(ok));
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={main};
