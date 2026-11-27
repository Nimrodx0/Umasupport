'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {PATHS,render,propose}=require('../src/d072_release_proposal.cjs');
const {digest}=require('../src/event_release_gate.cjs'),{gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const [catalogPath,approvalPath,statusPath,entryPath,livePath]=PATHS;
const base='a'.repeat(40),pin={commit:'b'.repeat(40),cardBlob:'c'.repeat(40),skillBlob:'d'.repeat(40)};
const json=x=>JSON.stringify(x,null,2)+'\n';
function fixture(){
 const e={id:'gt-json:39998:1',name:'Synthetic event',type:'auto',rewards:[]};
 const prior={id:'gt-json:39997:1',name:'Synthetic old',type:'auto',rewards:[]};
 const approval=(event,cardId)=>({cardId,eventId:event.id,eventSha256:digest(event),reviewer:'synthetic',
  reviewedAt:'2026-11-27',checks:Object.fromEntries(['card','event','choices','outcomes','dependencies','publication'].map(k=>[k,true])),
  evidence:Object.fromEntries(['card','event','choices','outcomes','dependencies','publication'].map(k=>[k,['https://example.org/synthetic']])),
  publicationBasis:{kind:'original-factual-description',reason:'synthetic only'}});
 const catalog={schemaVersion:1,cards:[{cardId:'39997',coverageStatus:'partial',events:[prior]}]},oldApprovals={schemaVersion:2,cohorts:[],entries:[approval(prior,'39997')]};
 const next={...catalog,cards:[...catalog.cards,{cardId:'39998',coverageStatus:'partial',events:[e]}]},nextApprovals={...oldApprovals,entries:[...oldApprovals.entries,approval(e,'39998')]};
 const files={[catalogPath]:json(catalog),[approvalPath]:json(oldApprovals),
 [statusPath]:'# status\n## 現在の到達点と残る課題\n\n公開イベント（公開JSON実測）：**1件**／**1カード**\n',
 [entryPath]:'<a href="poc/live.html?v=old-version">open</a>',
 [livePath]:'<div data-release="old-version">old-version</div><script src="a.js?v=old-version"></script><script src="b.js?v=old-version"></script>'};
 const result={catalog:next,approvals:nextApprovals,status:'ready-to-append',existingCatalogUnchanged:true,newCardIds:['39998'],appendedCardCount:1,appendedEventCount:1,
 releasePin:pin,proofs:[{cardId:'39998',packetSha256:'1'.repeat(64),sourcePin:pin,releasePin:pin,matchedSkillIds:[]}],
 independentReviewReceipts:[{schemaVersion:1,cardId:'39998',packetSha256:'1'.repeat(64),independentEvidenceSha256:'2'.repeat(64),reviewer:'synthetic',reviewedAt:'2026-11-27',evidenceUrls:['https://example.org/synthetic'],publicationApproved:false}]};
 const state={main:base,branch:null,writes:0,drift:false},trees=new Map(),commits=new Map();
 const tree='e'.repeat(40),targetTree='f'.repeat(40),head='9'.repeat(40);
 commits.set(base,{sha:base,tree:{sha:tree},parents:[]});trees.set(tree,PATHS.map(path=>({path,mode:'100644',type:'blob',sha:gitBlobSha(files[path])})));
 const d=data=>({data});const github={rest:{git:{
  getRef:async({ref})=>{if(ref==='heads/main')return d({object:{sha:state.main}});if(!state.branch)throw Object.assign(Error('missing'),{status:404});return d({object:{sha:state.branch}});},
  getCommit:async({commit_sha})=>d(commits.get(commit_sha)),
  getTree:async({tree_sha})=>d({sha:tree_sha,truncated:false,tree:trees.get(tree_sha)}),
  createBlob:async({content})=>{state.writes++;return d({sha:gitBlobSha(content)});},
  createTree:async({base_tree,tree:entries})=>{a.equal(base_tree,tree);a.equal(entries.length,6);trees.set(targetTree,entries);return d({sha:targetTree});},
  createCommit:async({parents,tree})=>{a.deepEqual(parents,[base]);commits.set(head,{sha:head,tree:{sha:tree},parents:[{sha:base}]});return d({sha:head});},
  createRef:async({ref,sha})=>{a.match(ref,/^refs\/heads\/automation\/d072-release-/);a.equal(sha,head);state.branch=sha;return d({object:{sha}});}
 }}};
 const intake={stage:async()=>{if(state.drift)state.main='8'.repeat(40);return structuredClone(result);}};
 return {files,result,state,commits,args:{github,owner:'test',repo:'test',baseSha:base,files,evidence:[],newApprovals:{},intake}};
}
test('proposal retains prior data, approval ledger, consistent asset version and evidence receipt',()=>{
 const f=fixture(),p=render({files:f.files,result:f.result,baseSha:base});
 a.equal(Object.keys(p.files).length,6);a.equal(p.receipt.deploymentVerified,false);
 a.deepEqual(JSON.parse(p.files[catalogPath]),f.result.catalog);
 a.deepEqual(JSON.parse(p.files[approvalPath]),f.result.approvals);
 a.match(p.files[statusPath],/\*\*2件\*\*／\*\*2カード\*\*/);
 a.doesNotMatch(p.files[livePath],/old-version/);a.ok(p.files[entryPath].includes(p.version));
 a.equal(digest(p.receipt),p.proposalSha);
});
test('missing approval, wrong receipt, old content mutation and mixed asset version fail closed',()=>{
 for(const change of [
  f=>f.result.approvals.entries.pop(),
  f=>f.result.independentReviewReceipts[0].packetSha256='0'.repeat(64),
  f=>{const e=f.result.catalog.cards[0].events[0];e.name='changed';f.result.approvals.entries[0].eventSha256=digest(e);},
  f=>f.files[livePath]=f.files[livePath].replace('a.js?v=old-version','a.js?v=wrong')
 ]){const f=fixture();change(f);a.throws(()=>render({files:f.files,result:f.result,baseSha:base}));}
});
test('plan is read only, write creates one atomic branch, repeat is idempotent, no main write',async()=>{
 const f=fixture(),p=await propose(f.args);a.equal(p.branchWritten,false);a.equal(f.state.writes,0);
 const b=await propose({...f.args,mode:'branch'});a.equal(b.branchWritten,true);a.equal(b.merged,false);a.equal(b.deployed,false);
 a.equal(f.state.main,base);a.equal(f.state.branch,b.headSha);
 a.deepEqual(await propose({...f.args,mode:'branch'}),b);
 f.commits.get(b.headSha).parents=[{sha:'0'.repeat(40)}];
 await a.rejects(propose({...f.args,mode:'branch'}),/collision/);
});
test('modified checkout or moving main stops before creating any blob or branch',async()=>{
 const f=fixture();f.files[entryPath]+='changed';await a.rejects(propose({...f.args,mode:'branch'}),/base file mismatch/);a.equal(f.state.writes,0);
 const g=fixture();g.state.drift=true;await a.rejects(propose({...g.args,mode:'branch'}),/main drift after review/);a.equal(g.state.writes,0);a.equal(g.state.branch,null);
});

test('PR mode cannot call pulls before the approved branch is verified',async()=>{
 const f=fixture();let called=0;
 const repo={full_name:'test/test'};
 f.args.github.rest.pulls={list:async()=>({data:[]}),create:async q=>{
  called++;a.equal(f.state.branch,'9'.repeat(40));
  return {data:{number:17,state:'open',draft:false,title:q.title,body:q.body,
   head:{ref:q.head,sha:f.state.branch,repo},base:{ref:'main',sha:base,repo}}};
 }};
 const plan=await propose(f.args);a.equal(plan.branchWritten,false);a.equal(called,0);
 const pr=await propose({...f.args,mode:'pr'});a.equal(pr.prNumber,17);a.equal(pr.ciVerified,false);a.equal(called,1);
 const g=fixture();g.result.approvals.entries.pop();
 g.args.github.rest.pulls={list:async()=>{throw Error('unexpected PR access');}};
 await a.rejects(propose({...g.args,mode:'pr'}),/承認/);a.equal(g.state.writes,0);
});

test('source fact receipt is distinct from independent evidence and reconstructs exact proposal',()=>{
 const f=fixture(),proof=f.result.proofs[0];
 f.result.independentReviewReceipts=[];
 f.result.sourceFactReceipts=[{dataKind:'d073-source-fact-receipt',schemaVersion:1,cardId:proof.cardId,packetSha256:proof.packetSha256,
  sourceFactsSha256:'2'.repeat(64),titleInputSha256:'3'.repeat(64),chainEvidenceSha256:null,chainEvidenceUrls:[],independentGameVerification:false,publicationApproved:false}];
 const p=render({files:f.files,result:f.result,baseSha:base});
 a.deepEqual(p.receipt.independentReviewReceipts,[]);
 a.deepEqual(p.receipt.sourceFactReceipts,f.result.sourceFactReceipts);
 const {verifyProposalFiles}=require('../src/d072_release_ci_gate.cjs');
 a.deepEqual(verifyProposalFiles({baseSha:base,hash:p.proposalSha,oldFiles:f.files,newFiles:p.files,receipt:p.receipt}),p);
 f.result.sourceFactReceipts[0].independentGameVerification=true;
 a.throws(()=>render({files:f.files,result:f.result,baseSha:base}),/source receipt/);
});
