#!/usr/bin/env node
'use strict';
const {join,query}=require('../src/phase2_event_review_lookup.cjs');
const queue=require('../data/candidates/checker_explicit_result_review_queue.v1.json');
const index=require('../data/candidates/event_coverage_index.v1.json');
function main(){
 const args=process.argv.slice(2),data=join({queue,index});
 if(args.length===1&&args[0]==='--summary'){
  console.log(JSON.stringify(data.stats,null,2));return;
 }
 let cardId=null,priority=null,limit=30;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--priority')priority=args[++i];
  else if(args[i]==='--limit')limit=Number(args[++i]);
  else if(/^\d{5}$/.test(args[i])&&!cardId)cardId=args[i];
  else throw Error('Usage: node poc/tools/query_checker_result_review.cjs [<cardId>] [--priority P0|P1|P2] [--limit 1..2109] | --summary');
 }
 console.log(JSON.stringify(query(data,{cardId,priority,limit}),null,2));
}
if(require.main===module)main();
