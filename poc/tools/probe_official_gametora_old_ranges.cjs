'use strict';
/*
 * Two known, immutable historical cards only. Open the original GameTora
 * website in a real Chrome session, inspect one existing event per card and
 * print structural/numeric metrics only. Never persist HTML or site wording.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {inspectVisibleRange}=require('../src/official_gametora_old_range_dom.cjs');
const {EXPECTED}=require('../src/official_gametora_old_structural_cohorts.cjs');
const PINS=[
 {id:'30030',url:'https://gametora.com/ja/umamusume/supports/30030-matikanetannhauser',
  blob:'95d6692825af1d7774b0382245016433660509c9'},
 {id:'30041',url:'https://gametora.com/ja/umamusume/supports/30041-mejiro-dober',
  blob:'fda834045267a13bd06d51d39468ac7cb9367136'}
];
const fail=(code)=>{throw Error('限定実サイト数値範囲監査: '+code);};
const titleKey=s=>String(s||'').normalize('NFKC')
 .replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
function readPinned(path,profile){
 const bytes=fs.readFileSync(path);
 const sha=crypto.createHash('sha1').update('blob '+bytes.length+'\0')
  .update(bytes).digest('hex');
 if(sha!==profile.blob)fail('historical-blob-drift-'+profile.id);
 const doc=JSON.parse(bytes.toString('utf8'));
 if(String(doc?.id)!==profile.id)fail('historical-card-identity');
 return doc;
}
async function main(paths){
 if(paths.length!==2)fail('require-exactly-two-pinned-documents');
 const docs=paths.map((p,i)=>readPinned(p,PINS[i]));
 const robotsResponse=await fetch('https://gametora.com/robots.txt',{
  headers:{'User-Agent':'UmaSupportLab-small-original-site-verification/1'},
  redirect:'error',signal:AbortSignal.timeout(20000)
 });
 if(robotsResponse.status!==200)fail('robots-unavailable');
 const robots=await robotsResponse.text();
 if(robots.length>200000)fail('robots-oversize');
 for(const profile of PINS){
  if(robotsDisallows(robots,new URL(profile.url).pathname).length)
   fail('robots-disallow-'+profile.id);
 }
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  const comparisons=[];
  for(const [index,profile] of PINS.entries()){
   if(index)await new Promise(resolve=>setTimeout(resolve,6000));
   const doc=docs[index];
   const page=await browser.newPage({locale:'ja-JP'});
   let blocked=false;
   await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.protocol!=='https:'||u.hostname!=='gametora.com'||
      ['image','font','media'].includes(route.request().resourceType()))
     return route.abort();
    return route.continue();
   });
   page.on('response',response=>{
    if([403,429].includes(response.status()))blocked=true;
   });
   const response=await page.goto(profile.url,{waitUntil:'domcontentloaded',timeout:30000})
    .catch(()=>fail('navigation-'+profile.id));
   if(!response||response.status()!==200||blocked)
    fail('site-response-'+profile.id);
   await page.waitForTimeout(3500);
   if(blocked)fail('site-blocked-'+profile.id);
   const originalEvent=Object.values(doc.events_ja)[EXPECTED[profile.id].expectedRange.event-1];
   const buttons=page.locator('section button[aria-expanded]');
   const titles=await buttons.allInnerTexts();
   const needle=titleKey(originalEvent.name);
   if(!needle)fail('empty-expected-event-title');
   const matched=titles.map((t,i)=>({i,key:titleKey(t)}))
    .filter(x=>x.key.includes(needle)).map(x=>x.i);
   if(matched.length!==1)fail('ambiguous-site-title-'+profile.id);
   const button=buttons.nth(matched[0]);
   if(await button.getAttribute('aria-expanded')!=='true')
    await button.click({timeout:6500}).catch(()=>fail('expand-event-'+profile.id));
   await page.waitForTimeout(700);
   const choiceGroups=await button.evaluate(button=>{
    const panel=[...button.parentElement.children].find(el=>el.tagName==='DIV');
    const section=panel?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
    const body=section?.children?.[1];
    if(!body)return [];
    return [...body.children].slice(0,12).map(group=>{
     const fragments=new Set();
     for(const element of [group,...group.querySelectorAll('*')]){
      const own=[...element.childNodes].filter(x=>x.nodeType===3)
       .map(x=>x.textContent||'').join('').trim();
      if(!/[+＋\-－−]\s*\d/.test(own))continue;
      if(own.length<=350)fragments.add(own);
      for(let p=element,depth=0;p&&group.contains(p)&&depth<4;p=p.parentElement,depth++){
       const txt=(p.innerText||'').trim();
       if(txt.length<=140&&txt.length)fragments.add(txt);
      }
     }
     return {fragments:[...fragments].slice(0,150)};
    });
   });
   const proof=inspectVisibleRange(doc,{
    cardId:profile.id,targetSourceOrdinal:EXPECTED[profile.id].expectedRange.event,
    titleMatchCount:matched.length,choiceGroups
   });
   comparisons.push(proof);
   await page.close();
  }
  const result={source:'gametora.com',mode:'two-old-cards-original-site-visible-numeric-range',
   cards:comparisons,sitePagesVisited:2,
   allExpectedRangeAmountsVisible:comparisons.every(x=>x.exactBothNumericAlternativesVisibleInTargetGroup),
   fullSourceToAppParityVerified:false,publicationApproved:false,
   sourceTextOrHtmlCopied:false};
  console.log('ORIGINAL_GT_OLD_RANGES='+JSON.stringify(result));
 }finally{await browser.close();}
}
if(require.main===module){
 if(process.argv.length!==5||process.argv[2]!=='--live-old-ranges')
  fail('explicit-live-flag-and-two-files-required');
 main(process.argv.slice(3)).catch(e=>{
  console.error(/^限定実サイト数値範囲監査:/.test(e.message)?e.message:'限定実サイト数値範囲監査: browser-execution-error');
  process.exitCode=1;
 });
}
module.exports={main,readPinned};
