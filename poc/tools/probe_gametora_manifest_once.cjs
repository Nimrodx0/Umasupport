'use strict';
// Explicit one-time D069 research; no persistence of upstream JSON or prose.
const crypto=require('node:crypto');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const origin='https://gametora.com', targets=['10149','30323'];
const ua='Umasupport-readonly-new-card-probe/0.1';
let robots='';
async function read(path,max,type){
 if(!/^\/(?:robots\.txt|data\/[a-zA-Z0-9_./-]+\.json)$/.test(path))throw Error('Invalid path');
 if(path!=='/robots.txt'&&robotsDisallows(robots,path).length)throw Error('robots disallows '+path);
 const r=await fetch(origin+path,{headers:{'User-Agent':ua},redirect:'manual',signal:AbortSignal.timeout(30000)});
 console.log('GT_RESPONSE='+JSON.stringify({path,status:r.status,contentType:r.headers.get('content-type'),contentLength:r.headers.get('content-length'),encoding:r.headers.get('content-encoding')}));
 if(r.status!==200)throw Error('HTTP '+r.status+'; stop');
 if(!String(r.headers.get('content-type')).includes(type))throw Error('Unexpected content type');
 const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Response exceeds cap');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
 const bytes=Buffer.concat(chunks);
 console.log('GT_BYTES='+JSON.stringify({path,bytes:size,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
 return bytes.toString('utf8');
}
const kind=x=>x===null?'null':Array.isArray(x)?'array':typeof x;
function shape(x,depth=0){
 const t=kind(x);
 if(t==='array')return {type:t,length:x.length,first:depth<3&&x.length?shape(x[0],depth+1):undefined};
 if(t==='object')return {type:t,keyCount:Object.keys(x).length,fields:depth<3?Object.entries(x).slice(0,20).map(([k,v])=>({key:/^[a-zA-Z_][a-zA-Z0-9_-]{0,35}$/.test(k)?k:'<nonfield>',shape:shape(v,depth+1)})):undefined};
 return {type:t};
}
// Match only the two explicit pending cards, never report other IDs or values.
function locate(x){
 const matches=[];let visited=0;
 const walk=(v,path,d)=>{
  if(!v||typeof v!=='object'||d>12)return;
  if(++visited>250000)throw Error('Structure inspection cap');
  if(Array.isArray(v)){for(let i=0;i<v.length;i++)walk(v[i],path.concat('[]'),d+1);return;}
  for(const [k,val] of Object.entries(v)){
   if(targets.includes(k)&&val&&typeof val==='object')matches.push({target:k,via:'key',path:path.concat('<target>'),shape:shape(val)});
   if(/^(id|card_?id|support_?id|support_?card_?id)$/i.test(k)&&targets.includes(String(val)))matches.push({target:String(val),via:k,path,shape:shape(v)});
   if(val&&typeof val==='object')walk(val,path.concat(/^[a-zA-Z_][a-zA-Z0-9_-]{0,35}$/.test(k)?k:'<key>'),d+1);
  }
 };
 walk(x,[],0);
 return {matches:matches.slice(0,12),matchCount:matches.length};
}
// Exact known target records only. No text, raw HTML or unrelated records.
function numericShape(v,d=0){
 if(d>10)return {type:kind(v),depthLimit:true};
 if(Array.isArray(v))return v.slice(0,30).map(x=>numericShape(x,d+1));
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).slice(0,30).map(([k,x],i)=>[/^[a-zA-Z_][a-zA-Z0-9_-]{0,35}$/.test(k)?k:'key'+i,numericShape(x,d+1)]));
 if(typeof v==='string')return {type:'string',length:v.length,code:/^[a-zA-Z0-9_:+;,.|/@#% -]{1,28}$/.test(v)&&/\d/.test(v)?v:undefined};
 return v;
}
(async()=>{
 robots=await read('/robots.txt',100000,'text/plain');
 const fetchPinned=async(key,version)=>{
  await new Promise(r=>setTimeout(r,6000));
  const body=await read('/data/umamusume/'+key+'.'+version+'.json',4*1024*1024,'json');
  if(!crypto.createHash('sha256').update(body).digest('hex').startsWith(version))throw Error('Version digest mismatch');
  return JSON.parse(body);
 };
 const friend=await fetchPinned('training_events/friend','3e027684');
 const found=friend.filter(row=>Array.isArray(row)&&row[0]===9052);
 if(found.length!==1)throw Error('Target mapping changed');
 console.log('GT_FRIEND_TARGET_NUMERIC='+JSON.stringify(numericShape(found[0])));
 const ssr=await fetchPinned('training_events/ssr','fa74f9c4');
 const compare=ssr.filter(row=>Array.isArray(row)&&row[0]===30322);
 console.log('GT_SSR_REFERENCE='+JSON.stringify({rootType:kind(ssr),rootCount:ssr.length,rowShape:shape(ssr[0]),matches:compare.map(x=>numericShape(x))}));
})().catch(e=>{console.error('GT_PROBE_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
