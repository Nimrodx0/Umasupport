'use strict';
// Handoff only from the verified proposal writer. No automatic merge,
// CI approval, token escalation or Pages deployment.
const SHA=/^[a-f0-9]{40}$/,HASH=/^[a-f0-9]{64}$/;
const fail=m=>{throw Error('D072 release PR: '+m);};
async function openProposalPR({github,owner,repo,proposal}={}){
 if(!github?.rest?.pulls||!github?.rest?.git||!owner||!repo||
    proposal?.branchWritten!==true||proposal.merged!==false||proposal.deployed!==false||
    !HASH.test(proposal.proposalSha||'')||proposal.branch!=='automation/d072-release-'+proposal.proposalSha.slice(0,24)||
    !SHA.test(proposal.baseSha||'')||!SHA.test(proposal.headSha||'')||
    !Array.isArray(proposal.newCardIds)||!proposal.newCardIds.length||proposal.newCardIds.length>2||
    new Set(proposal.newCardIds).size!==proposal.newCardIds.length||proposal.newCardIds.some(x=>typeof x!=='string'||!/^[1-9]\d{4}$/.test(x)))
  fail('verified branch report required');
 const p=github.rest.pulls,g=github.rest.git,coord={owner,repo},full=owner+'/'+repo;
 const ref=async name=>(await g.getRef({...coord,ref:'heads/'+name})).data.object.sha;
 async function checkRefs(){
  if(await ref('main')!==proposal.baseSha||await ref(proposal.branch)!==proposal.headSha)fail('base or proposal head drift');
 }
 const title='D072 reviewed event release '+proposal.proposalSha.slice(0,16);
 const marker='<!-- D072_RELEASE_PROPOSAL '+proposal.proposalSha+' -->';
 const body=marker+'\n\nIndividually approved event increment. Cards: '+proposal.newCardIds.join(', ')+
  '.\n\nFixed base: '+proposal.baseSha+'\nFixed head: '+proposal.headSha+
  '\nReceipt: poc/config/d072-release-receipts/'+proposal.proposalSha+'.json'+
  '\n\nReview all PR checks against this head before merging. No CI approval, merge or deployment is performed by this workflow.';
 const report=x=>{
  if(x?.state!=='open'||x.draft!==false||!Number.isSafeInteger(x.number)||x.number<1||
     x.head?.ref!==proposal.branch||x.head?.sha!==proposal.headSha||x.head?.repo?.full_name!==full||
     x.base?.ref!=='main'||x.base?.sha!==proposal.baseSha||x.base?.repo?.full_name!==full||
     x.title!==title||x.body!==body)fail('existing PR scope or content mismatch');
  return {...proposal,prNumber:x.number,prUrl:'https://github.com/'+full+'/pull/'+x.number,
   prCreatedOrReused:true,ciVerified:false,merged:false,deployed:false};
 };
 async function find(){
  const list=(await p.list({...coord,state:'all',head:owner+':'+proposal.branch,per_page:100})).data;
  if(!Array.isArray(list)||list.length>=100||list.length>1)fail('ambiguous proposal PR history');
  return list[0]||null;
 }
 await checkRefs();
 const old=await find();if(old){const result=report(old);await checkRefs();return result;}
 await checkRefs();
 let created;
 try{created=(await p.create({...coord,title,body,head:proposal.branch,base:'main',draft:false})).data;}
 catch(e){
  if(e.status!==422)throw e;
  // A concurrent creation may be reused only if it is precisely ours.
  const raced=await find();if(!raced)throw e;
  const result=report(raced);await checkRefs();return result;
 }
 const result=report(created);await checkRefs();return result;
}
module.exports={openProposalPR};
