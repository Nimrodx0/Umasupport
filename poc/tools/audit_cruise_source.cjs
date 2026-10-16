#!/usr/bin/env node
'use strict';
// Read-only source reconnaissance. No copyrighted event text is published in logs.
const URL='https://raw.githubusercontent.com/po-po-po-pong/umaumacruise_customjson/main/UmaMusumeLibrary.json';
const normalize=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
async function fetchText(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{accept:'application/json'}});
 if(!r.ok)throw new Error('HTTP '+r.status+' '+url);
 return r.text();
}
const describe=(v,depth=0)=>{
 if(Array.isArray(v))return {type:'array',length:v.length,element:depth<3?describe(v[0],depth+1):typeof v[0]};
 if(v&&typeof v==='object')return {type:'object',entries:Object.keys(v).length,
   keys:Object.keys(v).slice(0,16),
   sampleValues:depth<3?Object.fromEntries(Object.entries(v).slice(0,3).map(([key,item])=>[key,describe(item,depth+1)])):undefined};
 if(typeof v==='string')return {type:'string',length:v.length,isNumericId:/^\d{5}$/.test(v)};
 return {type:typeof v,value:typeof v==='number'?v:undefined};
};
async function main(){
 const dataText=await fetchText(URL),data=JSON.parse(dataText);
 console.log('SOURCE_SCHEMA_START');
 console.log(JSON.stringify({downloadBytes:Buffer.byteLength(dataText),root:describe(data)},null,2));
 console.log('SOURCE_SCHEMA_END');
}
main().catch(e=>{console.error('SOURCE_AUDIT_ERROR '+e.stack);process.exitCode=1;});
