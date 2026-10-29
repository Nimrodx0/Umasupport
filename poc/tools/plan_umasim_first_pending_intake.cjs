#!/usr/bin/env node
'use strict';
/*
 * Pure UmaSim-first decision. No GitHub event-source calls, and no skill_data
 * read, until at least one unimported NEW support card needs event intake.
 */
const fs=require('node:fs');
const path=require('node:path');
const {planRosterFirst}=require('../src/derived_github_pending_refresh.cjs');
const {emptyLedger,verifyLedger}=require('../src/derived_github_pending_ledger.cjs');
function main(args){
 if(args.length!==5)throw Error('usage: <old-roster> <current-roster> <previous-ledger> <output-prefix> <github-output>');
 const [oldFile,newFile,previousFile,outputPrefix,ghOutput]=args;
 const read=p=>fs.readFileSync(path.resolve(p),'utf8');
 const previous=verifyLedger(JSON.parse(read(previousFile)));
 const existingCatalog=require('../data/reviewed_events.v1.json');
 const {discovery,targetIds,needThirdPartySource}=planRosterFirst({
  previousRosterText:read(oldFile),currentRosterText:read(newFile),
  previousLedger:previous,existingCatalog});
 const result={needThirdPartySource,
  newCardIds:discovery.addedCardIds,unimportedCardIds:targetIds};
 const prefix=path.resolve(outputPrefix);
 if(prefix.startsWith(path.resolve(__dirname,'../..')+path.sep))
  throw Error('persistent source preview files in checked-in tree forbidden');
 if(!needThirdPartySource){
  const empty=emptyLedger();
  const summary={previousRosterCount:discovery.previousRosterCount,
   currentRosterCount:discovery.currentRosterCount,
   discoveredNewCardIds:discovery.addedCardIds,
   sourceCommit:null,sourceTreeSha:null,
   independentlyPinnedSkillCommit:null,
   catalogAlreadyImportedIds:discovery.addedCardIds.filter(id=>
     existingCatalog.cards.some(c=>c.cardId===id)),
   missingSourceIds:[],fetchFailedIds:[],reusedUnchangedCardIds:[],
   fetchedEventCardIds:[],pendingCards:0,states:{},reviewIssues:0,
   skippedThirdPartySourceBecauseNoTargets:true,
   sourceProseIncluded:false,publicationApproved:false,
   existingDatabaseUnchanged:true};
  fs.writeFileSync(prefix+'.ledger.json',JSON.stringify(empty,null,2)+'\n');
  fs.writeFileSync(prefix+'.summary.json',JSON.stringify(summary,null,2)+'\n');
 }
 fs.appendFileSync(path.resolve(ghOutput),
  'needs_source='+String(needThirdPartySource)+'\n');
 process.stdout.write('UMASIM_FIRST_PENDING_CHECK='+JSON.stringify(result)+'\n');
 return result;
}
if(require.main===module)try{main(process.argv.slice(2));}
catch(e){process.stderr.write('UMASIM_FIRST_PENDING_CHECK_FAILED: '+
 String(e.message)+'\n');process.exitCode=1;}
module.exports={main};
