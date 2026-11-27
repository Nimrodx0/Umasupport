'use strict';
// Read-only pre-merge gate for the exact approved proposal. The ordinary
// maintainer merge remains separate: GITHUB_TOKEN merges can suppress Pages.
const {PATHS,render}=require('./d072_release_proposal.cjs');
const {canonical,digest}=require('./event_release_gate.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const SHA=/^[a-f0-9]{40}$/,HASH=/^[a-f0-9]{64}$/;
const fail=m=>{throw Error('D072 release CI gate: '+m);};
const workflows=[{file:'ci.yml',name:'PoC Core Tests',jobs:['browser-smoke','core-tests']},
 {file:'docs-integrity.yml',name:'Documentation Integrity',jobs:['Reference, provenance and decision safety']}];
const same=(a,b)=>canonical(a)===canonical(b);
function verifyProposalFiles({baseSha,hash,oldFiles,newFiles,receipt}){
 if(!SHA.test(baseSha||'')||!HASH.test(hash||'')||digest(receipt)!==hash||receipt.baseSha!==baseSha)fail('receipt digest or base mismatch');
 const r=render({files:oldFiles,baseSha,result:{catalog:JSON.parse(newFiles[PATHS[0]]),approvals:JSON.parse(newFiles[PATHS[1]]),
  status:'ready-to-append',existingCatalogUnchanged:true,newCardIds:receipt.newCardIds,
  appendedCardCount:receipt.after.cards-receipt.before.cards,appendedEventCount:receipt.after.events-receipt.before.events,
  releasePin:receipt.releasePin,proofs:receipt.proofs,independentReviewReceipts:receipt.independentReviewReceipts,sourceFactReceipts:receipt.sourceFactReceipts}});
 if(r.proposalSha!==hash||!same(r.receipt,receipt)||!same(r.files,newFiles))fail('proposal reconstruction mismatch');
 return r;
}
async function verifyPR({github,owner,repo,prNumber}={}){
 if(!github?.rest?.git||!github?.rest?.pulls||!github?.rest?.actions||!owner||!repo||
  !Number.isSafeInteger(prNumber)||prNumber<1)fail('scope');
 const {git:g,pulls:p,actions:a}=github.rest,coord={owner,repo},full=owner+'/'+repo;
 const getPR=async()=>(await p.get({...coord,pull_number:prNumber})).data;
 const pr=await getPR(),base=pr.base?.sha,head=pr.head?.sha,branch=pr.head?.ref;
 const hash=/^<!-- D072_RELEASE_PROPOSAL ([a-f0-9]{64}) -->\n/.exec(pr.body||'')?.[1];
 if(pr.number!==prNumber||pr.state!=='open'||pr.draft!==false||!HASH.test(hash||'')||
    branch!=='automation/d072-release-'+hash.slice(0,24)||pr.title!=='D072 reviewed event release '+hash.slice(0,16)||
    !SHA.test(base||'')||!SHA.test(head||'')||pr.base?.ref!=='main'||
    pr.base?.repo?.full_name!==full||pr.head?.repo?.full_name!==full)fail('not an approved proposal PR');
 const ref=async name=>(await g.getRef({...coord,ref:'heads/'+name})).data.object.sha;
 const refs=async()=>{if(await ref('main')!==base||await ref(branch)!==head)fail('base or head drift');};
 await refs();
 const commit=async sha=>{const c=(await g.getCommit({...coord,commit_sha:sha})).data;if(c.sha!==sha||!SHA.test(c.tree?.sha||''))fail('commit mismatch');return c;};
 const bc=await commit(base),hc=await commit(head);
 if(hc.parents?.length!==1||hc.parents[0].sha!==base)fail('proposal parent mismatch');
 async function tree(c){
  const t=(await g.getTree({...coord,tree_sha:c.tree.sha,recursive:'1'})).data;
  if(t.sha!==c.tree.sha||t.truncated!==false||!Array.isArray(t.tree))fail('incomplete tree');
  const rows=t.tree.filter(x=>x.type!=='tree');
  if(new Set(rows.map(x=>x.path)).size!==rows.length)fail('duplicate tree paths');
  return new Map(rows.map(x=>[x.path,x]));
 }
 const before=await tree(bc),after=await tree(hc),receiptPath='poc/config/d072-release-receipts/'+hash+'.json',allowed=[...PATHS,receiptPath];
 const changed=[...new Set([...before.keys(),...after.keys()])].filter(k=>{
  const a=before.get(k),b=after.get(k);return !a||!b||a.sha!==b.sha||a.mode!==b.mode||a.type!==b.type;
 }).sort();
 if(!same(changed,allowed.slice().sort())||before.has(receiptPath))fail('unexpected changed paths');
 async function read(map,path){
  const x=map.get(path);if(x?.type!=='blob'||x.mode!=='100644'||!SHA.test(x.sha||''))fail('blob scope');
  const b=(await g.getBlob({...coord,file_sha:x.sha})).data;
  if(b.sha!==x.sha||b.encoding!=='base64'||typeof b.content!=='string')fail('blob encoding');
  const bytes=Buffer.from(b.content,'base64'),text=bytes.toString('utf8');
  if(bytes.length!==b.size||gitBlobSha(text)!==x.sha)fail('blob hash mismatch');
  return text;
 }
 const oldFiles={},newFiles={};
 for(const path of PATHS)oldFiles[path]=await read(before,path);
 for(const path of allowed)newFiles[path]=await read(after,path);
 const receipt=JSON.parse(newFiles[receiptPath]),proposal=verifyProposalFiles({baseSha:base,hash,oldFiles,newFiles,receipt});
 const expectedBody='<!-- D072_RELEASE_PROPOSAL '+hash+' -->\n\nIndividually approved event increment. Cards: '+receipt.newCardIds.join(', ')+
  '.\n\nFixed base: '+base+'\nFixed head: '+head+'\nReceipt: '+receiptPath+
  '\n\nReview all PR checks against this head before merging. No CI approval, merge or deployment is performed by this workflow.';
 if(pr.body!==expectedBody)fail('PR body drift');
 const checks=[];
 for(const w of workflows){
  const runs=(await a.listWorkflowRuns({...coord,workflow_id:w.file,event:'pull_request',head_sha:head,per_page:100})).data;
  if(!Array.isArray(runs.workflow_runs)||runs.total_count!==runs.workflow_runs.length||runs.total_count>=100)fail('incomplete run list');
  const candidates=runs.workflow_runs.filter(x=>x.head_sha===head&&x.head_branch===branch&&x.event==='pull_request'&&
   x.repository?.full_name===full&&x.head_repository?.full_name===full&&x.path==='.github/workflows/'+w.file&&x.name===w.name);
  if(candidates.length!==runs.workflow_runs.length)fail('unexpected workflow run scope');
  const run=candidates.sort((x,y)=>y.id-x.id)[0];
  if(!run){checks.push({workflow:w.name,status:'missing'});continue;}
  if(!Array.isArray(run.pull_requests)||run.pull_requests.some(x=>x.number!==prNumber||x.head?.sha!==head||x.base?.sha!==base))fail('run PR mismatch');
  if(run.status!=='completed'||run.conclusion!=='success'){checks.push({workflow:w.name,runId:run.id,status:run.status==='completed'?'failed':'pending'});continue;}
  if(!Number.isSafeInteger(run.id)||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1)fail('run identity');
  const j=(await a.listJobsForWorkflowRunAttempt({...coord,run_id:run.id,attempt_number:run.run_attempt,per_page:100})).data;
  if(!Array.isArray(j.jobs)||j.total_count!==j.jobs.length||!same(j.jobs.map(x=>x.name).sort(),w.jobs.slice().sort())||
    j.jobs.some(x=>x.run_id!==run.id||x.head_sha!==head||x.status!=='completed'||x.conclusion!=='success'))fail('required jobs missing or failed');
  checks.push({workflow:w.name,runId:run.id,attempt:run.run_attempt,status:'success'});
 }
 await refs();
 const latest=await getPR();
 if(latest.state!=='open'||latest.draft!==false||latest.base?.sha!==base||latest.head?.sha!==head||latest.body!==pr.body||latest.title!==pr.title)fail('PR changed during verification');
 return {dataKind:'d072-release-ci-gate',prNumber,baseSha:base,headSha:head,proposalSha:hash,version:proposal.version,
  checks,readyForMaintainerMerge:latest.mergeable===true&&checks.every(c=>c.status==='success'),merged:false,deployed:false};
}
module.exports={verifyProposalFiles,verifyPR};
