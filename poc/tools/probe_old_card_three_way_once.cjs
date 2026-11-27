'use strict';
// Inspect only card-specific Next.js page props, never persist source JSON.
const crypto=require('node:crypto');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {headingFingerprint}=require('../src/direct_event_fact_review.cjs');
const catalog=require('../data/reviewed_events.v1.json');
const origin='https://gametora.com';
const targets=[['30001','special-week'],['30080','sasami-anshinzawa']];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
const rootShape=v=>Array.isArray(v)?{type:'array',length:v.length}:v&&typeof v==='object'?{type:'object',count:Object.keys(v).length}:v===null?'null':typeof v;
function shape(v,d=0){
 if(d>4)return rootShape(v);
 if(Array.isArray(v))return {type:'array',length:v.length,first:v.length?shape(v[0],d+1):null};
 if(v&&typeof v==='object')return {type:'object',count:Object.keys(v).length,fields:Object.entries(v).slice(0,25).map(([k,x])=>({key:/^[a-zA-Z_][a-zA-Z0-9_]{0,50}$/.test(k)?k:'<key>',shape:shape(x,d+1)}))};
 return rootShape(v);
}
function titleMatches(eventData,card){
 const names=card.events.map(e=>({id:e.id,name:norm(e.name)}));
 const matches=[];
 function walk(v,path,d){
  if(d>15||!v||typeof v!=='object')return;
  for(const [k,x] of Object.entries(v)){
   const p=path.concat(/^[a-zA-Z_][a-zA-Z0-9_]{0,50}$/.test(k)?k:'[]');
   if(typeof x==='string'&&x.length<200){
    const target=names.filter(e=>e.name===norm(x));
    if(target.length)matches.push({eventIds:target.map(t=>t.id),path:p,parent:shape(v,2)});
   }else if(x&&typeof x==='object')walk(x,p,d+1);
  }
 }
 walk(eventData,[],0);
 return matches.slice(0,20);
}
function facts(v,d=0){
 if(d>8)return rootShape(v);
 if(Array.isArray(v))return v.slice(0,20).map(x=>facts(x,d+1));
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).slice(0,30).map(([k,x],i)=>[/^[a-zA-Z_][a-zA-Z0-9_]{0,50}$/.test(k)?k:'key'+i,facts(x,d+1)]));
 // Avoid any source text. Only numeric facts, booleans, null and short
 // tightly constrained machine reward codes are emitted.
 if(typeof v==='string')return /^[-+]?\d{1,8}$/.test(v)||/^(sk|pt|en|bo|sp|st|pw|gu|wi|mo|se|rs|or|chain_end|auto|choice|hint|obtained)$/.test(v)?v:{type:'string',length:v.length};
 return v;
}
(async()=>{
 const rr=await fetch(origin+'/robots.txt',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(rr.status!==200)throw Error('robots unavailable');const robots=await rr.text();
 async function read(path,type,max,optional=false){
  if(robotsDisallows(robots,path).length)throw Error('robots disallow');
  await new Promise(r=>setTimeout(r,6000));
  const res=await fetch(origin+path,{headers:{'User-Agent':'Umasupport-readonly-new-card-probe/0.1'},redirect:'manual',signal:AbortSignal.timeout(20000)});
  console.log('PROPS_HTTP='+JSON.stringify({path,status:res.status,contentType:res.headers.get('content-type')}));
  if(optional&&res.status===404)return null;
  if(res.status!==200||!String(res.headers.get('content-type')).includes(type))throw Error('HTTP/content failure; stop');
  const b=Buffer.from(await res.arrayBuffer());
  if(b.length>max)throw Error('response cap');
  console.log('PROPS_BYTES='+JSON.stringify({bytes:b.length,sha256:sha(b)}));return b;
 }
 for(const [id,slug] of targets){
  const path='/ja/umamusume/supports/'+id+'-'+slug;
  const html=(await read(path,'text/html',4*1024*1024)).toString('utf8');
  const m=/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script\s*>/i.exec(html);
  if(!m)throw Error('missing Next data');
  const root=JSON.parse(m[1]),props=root.props?.pageProps,events=props?.eventData;
  const card=catalog.cards.find(c=>c.cardId===id);
  const buildId=root.buildId;
  console.log('PROPS_CARD='+JSON.stringify({id,buildId:typeof buildId==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(buildId)?buildId:null,page:root.page,locale:root.locale,queryKeys:Object.keys(root.query||{}),propsKeys:Object.keys(props||{}),eventDataShape:shape(events),titleMatches:titleMatches(events,card).map(x=>({eventIds:x.eventIds,path:x.path})),numericShape:facts(Array.isArray(events)?events.slice(0,1):events),publicationApproved:false}));
  // Standard Next.js per-page data route, one attempt only for the first
  // card. No guessed alternate route, no retry or access-control bypass.
  if(id==='30001'&&typeof buildId==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(buildId)){
   const b=await read('/_next/data/'+buildId+path+'.json','json',2*1024*1024,true);
   if(b){
    const j=JSON.parse(b),p=j.pageProps||j.props?.pageProps;
    console.log('PROPS_NEXT_JSON='+JSON.stringify({id,keys:Object.keys(j),pagePropsKeys:Object.keys(p||{}),eventDataEqual:JSON.stringify(p?.eventData)===JSON.stringify(events),eventDataShape:rootShape(p?.eventData)}));
   }
  }
 }
})().catch(e=>{console.error('PROPS_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
