'use strict';
/*
 * One support-card page, as a normal browser user sees it. No page text,
 * choice labels, screenshots, HTML, response bodies or JSON are persisted.
 * This does not bypass site protections or run as a recurring crawler.
 */
const {chromium}=require('playwright');
const {TARGETS,pageUrl}=require('../src/official_gametora_probe.cjs');
const fail=s=>{throw Error('GameToraブラウザ実地調査: '+s);};
function classifyJson(root){
 const totals={eventKeys:0,choiceArrays:0,outcomeArrays:0,effectArrays:0,
  numericSkillIdFields:0,recordsWithChoicesAndSection:0};
 const queue=[root];let idx=0;
 while(idx<queue.length&&idx<70000){
  const value=queue[idx++];
  if(!value||typeof value!=='object')continue;
  if(Array.isArray(value)){
   for(const n of value)if(n&&typeof n==='object')queue.push(n);
   continue;
  }
  const keys=Object.keys(value);
  if(Array.isArray(value.choices)&&('section' in value||'event_id' in value||'id' in value))
   totals.recordsWithChoicesAndSection++;
  for(const key of keys){
   const k=key.toLowerCase(),item=value[key];
   if(/events?|eventdata|trainingevents/.test(k))totals.eventKeys++;
   if(/choices?/.test(k)&&Array.isArray(item))totals.choiceArrays++;
   if(/outcomes?|resultgroups?/.test(k)&&Array.isArray(item))totals.outcomeArrays++;
   if(/effects?|rewards?/.test(k)&&Array.isArray(item))totals.effectArrays++;
   if(/^(skill_?id|skillnumericid)$/.test(k)&&typeof item==='number')
    totals.numericSkillIdFields++;
   if(item&&typeof item==='object')queue.push(item);
  }
 }
 return totals;
}

async function probe(){
 const target=TARGETS[0]; // only the old, already-listed 30001 card
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({locale:'ja-JP'});
  const page=await context.newPage();
  const network={sameOriginFetchOrXhr:0,jsonResponses:0,blockedResponses:0};
  const jsonTasks=[];
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
    if((response.headers()['content-type']||'').includes('json')){
     network.jsonResponses++;
     const length=Number(response.headers()['content-length']||0);
     if(jsonTasks.length<35&&(!length||length<=2*1024*1024))
      jsonTasks.push(response.json().then(classifyJson).catch(()=>null));
    }
   }
   if([403,429].includes(response.status()))network.blockedResponses++;
  });
  const response=await page.goto(pageUrl(target),{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||[403,429].includes(response.status()))fail('アクセス制限。追加試行を行わない');
  if(response.status()!==200)fail('HTTP '+response.status());
  await page.waitForTimeout(3500);
  const text=await page.locator('body').innerText();
  const shapes=await Promise.all(jsonTasks);
  const annotated=shapes.filter(Boolean);
  const hit=key=>annotated.filter(shape=>shape[key]>0).length;
  const total=key=>annotated.reduce((sum,shape)=>sum+shape[key],0);
  const visible={
   cardId:target.cardId,
   trainingEventLabelVisible:/育成イベント|Training Events/.test(text),
   chainLabelVisible:/連続イベント|Chain Events/.test(text),
   randomLabelVisible:/ランダムイベント|Random Events/.test(text),
   totalRenderedButtons:await page.locator('button').count(),
   sameOriginFetchOrXhr:network.sameOriginFetchOrXhr,
   jsonResponses:network.jsonResponses,
   jsonBodiesInspected:annotated.length,
   responseShapeSignals:{
    withEventKeys:hit('eventKeys'),
    withChoiceArrays:hit('choiceArrays'),
    withOutcomeArrays:hit('outcomeArrays'),
    withEffectArrays:hit('effectArrays'),
    withNumericSkillIdFields:hit('numericSkillIdFields'),
    withEventLikeRecords:hit('recordsWithChoicesAndSection'),
    eventLikeRecordsTotal:total('recordsWithChoicesAndSection')
   },
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
