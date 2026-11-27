'use strict';
// Local response substitution in a disposable browser only. Upstream is
// read-only. No source content is persisted or logged.
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const origin='https://gametora.com';
const marker='UMASUPPORT_LOCAL_TEST_30001';
const expected=[559,560,561];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const rr=await fetch(origin+'/robots.txt',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(rr.status!==200)throw Error('robots unavailable');
 const robots=await rr.text();
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 let blocked=false,mutationCount=0,handlerError=null;const scriptMeta=[],requests=[];
 try{
  const ctx=await browser.newContext({locale:'ja-JP',serviceWorkers:'block'});
  await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(blocked||u.origin!==origin||robotsDisallows(robots,u.pathname).length||['image','font','media'].includes(req.resourceType()))return route.abort();
   if(!/^\/data\/umamusume\/dict\/te_names_ja\.[a-f0-9]{8}\.json$/.test(u.pathname))return route.continue();
   try{
    if(mutationCount!==0)throw Error('unexpected repeat of dictionary');
    const res=await route.fetch({maxRedirects:0,maxRetries:0,timeout:20000});
    if([403,429].includes(res.status()))blocked=true;
    if(res.status()!==200)throw Error('dictionary unavailable');
    const bytes=await res.body();
    if(bytes.length>1024*1024||!sha(bytes).startsWith('8e06334e')||!u.pathname.endsWith('.8e06334e.json'))throw Error('dictionary version changed');
    const data=JSON.parse(bytes);
    if(!Array.isArray(data)||!expected.every(i=>typeof data[i]==='string'))throw Error('dictionary shape changed');
    expected.forEach(i=>{data[i]=marker+'_'+i;});
    mutationCount++;
    await route.fulfill({status:200,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(data)});
   }catch(e){handlerError=String(e.message).slice(0,100);await route.abort();}
  });
  const page=await ctx.newPage(),pending=[];
  page.on('response',res=>{
   const u=new URL(res.url());if(u.origin!==origin)return;
   if([403,429].includes(res.status()))blocked=true;
   if(res.status()!==200)return;
   if(u.pathname.startsWith('/data/'))requests.push({path:u.pathname});
   if(!u.pathname.endsWith('.js'))return;
   pending.push((async()=>{
    try{
     const b=await res.body();if(b.length>4*1024*1024)return;
     const s=b.toString('utf8');
     const signals=['dict/evrew','dict/te_names_ja','te_names','training_events/ssr','training_events/shared','ttl_gauge','bo_l'].filter(x=>s.includes(x));
     if(signals.length)scriptMeta.push({asset:u.pathname,bytes:b.length,sha256:sha(b),signals});
    }catch{}
   })());
  });
  const url=origin+'/ja/umamusume/supports/30001-special-week';
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  if(!r||r.status()!==200||r.url()!==url||blocked)throw Error('page unavailable');
  await page.getByRole('heading',{name:'育成イベント',exact:true}).waitFor({timeout:20000});
  await page.waitForTimeout(3500);
  await Promise.all(pending);
  if(handlerError||blocked)throw Error(handlerError||'access stopped');
  const result=await page.evaluate(marker=>{
   const titles=[...document.querySelectorAll('h3')].filter(el=>el.closest('section')).map(el=>el.innerText);
   const initial=document.querySelector('#__NEXT_DATA__')?.textContent;
   let pagePropsKeys=[],initialTitleHits=0;
   if(initial)try{const v=JSON.parse(initial);pagePropsKeys=Object.keys(v.props?.pageProps||{}).filter(x=>/^[A-Za-z0-9_]{1,50}$/.test(x));initialTitleHits=titles.filter(t=>t.length>1&&initial.includes(t)).length;}catch{}
   return {h3Count:titles.length,markerH3Count:titles.filter(t=>t.includes(marker)).length,markerAnywhere:document.body.innerText.includes(marker),initialJsonPresent:!!initial,pagePropsKeys,initialTitleHits};
  },marker);
  console.log('CAUSAL_LOCAL_TEST='+JSON.stringify({mutationCount,indices:expected,...result,scriptMeta,versionedJsonCount:requests.length,publicationApproved:false}));
 }finally{await browser.close();}
})().catch(e=>{console.error('CAUSAL_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
