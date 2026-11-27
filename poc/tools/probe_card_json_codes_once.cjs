'use strict';
// Explicit, read-only, bounded research. No source text or documents persisted.
const crypto=require('node:crypto');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const catalog=require('../data/reviewed_events.v1.json');
const origin='https://gametora.com';
const cohorts=[[['30001','special-week'],['30080','sasami-anshinzawa']],[['30030','matikanetannhauser'],['30041','mejiro-dober']]];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
const oldLeaves=e=>(e.type==='auto'?[e]:e.choices||[]).map(g=>g.outcomes||[g]);
const hint=r=>({id:Number(String(r.skillId).replace(/^skill:/,'')),level:r.level??null,kind:r.kind||'hint'});
const oldFacts=e=>oldLeaves(e).map(g=>g.map(l=>({hints:(l.rewards||[]).map(hint),effects:(l.effects||[]).map(x=>[x.kind,x.delta,x.recipientCharId??null]),terminal:l.terminal===true,statusCount:l.statusEffects?.length||0,dynamicCount:l.dynamicEffects?.length||0})));
const allowedToken=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,20}$/.test(x);
const safeValue=x=>x===null||typeof x==='number'||typeof x==='boolean'||typeof x==='string'&&/^[+-]?\d{1,5}(?:\s*[/~]\s*[+-]?\d{1,5})?$/.test(x)?x:{type:typeof x,length:typeof x==='string'?x.length:undefined};
let robots='';
async function read(path,type,max){
 if(!/^\/(?:robots\.txt|ja\/umamusume\/supports\/[1-9]\d{4}-[a-z-]+|_next\/data\/[A-Za-z0-9_-]+\/ja\/umamusume\/supports\/[1-9]\d{4}-[a-z-]+\.json)$/.test(path))throw Error('scope');
 if(path!=='/robots.txt'){
  if(robotsDisallows(robots,path).length)throw Error('robots denied');
  await new Promise(r=>setTimeout(r,6000));
 }
 const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Umasupport-readonly-new-card-probe/0.1'}});
 if(r.status!==200||!String(r.headers.get('content-type')).includes(type))throw Error('HTTP/content failure '+r.status);
 const chunks=[];let size=0;const reader=r.body.getReader();
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('response cap');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 const b=Buffer.concat(chunks);console.log('CODE_HTTP='+JSON.stringify({path,bytes:b.length,sha256:sha(b)}));return b.toString('utf8');
}
(async()=>{
 robots=await read('/robots.txt','text/plain',100000);
 const html=await read('/ja/umamusume/supports/30001-special-week','text/html',512000);
 const m=/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script\s*>/i.exec(html);
 const build=m?JSON.parse(m[1]).buildId:null;
 if(typeof build!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(build))throw Error('invalid build');
 for(const cohort of cohorts){
  for(const [id,slug] of cohort){
   const j=JSON.parse(await read('/_next/data/'+build+'/ja/umamusume/supports/'+id+'-'+slug+'.json','json',512000));
   const p=j.pageProps;
   if(String(p?.sourceData?.support_id)!==id||typeof p?.eventData?.ja!=='string')throw Error('card scope');
   const doc=JSON.parse(p.eventData.ja),old=catalog.cards.find(c=>c.cardId===id);
   const entries=Object.entries(doc).flatMap(([cat,es])=>{
    if(!['random','arrows','special','dates'].includes(cat)||!Array.isArray(es))throw Error('category');
    return es.map((e,i)=>{
     const found=old.events.filter(x=>norm(x.name)===norm(e.n));
     const relevant=id==='30001'||id==='30080'&&found.some(x=>x.id.endsWith('008'))||id==='30030'&&found.some(x=>x.id.endsWith('003'))||id==='30041'&&found.some(x=>x.id.endsWith('003'));
     const groups=e.c.map(c=>({labelPresent:!!c.o,keys:Object.keys(c).sort(),effects:c.r.map(r=>({t:allowedToken(r.t)?r.t:'<unknown>',fields:Object.keys(r).sort(),v:r.v===undefined?undefined:safeValue(r.v),d:r.d===undefined?undefined:safeValue(r.d),r:r.r===undefined?undefined:safeValue(r.r)}))}));
     return {category:cat,ordinal:i+1,sourceId:e.i,oldIds:found.map(x=>x.id),eventKeys:Object.keys(e).sort(),type:allowedToken(e.type)?e.type:null,meaninglessChoices:e.meaningless_choices===true,historyCount:e.history?.length||0,groups:relevant?groups:undefined,groupCount:groups.length,codes:[...new Set(groups.flatMap(g=>g.effects.map(r=>r.t)))].sort(),oldFacts:relevant&&found.length===1?oldFacts(found[0]):undefined};
    });
   });
   console.log('CODE_CARD='+JSON.stringify({id,build,eventCount:entries.length,events:entries,publicationApproved:false}));
  }
 }
})().catch(e=>{console.error('CODE_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
