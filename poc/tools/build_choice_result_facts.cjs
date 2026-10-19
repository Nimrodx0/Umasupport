#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {build,validateStored}=require('../src/choice_result_facts.cjs');
const root=path.resolve(__dirname,'../data/candidates');
const input=path.join(root,'checker_event_hints.v1.json');
const output=path.join(root,'checker_choice_results.v1.json');
function main(){
 const arg=process.argv[2];
 if(process.argv.length>3||arg&&arg!=='--verify')
  throw Error('Usage: node poc/tools/build_choice_result_facts.cjs [--verify]');
 const db=JSON.parse(fs.readFileSync(input,'utf8'));
 if(arg==='--verify'){
  const current=JSON.parse(fs.readFileSync(output,'utf8'));
  console.log('Choice/outcome numeric facts:',JSON.stringify(validateStored(db,current)));
  return;
 }
 if(fs.existsSync(output))throw Error('Refusing to overwrite committed choice/result facts; remove generated output explicitly before regenerating');
 const result=build(db);
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx',encoding:'utf8'});
 console.log('Created choice/result numeric facts:',JSON.stringify(result.stats));
}
try{main()}catch(e){console.error('CHOICE_RESULT_FACTS_FAILED:',e.message);process.exitCode=1}
