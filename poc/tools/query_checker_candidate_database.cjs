#!/usr/bin/env node
'use strict';
/* Read-only editorial lookup. Outputs game skill numbers and position only. */
const fs=require('node:fs');
const path=require('node:path');
const {validate,card}=require('../src/checker_candidate_database.cjs');
const file=path.resolve(__dirname,'../data/candidates/checker_event_hints.v1.json');
function run(){
 const [id]=process.argv.slice(2);
 if(id&&!/^\d{5}$/.test(id))throw Error('Need a five-digit UmaSim support card ID');
 const db=JSON.parse(fs.readFileSync(file,'utf8'));
 const summary=validate(db);
 if(!id){console.log(JSON.stringify({summary,status:db.approvalState,sourcePins:db.sourcePins},null,2));return;}
 const c=card(db,id);
 if(!c){console.log(JSON.stringify({cardId:id,exists:false,approvalState:db.approvalState}));return;}
 const queue=db.reviewQueue.filter(x=>x.cardId===id);
 console.log(JSON.stringify({
  approvalState:db.approvalState,forSkillGrant:false,
  card:c,reviewQueue:queue
 },null,2));
}
try{run()}catch(e){console.error('候補DB照会失敗:',e.message);process.exitCode=1;}
