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
 const stats=inventory.audit({index,model,draftCatalogs:drafts,
  publicCatalog:readJSON('poc/data/reviewed_events.v1.json'),skillText,
  supplementalSkills:readJSON('poc/data/curation/supplemental_skills.v1.json')});
 console.log(JSON.stringify({source:'Pinned UmaSim support_card + skill_data; GameWith-first editorial index (NO article download)',
  ...stats,coverageScope:'Draft entry count is NOT game event completeness; all draft cards partial',
  note:'No draft enters the live production reviewed-event catalog through this report'},null,2));
}
try{main();}catch(e){console.error('Curated event coverage audit failed:',e.message);process.exitCode=1;}
