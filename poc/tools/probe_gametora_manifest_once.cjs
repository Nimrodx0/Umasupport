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
// Current verified manifest coordinates from the first explicit run.
const refs={support:'6ea0c160',friend:'3e027684'};
function matchesRow(v,ids){
 if(!v||typeof v!=='object')return false;
 return Object.entries(v).some(([k,x])=>ids.includes(k)||((typeof x==='number'||typeof x==='string')&&ids.includes(String(x))));
}
function relevantRows(doc,ids){
 const found=[];
 function walk(v,d){
  if(!v||typeof v!=='object'||d>8||found.length>=20)return;
  if(matchesRow(v,ids)){
   const fields=Object.entries(v).filter(([k,x])=>/^(?:.*(?:id|event|char|card|rarity|type).*)$/i.test(k)&&typeof x==='number'&&Number.isSafeInteger(x)).map(([k,x])=>[k,x]);
   const numericPositions=Array.isArray(v)?v.slice(0,12).map((x,i)=>typeof x==='number'&&Number.isSafeInteger(x)?[i,x]:null).filter(Boolean):[];
   found.push({shape:shape(v),identityFields:fields,numericPositions});
  }
  for(const x of Object.values(v))if(x&&typeof x==='object')walk(x,d+1);
 }
 walk(doc,0);
 return found;
}
(async()=>{
 robots=await read('/robots.txt',100000,'text/plain');
 await new Promise(r=>setTimeout(r,6000));
 const fetchPinned=async(key,version)=>{
  const body=await read('/data/umamusume/'+key+'.'+version+'.json',4*1024*1024,'json');
  if(!crypto.createHash('sha256').update(body).digest('hex').startsWith(version))throw Error('Version digest mismatch');
  return JSON.parse(body);
 };
 const supports=await fetchPinned('support-cards',refs.support);
 const rows=relevantRows(supports,targets);
 console.log('GT_SUPPORT_TARGET_MAP='+JSON.stringify({root:shape(supports,1),matches:rows}));
 const related=[...new Set([...targets,...rows.flatMap(r=>r.identityFields.filter(([k,v])=>/char/i.test(k)&&v>0).map(([k,v])=>String(v)))])];
 await new Promise(r=>setTimeout(r,6000));
 const friend=await fetchPinned('training_events/friend',refs.friend);
 console.log('GT_FRIEND_ROOT_SHAPE='+JSON.stringify(shape(friend)));
 console.log('GT_FRIEND_TARGET_MAP='+JSON.stringify({relatedIds:related,matches:relevantRows(friend,related)}));
})().catch(e=>{console.error('GT_PROBE_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
