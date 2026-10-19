#!/usr/bin/env node
'use strict';
// Check committed independent Phase-2 candidate/old-master mapping without GET.
const fs=require('node:fs'),path=require('node:path');
const {verifySnapshot}=require('../src/event_coverage_index.cjs');
const {attach}=require('../src/event_coverage_historical.cjs');
function main(){
 const root=path.resolve(__dirname,'..');
 const index=JSON.parse(fs.readFileSync(path.join(root,'data/candidates/event_coverage_index.v1.json'),'utf8'));
 const cls=require('../data/candidates/checker_route_classification.v1.json');
 const groups=require('../data/candidates/checker_chain_stage_audit.v1.json');
 verifySnapshot(index);
 const ids=new Set();
 for(const card of index.cards){
  if(!/^\d{5}$/.test(card.cardId)||ids.has(card.cardId)||
     !['R','SR','SSR'].includes(card.rarity)||!Array.isArray(card.observedCandidates))
   throw Error('カードID/レアリティの全件索引が不正');
  ids.add(card.cardId);
  if(card.observedCandidates.length!==card.observedCandidateCount)
   throw Error('候補イベント数が違う');
 }
 const bare=JSON.parse(JSON.stringify(index));
 delete bare.stats.historical2025;
 delete bare.historicalEvidenceStatus;
 for(const c of bare.cards){
  delete c.historicalPotentialGaps;delete c.historicalChainGroups;
  for(const e of c.observedCandidates)delete e.historical2025;
 }
 const rebuilt=attach(bare,cls,groups);
 if(JSON.stringify(index)!==JSON.stringify(rebuilt))
  throw Error('保存済み旧イベント照合が全件一致しません');
 const totals=index.stats.historical2025;
 if(totals.provisionalStrictLinks!==954||totals.typographySuggestions!==29||
    totals.unpairedHistoricalStoryIds!==63||totals.stageGroups!==349||
    totals.structurallyCompleteGroups!==312||totals.incompleteGroups!==33||
    totals.ambiguousGroups!==4||totals.verifiedGameRoutes!==0)
  throw Error('既知2025年数値母数と一致しません');
 console.log(JSON.stringify({cards:ids.size,events:index.stats.observedCheckerCandidates,historical:totals}));
}
if(require.main===module)main();
