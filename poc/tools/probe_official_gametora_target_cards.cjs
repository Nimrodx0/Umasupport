#!/usr/bin/env node
'use strict';
/*
 * Explicit, read-only, bounded original-GameTora browser probe.
 *
 * Input is the output of plan_new_card_event_intake.cjs. It visits at most
 * two still-pending card pages, discovered from one visible GameTora index.
 * Nothing is approved, written to the app DB, or exported as source HTML.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {registryFromSkillText}=
 require('../src/official_gametora_skill_id_crosswalk.cjs');
const {extractRoutePieces}=
 require('../src/official_gametora_route_dom_extractor.cjs');
const {assembleLiveEvent}=
 require('../src/official_gametora_live_event_assembler.cjs');
const {projectNewCardSite,summarizeCardProjection}=
 require('../src/official_gametora_private_schema_projection.cjs');
const {LISTING,selectIntakeTargets,resolveListedPages}=
 require('../src/official_gametora_new_card_locator.cjs');
const fail=s=>{throw Error('GameTora新カード汎用Chrome検査: '+s);};
const SHA='0c6ea6d72b037b24ee40860f73b0e86db47aab1d';
async function getRobots(){
 const response=await fetch('https://gametora.com/robots.txt',{
  headers:{'User-Agent':'Umasupport-readonly-new-card-probe/0.1'},
  redirect:'manual',signal:AbortSignal.timeout(20000)
 });
 if(response.status!==200)fail('robots.txt HTTP '+response.status+'。追加訪問を中止');
 const type=response.headers.get('content-type')||'';
 if(!type.includes('text/plain'))fail('robots.txtの形式が不明');
 const text=await response.text();
 if(text.length>100000)fail('robots.txtの取得サイズが不正');
 return text;
}
function getSkillRegistry(file){
 const bytes=fs.readFileSync(file);
 if(bytes.byteLength>6*1024*1024)fail('独立辞書がサイズ上限を超過');
 const blob=crypto.createHash('sha1').update('blob '+bytes.length+'\0')
  .update(bytes).digest('hex');
 if(blob!==SHA)fail('独立UmaSimスキル辞書の固定版ハッシュが異なる');
 return registryFromSkillText(bytes.toString('utf8'));
}
async function inspect({plan,skillFile}={}){
 const selection=selectIntakeTargets(plan);
 if(!selection.targetCardIds.length)return {
  dataKind:'gametora-new-card-listing-probe',version:1,
  selectedCardIds:[],unvisitedCardIds:[],results:[],pendingCardIds:[],
  sourceSiteCardVisitsPerformed:0,existingDatabaseUnchanged:true,
  sourceSiteTextCopied:false,publicationApproved:false
 };
 const registry=getSkillRegistry(skillFile);
 const robots=await getRobots();
 const allowed=address=>{
  const path=new URL(address).pathname;
  if(robotsDisallows(robots,path).length)
   fail('robots.txtによる取得制限のため中止');
 };
 allowed(LISTING);
 const {chromium}=require('playwright');
 const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox']});
 let cardVisits=0;
 try{
  const context=await browser.newContext({locale:'ja-JP'});
  const page=await context.newPage();
  let blocked=false;
  page.on('response',res=>{
   if([403,429].includes(res.status()))blocked=true;
  });
  await page.route('**/*',route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.protocol!=='https:'||u.hostname!=='gametora.com'||
      ['image','font','media'].includes(req.resourceType()))
    return route.abort();
   return route.continue();
  });
  const goto=async url=>{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   if(!response||response.status()!==200||blocked||
      response.url()!==url)
    fail('元サイト取得・HTTP・URL検証に失敗。追加訪問中止');
   await page.waitForTimeout(2500);
   if(blocked)fail('元サイトが取得を制限。追加訪問中止');
  };
  await goto(LISTING);
  const hrefs=await page.locator('a[href]').evaluateAll(anchors=>
   anchors.map(a=>a.getAttribute('href')||''));
  if(!hrefs.length||hrefs.length>10000)
   fail('一覧画面のリンクが読み取れない。未掲載とは判定しない');
  const pages=resolveListedPages({
   targetCardIds:selection.targetCardIds,hrefs
  });
  const results=[];
  for(const entry of pages){
   if(entry.status!=='listed'){
    results.push({cardId:entry.cardId,status:'not-listed-yet',
     publishedEventCount:0,publicationApproved:false});
    continue;
   }
   allowed(entry.url);
   await page.waitForTimeout(6000);
   blocked=false;
   await goto(entry.url);
   cardVisits++;
   const buttons=page.locator('section button[aria-expanded]');
   const panels=await buttons.count();
   if(panels===0){
    results.push({cardId:entry.cardId,status:'no-visible-event-panels',
     siteEventPanelCount:0,publicationApproved:false});
    continue;
   }
   if(panels>20)fail('イベントパネル20件超。途中まで取得して完了扱いしない');
   const observations=[];
   for(let i=0;i<panels;i++){
    const button=buttons.nth(i);
    if((await button.getAttribute('aria-expanded'))!=='true')
     await button.click({timeout:5000});
    await page.waitForTimeout(650);
    if(blocked)fail('取得制限によりイベントの途中読取を中止');
    const pieces=await button.evaluate(extractRoutePieces);
    observations.push(assembleLiveEvent({
     cardId:entry.cardId,siteEventOrdinal:i+1,routePieces:pieces,registry
    }));
   }
   if(observations.length!==panels)fail('表示イベントの途中欠損');
   const projected=projectNewCardSite({
    cardId:entry.cardId,siteEventPanelCount:panels,
    eventObservations:observations
   });
   const summary=summarizeCardProjection(projected);
   if(projected.intakeCandidate.convertedEventCount!==0||
      projected.intakeCandidate.events.length!==0||
      projected.intakeCandidate.unresolvedEventCount!==panels)
    fail('保留候補の公開ゲートを迂回');
   results.push({cardId:entry.cardId,status:'private-schema-only',
    ...summary});
  }
  return {
   dataKind:'gametora-new-card-listing-probe',version:1,
   selectedCardIds:selection.targetCardIds,
   unvisitedCardIds:selection.unvisitedCardIds,
   results,
   // Even structurally parsed cards remain queued UNTIL separately approved
   // and appended to the existing catalog. Never drop a pending card here.
   pendingCardIds:[
    ...selection.targetCardIds,...selection.unvisitedCardIds
   ],
   sourceSiteCardVisitsPerformed:cardVisits,
   existingDatabaseUnchanged:true,sourceSiteTextCopied:false,
   publicationApproved:false
  };
 }finally{await browser.close();}
}
async function main(args){
 if(args.length!==5||args[0]!=='--live'||args[1]!=='--plan'||
    args[3]!=='--skills')
  fail('使い方: --live --plan intake-plan.json --skills pinned-skill_data.txt');
 const input=fs.readFileSync(args[2],'utf8').trim();
 const prefix='NEW_CARD_EVENT_INTAKE_PLAN=';
 const plan=JSON.parse(input.startsWith(prefix)?input.slice(prefix.length):input);
 const outcome=await inspect({plan,skillFile:args[4]});
 process.stdout.write('GT_NEW_CARD_READONLY_PROBE='+JSON.stringify(outcome)+'\n');
}
if(require.main===module){
 main(process.argv.slice(2)).catch(e=>{
  process.stderr.write(String(e.message).slice(0,240)+'\n');process.exitCode=1;
 });
}
module.exports={getSkillRegistry,inspect};
