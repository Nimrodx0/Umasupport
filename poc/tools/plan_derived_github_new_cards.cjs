#!/usr/bin/env node
'use strict';
/*
 * OFFLINE metadata-only diagnostic for the GitHub-derived primary source.
 * Input tree/discovery/catalog files must already be downloaded or generated.
 * Never fetches event prose, scrapes GameTora, writes a DB or publishes.
 */
const fs=require('node:fs');
const {planDerivedNewCardIntake}=
 require('../src/derived_github_new_card_source_plan.cjs');
const fail=s=>{throw Error('派生GitHub新カード計画CLI: '+s);};
function readJson(path){
 if(typeof path!=='string'||!path||!fs.existsSync(path))
  fail('ローカルJSON入力が存在しない');
 const stat=fs.statSync(path);
 if(!stat.isFile()||stat.size>15*1024*1024||stat.size===0)
  fail('ローカルJSONサイズ・形式が不正');
 try{return JSON.parse(fs.readFileSync(path,'utf8'));}
 catch{fail('JSONパースに失敗');}
}
function main(args){
 if(args.length!==8&&args.length!==10)
  fail('使い方: --tree PATH --commit SHA --discovery PATH --catalog PATH [--pending PATH]');
 const opts={};
 for(let i=0;i<args.length;i+=2){
  const key=args[i],value=args[i+1];
  if(!['--tree','--commit','--discovery','--catalog','--pending'].includes(key)||
     Object.hasOwn(opts,key)||typeof value!=='string'||!value)
   fail('オプション名・重複・値が不正');
  opts[key]=value;
 }
 if(['--tree','--commit','--discovery','--catalog'].some(x=>!opts[x]))
  fail('必要なオプションが不足');
 const pending=opts['--pending']?readJson(opts['--pending']):{pendingCardIds:[]};
 const pendingCardIds=Array.isArray(pending)?pending:pending.pendingCardIds;
 const result=planDerivedNewCardIntake({
  discovery:readJson(opts['--discovery']),
  existingCatalog:readJson(opts['--catalog']),
  pendingCardIds,sourceTree:readJson(opts['--tree']),
  sourceCommit:opts['--commit']
 });
 process.stdout.write('DERIVED_GITHUB_NEW_CARD_PLAN='+JSON.stringify(result)+'\n');
}
if(require.main===module)try{main(process.argv.slice(2));}catch(error){
 // Do not include file names, input contents, event prose or other exception
 // detail in logs. The module throws fixed, source-text-free messages.
 process.stderr.write(String(error.message).slice(0,240)+'\n');
 process.exitCode=1;
}
module.exports={main,readJson};
