#!/usr/bin/env node
'use strict';
// Only ephemeral, metadata-only observations. No network to legacy mirror.
const fs=require('node:fs');
const {gitBlobSha,POLICY}=require('../src/current_umasim_roster_delta.cjs');
const {plan}=require('./plan_new_card_event_intake.cjs');
const {inspect}=require('./probe_official_gametora_target_cards.cjs');
async function main(args){
 if(args.length!==5)throw Error('usage: old-roster current-roster skill-data pinned-metadata batch-offset');
 const [oldPath,newPath,skillFile,metaPath,offsetText]=args;
 const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
 if(!/^[a-f0-9]{40}$/.test(meta.commit)||!['cardBlob','skillBlob'].every(k=>/^[a-f0-9]{40}$/.test(meta[k])))throw Error('Invalid pinned UmaSim metadata');
 const old=fs.readFileSync(oldPath,'utf8'),current=fs.readFileSync(newPath,'utf8');
 if(gitBlobSha(old)!==POLICY.beforeBlob||gitBlobSha(current)!==meta.cardBlob)throw Error('UmaSim roster hash mismatch');
 const p=plan({previousSupportText:old,currentSupportText:current,existingCatalog:require('../data/reviewed_events.v1.json')});
 const offset=Number(offsetText);
 const result=await inspect({plan:p,skillFile,skillBlobSha:meta.skillBlob,offset});
 const report={umaSimCommit:meta.commit,baselineCards:p.baselineCards,currentCards:p.currentCards,existingCatalogDigest:p.existingCatalogDigest,...result};
 process.stdout.write('GT_DIRECT_NEW_CARD_INTAKE='+JSON.stringify(report)+'\n');
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{process.stderr.write(String(e.message).slice(0,240)+'\n');process.exitCode=1;});
module.exports={main};
