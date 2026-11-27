'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {verifyPR}=require('../src/d072_release_ci_gate.cjs');
const {PATHS,render}=require('../src/d072_release_proposal.cjs');
const {digest}=require('../src/event_release_gate.cjs'),{gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const base='a'.repeat(40),head='b'.repeat(40),bt='c'.repeat(40),ht='d'.repeat(40),pin={commit:base,cardBlob:bt,skillBlob:ht};
const json=x=>JSON.stringify(x,null,2)+'\n';
function fixture(){
 const event=(id)=>({id:'gt-json:'+id+':1',name:'Synthetic',type:'auto',rewards:[]});
 const card=id=>({cardId:id,coverageStatus:'partial',events:[event(id)]});
 const approve=id=>({cardId:id,eventId:event(id).id,eventSha256:digest(event(id)),reviewer:'synthetic',reviewedAt:'2026-11-27',
 checks:Object.fromEntries(['card','event','choices','outcomes','dependencies','publication'].map(k=>[k,true])),
 evidence:Object.fromEntries(['card','event','choices','outcomes','dependencies','publication'].map(k=>[k,['https://example.org/synthetic']])),
 publicationBasis:{kind:'original-factual-description',reason:'synthetic'}});
 const catalog={schemaVersion:1,cards:[card('39997')]},approvals={schemaVersion:2,cohorts:[],entries:[approve('39997')]};
 const oldFiles=Object.fromEntries(PATHS.map((p,i)=>[p,[json(catalog),json(approvals),
 '# status\n## 現在の到達点と残る課題\n\n公開イベント（公開JSON実測）：**1件**／**1カード**\n',
 '<a href="poc/live.html?v=old-version">open</a>',
 '<div data-release="old-version">old-version</div><script src="a.js?v=old-version"></script><script src="b.js?v=old-version"></script>'][i]]));
 const result={catalog:{...catalog,cards:[...catalog.cards,card('39998')]},approvals:{...approvals,entries:[...approvals.entries,approve('39998')]},
 status:'ready-to-append',existingCatalogUnchanged:true,newCardIds:['39998'],appendedCardCount:1,appendedEventCount:1,releasePin:pin,
 proofs:[{cardId:'39998',packetSha256:'1'.repeat(64),sourcePin:pin,releasePin:pin,matchedSkillIds:[]}],
 independentReviewReceipts:[{schemaVersion:1,cardId:'39998',packetSha256:'1'.repeat(64),independentEvidenceSha256:'2'.repeat(64),reviewer:'synthetic',reviewedAt:'2026-11-27',evidenceUrls:['https://example.org/synthetic'],publicationApproved:false}]};
 const proposal=render({files:oldFiles,result,baseSha:base}),hash=proposal.proposalSha,branch=proposal.branch,full='test/repo';
 const blobs=new Map(),tree=files=>Object.entries({...files,'untouched.txt':'fixed'}).map(([path,text])=>{
  const sha=gitBlobSha(text);blobs.set(sha,text);return {path,sha,type:'blob',mode:'100644'};
 });
 const before=tree(oldFiles),after=tree(proposal.files);
 const state={main:base,branchHead:head,after,before,missing:false,pending:false,failed:false,badJob:false,badScope:false};
 const pr={number:9,state:'open',draft:false,mergeable:true,title:'D072 reviewed event release '+hash.slice(0,16),
 body:'<!-- D072_RELEASE_PROPOSAL '+hash+' -->\n\nIndividually approved event increment. Cards: 39998.\n\nFixed base: '+base+'\nFixed head: '+head+'\nReceipt: poc/config/d072-release-receipts/'+hash+'.json\n\nReview all PR checks against this head before merging. No CI approval, merge or deployment is performed by this workflow.',
 base:{sha:base,ref:'main',repo:{full_name:full}},head:{sha:head,ref:branch,repo:{full_name:full}}};
 const d=data=>({data}),github={rest:{git:{
  getRef:async({ref})=>d({object:{sha:ref==='heads/main'?state.main:state.branchHead}}),
  getCommit:async({commit_sha})=>d({sha:commit_sha,tree:{sha:commit_sha===base?bt:ht},parents:commit_sha===base?[]:[{sha:base}]}),
  getTree:async({tree_sha})=>d({sha:tree_sha,truncated:false,tree:tree_sha===bt?state.before:state.after}),
  getBlob:async({file_sha})=>{const bytes=Buffer.from(blobs.get(file_sha));return d({sha:file_sha,encoding:'base64',size:bytes.length,content:bytes.toString('base64')});}
 },pulls:{get:async()=>d(pr)},actions:{
  listWorkflowRuns:async({workflow_id,event,head_sha})=>{a.equal(event,'pull_request');a.equal(head_sha,head);
   const docs=workflow_id==='docs-integrity.yml';
   const rows=state.missing&&docs?[]:[{id:docs?2:1,name:docs?'Documentation Integrity':'PoC Core Tests',path:'.github/workflows/'+workflow_id,
    head_sha:state.badScope?base:head,head_branch:branch,event:'pull_request',repository:{full_name:full},head_repository:{full_name:full},
    pull_requests:[],status:state.pending?'in_progress':'completed',conclusion:state.failed?'failure':state.pending?null:'success',run_attempt:1}];
   return d({total_count:rows.length,workflow_runs:rows});},
  listJobsForWorkflowRunAttempt:async({run_id,attempt_number})=>{a.equal(attempt_number,1);
   const rows=(run_id===1?['core-tests','browser-smoke']:['Reference, provenance and decision safety']).map(name=>({name,run_id,head_sha:head,status:'completed',conclusion:state.badJob?'skipped':'success'}));
   return d({total_count:rows.length,jobs:rows});}
 }}};
 return {state,pr,args:{github,owner:'test',repo:'repo',prNumber:9}};
}
test('only exact receipt, six files, successful required workflows and jobs permit a merge handoff',async()=>{
 const f=fixture(),r=await verifyPR(f.args);a.equal(r.readyForMaintainerMerge,true);a.equal(r.merged,false);a.equal(r.deployed,false);
 for(const key of ['missing','pending','failed']){const x=fixture();x.state[key]=true;a.equal((await verifyPR(x.args)).readyForMaintainerMerge,false);}
 const x=fixture();x.pr.mergeable=null;a.equal((await verifyPR(x.args)).readyForMaintainerMerge,false);
});
test('unexpected changed files, drift, missing job success or wrong run identity fail closed',async()=>{
 for(const [alter,reason] of [
  [f=>f.state.after.push({path:'unexpected.js',type:'blob',mode:'100644',sha:base}),/unexpected changed paths/],
  [f=>f.state.main=head,/drift/],[f=>f.state.branchHead=base,/drift/],
  [f=>f.state.badJob=true,/required jobs/],[f=>f.state.badScope=true,/scope/],
  [f=>f.pr.body+=' changed',/body drift/]
 ]){const f=fixture();alter(f);await a.rejects(verifyPR(f.args),reason);}
});
