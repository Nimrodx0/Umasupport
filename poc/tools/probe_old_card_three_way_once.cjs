'use strict';
const crypto=require('node:crypto');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const catalog=require('../data/reviewed_events.v1.json');
const origin='https://gametora.com',build='E83n5Oh6VRQK2vmoqOZ2A';
const targets=[['30001','special-week'],['30080','sasami-anshinzawa']];
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const leaves=e=>(e.type==='auto'?[e]:e.choices||[]).flatMap(g=>g.outcomes||[g]);
const fact=(id,lv)=>String(id).replace(/^skill:/,'')+':'+Number(lv);
const bag=a=>a.slice().sort().join('|');
const oldHints=e=>leaves(e).flatMap(o=>(o.rewards||[]).filter(r=>r.kind==='hint'||r.kind===undefined&&Number.isInteger(r.level)).map(r=>fact(r.skillId,r.level)));
const type=v=>Array.isArray(v)?'array':v===null?'null':typeof v;
function shape(v,d=0){
 if(d>4)return {type:type(v)};
 if(Array.isArray(v))return {type:'array',length:v.length,first:v.length?shape(v[0],d+1):null};
 if(v&&typeof v==='object')return {type:'object',fields:Object.entries(v).slice(0,25).map(([k,x])=>({key:/^[a-zA-Z_][a-zA-Z0-9_]{0,50}$/.test(k)?k:'<key>',shape:shape(x,d+1)}))};
 return {type:type(v)};
}
function numeric(v,d=0){
 if(d>9)return {type:type(v)};
 if(Array.isArray(v))return v.slice(0,25).map(x=>numeric(x,d+1));
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).slice(0,25).map(([k,x],i)=>[/^[a-zA-Z_][a-zA-Z0-9_]{0,50}$/.test(k)?k:'key'+i,numeric(x,d+1)]));
 if(typeof v==='string')return /^[-+]?\d{1,8}$/.test(v)||/^(sk|pt|en|bo|sp|st|pw|gu|wi|mo|se|rs|or|chain_end|auto|choice|hint|obtained|speed|stamina|power|guts|wisdom|energy|bond|skill_points|skill_hint)$/.test(v)?v:{type:'string',length:v.length};
 return v;
}
function find(v,card){
 const result=[];
 function walk(x,path,d){
  if(!x||typeof x!=='object'||d>15)return;
  for(const [k,val] of Object.entries(x)){
   if(typeof val==='string'&&val.length<300){
    const ids=card.events.filter(e=>norm(e.name)===norm(val)).map(e=>e.id);
    if(ids.length)result.push({ids,path:path.concat(k),record:numeric(x)});
   }else if(val&&typeof val==='object')walk(val,path.concat(k),d+1);
  }
 }
 walk(v,[],0);return result.slice(0,20);
}
(async()=>{
 const rr=await fetch(origin+'/robots.txt',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(rr.status!==200)throw Error('robots unavailable');const robots=await rr.text();
 for(const [id,slug] of targets){
  const path='/_next/data/'+build+'/ja/umamusume/supports/'+id+'-'+slug+'.json';
  if(robotsDisallows(robots,path).length)throw Error('robots disallow');
  await new Promise(r=>setTimeout(r,6000));
  const res=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(res.status!==200||!String(res.headers.get('content-type')).includes('json'))throw Error('HTTP '+res.status+'; stop');
  const b=Buffer.from(await res.arrayBuffer());if(b.length>2*1024*1024)throw Error('response cap');
  const p=JSON.parse(b).pageProps,raw=p?.eventData?.ja;
  if(typeof raw!=='string')throw Error('missing Japanese event data');
  let parsed,encoding='json';
  try{parsed=JSON.parse(raw);}catch{encoding='not-json';}
  // No speculative decoding or source text export.
  const card=catalog.cards.find(c=>c.cardId===id);
  console.log('CARD_JSON_META='+JSON.stringify({id,bytes:b.length,sha256:sha(b),eventBytes:Buffer.byteLength(raw),encoding,rawShape:{startsObject:raw.trim().startsWith('{'),startsArray:raw.trim().startsWith('['),base64Like:/^[A-Za-z0-9+/=]+$/.test(raw),hasLineBreak:raw.includes('\n'),hasColon:raw.includes(':'),knownTitleCount:card.events.filter(e=>raw.includes(e.name)).length},sourceDataShape:shape(p.sourceData),eventShape:shape(parsed),matches:find(parsed,card),firstRecord:numeric(Array.isArray(parsed)?parsed.slice(0,1):parsed),publicationApproved:false}));
 }
})().catch(e=>{console.error('CARD_JSON_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
