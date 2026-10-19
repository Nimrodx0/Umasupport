#!/usr/bin/env node
'use strict';
// Deterministic offline regeneration. Source texts are never published here.
const fs=require('node:fs');
const {build,verifySnapshot}=require('../src/event_coverage_index.cjs');
function main(){
 if(process.argv.length!==4)throw Error('Usage: node poc/tools/build_event_coverage_index.cjs <support_card.txt> <output.json>');
 const [input,output]=process.argv.slice(2);
 const facts=require('../data/candidates/checker_choice_results.v1.json');
 const drafts=require('../data/curation/source_index.v1.json');
 const index=build({rosterText:fs.readFileSync(input,'utf8'),choiceFacts:facts,curationIndex:drafts});
 verifySnapshot(index);
 if(output.endsWith('/reviewed_events.v1.json')||output==='reviewed_events.v1.json')
  throw Error('公開イベントDBへの上書きはできません');
 fs.writeFileSync(output,JSON.stringify(index,null,2)+'\n');
 console.log(JSON.stringify(index.stats,null,2));
}
if(require.main===module)main();
