'use strict';
// Daily handoff uses the same validated data branch as discovery. Publication
// requires both a reviewed common policy and the explicit publication flag.
const {selectRoutine}=require('./d073_daily_proposal.cjs');
const {readCurrent,appendReviewed,verifyPublicRaw,REF,CATALOG}=require('./d074_event_data_branch.cjs');
const {digest}=require('./event_release_gate.cjs');
const {validatePolicy}=require('./d073_routine_publication_policy.cjs');
const HASH=/^[a-f0-9]{64}$/,SHA=/^[a-f0-9]{40}$/;
const fail=m=>{throw Error('D074 daily data: '+m);};
async function runDailyData({config,publicationPolicy,queue,auto,store,github,owner,repo,baseSha,expectedHead,
 reader=readCurrent,appender=appendReviewed,rawVerifier=verifyPublicRaw}={}){
 if(!config||Object.keys(config).sort().join(',')!=='mode,routinePublicationPolicy,schemaVersion'||config.schemaVersion!==1||
   !['disabled','plan','publish'].includes(config.mode)||(config.mode==='disabled'?config.routinePublicationPolicy!==null:!config.routinePublicationPolicy))fail('explicit configuration required');
 const report=(status,extra={})=>({dataKind:'d074-daily-data',schemaVersion:1,status,mode:config.mode,selectedIds:[],
  branchWritten:false,mainWritten:false,pagesDeployed:false,publicRawVerified:false,...extra});
 if(!publicationPolicy||Object.keys(publicationPolicy).sort().join(',')!=='automaticPublicationAllowed,schemaVersion'||
   publicationPolicy.schemaVersion!==1||typeof publicationPolicy.automaticPublicationAllowed!=='boolean')fail('explicit separate publication policy required');
 if(config.mode==='disabled')return report('disabled');
 if(config.mode==='publish'&&publicationPolicy.automaticPublicationAllowed!==true)return report('publication-disabled-by-policy');
 validatePolicy(config.routinePublicationPolicy);
 if(config.routinePublicationPolicy.schemaVersion!==2)fail('D075 indefinite policy required for daily automation');
 if(!SHA.test(expectedHead||'')||!SHA.test(baseSha||'')||!github?.rest?.git||!github?.rest?.pulls)fail('fixed coordinates required');
 const coord={owner,repo},ref=async ref=>(await github.rest.git.getRef({...coord,ref})).data.object.sha;
 const stable=async()=>{if(await ref('heads/main')!==baseSha||await ref(REF)!==expectedHead)fail('code or data head drift');};
 await stable();
 const current=await reader({github,...coord});
 if(current.head!==expectedHead||digest(JSON.parse(current.catalogText))!==queue?.catalogSha256)fail('queue snapshot drift');
 let selected=await selectRoutine({config,queue,auto,store,github,...coord,baseSha,files:{[CATALOG]:current.catalogText}});
 if(selected.status!=='selected')return report(selected.status);
 let expectedRoutine=selected.selectedIds.map(cardId=>{
  const r=queue.rows.find(r=>r.cardId===cardId)?.routine;
  if(!HASH.test(r?.receiptSha256||'')||!HASH.test(r?.eventDigestsSha256||'')||!Array.isArray(r.events)||
    digest({events:r.events})!==r.eventDigestsSha256)fail('queued receipt mismatch');
  return {cardId,receiptSha256:r.receiptSha256,eventDigestsSha256:r.eventDigestsSha256};
 });
 const open=(await github.rest.pulls.list({...coord,state:'open',base:'main',per_page:100})).data;
 if(!Array.isArray(open)||open.length>=100)fail('incomplete open PR list');
 if(open.some(p=>p.head?.ref?.startsWith('automation/d072-release-')||/^<!-- D072_RELEASE_PROPOSAL /.test(p.body||'')))return report('legacy-proposal-open');
 await stable();
 // Plan before any write. If the combined preflight fails, isolate
 // candidates without ever retrying a possibly committed publication.
 const call=async (mode,selection=selected,routine=expectedRoutine)=>{
  const result=await appender({github,...coord,baseSha,expectedHead,mode,evidence:selection.evidence,
   routinePublicationPolicy:config.routinePublicationPolicy,expectedRoutine:routine});
  if(result?.baseSha!==baseSha||result.previousHead!==expectedHead||JSON.stringify(result.newCardIds)!==JSON.stringify(selection.selectedIds)||
     result.mainWritten!==false||result.pagesDeployed!==false||result.branchWritten!==(mode==='publish'))fail('append report mismatch');
  return result;
 };
 let preview,heldIds=[];
 const continueAfterHeld=async ids=>{
  const remaining={...queue,rows:queue.rows.filter(row=>!ids.includes(row.cardId))};
  if(!remaining.rows.some(row=>row.status==='ready-for-publication-decision'))return report('candidate-validation-held',{heldIds:ids});
  // The remaining set strictly shrinks; no retry of a failed candidate or
  // potentially committed write within this run.
  const next=await runDailyData({config,publicationPolicy,queue:remaining,auto,store,github,owner,repo,baseSha,expectedHead,reader,appender,rawVerifier});
  return {...next,status:['no-pending-cards','no-routine-candidates'].includes(next.status)?'candidate-validation-held':next.status,heldIds:[...ids,...(next.heldIds??[])]};
 };
 {
  try{preview=await call('plan');}
  catch(error){
   await stable();
   if(selected.selectedIds.length===1)return continueAfterHeld(selected.selectedIds);
   const good=[];
   for(const [i,id] of selected.selectedIds.entries()){
    const selection={selectedIds:[id],evidence:[selected.evidence[i]]},routine=[expectedRoutine[i]];
    try{good.push({selection,routine,preview:await call('plan',selection,routine)});}
    catch{await stable();heldIds.push(id);}
   }
   if(!good.length)return continueAfterHeld(heldIds);
   // If both pass separately but not together, publish only the first.
   ({selection:selected,routine:expectedRoutine,preview}=good[0]);
  }
 }
 const held=heldIds.length?{heldIds}:{};
 if(config.mode==='plan')return report('planned',{selectedIds:selected.selectedIds,receiptSha256:preview.receiptSha256,revision:preview.revision,...held});
 await stable();
 const result=await call('publish');
 const checked=await rawVerifier({...coord,report:result});
 if(checked.publicRawVerified!==true||checked.head!==result.head)fail('public verification mismatch');
 return report('published-raw-verified',{selectedIds:selected.selectedIds,receiptSha256:result.receiptSha256,revision:result.revision,head:result.head,branchWritten:true,publicRawVerified:true,...held});
}
module.exports={runDailyData};
