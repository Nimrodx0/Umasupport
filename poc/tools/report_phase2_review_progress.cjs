#!/usr/bin/env node
'use strict';
const {build,query}=require('../src/phase2_review_progress.cjs');
const args={
 queue:require('../data/candidates/checker_explicit_result_review_queue.v1.json'),
 index:require('../data/candidates/event_coverage_index.v1.json'),
 candidate:require('../data/candidates/checker_event_hints.v1.json'),
 facts:require('../data/candidates/checker_explicit_result_facts.v1.json'),
 audit:require('../data/candidates/editorial_branch_crosscheck.v1.json')
};
function main(){
 const ledger=build(args),argv=process.argv.slice(2);
 if(!argv.length||argv[0]==='--summary'){
  console.log(JSON.stringify(ledger.totals,null,2));return;
 }
 let priority=null,cardId=null,status=null,limit=30;
 for(let i=0;i<argv.length;i++){
  const flag=argv[i],value=argv[++i];
  if(flag==='--priority')priority=value;
  else if(flag==='--card')cardId=value;
  else if(flag==='--status')status=value;
  else if(flag==='--limit')limit=Number(value);
  else throw Error('Unknown argument: '+flag);
 }
 console.log(JSON.stringify(query(ledger,{priority,cardId,status,limit}),null,2));
}
if(require.main===module)main();
