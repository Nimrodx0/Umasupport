#!/usr/bin/env node
/* Read-only source audit; does not redistribute the upstream event dataset. */
'use strict';
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {buildModel}=require('../src/live_loader.js');
const {audit}=require('../src/cruise_source_audit.js');
const SOURCE_URL='https://raw.githubusercontent.com/po-po-po-pong/umaumacruise_customjson/main/UmaMusumeLibrary.json';
const UMA_URL='https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt';
async function retrieve(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(30000),cache:'no-store'});
 if(!r.ok)throw new Error('HTTP '+r.status+' at '+url);
 return r.text();
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==0&&!(args.length===3&&args[0]==='--local')){
  throw new Error('Usage: node poc/tools/audit_cruise_source.cjs [--local <UmaMusumeLibrary.json> <support_card.txt>]');
 }
 const texts=args.length?await Promise.all(args.slice(1).map(p=>fs.readFile(p,'utf8'))):
  await Promise.all([retrieve(SOURCE_URL),retrieve(UMA_URL)]);
 const [sourceText,umaText]=texts;
 const source=JSON.parse(sourceText),model=buildModel(umaText),report=audit(source,model);
 const {records,...summary}=report;
 const result={schemaVersion:1,runAt:new Date().toISOString(),
   inputs:[{url:args.length?'local file':SOURCE_URL,bytes:Buffer.byteLength(sourceText),sha256:crypto.createHash('sha256').update(sourceText).digest('hex')},
    {url:args.length?'local file':UMA_URL,bytes:Buffer.byteLength(umaText),sha256:crypto.createHash('sha256').update(umaText).digest('hex')}],
   ...summary};
 console.log('COMPREHENSIVE_AUDIT_JSON_START');
 console.log(JSON.stringify(result,null,2));
 console.log('COMPREHENSIVE_AUDIT_JSON_END');
}
main().catch(e=>{console.error('SOURCE_AUDIT_ERROR',e.stack);process.exitCode=1});
