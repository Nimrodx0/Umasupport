'use strict';
/*
 * New-card admission gate, fixed two-card and read-only. Page HTML, source
 * strings, images and JSON do not leave process memory. No event ingest here.
 */
const {chromium}=require('playwright');
const {TARGETS,pageUrl,robotsDisallows}=require('../src/official_gametora_probe.cjs');
const NEW_CARD_IDS=Object.freeze(['30322','30323']);
const fail=s=>{throw Error('GameTora新サポカ限定表示検査: '+s);};
function validateTargets(targets){
 if(!Array.isArray(targets)||targets.length!==2||
    targets.some((t,i)=>t?.cardId!==NEW_CARD_IDS[i]||
     !TARGETS.some(x=>x.cardId===t.cardId&&x.slug===t.slug)))
  fail('対象カードが固定2枚以外');
 return targets;
}
function summarizeEvents(visible){
 if(!visible||typeof visible!=='object'||
    !Number.isSafeInteger(visible.accordionButtons)||
    !Number.isSafeInteger(visible.trainingSections)||
    !Number.isSafeInteger(visible.chainSections)||
    !Number.isSafeInteger(visible.randomSections)||
    !Number.isSafeInteger(visible.outingSections))
  fail('画面構造が不正');
 return {
  supportEventAccordions:visible.accordionButtons,
  trainingSectionCount:visible.trainingSections,
  chainSectionCount:visible.chainSections,
  randomSectionCount:visible.randomSections,
  outingSectionCount:visible.outingSections,
  eventRewardRoutesVerified:false,
  choiceWordingVerified:false,
  independentSkillIdVerified:false,
  gameCurrentnessVerified:false,
  publicationApproved:false
 };
}
async function ensureAllowedByRobots(){
 const response=await fetch('https://gametora.com/robots.txt',{
  headers:{'User-Agent':'Umasupport-source-feasibility/0.1 (2-card metadata-only browser check)'},
  redirect:'manual',signal:AbortSignal.timeout(20000)
 });
 if(response.status!==200)fail('robots.txtを取得できませんでした HTTP '+response.status);
 const text=await response.text();
 if(text.length>100000)fail('robots.txtが想定外の長さ');
 return text;
}
async function probe(){
 const targets=validateTargets(TARGETS.filter(t=>NEW_CARD_IDS.includes(t.cardId)));
 const robots=await ensureAllowedByRobots();
 for(const target of targets){
  if(robotsDisallows(robots,new URL(pageUrl(target)).pathname).length)
   fail('robots.txtでカードページの取得を許可していません');
 }
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 const observed=[];
 try{
  const context=await browser.newContext({locale:'ja-JP'});
  const page=await context.newPage();
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.protocol!=='https:'||url.hostname!=='gametora.com'||
      ['image','font','media'].includes(request.resourceType()))
    return route.abort();
   return route.continue();
  });
  let forbidden=false;
  page.on('response',response=>{if([403,429].includes(response.status()))forbidden=true;});
  for(const [i,target] of targets.entries()){
   if(i)await page.waitForTimeout(6000);
   forbidden=false;
   const response=await page.goto(pageUrl(target),{waitUntil:'domcontentloaded',timeout:30000});
   if(!response||response.status()!==200||forbidden)
    fail('指定カードの画面表示に失敗 HTTP '+(response?.status()||'no response'));
   await page.waitForTimeout(3500);
   if(forbidden)fail('403/429により追加処理を中止');
   const counters=await page.evaluate(()=>{
    const parts=[...document.querySelectorAll('section')].map(el=>({
     heading:el.querySelector('h2,h3,h4')?.innerText||'',
     accordions:el.querySelectorAll('button[aria-expanded]').length
    }));
    const categories={chainSections:0,randomSections:0,outingSections:0,
     trainingSections:0,accordionButtons:0};
    for(const p of parts){
     if(/連続イベント|Chain Events/i.test(p.heading))categories.chainSections++;
     if(/ランダムイベント|Random Events/i.test(p.heading))categories.randomSections++;
     if(/お出かけイベント|Outing Events/i.test(p.heading))categories.outingSections++;
     if(/育成イベント|Training Events/i.test(p.heading))categories.trainingSections++;
    }
    categories.accordionButtons=document.querySelectorAll('section button[aria-expanded]').length;
    return categories;
   });
   observed.push({
    cardId:target.cardId,
    pageReceived200:true,
    pageRenderedInChrome:true,
    ...summarizeEvents(counters)
   });
  }
  return {
   source:'https://gametora.com',
   purpose:'new-card-render-coverage-only',
   targetCount:targets.length,
   observations:observed,
   fullEventCoverageClaimed:false,
   automaticAcquisitionAuthorized:false,
   publicationApproved:false
  };
 }finally{await browser.close();}
}
if(require.main===module){
 if(process.argv.length!==3||process.argv[2]!=='--live-new-cards')
  fail('明示的な --live-new-cards が必要');
 probe().then(x=>process.stdout.write('OFFICIAL_GT_NEW_CARDS='+JSON.stringify(x)+'\n'))
 .catch(e=>{process.stderr.write(e.message.slice(0,200)+'\n');process.exitCode=1;});
}
module.exports={validateTargets,summarizeEvents,probe};
