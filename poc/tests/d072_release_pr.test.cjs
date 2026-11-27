'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {openProposalPR}=require('../src/d072_release_pr.cjs');
const base='a'.repeat(40),head='b'.repeat(40),hash='c'.repeat(64),branch='automation/d072-release-'+hash.slice(0,24);
function fixture(){
 const proposal={proposalSha:hash,branch,baseSha:base,headSha:head,newCardIds:['39998'],branchWritten:true,merged:false,deployed:false};
 const state={base,head,prs:[],creates:0,drift:false,race:false,denied:false};
 const repo={full_name:'test/repo'};
 const github={rest:{git:{getRef:async({ref})=>({data:{object:{sha:ref==='heads/main'?state.base:state.head}}})},pulls:{
  list:async q=>{a.equal(q.head,'test:'+branch);a.equal(q.state,'all');return {data:state.prs};},
  create:async q=>{
   state.creates++;if(state.denied)throw Object.assign(Error('permission denied'),{status:403});
   a.equal(q.head,branch);a.equal(q.base,'main');a.equal(q.draft,false);
   const pr={number:12,state:'open',draft:false,title:q.title,body:q.body,head:{ref:branch,sha:head,repo},base:{ref:'main',sha:base,repo}};
   state.prs.push(pr);if(state.drift)state.base='d'.repeat(40);
   if(state.race)throw Object.assign(Error('already exists'),{status:422});
   return {data:pr};
  }
 }}};
 return {state,args:{github,owner:'test',repo:'repo',proposal}};
}
test('exact PR creation and idempotent reuse never claim CI or deployment',async()=>{
 const f=fixture(),x=await openProposalPR(f.args);
 a.equal(x.prNumber,12);a.equal(x.prUrl,'https://github.com/test/repo/pull/12');
 a.equal(x.ciVerified,false);a.equal(x.merged,false);a.equal(x.deployed,false);
 a.deepEqual(await openProposalPR(f.args),x);a.equal(f.state.creates,1);
});
test('concurrent creation, drift, denial, wrong repo and closed PR fail safely',async()=>{
 const race=fixture();race.state.race=true;a.equal((await openProposalPR(race.args)).prNumber,12);
 for(const mutate of [f=>f.state.base='e'.repeat(40),f=>f.state.head='e'.repeat(40)]){
  const f=fixture();mutate(f);await a.rejects(openProposalPR(f.args),/drift/);a.equal(f.state.creates,0);
 }
 const drift=fixture();drift.state.drift=true;await a.rejects(openProposalPR(drift.args),/drift/);
 const denied=fixture();denied.state.denied=true;await a.rejects(openProposalPR(denied.args),/permission denied/);
 for(const change of [p=>p.head.repo={full_name:'other/repo'},p=>p.state='closed',p=>p.body+=' changed',p=>p.draft=true]){
  const f=fixture();await openProposalPR(f.args);change(f.state.prs[0]);await a.rejects(openProposalPR(f.args),/mismatch/);a.equal(f.state.creates,1);
 }
 const f=fixture();await a.rejects(openProposalPR({...f.args,proposal:{...f.args.proposal,branchWritten:false}}),/verified branch/);a.equal(f.state.creates,0);
});
