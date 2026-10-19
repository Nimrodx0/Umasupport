#!/usr/bin/env node
'use strict';
// Local inputs only; no HTTP. Diagnostics are never a production event catalog.
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../src/live_loader.js');
const {extract}=require('../src/checker_hint_fact_extract.cjs');
const {compare}=require('../src/event_gap_audit.js');
const {build}=require('../src/checker_review_queue.cjs');
const root=path.resolve(__dirname,'../..');
const isWithin=(file,dir)=>file===dir||file.startsWith(dir+path.sep);
function main(){
 if(process.argv.length!==7)throw Error('Usage: node poc/tools/build_checker_review_queue.cjs <support_card.txt> <checker_Events.json> <skill_data.txt> <cruise_library.json> <output.json>');
 const [support,checkerFile,skillFile,cruiseFile,out]=process.argv.slice(2).map(v=>path.resolve(v));
 if(isWithin(out,root)&&!isWithin(out,path.join(root,'local-data')))
  throw Error('Never write review-only candidate queue into tracked project paths');
 if([support,checkerFile,skillFile,cruiseFile].includes(out))throw Error('Cannot overwrite input');
 const realParents=[root,path.join(root,'local-data')];
 // Refuse symlinked output parent escaping local-data into another tracked path.
 if(isWithin(out,root)&&fs.existsSync(path.dirname(out))){
  const parent=fs.realpathSync(path.dirname(out));
  if(!isWithin(parent,path.join(root,'local-data')))
   throw Error('Candidate output parent resolves outside local-data');
 }
 const model=loader.buildModel(fs.readFileSync(support,'utf8'),{mode:'audit'});
 const source=JSON.parse(fs.readFileSync(checkerFile,'utf8').replace(/^\uFEFF/,''));
 const skills=fs.readFileSync(skillFile,'utf8');
 const cruise=JSON.parse(fs.readFileSync(cruiseFile,'utf8'));
 const aliases=JSON.parse(fs.readFileSync(path.join(root,'poc/config/checker-name-aliases.json'),'utf8'));
 const candidates=extract({source,model,skillText:skills,aliases});
 if(!cruise.Support||!['SR','SSR'].every(r=>cruise.Support[r]&&typeof cruise.Support[r]==='object'))
  throw Error('Invalid second-source structure');
 const checkerRows=['SSR','SR'].flatMap(r=>Object.entries(source.Skills[r]).map(([name,raw])=>({
  rarity:r,name,events:raw.Events
 })));
 const cruiseRows=['SSR','SR'].flatMap(r=>Object.entries(cruise.Support[r]).map(([name,raw])=>({
  rarity:r,name,events:raw.Event
 })));
 const gaps=compare({modelCards:model.cards,checkerCards:checkerRows,cruiseCards:cruiseRows});
 const queue=build({candidates,gaps});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(queue,null,2)+'\n',{flag:'wx',encoding:'utf8',mode:0o600});
 console.log(JSON.stringify({
  approvalState:queue.approvalState,
  comparisonScope:queue.comparisonScope,
  extractedHintRows:candidates.stats.extractedHintRows,
  matchedNumericHints:candidates.stats.matchedNumericHints,
  unresolvedHintRows:candidates.stats.unresolvedHints+candidates.stats.ambiguousHints,
  ...queue.totals,
  crossSource:{bothCards:gaps.summary.bothCards,
   checkerOnlyEventTitleRows:gaps.summary.checkerOnlyEventRecords,
   cruiseOnlyEventTitleRows:gaps.summary.cruiseOnlyEventRecords,
   nonindependentSources:true}
 },null,2));
}
try{main();}catch(e){console.error('Candidate queue failed:',e.message);process.exitCode=1;}
