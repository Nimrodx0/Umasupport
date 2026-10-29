'use strict';
/*
 * Private, version-bound validation of one actual JSON blob from the
 * structured GitHub-derived GameTora source. This stops BEFORE the
 * app's publishable schema, release approvals or any file writes.
 */
const crypto=require('node:crypto');
const {transformDocument}=require('./gametora_whole_event_normalize.cjs');
const fail=code=>{throw Error('GitHub派生イベント事前検証: '+code);};
const blobSha=text=>crypto.createHash('sha1').update(
 'blob '+Buffer.byteLength(text,'utf8')+'\0'+text).digest('hex');
function validateDerivedCardSource({plan,cardId,sourceText}={}){
 if(plan?.dataKind!=='derived-github-new-card-source-plan'||
    plan.version!==1||plan.primarySourceRepository!=='systemless10/UmamusumePS'||
    plan.publicationApproved!==false||plan.allSourceEventsValidated!==false||
    !/^[a-f0-9]{40}$/.test(plan.primarySourceCommit||'')||
    !Array.isArray(plan.results)||typeof cardId!=='string'||
    !/^[1-9]\d{4}$/.test(cardId))
  fail('source-plan-scope-invalid');
 const matching=plan.results.filter(r=>r.cardId===cardId);
 if(matching.length!==1||matching[0].status!=='source-blob-present-needs-validation'||
    !/^[a-f0-9]{40}$/.test(matching[0].sourceBlobSha||'')||
    matching[0].sourcePath!==
      'server/data/events/gametora/support_'+cardId+'.json')
  fail('card-not-source-pinned');
 if(typeof sourceText!=='string'||!sourceText.length||
    Buffer.byteLength(sourceText,'utf8')>2*1024*1024||
    blobSha(sourceText)!==matching[0].sourceBlobSha)
  fail('source-blob-content-not-identical');
 let doc;
 try{doc=JSON.parse(sourceText);}catch{fail('invalid-source-json');}
 if(doc?.kind!=='support'||String(doc.id)!==cardId)
  fail('source-card-id-or-kind-drift');
 let provisional;
 try{provisional=transformDocument(doc);}
 catch{fail('source-event-normalizer-rejected');}
 if(provisional.cardId!==cardId||
    !Number.isSafeInteger(provisional.sourceEventCount)||
    provisional.sourceEventCount<1||
    !Array.isArray(provisional.events)||
    provisional.events.length!==provisional.sourceEventCount)
  fail('source-event-count-drift');
 const reasons={};
 for(const item of provisional.reviewQueue){
  if(typeof item?.reason!=='string'||!/^\w{3,80}$/.test(item.reason))
   fail('unrecognized-review-reason');
  reasons[item.reason]=(reasons[item.reason]||0)+1;
 }
 return {dataKind:'derived-github-card-event-preflight',version:1,cardId,
  sourceRevision:plan.primarySourceCommit,
  sourceBlobSha:matching[0].sourceBlobSha,
  observedEvents:provisional.sourceEventCount,
  observedChoices:provisional.sourceChoiceCount,
  observedResultRoutes:provisional.sourceExpandedRoutes,
  numericParsedHintMentions:provisional.numericParsedHintMentions,
  unresolvedHintMentions:provisional.unresolvedHintMentions,
  directSkillGrantMentions:provisional.directSkillGrantMentions,
  explicitChainTerminalRoutes:provisional.explicitChainTerminalRoutes,
  conditionalRoutes:provisional.conditionalRoutes,
  reviewReasonCounts:reasons,
  rawEventTextEmitted:false,
  allSkillIdsMappedToApp:false,allInternalDependenciesVerified:false,
  publishableSchemaProduced:false,publicationApproved:false,
  existingDatabaseUnchanged:true};
}
module.exports={blobSha,validateDerivedCardSource};
