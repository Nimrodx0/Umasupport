#!/usr/bin/env node
'use strict';
// Use explicit, local files; never fetch/redistribute GameWith articles.
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../src/live_loader.js');
const inventory=require('../src/curated_event_inventory.cjs');
const root=path.resolve(__dirname,'../..');
const indexFile='poc/data/curation/source_index.v1.json';
function readJSON(relative){
 const full=path.resolve(root,relative);
 if(!full.startsWith(root+path.sep))throw Error('Path outside repository: '+relative);
 return JSON.parse(fs.readFileSync(full,'utf8'));
}
function main(){
 if(process.argv.length!==4)throw Error('Usage: node report_curated_event_inventory.cjs <support_card.txt> <skill_data.txt>');
 const supportText=fs.readFileSync(process.argv[2],'utf8');
 const skillText=fs.readFileSync(process.argv[3],'utf8');
 const model=loader.buildModel(supportText,{mode:'audit'});
 const index=readJSON(indexFile);
 const drafts=Object.fromEntries(inventory.validateIndex(index).map(row=>[
  row.draftFile,readJSON(row.draftFile)
 ]));
 const published=readJSON('poc/data/reviewed_events.v1.json');
 const {forCatalog}=require('../src/current_public_event_approvals.cjs');
 const {verifyRelease}=require('../src/event_release_gate.cjs');
 // Verify the entire public catalog against the source-SHA-bound owner
 // approval first. Only non-GT records are within the scope of this separate
 // GameWith-curation intake; GT events are not "unapproved" because this
 // editorial source index did not author them.
 const signed=verifyRelease(published,forCatalog(published));
 const curatedPublished={schemaVersion:1,cards:published.cards.map(c=>({
  cardId:c.cardId,coverageStatus:c.coverageStatus,
  events:c.events.filter(e=>!e.id.startsWith('gt-'))
 })).filter(c=>c.events.length)};
 const stats=inventory.audit({index,model,draftCatalogs:drafts,
  publicCatalog:curatedPublished,skillText,
  supplementalSkills:readJSON('poc/data/curation/supplemental_skills.v1.json')});
 stats.otherSignedGTEvents=signed.publicEvents-curatedPublished.cards.reduce(
  (n,c)=>n+c.events.length,0);
 console.log(JSON.stringify({source:'Pinned UmaSim support_card + skill_data; GameWith-first editorial index (NO article download)',
  ...stats,coverageScope:'Draft entry count is NOT game event completeness; all draft cards partial',
  note:'No draft enters the live production reviewed-event catalog through this report'},null,2));
}
try{main();}catch(e){console.error('Curated event coverage audit failed:',e.message);process.exitCode=1;}
