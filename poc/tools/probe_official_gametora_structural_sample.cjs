#!/usr/bin/env node
'use strict';
/*
 * Bounded, read-only diagnostic for different original GameTora DOM shapes.
 * This is NOT a new-card intake source, public data, or a release gate pass.
 * Fixed diagnostic card IDs are isolated here, never in the generic parser.
 * Only numeric/card/event-position summaries leave volatile browser memory.
 */
const fs=require('node:fs');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {LISTING,resolveListedPages}=require('../src/official_gametora_new_card_locator.cjs');
const {getSkillRegistry}=require('./probe_official_gametora_target_cards.cjs');
const {extractRoutePieces}=require('../src/official_gametora_route_dom_extractor.cjs');
const {assembleLiveEvent,summarizeLiveEvent}=
 require('../src/official_gametora_live_event_assembler.cjs');
const {projectNewCardSite,summarizeCardProjection}=
 require('../src/official_gametora_private_schema_projection.cjs');

const COHORT=Object.freeze(['30030','30041','30080']);
const fail=message=>{throw Error('GameTora構造別限定監査: '+message);};
function parseCardScope(value){
 if(typeof value!=='string')fail('カード対象の形式が不正');
 const ids=value.split(',');
 if(!ids.length||ids.length>2||new Set(ids).size!==ids.length||
    ids.some(id=>!COHORT.includes(id)))fail('対象は構造別の既知カードから最大2枚');
 return ids;
}

// INDEPENDENT DOM census: count raw text nodes, not results of extractRoutePieces,
// numeric parsers, prior mirrors or card-specific conditionals. This is still
// a limited observation of the same page, not an independent game truth source.
function rawPanelCensus(button){
 const panel=[...button.parentElement.children].find(x=>x.tagName==='DIV');
 const body=panel?.firstElementChild?.firstElementChild?.firstElementChild
  ?.firstElementChild?.children?.[1];
 const own=el=>[...el.childNodes].filter(n=>n.nodeType===3)
  .map(n=>n.textContent||'').join('').trim();
 const leaves=body?[body,...body.querySelectorAll('*')]:[];
 const text=leaves.map(own).filter(Boolean);
 return {
  panelVisible:!!panel,
  bodyFound:!!body,
  bodyGroupCount:body?.children.length||0,
  orLeafCount:leaves.filter(el=>el.children.length===0&&
   /^(?:OR|または|又は)$/i.test((el.innerText||'').trim())).length,
  signedOwnTextCount:text.filter(t=>/[+＋\-－−]\s*\d/.test(t)).length,
  directLikeOwnTextCount:text.filter(t=>/(?:獲得|習得|取得)/.test(t)).length,
  explicitFlowOwnTextCount:text.filter(t=>
   /(?:連続|イベントチェーン|お出かけ|おでかけ)/.test(t)&&
   /(?:打ち切り|終了|中断|発生しない|可能|解放|できるようになる)/.test(t)).length,
  // Distinguish a genuinely empty panel from a nonempty DOM whose expected
  // results subtree moved or was missed by the generic adapter.
  panelHasText:!!(panel?.innerText||'').trim()
 };
}
function compareIndependentCensus(census,pieces){
 if(!Array.isArray(pieces))fail('結果行が不正');
 const groups=new Set(pieces.map(r=>r.choiceOrdinal)).size;
 const signed=pieces.reduce((sum,r)=>sum+r.numericEffectTexts.length,0);
 const detectedOr=pieces.length-groups;
 const discrepancies=[];
 if(!census.bodyFound&&census.panelHasText)
  discrepancies.push('nonempty-panel-without-recognized-body');
 if(census.bodyFound&&census.bodyGroupCount!==groups)
  discrepancies.push('site-group-to-extractor-count-diff');
 if(census.orLeafCount!==detectedOr)
  discrepancies.push('site-or-to-extractor-count-diff');
 if(census.signedOwnTextCount!==signed)
  discrepancies.push('site-signed-leaf-to-extractor-count-diff');
 return {rawGroups:census.bodyGroupCount,
  rawOrLeaves:census.orLeafCount,
  rawSignedLeaves:census.signedOwnTextCount,
  parsedGroups:groups,parsedRoutes:pieces.length,
  parsedSignedLeaves:signed,discrepancies};
}
async function inspect({ids,skillFile}={}){
 if(!Array.isArray(ids)||ids.length<1||ids.length>2||
    ids.some(x=>!COHORT.includes(x))||new Set(ids).size!==ids.length)
  fail('対象外のカードを要求');
 const registry=getSkillRegistry(skillFile);
 const robotsResponse=await fetch('https://gametora.com/robots.txt',{
  headers:{'User-Agent':'Umasupport-structural-audit/0.1'},
  redirect:'manual',signal:AbortSignal.timeout(20000)
 });
 if(robotsResponse.status!==200||
    !(robotsResponse.headers.get('content-type')||'').includes('text/plain'))
  fail('robots.txt取得失敗、監査を中止');
 const robots=await robotsResponse.text();
 if(robots.length>100000)fail('robotsがサイズ上限超過');
 const allowed=url=>{
  if(robotsDisallows(robots,new URL(url).pathname).length)
   fail('robotsにより訪問禁止');
 };
 allowed(LISTING);
 const {chromium}=require('playwright');
 const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox']});
 let visited=0;
 try{
  const page=await browser.newPage({locale:'ja-JP'});
  let blocked=false;
  page.on('response',r=>{if([403,429].includes(r.status()))blocked=true;});
  await page.route('**/*',route=>{
   const r=route.request(),url=new URL(r.url());
   if(url.protocol!=='https:'||url.hostname!=='gametora.com'||
      ['image','font','media'].includes(r.resourceType()))
    return route.abort();
   return route.continue();
  });
  const goto=async url=>{
   const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   if(!r||r.status()!==200||r.url()!==url||blocked)
    fail('HTTP・リダイレクト・取得制限が不適切');
   await page.waitForTimeout(2500);
   if(blocked)fail('アクセス制限が発生したため停止');
  };
  await goto(LISTING);
  const hrefs=await page.locator('a[href]').evaluateAll(nodes=>
   nodes.map(n=>n.getAttribute('href')||''));
  if(!hrefs.length||hrefs.length>10000)fail('一覧のリンクが取得できない');
  const entries=resolveListedPages({targetCardIds:ids,hrefs});
  const results=[];
  for(const item of entries){
   if(item.status!=='listed'){
    results.push({cardId:item.cardId,status:'not-listed-in-observed-index',
     complete:false,publicationApproved:false});continue;
   }
   allowed(item.url);
   await page.waitForTimeout(6000);
   blocked=false;
   await goto(item.url);
   visited++;
   const buttons=page.locator('section button[aria-expanded]');
   const count=await buttons.count();
   if(!count||count>20)fail('イベントの表示件数が0または上限20超');
   const events=[],observations=[];
   for(let i=0;i<count;i++){
    const button=buttons.nth(i);
    if((await button.getAttribute('aria-expanded'))!=='true')
     await button.click({timeout:5000});
    await page.waitForTimeout(650);
    if(blocked)fail('監査中に元サイトが取得制限');
    const raw=await button.evaluate(rawPanelCensus);
    if(!raw.panelVisible)fail('パネルが存在しない');
    try{
     const pieces=await button.evaluate(extractRoutePieces);
     const compared=compareIndependentCensus(raw,pieces);
     const observed=assembleLiveEvent({
      cardId:item.cardId,siteEventOrdinal:i+1,routePieces:pieces,registry
     });
     observations.push(observed);
     const summary=summarizeLiveEvent(observed);
     events.push({ordinal:i+1,status:summary.status,
      ...compared,
      unparsedNumericFacts:summary.unparsedNumericFacts??null,
      excludedNonScalarNumericFacts:summary.excludedNonScalarNumericFacts??null,
      unresolvedHintRows:summary.unresolvedHintRows??null,
      unresolvedDirectLikeTexts:summary.unresolvedDirectLikeTexts??null,
      flowMarkers:summary.visibleFlowMarkers??null});
    }catch{
     // An arbitrary DOM/parser error is never a "no reward" or a successful
     // conversion. Do not accidentally log raw source prose in exceptions.
     events.push({ordinal:i+1,status:'generic-parser-rejected',
      rawGroups:raw.bodyGroupCount,rawOrLeaves:raw.orLeafCount,
      rawSignedLeaves:raw.signedOwnTextCount,discrepancies:['parser-error']});
    }
   }
   if(events.length!==count)fail('全パネルを調査できなかった');
   let projection=null;
   if(observations.length===count){
    const preview=projectNewCardSite({cardId:item.cardId,
     siteEventPanelCount:count,eventObservations:observations});
    if(preview.intakeCandidate?.convertedEventCount!==0||
       preview.intakeCandidate.events?.length!==0)
     fail('非公開境界が破られた');
    projection=summarizeCardProjection(preview);
   }
   const unread=events.filter(e=>e.status!=='unified-unapproved');
   const discrepant=events.filter(e=>e.discrepancies.length>0);
   results.push({cardId:item.cardId,status:'diagnostic-only',
    sourceEventPanels:count,routeBearingPanels:count-unread.length,
    nonUnifiedPanels:unread.length,independentCensusMismatchPanels:discrepant.length,
    eventDiagnostics:events,projection,
    complete:false,publicationApproved:false});
  }
  return {dataKind:'gametora-structural-cross-cohort-diagnostic',version:1,
   selectedCardIds:ids,visitedCardPages:visited,results,
   sourceTextCopied:false,existingDatabaseUnchanged:true,
   publicationApproved:false,adapterGatePassed:false};
 }finally{await browser.close();}
}
async function main(args){
 if(args.length!==5||args[0]!=='--live'||args[1]!=='--cards'||args[3]!=='--skills')
  fail('使い方: --live --cards 30030,30041 --skills pinned.txt');
 const report=await inspect({ids:parseCardScope(args[2]),skillFile:args[4]});
 process.stdout.write('GT_CROSS_COHORT_DIAGNOSTIC='+JSON.stringify(report)+'\n');
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 process.stderr.write(String(e.message).slice(0,240)+'\n');process.exitCode=1;
});
module.exports={COHORT,parseCardScope,compareIndependentCensus,rawPanelCensus,inspect};
