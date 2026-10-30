'use strict';
/*
 * Browser-check the real final 2,512-event private candidate without ever
 * persisting or uploading it. The file chooser receives in-memory bytes.
 * Playwright starts only in the explicitly opted-in fixed-source audit.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
function server(){
 return http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://127.0.0.1');
   if(req.method!=='GET')throw Error('method');
   const target=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));
   if(!target.startsWith(ROOT+path.sep))throw Error('path');
   const body=await fs.readFile(target);
   const contentType=target.endsWith('.html')?'text/html; charset=utf-8':
    target.endsWith('.js')?'text/javascript; charset=utf-8':
    target.endsWith('.json')?'application/json; charset=utf-8':
    target.endsWith('.css')?'text/css; charset=utf-8':'text/plain; charset=utf-8';
   res.writeHead(200,{'Content-Type':contentType,'Cache-Control':'no-store'});
   res.end(body);
  }catch{res.writeHead(404);res.end('Missing');}
 });
}
function pickSkillChoice(bundle){
 for(const card of bundle.catalog.cards){
  for(const e of card.events){
   if(e.type!=='choice'||e.requires||
      e.availabilityKind&&e.availabilityKind!=='standard')continue;
   for(const ch of e.choices||[]){
    if(!ch.outcomes?.length&&ch.rewards?.some(r=>r.kind!=='negative'&&r.skillId))
     return {cardId:card.cardId,eventId:e.id,choiceId:ch.id};
   }
  }
 }
 throw Error('実全件から普通のヒントを持つ独立選択式イベントを選べません');
}
async function run({bundle,skillText,supportText,validateProvisionalLabels=false}){
 if(bundle?.summary?.cards!==563||bundle?.summary?.events!==2512||
    typeof skillText!=='string'||typeof supportText!=='string')
  throw Error('実出典2,512件と辞書が必要');
 const sample=pickSkillChoice(bundle);
 const web=server();
 await new Promise((ok,fail)=>{web.once('error',fail);web.listen(0,'127.0.0.1',ok)});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[],unexpectedRequests=[];
  const base='http://127.0.0.1:'+web.address().port;
  page.on('pageerror',e=>errors.push(String(e.message)));
  page.on('request',r=>{
   const url=r.url();
   if(!url.startsWith(base)&&
      !url.includes('raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt')&&
      !url.includes('raw.githubusercontent.com/mee1080/umasim/main/data/skill_data.txt'))
    unexpectedRequests.push(url);
  });
  await page.route('**/data/support_card.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:supportText}));
  await page.route('**/data/skill_data.txt',r=>r.fulfill({
   status:200,contentType:'text/plain',body:skillText}));
  await page.goto(base+'/poc/live.html?eventPreview=local',{waitUntil:'load'});
  await page.locator('#private-local-event-file').waitFor({timeout:20000});
  assert.equal(await page.locator('main.app').count(),0);
  // An actual browser File chooser / File.text() roundtrip, but without a
  // filesystem snapshot, public server response, artifact, or upload.
  await page.locator('#private-local-event-file').setInputFiles({
   name:'private-events.local.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(bundle))
  });
  await page.locator('main.app').waitFor({timeout:30000});
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.previewEvents.records),2512);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.previewEvents.cards),563);
  assert.equal(await page.evaluate(()=>window.UmaDemoData.meta.reviewedEventRecords),0);
  assert.equal(await page.evaluate(()=>window.UmaPreviewActive),true);
  assert.match(await page.locator('#candidate-preview-warning').innerText(),/未承認イベントの試用モード/);
  if(validateProvisionalLabels){
   const checked=await page.evaluate(({cardId,eventId})=>{
    const events=window.UmaDemoData.cards.flatMap(c=>c.events);
    let choiceLabels=0,outcomeLabels=0,incorrectChoices=0,incorrectOutcomes=0;
    const scan=(part)=>{
     for(const out of part.outcomes||[]){
      outcomeLabels++;
      if(!/^結果[1-9]\\d*（仮）$/.test(out.label))incorrectOutcomes++;
      scan(out);
     }
    };
    for(const e of events){
     for(const ch of e.choices||[]){
      choiceLabels++;
      if(!/^選択肢[1-9]\\d*（仮）$/.test(ch.label))incorrectChoices++;
      scan(ch);
     }
     if(e.type==='auto')scan(e);
    }
    return {events:events.length,choiceLabels,outcomeLabels,
     incorrectChoices,incorrectOutcomes,
     sampleTitle:window.UmaDemoData.cardById[cardId].events
      .find(e=>e.id===eventId)?.name};
   },{cardId:sample.cardId,eventId:sample.eventId});
   // Do not print original headings even on assertion failure.
   const expected=bundle.catalog.cards.find(c=>c.cardId===sample.cardId).events
    .find(e=>e.id===sample.eventId).name;
   if(checked.events!==2512||checked.choiceLabels!==3269||
      checked.outcomeLabels!==512||checked.incorrectChoices!==0||
      checked.incorrectOutcomes!==0||checked.sampleTitle!==expected)
    throw Error('ブラウザでイベント見出し保持・全仮称の表記契約が不一致');
  }
  const realCard=await page.evaluate(id=>window.UmaDemoData.cardById[id].name,sample.cardId);
  await page.locator('button[data-action="pick"][data-deck="main"][data-index="0"]').click();
  await page.locator('#picker-search').fill(realCard);
  await page.locator('button[data-action="set-card"][data-id="'+sample.cardId+'"]').click();
  await page.locator('button[data-action="edit-card"][data-deck="main"][data-index="0"]').click();
  if(validateProvisionalLabels){
   const names=await page.locator('input[data-event-choice][data-event="'+sample.eventId+'"]')
    .evaluateAll(els=>els.map(el=>el.closest('label')?.innerText||''));
   if(!names.some(x=>x.includes('選択肢1（仮）')))
    throw Error('実ブラウザのイベント編集UIに選択肢の仮称が表示されていない');
  }
  await page.locator('input[data-event-choice][data-event="'+sample.eventId+'"][value="'+sample.choiceId+'"]').click();
  const selected=await page.evaluate(({cardId,eventId})=>{
   const key='uma-support-lab-runtime-umasim-v1-event-preview-local-'+
     window.UmaPrivateLocalEventDigest.slice(0,16);
   const saved=JSON.parse(localStorage.getItem(key));
   const slot=saved?.decks?.main?.[0]?.slots?.[0];
   const card=window.UmaDemoData.cardById[cardId];
   return {normalKey:localStorage.getItem('uma-support-lab-runtime-umasim-v1'),
    selectedRoutes:window.UmaCore.directRoutes(card,slot)
     .filter(r=>r.source==='event'&&r.eventId===eventId).length,
    selectedSlotCard:slot?.cardId};
  },{cardId:sample.cardId,eventId:sample.eventId});
  assert.equal(selected.selectedSlotCard,sample.cardId);
  assert.ok(selected.selectedRoutes>0,'選択した実イベントのスキル候補が0件');
  assert.equal(selected.normalKey,null);
  await page.goto(base+'/poc/live.html',{waitUntil:'load'});
  await page.locator('main.app').waitFor({timeout:20000});
  assert.equal(await page.evaluate(id=>window.UmaDemoData.cardById[id].events.length,
   sample.cardId),0);
  assert.equal(await page.locator('#candidate-preview-warning').count(),0);
  assert.deepEqual(errors,[]);
  assert.deepEqual(unexpectedRequests,[]);
  await context.close();
  return {status:'REAL_2512_CHROMIUM_LOCAL_IMPORT_PASS',
   cards:563,events:2512,oneRealSelectedSkillRouteValidated:true,
   normalSettingsUnchanged:true,normalPublicCatalogUnchanged:true,
   sourceDataNotUploaded:true,sourceDataWrittenToDisk:false,
   fullProvisionalLabelContractVerified:validateProvisionalLabels,
   publicationApproved:false};
 }finally{
  await browser?.close();
  await new Promise(ok=>web.close(ok));
 }
}
module.exports={run};
