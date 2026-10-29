#!/usr/bin/env node
'use strict';
/*
 * Review-only offline tool. It NEVER edits poc/data or approval files.
 * Candidate text/unsigned review notes are not printed in CI logs.
 * Use `status` to learn what awaits human review; after a human has
 * independently completed all six review checks and the publication basis,
 * provide their external decisions file to `rehearse`.
 */
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('../src/phase2_eight_release_candidate.cjs');
const {buildModel}=require('../src/live_loader.js');
const {rehearseApprovedExistingEvents}=
 require('../src/reviewed_existing_event_append.cjs');
const {verifyRelease}=require('../src/event_release_gate.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=x=>{throw Error('通常8イベント・初回公開審査CLI: '+x);};
const root=path.resolve(__dirname,'../..');
function run(args){
 const mode=args[0];
 const packet=build();
 const pub=require('../data/reviewed_events.v1.json');
 const prior=require('../config/event-release-approvals.v1.json');
 const existing=verifyRelease(pub,prior);
 if(mode==='status'&&args.length===1){
  const reviewIds=packet.approvalWorksheet.entries.map(x=>({
   cardId:x.cardId,eventId:x.eventId,sourceOrdinal:x.sourceOrdinal,
   digest:x.eventSha256,reviewStatus:'PENDING_HUMAN_RELEASE_REVIEW'
  }));
  const result={source:'phase2_eight_release_candidate.build',
   cardIds:[...new Set(reviewIds.map(x=>x.cardId))],candidateEvents:reviewIds.length,
   publicEvents:existing.publicEvents,events:reviewIds,
   publicationApproved:false,existingCatalogUnchanged:true};
  process.stdout.write('EVENT_REVIEW_STATUS='+JSON.stringify(result)+'\n');
  return result;
 }
 const worksheet=mode==='worksheet';
 if(!(worksheet&&args.length===2)&&!(mode==='rehearse'&&args.length===5))
  fail('usage: status | worksheet <outside-repo-directory> | rehearse <support_card.txt> <skill_data.txt> <decisions.json> <outside-repo-directory>');
 const destDir=worksheet?args[1]:args[4];
 // Require a pre-existing separate directory that is NOT inside this
 // public repository, including through symlinks.
 const dest=fs.realpathSync(path.resolve(destDir));
 if(dest===root||dest.startsWith(root+path.sep))
  fail('レビュー候補や承認判断を公開リポジトリ内へ書き込めません');
 if(worksheet){
  const template={schemaVersion:1,entries:packet.approvalWorksheet.entries.map(row=>({
   cardId:row.cardId,eventId:row.eventId,eventSha256:row.eventSha256,
   reviewer:null,reviewedAt:null,
   checks:{...row.checks},evidence:copy(row.evidence),
   publicationBasis:null
  }))};
  const directory=fs.mkdtempSync(path.join(dest,'umasupport-review-worksheet-'));
  fs.chmodSync(directory,0o700);
  const file=path.join(directory,'decisions.template.json');
  fs.writeFileSync(file,JSON.stringify(template,null,2)+'\\n',
   {flag:'wx',mode:0o600});
  process.stdout.write('EVENT_REVIEW_WORKSHEET='+JSON.stringify({
   templateFile:file,candidateEvents:template.entries.length,
   signedReviewEvents:0,publicationExecuted:false})+'\\n');
  return template;
 }
 const [rosterFile,skillFile,decisionFile]=args.slice(1);
 const read=p=>fs.readFileSync(path.resolve(p),'utf8');
 const roster=read(rosterFile);
 const model=buildModel(roster);
 const skillText=read(skillFile);
 const decisions=JSON.parse(read(decisionFile));
 const result=rehearseApprovedExistingEvents({
  packet,decisions,existingCatalog:pub,existingApprovals:prior,
  model,skillText
 });
 if(!result.catalog){
  process.stdout.write('EVENT_RELEASE_REHEARSAL=PENDING_HUMAN_APPROVAL\n');
  return result;
 }
 // Only an explicit external decision file can produce a staged candidate,
 // and even then it must be moved into a separate, unpublished directory.
 const stageDir=fs.mkdtempSync(path.join(dest,'umasupport-reviewed-stage-'));
 fs.chmodSync(stageDir,0o700);
 for(const [name,value] of [
  ['reviewed_events.staged.json',result.catalog],
  ['event_release_approvals.staged.json',result.approvals]
 ]){
  fs.writeFileSync(path.join(stageDir,name),
   JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
 }
 const summary={status:result.status,stagedDirectory:stageDir,
  addedEventKeys:result.addedEventKeys,approvedNewEvents:result.approvedNewEvents,
  pendingReviewEvents:result.pendingReviewEvents,
  existingDatabaseUnchanged:true,publicRepositoryFilesUpdated:false,
  publicationExecuted:false};
 process.stdout.write('EVENT_RELEASE_REHEARSAL='+JSON.stringify(summary)+'\n');
 return summary;
}
if(require.main===module){
 try{run(process.argv.slice(2));}
 catch(err){process.stderr.write('EVENT_RELEASE_REHEARSAL_FAILED: '+
  String(err.message)+'\n');process.exitCode=1;}
}
module.exports={run};
