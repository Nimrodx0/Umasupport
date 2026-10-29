#!/usr/bin/env node
'use strict';
/*
 * Read-only automatic new-card intake plan. No browser/source crawling and
 * absolutely no modification of existing public DB, approvals or snapshots.
 * Operates only on source data supplied in temporary local files.
 *
 * node poc/tools/plan_new_card_event_intake.cjs \
 *    previous-support_card.txt current-support_card.txt \
 *    reviewed_events.v1.json [gameTora-original-site-candidates.json] [prior-pending.json]
 */
const fs=require('node:fs');
const {discoverNewCardsFromUmaSim,stageNewCardEvents}=
 require('../src/new_card_event_incremental.cjs');
const fail=s=>{throw Error('新規カード増分取り込み計画: '+s);};
function plan({previousSupportText,currentSupportText,existingCatalog,
 candidates=[],pendingCardIds=[]}={}){
 const discovered=discoverNewCardsFromUmaSim({
  previousSupportText,currentSupportText
 });
 const staged=stageNewCardEvents({
  discovery:discovered,existingCatalog,candidates,pendingCardIds
 });
 return {
  dataKind:'new-card-event-intake-plan',version:1,
  baselineCards:discovered.previousRosterCount,
  currentCards:discovered.currentRosterCount,
  newlyObservedIds:discovered.addedCardIds,
  readyIds:staged.ready.map(x=>x.cardId),
  alreadyImportedIds:staged.alreadyImportedIds,
  // Keep both unresolved and merely staged cards until they are ACTUALLY
  // present in the existing approved catalog on the next run.
  carryForwardPendingIds:staged.targetNewIds,
  pending:staged.pending,
  oldCatalogCardCount:staged.existingCardCount,
  // No source body or third-party event prose in the automated report.
  existingCatalogDigest:staged.existingCatalogDigest,
  sourceSiteCardVisitsPerformed:0,
  publishedEventsChanged:0,
  sourceEventsPublishedAutomatically:false,
  existingDatabaseUnchanged:true,
  publicationApproved:false
 };
}
function main(args){
 if(![3,4,5].includes(args.length))fail(
  '引数: previous-support.txt current-support.txt existing-events.json [gameTora-site-candidates.json] [prior-pending.json]');
 const [before,after,catalogPath,candidatesPath,pendingPath]=args;
 const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const result=plan({
  previousSupportText:fs.readFileSync(before,'utf8'),
  currentSupportText:fs.readFileSync(after,'utf8'),
  existingCatalog:readJson(catalogPath),
  candidates:candidatesPath?readJson(candidatesPath).cards:[],
  pendingCardIds:pendingPath?readJson(pendingPath).pendingCardIds:[]
 });
 process.stdout.write('NEW_CARD_EVENT_INTAKE_PLAN='+JSON.stringify(result)+'\n');
}
if(require.main===module){
 try{main(process.argv.slice(2));}
 catch(e){process.stderr.write(String(e.message).slice(0,260)+'\n');process.exitCode=1;}
}
module.exports={plan};
