#!/usr/bin/env node
'use strict';
/* Numeric-only read-only route triage; unverified candidates are never granted. */
const fs=require('node:fs');
const path=require('node:path');
const {verify}=require('../src/route_classification_verify.cjs');
function main(){
 const id=process.argv[2]||null;
 if(process.argv.length>3||id&&!/^\d{5}$/.test(id))
  throw Error('Usage: node poc/tools/query_candidate_event_routes.cjs [five-digit-card-id]');
 const root=path.resolve(__dirname,'../data/candidates');
 const db=JSON.parse(fs.readFileSync(path.join(root,'checker_event_hints.v1.json'),'utf8'));
 const cls=JSON.parse(fs.readFileSync(path.join(root,'checker_route_classification.v1.json'),'utf8'));
 const integrity=verify(db,cls);
 if(!id){
  console.log(JSON.stringify({status:cls.routeApprovalState,
   fullCoverage:cls.totals,integrity},null,2));
  return;
 }
 const card=cls.cards.find(c=>c.cardId===id)||null;
 console.log(JSON.stringify({cardId:id,
  candidateStatus:cls.routeApprovalState,card,
  possibleOldMasterGaps:cls.historicalPossibleGaps.filter(e=>e.cardId===id),
  reviewQueue:db.reviewQueue.filter(e=>e.cardId===id)},null,2));
}
try{main()}catch(e){console.error('ROUTE_LOOKUP_FAILED:',e.message);process.exitCode=1;}
