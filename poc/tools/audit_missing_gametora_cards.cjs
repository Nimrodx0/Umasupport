#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {triage}=require('../src/gametora_missing_card_triage.cjs');
function main(argv){
 if(argv.length!==2)throw Error('usage: <whole-provisional-index.json> <nonpublic-output.json>');
 const [input,output]=argv.map(x=>path.resolve(x));
 const publicTree=path.resolve(__dirname,'../data');
 if(output===input||output===publicTree||output.startsWith(publicTree+path.sep))
  throw Error('未承認の出典候補を本番用poc/dataへ出力できません');
 const report=triage(JSON.parse(fs.readFileSync(input,'utf8')));
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('GAMETORA_MISSING_SUPPORT_CARD_TRIAGE='+JSON.stringify(report));
 console.log('Source missing != in-game event absent; Checker is a provisional and derivative source.');
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e);process.exitCode=1;}
}
module.exports={main};
