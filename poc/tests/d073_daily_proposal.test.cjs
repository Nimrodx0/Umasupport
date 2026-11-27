'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {digest}=require('../src/event_release_gate.cjs');
const {runDailyProposal}=require('../src/d073_daily_proposal.cjs');
const config=require('../config/d073-daily-proposal.v1.json');
const base='a'.repeat(40),hash='b'.repeat(64);
function fixture(){
 const catalog={schemaVersion:1,cards:[]},files={'poc/data/reviewed_events.v1.json':JSON.stringify(catalog)};
 const pin={commit:'c'.repeat(40),cardBlob:'d'.repeat(40),skillBlob:'e'.repeat(40)};
 const ids=['39997','39995','39996','39998'];
 const ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:8,rows:ids.map(cardId=>({cardId,sourcePin:pin,status:'awaiting-fact-review',packetSha256:hash}))};
 const routine=cardId=>({input:{dataKind:'d073-source-title-input',schemaVersion:1,cardId,packetSha256:hash,titles:null,chainEvidence:null},publicationApproved:false});
 const queue={schemaVersion:1,dataKind:'d072-offline-review-queue',catalogSha256:digest(catalog),ledgerRevision:8,publicationApproved:false,rows:ids.map(cardId=>({cardId,packetSha256:hash,status:'ready-for-publication-decision',sourceCandidateInputReady:true,publicationApproved:false,routine:routine(cardId)}))};
 const calls=[],state={open:[],base};
 const github={rest:{git:{getRef:async()=>{calls.push('main');return {data:{object:{sha:state.base}}};}},pulls:{list:async()=>{calls.push('open');return {data:state.open};}}}};
 const policy={scope:'D073-normal-random-skill-path-identifying-titles-only'};
 const args={config:{schemaVersion:1,mode:'plan',routinePublicationPolicy:policy},queue,auto:{attemptedIds:[],stopReason:null,publicationApproved:false},
  store:{load:async()=>{calls.push('ledger');return structuredClone(ledger);}},github,owner:'o',repo:'r',baseSha:base,files,proposer:async x=>{
   calls.push(x);return {baseSha:base,newCardIds:x.evidence.map(v=>v.cardId),proposalSha:hash,branchWritten:x.mode==='pr',prCreatedOrReused:x.mode==='pr',
    ...(x.mode==='pr'?{prNumber:12,prUrl:'https://github.com/o/r/pull/12'}:{}),merged:false,deployed:false};
  }};
 return {args,queue,ledger,calls,state};
}
test('production default explicitly disabled, no source or GitHub calls',async()=>{
 a.deepEqual(config,{schemaVersion:1,mode:'disabled',routinePublicationPolicy:null});
 const f=fixture(),r=await runDailyProposal({...f.args,config});
 a.equal(r.status,'disabled');a.deepEqual(f.calls,[]);a.equal(r.merged,false);
 await a.rejects(runDailyProposal({...f.args,config:{...config,mode:'pr'}}),/explicit configuration/);
});
test('select at most two routine cards deterministically; plan and explicit PR modes do not merge',async()=>{
 const f=fixture();
 f.queue.rows[1].status='ready-for-independent-review';
 const r=await runDailyProposal(f.args);a.deepEqual(r.selectedIds,['39996','39997']);a.equal(r.status,'planned');
 a.equal(r.branchWritten,false);a.equal(r.prCreatedOrReused,false);
 const arg=f.calls.at(-1);a.equal(arg.mode,'plan');a.equal(arg.routinePublicationPolicy,f.args.config.routinePublicationPolicy);
 a.deepEqual(arg.evidence.map(x=>x.cardId),r.selectedIds);a.equal(arg.evidence[0].titles,null);
 const p=await runDailyProposal({...f.args,config:{...f.args.config,mode:'pr'}});
 a.equal(p.status,'pr-created-or-reused');a.equal(p.prNumber,12);a.equal(p.merged,false);a.equal(p.deployed,false);
});
test('empty, stopped, refusal, retry, out-of-scope chain and existing PR stop or skip safely',async()=>{
 const f=fixture();
 a.equal((await runDailyProposal({...f.args,queue:{...f.queue,rows:[]}})).status,'no-pending-cards');a.deepEqual(f.calls,[]);
 a.equal((await runDailyProposal({...f.args,auto:{...f.args.auto,stopReason:'observation-failed'}})).status,'acquisition-stopped');
 f.ledger.rows.push({cardId:'39999',sourcePin:f.ledger.rows[0].sourcePin,status:'uncertain',packetSha256:null,failureCode:'source-refused'});
 a.equal((await runDailyProposal(f.args)).status,'source-refused');f.ledger.rows.pop();
 f.ledger.rows[1].retry={approvalSha256:hash,priorRowSha256:hash,priorStatus:'not-listed'};
 f.queue.rows[2].routine.input.chainEvidence={dataKind:'d073-ordinary-chain-policy'};
 a.deepEqual((await runDailyProposal(f.args)).selectedIds,['39997','39998']);
 f.state.open=[{head:{ref:'automation/d072-release-stale'},body:''}];
 a.equal((await runDailyProposal(f.args)).status,'existing-proposal-open');
});
test('stale queue, main drift, incomplete PR list and changed candidate coordinates fail closed',async()=>{
 const f=fixture();
 await a.rejects(runDailyProposal({...f.args,queue:{...f.queue,ledgerRevision:7}}),/ledger changed/);
 await a.rejects(runDailyProposal({...f.args,queue:{...f.queue,catalogSha256:'0'.repeat(64)}}),/catalog changed/);
 f.state.base='f'.repeat(40);await a.rejects(runDailyProposal(f.args),/main drift/);f.state.base=base;
 f.state.open=Array.from({length:100},()=>({}));await a.rejects(runDailyProposal(f.args),/incomplete open PR list/);f.state.open=[];
 f.queue.rows[0].routine.input.cardId='39999';await a.rejects(runDailyProposal(f.args),/candidate coordinate mismatch/);
});
