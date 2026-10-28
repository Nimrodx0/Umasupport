'use strict';
/*
 * One explicit original-site card, one historical event. No extraction into a
 * publishable database; outputs only strict structural flags and counts.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {inspectOne,EXPECTED}=require('../src/official_gametora_old_structural_cohorts.cjs');
const {inspectSiteTopology}=require('../src/official_gametora_rendered_branch_topology.cjs');
const CARD_ID='30080';
const URL='https://gametora.com/ja/umamusume/supports/30080-sasami-anshinzawa';
const BLOB='8ce27e74dd18de7a08efa6a0bcf53d5be7a59a86';
const fail=code=>{throw Error('GameTora元サイトSSR30080限定分岐: '+code);};
const key=s=>String(s||'').normalize('NFKC')
 .replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
function loadPinned(path){
 const b=fs.readFileSync(path);
 const blob=crypto.createHash('sha1').update('blob '+b.length+'\0')
  .update(b).digest('hex');
 if(blob!==BLOB)fail('historical-source-sha-drift');
 const doc=JSON.parse(b.toString('utf8'));
 if(doc.kind!=='support'||String(doc.id)!==CARD_ID)fail('old-card-mismatch');
 inspectOne(doc);
 return doc;
}
async function run(path){
 const old=loadPinned(path);
 const eventOrdinal=EXPECTED[CARD_ID].expectedBranch.event;
 const event=Object.values(old.events_ja)[eventOrdinal-1];
 const robotsResponse=await fetch('https://gametora.com/robots.txt',{
  headers:{'User-Agent':'UmaSupportLab-small-original-site-verification/1'},
  redirect:'error',signal:AbortSignal.timeout(20000)
 });
 if(robotsResponse.status!==200)fail('robots-unavailable');
 const robots=await robotsResponse.text();
 if(robots.length>200000||robotsDisallows(robots,new URL(URL).pathname).length)
  fail('robots-block-or-oversize');
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
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
  const response=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||response.status()!==200||blocked)fail('unexpected-site-response');
  await page.waitForTimeout(3500);
  if(blocked)fail('site-blocked');
  const buttons=page.locator('section button[aria-expanded]');
  const names=await buttons.allInnerTexts();
  const target=key(event.name);
  if(!target)fail('missing-historical-event-name');
  const positions=names.map((name,i)=>({i,name:key(name)}))
   .filter(x=>x.name.includes(target)).map(x=>x.i);
  if(positions.length!==1)fail('event-title-not-uniquely-matched');
  const button=buttons.nth(positions[0]);
  if(await button.getAttribute('aria-expanded')!=='true')
   await button.click({timeout:6500});
  await page.waitForTimeout(750);
  const groups=await button.evaluate(button=>{
   const panel=[...button.parentElement.children].find(el=>el.tagName==='DIV');
   const section=panel?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
   const body=section?.children?.[1];
   if(!body)return [];
   return [...body.children].slice(0,20).map(group=>{
    const inner=group.children.length===1?group.firstElementChild:group;
    const rows=[...inner.children];
    const dividers=rows.map((el,i)=>({el,i})).filter(({el})=>
     /^(?:OR|または|又は)$/i.test((el.innerText||'').trim()));
    const actualOr=dividers.filter(({i})=>i>0&&i<rows.length-1).length;
    // An unexplained OR separator does not become a fabricated extra route.
    const fragments=[group,...group.querySelectorAll('*')].map(el=>
     [...el.childNodes].filter(n=>n.nodeType===3)
      .map(n=>n.textContent||'').join('').trim()).filter(Boolean);
    return {
     visibleText:(group.innerText||'').slice(0,3000),
     ownTextFragments:fragments.slice(0,100).map(x=>x.slice(0,250)),
     routeCandidateCount:actualOr+1,
     orSeparatorCount:actualOr
    };
   });
  });
  const proof=inspectSiteTopology(event,groups);
  const result={
   cardId:CARD_ID,sourceEventOrdinal:eventOrdinal,
   sourceEventsTotal:Object.values(old.events_ja).length,
   uniquelyMatchedEventTitles:positions.length,
   ...proof,
   independentOriginalSiteRead:true,
   historicalReferenceBlobVerified:true,
   publicationApproved:false
  };
  // The only output contains numbers, enums and booleans; no source text.
  console.log('ORIGINAL_GT_30080_BRANCH='+JSON.stringify(result));
  if(!result.exactChoiceAndVisibleRouteCardinality)
   fail('old-source-vs-live-site-choice-route-disagreement');
  return result;
 }finally{await browser.close();}
}
if(require.main===module){
 if(process.argv.length!==4||process.argv[2]!=='--live-30080')
  fail('explicit-original-site-run-with-pinned-json-required');
 run(process.argv[3]).catch(e=>{
  console.error(/^GameTora元サイトSSR30080限定分岐:/.test(e.message)?e.message:
   'GameTora元サイトSSR30080限定分岐: browser-or-site-error');
  process.exitCode=1;
 });
}
module.exports={run,loadPinned};
