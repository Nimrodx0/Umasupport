#!/usr/bin/env node
'use strict';
// Metadata-only CI; optional local-only private preview. No legacy mirror.
const fs=require('node:fs');
const path=require('node:path');
const policy=require('../config/direct-event-intake-policy.v1.json');
const {gitBlobSha,POLICY}=require('../src/current_umasim_roster_delta.cjs');
const {plan}=require('./plan_new_card_event_intake.cjs');
const {inspect,getSkillRegistry}=require('./probe_official_gametora_target_cards.cjs');
const {reviewCard,verifyObservedDigest,toUnapprovedIntakeCandidate,prepareNamedCandidate}=require('../src/direct_event_fact_review.cjs');
const reviewEvidence=require('../config/direct-event-fact-review-evidence.v1.json');
const reviewManifest=require('../config/direct-event-fact-review.v1.json');
function validatePolicy(){
 if(policy.schemaVersion!==1||policy.decision!=='D-067'||policy.origin!=='https://gametora.com'||
    policy.sourceType!=='GameTora-original-site'||policy.sourceVisitLimitPerInvocation!==2||
    policy.routineLegacySourceRequests!==false||policy.automaticPublicationAllowed!==false||
    policy.automaticScheduledSiteAccessAllowed!==true)throw Error('Direct intake policy boundary invalid');
}
function privatePath(file,env=process.env){
 if(env.CI||env.GITHUB_ACTIONS)throw Error('Private draft export forbidden in CI');
 if(typeof file!=='string'||!file.endsWith('.json'))throw Error('Private output must be a JSON file');
 const destination=path.join(fs.realpathSync(path.dirname(path.resolve(file))),path.basename(file));
 const root=fs.realpathSync(path.resolve(__dirname,'../..'));
 const relative=path.relative(root,destination);
 if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))
  throw Error('Private draft must be outside repository');
 if(fs.existsSync(destination))throw Error('Refusing to overwrite private draft');
 return destination;
}
// Stable card IDs avoid accidentally visiting a different pending card when
// a previous card is published or the roster changes between review runs.
function parseSelection(value){
 if(typeof value!=='string')throw Error('Invalid intake selection');
 if(/^[0-9]{1,3}$/.test(value))return {offset:Number(value),targetIds:null};
 if(/^ids:[1-9][0-9]{4}(,[1-9][0-9]{4})?$/.test(value)){
  const targetIds=value.slice(4).split(',');
  if(new Set(targetIds).size!==targetIds.length)throw Error('Duplicate target card ID');
  return {offset:0,targetIds};
 }
 throw Error('Use a batch offset or ids:<card-id>[,<card-id>] (maximum two)');
}
async function main(args){
 validatePolicy();
 if(!(args.length===5||args.length===6&&args[5]==='--review-known'||args.length===7&&args[5]==='--private-draft'))throw Error('usage: old-roster current-roster skill-data pinned-metadata batch-offset|ids:<card-id>[,<card-id>] [--review-known | --private-draft /outside/repo/review.json]');
 const draftFile=args.length===7?privatePath(args[6]):null,drafts=[];
 const [oldPath,newPath,skillFile,metaPath,offsetText]=args;
 const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
 if(!/^[a-f0-9]{40}$/.test(meta.commit)||!['cardBlob','skillBlob'].every(k=>/^[a-f0-9]{40}$/.test(meta[k])))throw Error('Invalid pinned UmaSim metadata');
 const old=fs.readFileSync(oldPath,'utf8'),current=fs.readFileSync(newPath,'utf8');
 if(gitBlobSha(old)!==POLICY.beforeBlob||gitBlobSha(current)!==meta.cardBlob)throw Error('UmaSim roster hash mismatch');
 const p=plan({previousSupportText:old,currentSupportText:current,existingCatalog:require('../data/reviewed_events.v1.json')});
 const {offset,targetIds}=parseSelection(offsetText);
 const review=args[5]==='--review-known',reviews=[];
 const registry=review||draftFile?getSkillRegistry(skillFile,meta.skillBlob):null;
 const result=await inspect({plan:p,skillFile,skillBlobSha:meta.skillBlob,offset,targetIds,
  onProjection:review||draftFile?(record,titles)=>{
   const spec=reviewManifest.cards.find(x=>x.cardId===record.cardId);
   if(review&&!spec)throw Error('No reviewed evidence for selected card '+record.cardId);
   const checked=spec?reviewCard(record,spec,registry):null;
   if(checked){verifyObservedDigest(checked.summary,reviewEvidence);reviews.push(checked.summary);}
   if(draftFile)drafts.push({...record,reviewedCandidate:checked?.candidate||null,
    unapprovedIntakeCandidate:checked?toUnapprovedIntakeCandidate(checked,reviewEvidence):null,
    namedProductionCandidate:checked?prepareNamedCandidate(checked,spec,registry,titles,reviewEvidence):null});
  }:null});
 if(review){
  if(reviews.length!==result.selectedCardIds.length||reviews.length===0)throw Error('Reviewed card source unavailable');
  process.stdout.write('GT_DIRECT_FACT_REVIEW='+JSON.stringify({cards:reviews,publicationApproved:false,existingCatalogUnchanged:true})+'\n');
 }
 if(draftFile){
  // Raw HTML, event/choice prose and screenshots are not returned by the
  // projection. This file is an unapproved local review input, not a catalog.
  fs.writeFileSync(draftFile,JSON.stringify({dataKind:'direct-new-card-private-review',schemaVersion:1,
   observedAt:new Date().toISOString(),umaSimCommit:meta.commit,umaSimCardBlob:meta.cardBlob,
   umaSimSkillBlob:meta.skillBlob,existingCatalogDigest:p.existingCatalogDigest,
   selectedCardIds:result.selectedCardIds,pendingCardIds:result.pendingCardIds,
   cards:drafts,sourceSiteTextCopied:false,publicationApproved:false},null,2)+'\n',{flag:'wx',mode:0o600});
 }
 const report={umaSimCommit:meta.commit,baselineCards:p.baselineCards,currentCards:p.currentCards,existingCatalogDigest:p.existingCatalogDigest,...result};
 process.stdout.write('GT_DIRECT_NEW_CARD_INTAKE='+JSON.stringify(report)+'\n');
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{process.stderr.write(String(e.message).slice(0,240)+'\n');process.exitCode=1;});
module.exports={main,privatePath,validatePolicy,parseSelection};
