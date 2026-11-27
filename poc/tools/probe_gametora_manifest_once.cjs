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
(async()=>{
 robots=await read('/robots.txt',100000,'text/plain');
 await new Promise(r=>setTimeout(r,6000));
 const manifest=JSON.parse(await read('/data/manifests/umamusume.json',256000,'json'));
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw Error('Manifest layout changed');
 const keys=Object.keys(manifest).filter(k=>/^(training_events\/|dict\/(?:evrew|te_|choice_)|support-cards$)/.test(k)&&/^[a-zA-Z0-9_/-]+$/.test(k));
 console.log('GT_MANIFEST_META='+JSON.stringify({keys:keys.map(k=>({key:k,version:typeof manifest[k]==='string'&&/^[a-f0-9]{8,64}$/.test(manifest[k])?manifest[k]:null}))}));
 // A single category file, if advertised by the live manifest. No full
 // catalog scan, no other category files, no source or candidate artifacts.
 const key='training_events/friend',version=manifest[key];
 if(typeof version!=='string'||!/^[a-f0-9]{8,64}$/.test(version))throw Error('Current friend event entry absent');
 await new Promise(r=>setTimeout(r,6000));
 const document=JSON.parse(await read('/data/umamusume/'+key+'.'+version+'.json',4*1024*1024,'json'));
 console.log('GT_TARGET_SHAPES='+JSON.stringify({rootType:kind(document),rootCount:Object.keys(document).length,...locate(document),publicationApproved:false}));
})().catch(e=>{console.error('GT_PROBE_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
