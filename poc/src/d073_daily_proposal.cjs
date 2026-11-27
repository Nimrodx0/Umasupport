'use strict';
// Daily handoff, not a release authorization. An explicit reviewed policy
// must be configured; no automatic main merge, deployment or token escalation.
const {digest}=require('./event_release_gate.cjs');
const {verify}=require('./d069_json_attempt_ledger.cjs');
const {propose}=require('./d072_release_proposal.cjs');
const SHA=/^[a-f0-9]{40}$/,HASH=/^[a-f0-9]{64}$/,ID=/^[1-9]\d{4}$/;
const fail=m=>{throw Error('D073 daily proposal: '+m);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.split(',').sort().join(',');
async function runDailyProposal({config,queue,auto,store,github,owner,repo,baseSha,files,proposer=propose}={}){
 if(!exact(config,'schemaVersion,mode,routinePublicationPolicy')||config.schemaVersion!==1||
    !['disabled','plan','pr'].includes(config.mode)||(config.mode==='disabled'?config.routinePublicationPolicy!==null:!config.routinePublicationPolicy))
  fail('explicit configuration required');
 const report=(status,extra={})=>({dataKind:'d073-daily-proposal',schemaVersion:1,status,mode:config.mode,
  selectedIds:[],branchWritten:false,prCreatedOrReused:false,merged:false,deployed:false,...extra});
 if(config.mode==='disabled')return report('disabled');
 if(!SHA.test(baseSha||'')||!github?.rest?.git||!github?.rest?.pulls||!owner||!repo||
    typeof store?.load!=='function'||!queue||queue.dataKind!=='d072-offline-review-queue'||queue.schemaVersion!==1||
    queue.publicationApproved!==false||!Array.isArray(queue.rows)||queue.rows.length>1000||
    new Set(queue.rows.map(r=>r?.cardId)).size!==queue.rows.length||
    queue.rows.some(r=>typeof r?.cardId!=='string'||!ID.test(r.cardId)||r.publicationApproved!==false)||
    !auto||auto.publicationApproved!==false||!Array.isArray(auto.attemptedIds))fail('daily queue scope');
 if(auto.stopReason!==null)return report('acquisition-stopped');
 if(!queue.rows.length)return report('no-pending-cards');
 const catalog=JSON.parse(files['poc/data/reviewed_events.v1.json']);
 if(digest(catalog)!==queue.catalogSha256)fail('catalog changed');
 const ledger=verify(await store.load());
 if(ledger.revision!==queue.ledgerRevision)fail('attempt ledger changed');
 if(ledger.rows.some(r=>r.failureCode==='source-refused'))return report('source-refused');
 const byId=new Map(ledger.rows.map(r=>[r.cardId,r]));
 const imported=new Set(catalog.cards.map(c=>c.cardId));
 const eligible=queue.rows.filter(r=>{
  if(r.status!=='ready-for-publication-decision'||r.sourceCandidateInputReady!==true)return false;
  const x=r.routine?.input,row=byId.get(r.cardId);
  if(!row||row.status!=='awaiting-fact-review'||row.packetSha256!==r.packetSha256||
     imported.has(r.cardId)||!HASH.test(r.packetSha256||'')||
     !exact(x,'dataKind,schemaVersion,cardId,packetSha256,titles,chainEvidence')||
     x.dataKind!=='d073-source-title-input'||x.schemaVersion!==1||x.cardId!==r.cardId||
     x.packetSha256!==r.packetSha256||x.titles!==null||r.routine.publicationApproved!==false)
    fail('candidate coordinate mismatch');
  if(row.retry!==undefined)return false;
  if(x.chainEvidence!==null&&config.routinePublicationPolicy.scope!=='D073-normal-random-and-ordinary-chain-skill-path-identifying-titles-only')return false;
  return true;
 }).sort((a,b)=>a.cardId.localeCompare(b.cardId)).slice(0,2);
 if(!eligible.length)return report('no-routine-candidates');
 const selectedIds=eligible.map(r=>r.cardId),coord={owner,repo};
 const main=async()=>(await github.rest.git.getRef({...coord,ref:'heads/main'})).data.object.sha;
 if(await main()!==baseSha)fail('main drift');
 // Do not generate overlapping increments while another proposal is open,
 // including stale-base proposals. A maintainer resolves those explicitly.
 const open=(await github.rest.pulls.list({...coord,state:'open',base:'main',per_page:100})).data;
 if(!Array.isArray(open)||open.length>=100)fail('incomplete open PR list');
 if(open.some(p=>p.head?.ref?.startsWith('automation/d072-release-')||/^<!-- D072_RELEASE_PROPOSAL /.test(p.body||'')))
  return report('existing-proposal-open');
 if(await main()!==baseSha)fail('main drift after PR check');
 const result=await proposer({github,owner,repo,baseSha,files,evidence:eligible.map(r=>r.routine.input),
  routinePublicationPolicy:config.routinePublicationPolicy,mode:config.mode});
 if(result?.baseSha!==baseSha||JSON.stringify(result.newCardIds)!==JSON.stringify(selectedIds)||
    result.merged!==false||result.deployed!==false||
    (config.mode==='plan'?result.branchWritten!==false:result.branchWritten!==true||result.prCreatedOrReused!==true||
     !Number.isSafeInteger(result.prNumber)||result.prNumber<1))fail('proposal report mismatch');
 return report(config.mode==='plan'?'planned':'pr-created-or-reused',{selectedIds,proposalSha:result.proposalSha,
  branchWritten:result.branchWritten,prCreatedOrReused:result.prCreatedOrReused===true,
  ...(config.mode==='pr'?{prNumber:result.prNumber,prUrl:result.prUrl}:{})});
}
module.exports={runDailyProposal};
