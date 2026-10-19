#!/usr/bin/env node
'use strict';
// Read-only offline audit of the exact externally downloaded source bytes.
// Does not emit third-party event titles, choices, images or article prose.
const fs=require('node:fs');
const crypto=require('node:crypto');
const converter=require('../src/community_candidate_preview.js');
if(process.argv.length!==5){
 console.error('Usage: node audit_expanded_candidate_preview.cjs events.json skill_data.txt supports.json');
 process.exit(2);
}
try{
 const raw=fs.readFileSync(process.argv[2]);
 const hash=crypto.createHash('sha256').update(raw).digest('hex');
 if(hash!==converter.SHA256)throw Error('Pinned external event hash mismatch');
 const events=JSON.parse(raw.toString('utf8'));
 const skillText=fs.readFileSync(process.argv[3],'utf8');
 const supports=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
 if(!Array.isArray(supports)||supports.length!==45||
    supports.some(x=>!Number.isInteger(x.id)))throw Error('Pinned supports roster invalid');
 const model={cardById:Object.fromEntries(supports.map(x=>[String(x.id),{id:String(x.id)}]))};
 const result=converter.fromSource(events,model,skillText);
 if(result.records!==119||result.cards!==44)throw Error('Expected actual pinned numeric coverage changed');
 console.log(JSON.stringify({
  verifiedExternalSha256:hash,selectableCandidateCards:result.cards,
  selectableCandidateEvents:result.records,
  substitutedDefaultAutoAsGuaranteed:false,
  omissions:result.omitted,reviewedGameEvents:0
 },null,2));
}catch(e){console.error('Expanded candidate preview audit failed:',e.message);process.exitCode=1;}
