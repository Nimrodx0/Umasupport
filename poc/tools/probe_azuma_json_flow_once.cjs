'use strict';
const {chromium}=require('playwright');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {extractRoutePieces}=require('../src/official_gametora_route_dom_extractor.cjs');
const {routeFlowCandidates}=require('../src/official_gametora_site_flow_draft.cjs');
const {inspectCardJson}=require('../src/official_gametora_card_json.cjs');
const crypto=require('node:crypto');
const origin='https://gametora.com',ids=['10149','30323'];
const hash=s=>crypto.createHash('sha256').update(s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'')).digest('hex');
(async()=>{
 const r=await fetch(origin+'/robots.txt',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(r.status!==200||!String(r.headers.get('content-type')).includes('text/plain'))throw Error('robots unavailable');
 const robots=await r.text();if(robots.length>100000)throw Error('robots cap');
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({locale:'ja-JP',serviceWorkers:'block'});
  let blocked=false;
  await ctx.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(blocked||u.origin!==origin||robotsDisallows(robots,u.pathname).length||['image','font','media'].includes(req.resourceType()))return route.abort();return route.continue();});
  for(const cardId of ids){
   await new Promise(r=>setTimeout(r,6000));if(blocked)throw Error('access refused');
   const page=await ctx.newPage();page.on('response',r=>{if([403,429].includes(r.status()))blocked=true;});
   const sourceUrl=origin+'/ja/umamusume/supports/'+cardId+'-azuma';
   const r=await page.goto(sourceUrl,{waitUntil:'domcontentloaded',timeout:30000});
   if(!r||r.status()!==200||r.url()!==sourceUrl||blocked)throw Error('HTTP/scope');
   const heading=page.getByRole('heading',{name:'育成イベント',exact:true});await heading.waitFor({timeout:20000});await page.waitForTimeout(3000);
   const root=JSON.parse(await page.locator('#__NEXT_DATA__').textContent());
   const obs=inspectCardJson({body:JSON.stringify({pageProps:root.props.pageProps}),cardId,sourceUrl,buildId:root.buildId});
   const headings=heading.locator('..').locator('h3'),count=await headings.count();
   if(count!==obs.events.length||count>20||blocked)throw Error('event count/access');
   const rows=[],matched=new Set();
   for(let i=0;i<count;i++){
    const h=headings.nth(i),name=await h.innerText(),section=h.locator('xpath=ancestor::section[1]');
    const e=obs.events.filter(x=>x.titleSha256===hash(name));
    if(e.length!==1||matched.has(e[0].sourceEventId))throw Error('identity ambiguity');
    matched.add(e[0].sourceEventId);
    const pieces=await section.evaluate(extractRoutePieces);
    if(!pieces.length||pieces.some(x=>x.unresolvedOr))throw Error('route ambiguity');
    const flows=routeFlowCandidates({cardId,siteEventOrdinal:i+1,routes:pieces});
    const source=e[0],routes=source.groups.flatMap(g=>g.routes.map(r=>({group:g.ordinal,result:r.ordinal,ds:r.unresolved.filter(x=>x.code==='ds').length,stop:r.markers.some(x=>x.kind==='explicit-chain-stop'),shun:r.unresolved.filter(x=>x.code==='shun_act_low').length})));
    const comparison=routes.map(x=>{
     const p=flows.routes.filter(y=>y.choiceGroupOrdinal===x.group&&y.resultOrdinal===x.result);
     return {...x,domMatch:p.length===1,visibleMarkers:p.length===1?p[0].visibleMarkerKinds:[]};
    });
    // Only classify presence of keywords, not the display wording or prose.
    const scenarioSignals=await section.evaluate(el=>{
     const text=el.innerText||'';
     return {action:/アクション|行動回数/.test(text),shun:/春夏秋冬|春天|春|旬/.test(text),count:/回数/.test(text)};
    });
    rows.push({sourceEventId:source.sourceEventId,category:source.category,categoryOrdinal:source.categoryOrdinal,domRoutes:pieces.length,jsonRoutes:routes.length,comparison,scenarioSignals});
   }
   if(blocked)throw Error('access refused');
   console.log('AZUMA_FLOW='+JSON.stringify({cardId,buildId:root.buildId,levelDependent:obs.levelDependent,events:rows,publicationApproved:false}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error('AZUMA_FLOW_STOP='+String(e.message).slice(0,120));process.exitCode=1;});
