'use strict';
/*
 * One support-card page, as a normal browser user sees it. No page text,
 * choice labels, screenshots, HTML, response bodies or JSON are persisted.
 * This does not bypass site protections or run as a recurring crawler.
 */
const {chromium}=require('playwright');
const {TARGETS,pageUrl}=require('../src/official_gametora_probe.cjs');
const fail=s=>{throw Error('GameToraブラウザ実地調査: '+s);};
async function probe(){
 const target=TARGETS[0]; // only the old, already-listed 30001 card
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({locale:'ja-JP'});
  const page=await context.newPage();
  const network={sameOriginFetchOrXhr:0,jsonResponses:0,blockedResponses:0};
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!['https:'].includes(url.protocol)||
      ![ 'gametora.com' ].includes(url.hostname)||
      ['image','font','media'].includes(req.resourceType()))
    return route.abort();
   return route.continue();
  });
  page.on('response',response=>{
   const req=response.request();
   if(['fetch','xhr'].includes(req.resourceType())){
    network.sameOriginFetchOrXhr++;
    if((response.headers()['content-type']||'').includes('json'))network.jsonResponses++;
   }
   if([403,429].includes(response.status()))network.blockedResponses++;
  });
  const response=await page.goto(pageUrl(target),{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||[403,429].includes(response.status()))fail('アクセス制限。追加試行を行わない');
  if(response.status()!==200)fail('HTTP '+response.status());
  await page.waitForTimeout(3500);
  const text=await page.locator('body').innerText();
  const visible={
   cardId:target.cardId,
   trainingEventLabelVisible:/育成イベント|Training Events/.test(text),
   chainLabelVisible:/連続イベント|Chain Events/.test(text),
   randomLabelVisible:/ランダムイベント|Random Events/.test(text),
   totalRenderedButtons:await page.locator('button').count(),
   sameOriginFetchOrXhr:network.sameOriginFetchOrXhr,
   jsonResponses:network.jsonResponses,
   blockedResponses:network.blockedResponses,
   fullChoiceOutcomeCoverageVerified:false,
   publishing:false
  };
  if(network.blockedResponses)fail('403/429を受信。追加操作を行わない');
  // Optional one visible user action, only if the expected known old
  // support-card event is present. Never log its original label or text.
  const firstKnownEvent=page.getByRole('button',{name:/蹄鉄で/}).first();
  const found=(await firstKnownEvent.count())>0;
  visible.oneKnownEventControlPresent=found;
  if(found){
   const before=text.length;
   await firstKnownEvent.click({timeout:5000});
   const after=(await page.locator('body').innerText()).length;
   visible.eventExpansionChangedRenderedTextLength=before!==after;
  }else visible.eventExpansionChangedRenderedTextLength=null;
  return visible;
 }finally{await browser.close();}
}
if(require.main===module){
 if(process.argv.length!==3||process.argv[2]!=='--live-browser')
  fail('明示的な --live-browser が必要');
 probe().then(result=>process.stdout.write('OFFICIAL_GT_BROWSER='+JSON.stringify(result)+'\n'))
 .catch(e=>{process.stderr.write(String(e.message).slice(0,220)+'\n');process.exitCode=1;});
}
module.exports={probe};
