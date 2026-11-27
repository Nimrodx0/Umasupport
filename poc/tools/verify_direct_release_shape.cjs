#!/usr/bin/env node
'use strict';
// A disposable in-memory rehearsal against the ACTUAL production loader.
// No catalog export, no review signatures, no source title or skill text logs.
const fs=require('node:fs'),crypto=require('node:crypto');
const {plan}=require('./plan_new_card_event_intake.cjs');
const {gitBlobSha,POLICY}=require('../src/current_umasim_roster_delta.cjs');
const {inspect,getSkillRegistry}=require('./probe_official_gametora_target_cards.cjs');
const {reviewCard,prepareNamedCandidate}=require('../src/direct_event_fact_review.cjs');
const {discoverNewCardsFromUmaSim,stageNewCardEvents}=require('../src/new_card_event_incremental.cjs');
const {verifyRelease,canonical}=require('../src/event_release_gate.cjs');
const loader=require('../src/live_loader.js'),publicEvents=require('../src/public_event_catalog.js');
const bridge=require('../src/skill_bridge.js');
const manifest=require('../config/direct-event-fact-review.v1.json');
const evidence=require('../config/direct-event-fact-review-evidence.v1.json');
const oldCatalog=require('../data/reviewed_events.v1.json');
const approvals=require('../config/event-release-approvals.gt2487.v2.json');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function main(args){
 if(!(args.length===5||args.length===6&&args[5]==='--d068-approved-payload'))throw Error('usage: old-roster current-roster current-skill pinned-meta historical-skill');
 const [oldPath,newPath,skillFile,metaFile,pinnedFile]=args;
 const approvedPayload=args[5]==='--d068-approved-payload';
 const before=fs.readFileSync(oldPath,'utf8'),current=fs.readFileSync(newPath,'utf8'),skills=fs.readFileSync(skillFile,'utf8'),pinned=fs.readFileSync(pinnedFile,'utf8');
 const meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));
 if(gitBlobSha(before)!==POLICY.beforeBlob||gitBlobSha(current)!==meta.cardBlob||gitBlobSha(skills)!==meta.skillBlob||
    meta.commit!==evidence.umaSimCommit||meta.skillBlob!==evidence.umaSimSkillBlob||sha(pinned)!==bridge.PINNED_SHA256)throw Error('fixed source mismatch');
 const registry=getSkillRegistry(skillFile,meta.skillBlob),p=plan({previousSupportText:before,currentSupportText:current,existingCatalog:oldCatalog});
 const oldDigest=sha(canonical(oldCatalog));
 const oldVerified=verifyRelease(oldCatalog,approvals);
 const candidates=[],summaries=[];
 for(const ids of [['20102','30322'],['30324']]){
  const report=await inspect({plan:p,skillFile,skillBlobSha:meta.skillBlob,targetIds:ids,onProjection:(record,titles)=>{
   const spec=manifest.cards.find(x=>x.cardId===record.cardId);
   const n=prepareNamedCandidate(reviewCard(record,spec,registry),spec,registry,titles,evidence);
   candidates.push(n.candidate);summaries.push(n.summary);
  }});
  if(report.sourceSiteCardVisitsPerformed!==ids.length||report.publicationApproved!==false)throw Error('bounded observations incomplete');
 }
 if(candidates.length!==3||summaries.reduce((n,c)=>n+c.events,0)!==12||
    summaries.reduce((n,c)=>n+c.verifiedSkillNames,0)!==19)throw Error('candidate count mismatch');
 const discovery=discoverNewCardsFromUmaSim({previousSupportText:before,currentSupportText:current});
 const stage=stageNewCardEvents({discovery,existingCatalog:oldCatalog,candidates});
 if(stage.ready.length!==3||stage.pending.map(x=>x.cardId).join(',')!=='10149,30323')throw Error('wrong staging scope');
 const combined={...structuredClone(oldCatalog),cards:[...structuredClone(oldCatalog.cards),...stage.ready]};
 const model=loader.buildModel(current);
 const opts={skillText:skills,pinnedSkillText:pinned,allowReviewedLegacy:true,fullRegistry:true};
 const oldRuntime=publicEvents.preflight(model,oldCatalog,opts).summary;
 const mergedRuntime=publicEvents.attach(model,combined,opts);
 if(mergedRuntime.eventsWithRecords!==oldRuntime.eventsWithRecords+12||
    mergedRuntime.cardsWithRecords!==oldRuntime.cardsWithRecords+3||
    sha(canonical(oldCatalog))!==oldDigest||
    canonical(combined.cards.slice(0,oldCatalog.cards.length))!==canonical(oldCatalog.cards))throw Error('combined runtime or existing catalog mismatch');
 let releaseBlocked=false;
 try{verifyRelease(combined,approvals);}catch(e){
  // The historical cohort uses the broad gt- prefix. It must reject
  // unsigned gt-site additions by cohort fingerprint mismatch BEFORE
  // any individual entry can be approved. Neither gate nor cohort changes.
  if(!/未承認のイベント|コホート数／承認済みSHA不一致: gt-derived-factual-2026-11-02-first-release$/.test(String(e)))throw e;
  releaseBlocked=true;
 }
 if(!releaseBlocked)throw Error('approval boundary bypassed');
 if(approvedPayload){
  const payload=require('../src/direct_named_release_d068.cjs').prepare({discovery,existingCatalog:oldCatalog,candidates,existingApprovals:approvals,model:loader.buildModel(current),skillText:skills,pinnedSkillText:pinned,allowReviewedLegacy:true});
  // This is the exact owner-authorized, hash-pinned and gate-validated
  // factual increment, not an unapproved draft or any raw source content.
  console.log('D068_APPROVED_APPEND='+JSON.stringify(payload));
 }
 console.log('GT_DIRECT_PRODUCTION_SHAPE='+JSON.stringify({cards:summaries,
  baseline:oldVerified,combinedCards:mergedRuntime.cardsWithRecords,combinedEvents:mergedRuntime.eventsWithRecords,
  existingCatalogUnchanged:true,pendingIds:stage.pending.map(x=>x.cardId),releaseBlocked,publicationApproved:false}));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(String(e.message).slice(0,200));process.exitCode=1});
module.exports={main};
