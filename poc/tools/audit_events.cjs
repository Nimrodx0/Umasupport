#!/usr/bin/env node
/* Developer-only, read-only audit. Never packages or writes third-party event text. */
'use strict';
const fs=require('node:fs/promises');
const loader=require('../src/live_loader.js');
const audit=require('../src/event_source_audit.js').audit;
const URLS=[
 'https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt',
 'https://raw.githubusercontent.com/Tsuyuchan-jp/umamusume-data/main/data/supports.json',
 'https://raw.githubusercontent.com/Tsuyuchan-jp/umamusume-data/main/data/events.json'
];
async function download(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(20000),cache:'no-store'});
 if(!response.ok)throw new Error(url+': HTTP '+response.status);
 const text=await response.text();
 if(text.length>2000000)throw new Error('Unexpectedly large source: '+url);
 return text;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length&&!(args.length===4&&args[0]==='--local')){
  console.error('Usage: node poc/tools/audit_events.cjs [--local support_card.txt supports.json events.json]');
  process.exitCode=2;return;
 }
 const input=args.length?await Promise.all(args.slice(1).map(p=>fs.readFile(p,'utf8'))):await Promise.all(URLS.map(download));
 const model=loader.buildModel(input[0]);
 const report=audit({supports:JSON.parse(input[1]),eventsDocument:JSON.parse(input[2]),model});
 const {skillMatches,perCard,...summary}=report;
 console.log(JSON.stringify({
  source:args.length?'local files':'public original URLs (read-only)',
  ...summary,
  perCard:Object.fromEntries(Object.entries(perCard).map(([id,v])=>[id,{matched:v.matched,sourceEventCount:v.sourceEventCount,auditStatus:v.auditStatus}])),
  warning:'Not a verified game-event catalog; unreviewed event chains and skill identities are NOT used by the app.'
 },null,2));
}
main().catch(e=>{console.error('Event audit failed:',e.message);process.exitCode=1;});
