#!/usr/bin/env node
'use strict';
/* Offline summary only: never writes public catalog, source prose, or approvals. */
const {build}=require('../src/phase2_publication_readiness.cjs');
try{
 const out=build();
 if(process.argv.includes('--json'))console.log(JSON.stringify(out,null,2));
 else{
  console.log('Phase 2 targeted publication-readiness worklist (NOT FULL ROSTER)');
  console.log(JSON.stringify(out.summary,null,2));
  for(const row of out.rows)
   console.log([row.cardId+'/'+row.sourceOrdinal,row.kind,
    row.sourceStatus,row.blockers.join(',')].join(' | '));
  console.log('Nothing was approved or published. Review source links and blockers per position.');
 }
}catch(e){console.error(e.message);process.exitCode=1;}
