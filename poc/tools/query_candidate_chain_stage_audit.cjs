#!/usr/bin/env node
'use strict';
/* Developer-only fact/position lookup. Never turns candidates into usable rewards. */
const fs=require('node:fs');
const path=require('node:path');
const {validateAudit}=require('../src/candidate_chain_stage_audit.cjs');
const root=path.resolve(__dirname,'../data/candidates');
function read(name){return JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));}
function main(){
 const arg=process.argv[2]||'--summary';
 if(process.argv.length>3||arg!=='--summary'&&arg!=='--first-pass'&&!/^\d{5}$/.test(arg))
  throw Error('Usage: node poc/tools/query_candidate_chain_stage_audit.cjs [--summary|--first-pass|five-digit cardId]');
 const db=read('checker_event_hints.v1.json'),cls=read('checker_route_classification.v1.json'),
  aud=read('checker_chain_stage_audit.v1.json');
 validateAudit(db,cls,aud);
 if(arg==='--summary')return console.log(JSON.stringify({
  approvalState:aud.approvalState,totals:aud.totals,
  note:'Historical numeric stage completeness is NOT verified game acquisition'
 },null,2));
 if(arg==='--first-pass'){
  const matches=aud.chainGroups.filter(x=>x.reviewBand==='readyForIndependentRouteReview');
  return console.log(JSON.stringify({
   count:matches.length,
   reviewOnlyFirstBatch:matches.slice(0,25).map(x=>({
    cardId:x.cardId,chainMax:x.chainMax,isGroupChain:x.isGroupChain,
    sourceKeys:x.events.map(e=>e.sourceKey),
    provisionalStoryIds:x.events.map(e=>e.provisionalStoryId)
   })),
   note:'Sample 25 only; run with a card ID to inspect a group. Never auto-approve.'},null,2));
 }
 console.log(JSON.stringify({cardId:arg,approvalState:aud.approvalState,
  chainGroups:aud.chainGroups.filter(x=>x.cardId===arg),
  unsequencedStrictEvents:aud.unsequencedStrictEvents.filter(x=>x.cardId===arg)},null,2));
}
try{main()}catch(e){console.error('CHAIN_STAGE_QUERY_FAILED:',e.message);process.exitCode=1;}
