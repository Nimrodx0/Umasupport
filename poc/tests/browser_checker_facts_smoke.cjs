'use strict';
/* Real Chromium: all 417 local fact cards, 879 conditional candidate events,
 * opt-in selection and isolation from the normal app. All third-party card
 * and skill source fetches are synthetic; local fact DB is deterministically
 * derived from the committed pinned numerical source. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const {build}=require('../src/choice_result_facts.cjs');
const raw=require('../data/candidates/checker_event_hints.v1.json');
const facts=build(raw);
const ids=facts.cards.map(c=>c.cardId);
const extra=Array.from({length:563-ids.length},(_,i)=>String(40001+i));
const all=[...ids,...extra];
assert.equal(all.length,563);
const ROOT=path.resolve(__dirname,'../..');
function supportData(){
 const out=[];
 for(let n=0;n<all.length;n++){
  const id=all[n];
  for(let stage=0;stage<5;stage++){
   const v=Array(62).fill('');
   v[0]=id;v[1]='[架空'+id+']サポカ'+id;
   v[3]='3';v[4]=String(stage);v[6]='スピード';
   for(let k=7;k<=58;k++)v[k]='0';
   v[23]='0';v[24]='10';v[49]='0';v[50]='0';
   out.push(v.join('\t'));
  }
 }
 return out.join('\n');
}
const numericIds=[...new Set(facts.cards.flatMap(c=>c.events.flatMap(e=>
 e.choices.flatMap(ch=>ch.resultCandidates.flatMap(result=>
  result.skillHints.map(s=>s.skillId))))))];
const dictRows=numericIds.map((id,i)=>({
 id,name:'架空数値スキル'+id,rarity:'normal',group:10000+i}));
for(const p of require('../src/skill_hierarchy.js').PAIRS){
 if(!numericIds.includes(p.goldId)&&!numericIds.includes(p.whiteId))continue;
 for(const [id,name,rarity] of [[p.goldId,p.goldName,'rare'],[p.whiteId,p.whiteName,'normal']]){
  let row=dictRows.find(x=>x.id===id);
  if(!row){row={id};dictRows.push(row);}
  Object.assign(row,{name,rarity,group:p.group});
 }
}
const skills=JSON.stringify(dictRows);
function serve(){
 return http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   const file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
   if(!file.startsWith(ROOT+path.sep))throw Error('path traversal');
   const body=await fs.readFile(file);
   const type=file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':
    file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/plain';
   res.writeHead(200,{'Content-Type':type});res.end(body);
  }catch{res.writeHead(404);res.end('Missing')}
 });
}
async function boot(page,url){
 await page.goto(url,{waitUntil:'load'});
 await page.locator('#app main.app').waitFor({timeout:20000});
}
async function main(){
 const server=serve();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext(),page=await context.newPage();
  await page.route('**/data/support_card.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:supportData()}));
  await page.route('**/data/skill_data.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:skills}));
  await page.route('**/data/candidates/checker_choice_results.v1.json',r=>r.fulfill({
   status:200,contentType:'application/json',body:JSON.stringify(facts)}));
  await boot(page,origin+'/poc/live.html?eventPreview=facts');
  const snapshot=await page.evaluate(()=>({
   active:window.UmaPreviewActive,meta:window.UmaDemoData.meta.previewEvents,
   publicEvents:window.UmaDemoData.meta.reviewedEventRecords,
   totalCards:window.UmaDemoData.cards.length,
   sourceMode:window.UmaDemoData.meta.runtimeSources.events.mode
  }));
  assert.equal(snapshot.active,true);
  assert.equal(snapshot.meta.records,879);
  assert.equal(snapshot.meta.cards,398);
  assert.equal(snapshot.meta.numericSourceFacts.matchedHints,1077);
  assert.equal(snapshot.publicEvents,0);
  assert.equal(snapshot.totalCards,563);
  assert.equal(snapshot.sourceMode,'preview');
  assert.match(await page.locator('#candidate-preview-warning').innerText(),/未承認イベントの試用モード/);
  const target=facts.cards.find(c=>c.events.some(e=>e.candidateStatus==='numeric-choice-candidate')).cardId;
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await page.locator('#picker-search').fill('サポカ'+target);
  await page.locator('button[data-action="set-card"][data-id="'+target+'"]').click();
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  const ev=page.locator('.modal-body .event').first();
  assert.match(await ev.innerText(),/候補位置/);
  await ev.locator('input[data-event-choice][value="option1"]').click();
  const recorded=await page.evaluate(()=>{
   const slot=JSON.parse(localStorage.getItem('uma-support-lab-runtime-umasim-v1-event-preview-facts'))
    .decks.main[0].slots[0];
   return window.UmaCore.directRoutes(window.UmaDemoData.cardById[slot.cardId],slot)
    .filter(r=>r.source==='event');
  });
  assert.ok(recorded.length>0);
  assert.ok(recorded.every(r=>r.conditional===true&&r.condition.includes('結果未区分')));
  assert.equal(await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1')),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('uma-support-lab-runtime-umasim-v1-event-preview')),null);
  await boot(page,origin+'/poc/live.html');
  assert.equal(await page.evaluate(()=>window.UmaPreviewActive),false);
  assert.equal(await page.evaluate(id=>window.UmaDemoData.cardById[id].events.length,target),0);
  assert.equal(await page.locator('#candidate-preview-warning').count(),0);
  await context.close();
  console.log('PASS: actual Chromium 398 card/879 event preview, conditional-only routes and isolated normal data');
 }finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
