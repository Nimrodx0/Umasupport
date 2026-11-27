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
// Reward references observed in the two scoped records, not a full export.
const friendCodes=[71,41,46,68,186,1358,756,1359,1360,246,1361,1362,1209,49,47,39,82,1243,45,66,1280,48,56,108,1363,40,802,52,1364,121,1365,695,72,110,60,886];
const ssrCodes=[99,41,56,1193,92,44,114,186,1194,103,1195,1196,155,40,1197,1198,43,1199,1200,47,1201,1202];
function codeShape(v,d=0){
 if(d>5)return {type:kind(v)};
 if(Array.isArray(v))return v.slice(0,20).map(x=>codeShape(x,d+1));
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).slice(0,20).map(([k,x],i)=>[/^[a-zA-Z_][a-zA-Z0-9_-]{0,35}$/.test(k)?k:'key'+i,codeShape(x,d+1)]));
 if(typeof v==='string'){
  // Only compact machine tokens or numerical facts, never source prose.
  if(/^[A-Za-z0-9_:+;,.|/@#%=-]{1,40}$/.test(v))return v;
  return {type:'string',length:v.length,numbers:v.match(/[-+]?\d+/g)?.slice(0,12).map(Number)||[],hasRare:/SSR|レア|金|rare/i.test(v),hasHint:/ヒント|hint/i.test(v)};
 }
 return v;
}
(async()=>{
 robots=await read('/robots.txt',100000,'text/plain');
 await new Promise(r=>setTimeout(r,6000));
 const version='a687fca9';
 const body=await read('/data/umamusume/dict/evrew.'+version+'.json',4*1024*1024,'json');
 if(!crypto.createHash('sha256').update(body).digest('hex').startsWith(version))throw Error('Version digest mismatch');
 const doc=JSON.parse(body);
 const codes=[...new Set([...friendCodes,...ssrCodes])].sort((a,b)=>a-b);
 console.log('GT_REWARD_DICTIONARY='+JSON.stringify({rootType:kind(doc),rootCount:Object.keys(doc).length,rootShape:shape(doc),selected:codes.map(id=>({id,present:Object.hasOwn(doc,id),value:codeShape(doc[id])}))}));
})().catch(e=>{console.error('GT_PROBE_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
