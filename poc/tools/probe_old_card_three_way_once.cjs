'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {extractRoutePieces}=require('../src/official_gametora_route_dom_extractor.cjs');
const {assembleLiveEvent}=require('../src/official_gametora_live_event_assembler.cjs');
const {registryFromSkillText}=require('../src/official_gametora_skill_id_crosswalk.cjs');
const {headingFingerprint}=require('../src/direct_event_fact_review.cjs');
const catalog=require('../data/reviewed_events.v1.json');
const targets=[['30001','special-week'],['30080','sasami-anshinzawa']];
const origin='https://gametora.com';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
const bag=a=>a.slice().sort().join('|');
const fact=(id,lv)=>String(id).replace(/^skill:/,'')+':'+Number(lv);
function publicHints(e){return (e.type==='auto'?[e]:e.choices||[]).flatMap(g=>(g.outcomes||[g]).flatMap(o=>(o.rewards||[]).filter(r=>r.kind==='hint').map(r=>fact(r.skillId,r.level))));}
const publicShape=e=>({groups:e.type==='auto'?1:e.choices?.length||0,routes:(e.type==='auto'?[e]:e.choices||[]).reduce((n,g)=>n+(g.outcomes?.length||1),0),hints:publicHints(e)});
function rows(doc,id){return Array.isArray(doc)?doc.filter(r=>Array.isArray(r)&&String(r[0])===String(id)):[];}
function jsonHints(event,dict,offset=0){return event[1].flatMap(g=>(g[1]||[]).flatMap(k=>{const v=dict[k+offset];return Array.isArray(v)&&v[0]==='sk'?[fact(v[2],v[1])]:[];}));}
async function main(){
 const registry=registryFromSkillText(fs.readFileSync(process.argv[2],'utf8'));
 const rr=await fetch(origin+'/robots.txt',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(rr.status!==200)throw Error('robots unavailable');const robots=await rr.text();
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({locale:'ja-JP',serviceWorkers:'block'});
 const docs=new Map(),net=new Map(),results=[];let blocked=false;
 try{
  await ctx.route('**/*',route=>{
   const req=route.request(),u=new URL(req.url());
   if(blocked||u.origin!==origin||robotsDisallows(robots,u.pathname).length||['image','font','media'].includes(req.resourceType()))return route.abort();
   return route.continue();
  });
  for(const [id,slug] of targets){
   if(blocked)throw Error('access stopped');
   await new Promise(r=>setTimeout(r,6000));
   const page=await ctx.newPage(),pending=[];
   page.on('response',res=>{
    if([403,429].includes(res.status()))blocked=true;
    const u=new URL(res.url());
    if(u.origin!==origin)return;
    const m=/^\/data\/umamusume\/(.+)\.([a-f0-9]{8})\.json$/.exec(u.pathname);
    if(!m||res.status()!==200)return;
    pending.push((async()=>{const bytes=await res.body();if(bytes.length>4*1024*1024)throw Error('JSON cap');
     const hash=sha(bytes);if(!hash.startsWith(m[2]))throw Error('version mismatch');
     docs.set(m[1],JSON.parse(bytes.toString('utf8')));net.set(m[1],{key:m[1],version:m[2],bytes:bytes.length,sha256:hash});
    })());
   });
   const url=origin+'/ja/umamusume/supports/'+id+'-'+slug;
   const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   if(!r||r.status()!==200||r.url()!==url||blocked)throw Error('page unavailable');
   const heading=page.getByRole('heading',{name:'育成イベント',exact:true});
   await heading.waitFor({timeout:20000});await page.waitForTimeout(3500);
   if(blocked)throw Error('access stopped');
   const area=heading.locator('..'),hs=area.locator('h3'),n=await hs.count();
   if(n<1||n>20)throw Error('unexpected visible heading count');
   const old=catalog.cards.find(c=>c.cardId===id);if(!old)throw Error('missing published comparator');
   const obs=[];
   for(let i=0;i<n;i++){
    const h=hs.nth(i),title=await h.innerText(),event=h.locator('xpath=ancestor::section[1]');
    const pieces=await event.evaluate(extractRoutePieces);
    const a=assembleLiveEvent({cardId:id,siteEventOrdinal:i+1,routePieces:pieces,registry});
    const matched=old.events.filter(e=>norm(e.name)===norm(title.replace(/^\s*\(?\s*[❯›»>→]+\s*\)?\s*/u,'')));
    const routes=a.joined?.routes||[];
    const hints=routes.flatMap(r=>r.skillHints.map(h=>fact(h.numericId,h.level)));
    obs.push({ordinal:i+1,titleHash:headingFingerprint(title).sha256,matchedIds:matched.map(e=>e.id),status:a.status,groups:new Set(pieces.map(p=>p.choiceOrdinal)).size,routes:pieces.length,hints,unresolvedHintRows:a.hintDraft?.unresolvedHintRows??null,scalarCount:routes.reduce((n,r)=>n+r.numericEffects.length,0),published:matched.length===1?publicShape(matched[0]):null});
   }
   await Promise.all(pending);await page.close();results.push({cardId:id,publishedEvents:old.events.length,html:obs});
  }
  console.log('THREEWAY_NETWORK='+JSON.stringify([...net.values()]));
  const dict=docs.get('dict/evrew'),names=docs.get('dict/te_names_ja'),byId=docs.get('dict/te_names_by_id_ja'),ssr=docs.get('training_events/ssr'),supports=docs.get('support-cards');
  console.log('THREEWAY_DICT_SHAPES='+JSON.stringify({rewardCount:dict?.length,namesType:Array.isArray(names)?'array':typeof names,namesCount:names?Object.keys(names).length:null,byIdType:Array.isArray(byId)?'array':typeof byId,byIdCount:byId?Object.keys(byId).length:null,ssrCount:ssr?.length}));
  for(const c of results){
   const row=rows(ssr,c.cardId);const support=Array.isArray(supports)?supports.find(x=>String(x.support_id)===c.cardId):null;
   const chain=row.length===1?row[0][1]:[];
   const byName=chain.map(e=>{
    const candidates=[names?.[e[0]],byId?.[e[2]],byId?.[String(e[2])]].filter(x=>typeof x==='string');
    const hashes=[...new Set(candidates.map(x=>headingFingerprint(x).sha256))];
    const matched=c.html.filter(h=>hashes.includes(h.titleHash));
    const offsetTrials=dict?[-1,0,1].map(offset=>{const hints=jsonHints(e,dict,offset);return {offset,hintCount:hints.length,htmlExact:matched.length===1?bag(hints)===bag(matched[0].hints):null,publishedExact:matched.length===1&&matched[0].published?bag(hints)===bag(matched[0].published.hints):null};}):[];
    return {storyId:e[2],nameRef:e[0],matchedHtmlOrdinals:matched.map(x=>x.ordinal),groups:e[1]?.length,offsetTrials};
   });
   console.log('THREEWAY_CARD='+JSON.stringify({...c,supportCharId:support?.char_id??null,jsonChainCount:chain.length,jsonByName:byName,publicationApproved:false}));
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error('THREEWAY_STOP='+String(e.message).slice(0,200));process.exitCode=1;});
