#!/usr/bin/env node
'use strict';
// Deterministic offline regeneration. Source texts are never published here.
const fs=require('node:fs'),crypto=require('node:crypto');
const EXPECTED_UMASIM_SHA256='153213019b5232df6c211427b862978218b60df6baee03c2a5fee75e0966d424';
const {build,verifySnapshot}=require('../src/event_coverage_index.cjs');
const {attach}=require('../src/event_coverage_historical.cjs');
function main(){
 if(process.argv.length!==4)throw Error('Usage: node poc/tools/build_event_coverage_index.cjs <support_card.txt> <output.json>');
 const [input,output]=process.argv.slice(2);
 const facts=require('../data/candidates/checker_choice_results.v1.json');
 const drafts=require('../data/curation/source_index.v1.json');
 const rosterText=fs.readFileSync(input,'utf8');
 if(crypto.createHash('sha256').update(rosterText).digest('hex')!==EXPECTED_UMASIM_SHA256)
  throw Error('固定UmaSim版のSHA256が一致しません。版変更は先に独立監査が必要です');
 const source=require('../data/candidates/checker_route_classification.v1.json');
 const chains=require('../data/candidates/checker_chain_stage_audit.v1.json');
 const index=attach(build({rosterText,choiceFacts:facts,curationIndex:drafts}),source,chains);
 verifySnapshot(index);
 if(index.stats.historical2025.provisionalStrictLinks!==954||index.stats.historical2025.unpairedHistoricalStoryIds!==63||index.stats.historical2025.structurallyCompleteGroups!==312)throw Error('旧マスター全件整合が崩れています');
 if(output.endsWith('/reviewed_events.v1.json')||output==='reviewed_events.v1.json')
  throw Error('公開イベントDBへの上書きはできません');
 fs.writeFileSync(output,JSON.stringify(index,null,2)+'\n');
 console.log(JSON.stringify(index.stats,null,2));
}
if(require.main===module)main();
