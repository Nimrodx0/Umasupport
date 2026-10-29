#!/usr/bin/env node
'use strict';
/*
 * Fixed four-card REAL-source regression for the ORIGINAL mature converter.
 * Historical R/SR/SSR cards are an artificial "new-card" discovery fixture.
 * No source title, choice text, reward prose or unpublished catalog is logged.
 */
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const {discoverNewCards}=require('../src/new_card_event_incremental.cjs');
const {planDerivedNewCardIntake}=require('../src/derived_github_new_card_source_plan.cjs');
const {stageDerivedGitHubNewCards}=require('../src/derived_github_staging_bridge.cjs');
const PIN='62ec54e754f903e347da807d30aad40e53d794d2';
const SKILL_PIN='910dd79f046710245e0cc88a09c5c92b1044897e';
const samples=['10016','20075','30010','30030'];
function audit(dir,skillFile){
 const git=(...args)=>cp.execFileSync('git',['-C',dir,...args],
  {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:20*1024*1024}).trim();
 if(git('rev-parse','HEAD')!==PIN)throw Error('source-commit-drift');
 const root=path.resolve(dir);
 const sourceTree={sha:git('rev-parse','HEAD^{tree}'),
  truncated:false,tree:git('ls-tree','-r','HEAD').split('\n').map(line=>{
   const m=/^[0-7]{6} (blob|tree|commit) ([0-9a-f]{40})\t(.+)$/.exec(line);
   if(!m)throw Error('source-tree-invalid');
   return {type:m[1],sha:m[2],path:m[3]};
  })};
 const sourceDocuments=Object.fromEntries(samples.map(id=>[id,
  fs.readFileSync(path.join(root,'server/data/events/gametora/support_'+id+'.json'),'utf8')]));
 const skillText=fs.readFileSync(skillFile,'utf8');
 const discovery=discoverNewCards({previousRosterIds:['30001'],
  currentRosterIds:['30001',...samples]});
 const existingCatalog={schemaVersion:1,cards:[]};
 const plan=planDerivedNewCardIntake({
  discovery,existingCatalog,sourceTree,sourceCommit:PIN});
 const result=stageDerivedGitHubNewCards({
  discovery,existingCatalog,sourcePlan:plan,sourceDocuments,skillText,skillRevision:SKILL_PIN});
 const ready=result.newlyModeledCardIds;
 const pending=result.stage.pending.map(x=>x.cardId);
 if(JSON.stringify(ready)!==JSON.stringify(['10016','20075','30010'])||
    JSON.stringify(pending)!==JSON.stringify(['30030'])||
    result.reviewItems.filter(x=>x.cardId==='30010').length===0||
    result.carryForwardPendingIds.length!==4||
    result.publicationApproved!==false||
    result.stage.ready.some(c=>c.events.some(e=>
     e.sourceKind!=='derived-github-unreviewed')))
  throw Error('canonical-pinned-historical-stage-regression');
 return {sourceCommit:PIN,independentSkillCommit:SKILL_PIN,
  artificialHistoricalNewCardFixture:true,
  readyCardIds:ready,pendingCardIds:pending,
  reviewCountsByCard:Object.fromEntries(samples.map(id=>
   [id,result.reviewItems.filter(x=>x.cardId===id).length])),
  carriedForwardPendingCards:result.carryForwardPendingIds.length,
  publicationApproved:false,sourceEventTextEmitted:false};
}
if(require.main===module){
 try{
  if(process.argv.length!==4)throw Error('usage');
  const result=audit(process.argv[2],process.argv[3]);
  process.stdout.write('CANONICAL_PINNED_GITHUB_NEW_CARD_STAGING='+JSON.stringify(result)+'\n');
 }catch{
  // No third-party text, source-file path or raw exception is ever logged.
  process.stderr.write('CANONICAL_PINNED_GITHUB_NEW_CARD_STAGING_FAILED\n');
  process.exitCode=1;
 }
}
module.exports={audit};
