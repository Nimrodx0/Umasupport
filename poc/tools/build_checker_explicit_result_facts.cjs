#!/usr/bin/env node
'use strict';
// Offline-only reconstruction. Never commit the third-party input files.
const fs=require('node:fs'),path=require('node:path');
const {generate,verifyDerived}=require('../src/checker_explicit_result_extract.cjs');
const root=path.resolve(__dirname,'..');
function main(){
 const [mode,rosterPath,skillsPath,checkerPath]=process.argv.slice(2);
 if(!['--verify','--create'].includes(mode)||!rosterPath||!skillsPath||!checkerPath||process.argv.length!==6)
  throw Error('Usage: node poc/tools/build_checker_explicit_result_facts.cjs --verify|--create <support_card.txt> <skill_data.txt> <Events.json>');
 const candidates=require('../data/candidates/checker_event_hints.v1.json');
 const aliases=require('../config/checker-name-aliases.json');
 const output=path.join(root,'data/candidates/checker_explicit_result_facts.v1.json');
 const computed=generate({rosterText:fs.readFileSync(rosterPath,'utf8'),
  skillText:fs.readFileSync(skillsPath,'utf8'),checkerText:fs.readFileSync(checkerPath,'utf8'),
  candidates,aliases});
 const payload=JSON.stringify(computed,null,2)+'\n';
 if(mode==='--create')fs.writeFileSync(output,payload,{encoding:'utf8',flag:'wx'});
 else if(fs.readFileSync(output,'utf8')!==payload)
  throw Error('Committed result facts differ from exact pinned source regeneration');
 console.log(JSON.stringify(verifyDerived(candidates,computed),null,2));
}
if(require.main===module)main();
