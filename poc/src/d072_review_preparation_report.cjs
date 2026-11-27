'use strict';
// Prepare approval targets only from independently supplied evidence.
// No source-site access, no inferred approval or source prose output.
const {createReviewedIntake}=require('./d072_github_reviewed_intake.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const {digest}=require('./event_release_gate.cjs');
const SHA=/^[a-f0-9]{40}$/,CATALOG='poc/data/reviewed_events.v1.json';
const fail=m=>{throw Error('D072 review preparation: '+m);};
async function prepareReport({github,owner,repo,baseSha,catalogText,evidence,intake=createReviewedIntake({github,owner,repo})}={}){
 if(!SHA.test(baseSha||'')||typeof catalogText!=='string'||!github?.rest?.git||!owner||!repo)fail('base scope');
 const g=github.rest.git,coord={owner,repo};
 const main=async()=>(await g.getRef({...coord,ref:'heads/main'})).data.object.sha;
 if(await main()!==baseSha)fail('main drift');
 const c=(await g.getCommit({...coord,commit_sha:baseSha})).data;
 if(c.sha!==baseSha||!SHA.test(c.tree?.sha||''))fail('commit mismatch');
 const t=(await g.getTree({...coord,tree_sha:c.tree.sha,recursive:'1'})).data;
 if(t.sha!==c.tree.sha||t.truncated!==false||!Array.isArray(t.tree))fail('tree mismatch');
 const blobs=t.tree.filter(x=>x.path===CATALOG);
 if(blobs.length!==1||blobs[0].type!=='blob'||blobs[0].mode!=='100644'||blobs[0].sha!==gitBlobSha(catalogText))fail('catalog mismatch');
 const existingCatalog=JSON.parse(catalogText);
 const prepared=await intake.prepare({evidence,existingCatalog});
 if(prepared.publicationApproved!==false||!Array.isArray(prepared.items)||prepared.items.length!==evidence.length)fail('preparation scope');
 const cards=prepared.items.map(({candidate,receipt},i)=>{
  if(candidate.publicationApproved!==false||receipt.publicationApproved!==false||candidate.card.cardId!==evidence[i].cardId||
     receipt.cardId!==candidate.card.cardId||candidate.packetSha256!==receipt.packetSha256||
     (evidence[i]?.dataKind==='d073-source-title-input'?(receipt.dataKind!=='d073-source-fact-receipt'||receipt.titleInputSha256!==digest({titles:evidence[i].titles??candidate.card.events.map(e=>({sourceEventId:Number(e.id.split(':').at(-1)),title:e.name}))})||receipt.chainEvidenceSha256!==(evidence[i].chainEvidence===null?null:digest(evidence[i].chainEvidence))):receipt.independentEvidenceSha256!==digest(evidence[i]))||
     candidate.eventDigests.length!==candidate.card.events.length||
     candidate.card.events.some((e,i)=>candidate.eventDigests[i].eventId!==e.id||candidate.eventDigests[i].sha256!==digest(e)))fail('candidate receipt mismatch');
  return {cardId:receipt.cardId,packetSha256:receipt.packetSha256,...(receipt.dataKind==='d073-source-fact-receipt'?{sourceFactsSha256:receipt.sourceFactsSha256,titleInputSha256:receipt.titleInputSha256,chainEvidenceSha256:receipt.chainEvidenceSha256,receiptSha256:digest(receipt),eventDigestsSha256:digest({events:candidate.eventDigests})}:{independentEvidenceSha256:receipt.independentEvidenceSha256}),
   events:candidate.eventDigests,nonSkillOmissionCount:candidate.omissions.length};
 });
 if(await main()!==baseSha)fail('main drift after preparation');
 return {dataKind:'d072-approval-target-report',schemaVersion:1,baseSha,catalogSha256:digest(existingCatalog),cards,
  requiredChecks:['card','event','choices','outcomes','dependencies','publication'],publicationApproved:false};
}
module.exports={prepareReport};
