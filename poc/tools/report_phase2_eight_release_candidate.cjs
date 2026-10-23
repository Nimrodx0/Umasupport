#!/usr/bin/env node
'use strict';
/*
 * Read-only, offline. Never writes poc/data/reviewed_events.v1.json or the
 * actual approval ledger. --json prints the *unsigned* review packet to STDOUT.
 */
const {build}=require('../src/phase2_eight_release_candidate.cjs');
function main(args=process.argv.slice(2)){
 if(args.length>1||args.some(a=>a!=='--json'))
  throw Error('usage: node poc/tools/report_phase2_eight_release_candidate.cjs [--json]');
 const result=build();
 if(args.includes('--json'))console.log(JSON.stringify(result,null,2));
 else{
  console.log('Phase2 eight-event public-schema candidate (NOT RELEASED):');
  console.log(JSON.stringify(result.summary));
  for(const x of result.approvalWorksheet.entries)
   console.log(x.cardId+'/'+x.sourceOrdinal+' '+x.eventId+' sha256='+x.eventSha256+
    ' approval='+x.status);
  console.log('Actual public event catalog and approvals were NOT modified.');
 }
 return result.summary;
}
if(require.main===module){
 try{main();}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main};
