#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {verifyDerived}=require('../src/checker_explicit_result_extract.cjs');
const {build,verify}=require('../src/checker_result_review_queue.cjs');
const root=path.resolve(__dirname,'../data/candidates');
function main(){
 const old=JSON.parse(fs.readFileSync(path.join(root,'checker_event_hints.v1.json'),'utf8'));
 const facts=JSON.parse(fs.readFileSync(path.join(root,'checker_explicit_result_facts.v1.json'),'utf8'));
 const counts=verifyDerived(old,facts);
 const output=path.join(root,'checker_explicit_result_review_queue.v1.json');
 const mode=process.argv[2]||'--verify';
 if(!['--verify','--create'].includes(mode)||process.argv.length>3)throw Error('Use --verify or --create');
 if(mode==='--create'){
  fs.writeFileSync(output,JSON.stringify(build(old,facts),null,2)+'\n',{flag:'wx'});
 }else{
  const queue=JSON.parse(fs.readFileSync(output,'utf8'));
  console.log(JSON.stringify({facts:counts,review:verify(old,facts,queue)},null,2));
 }
}
if(require.main===module)main();
