'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {runDailyData}=require('../src/d074_daily_data.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const {REF}=require('../src/d074_event_data_branch.cjs');
const config=require('../config/d074-daily-data.v1.json');
const acquisitionPolicy=require('../config/direct-event-intake-policy.v1.json');
const publicationPolicy=require('../config/d074-publication-policy.v1.json');
const routinePolicy={schemaVersion:2,scope:'D073-normal-random-skill-path-identifying-titles-only',reviewer:'synthetic fixture',reviewedAt:'2000-01-01',validThrough:null,accessConditionsReviewed:true,publicationApproved:true,evidenceUrls:['https://example.org/synthetic'],publicationBasis:{kind:'original-factual-description',reason:'Synthetic regression only'}};
const base='a'.repeat(40),head='b'.repeat(40),hash='c'.repeat(64);
function fixture(){
 const catalog={schemaVersion:1,cards:[]},ids=['39999','39997','39998'];
 const ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:3,rows:ids.map(cardId=>({cardId,sourcePin:{commit:'d'.repeat(40),cardBlob:'e'.repeat(40),skillBlob:'f'.repeat(40)},status:'awaiting-fact-review',packetSha256:hash}))};
 const queue={dataKind:'d072-offline-review-queue',schemaVersion:1,publicationApproved:false,catalogSha256:digest(catalog),ledgerRevision:3,rows:ids.map(cardId=>{
  const events=[{eventId:'test:'+cardId,sha256:hash}];
  return {cardId,status:'ready-for-publication-decision',sourceCandidateInputReady:true,publicationApproved:false,packetSha256:hash,routine:{input:{dataKind:'d073-source-title-input',schemaVersion:1,cardId,packetSha256:hash,titles:null,chainEvidence:null},receiptSha256:hash,eventDigestsSha256:digest({events}),events,publicationApproved:false}};
 })};
 const calls=[],state={main:base,head,open:[],catalog};
 const github={rest:{git:{getRef:async({ref})=>{calls.push(ref);return {data:{object:{sha:ref===REF?state.head:state.main}}};}},pulls:{list:async()=>({data:state.open})}}};
 const args={config:{schemaVersion:1,mode:'plan',routinePublicationPolicy:structuredClone(routinePolicy)},publicationPolicy,
  queue,auto:{attemptedIds:[],stopReason:null,publicationApproved:false},store:{load:async()=>structuredClone(ledger)},github,owner:'o',repo:'r',baseSha:base,expectedHead:head,
  reader:async()=>({head:state.head,catalogText:JSON.stringify(state.catalog)}),appender:async x=>{calls.push(x);return {baseSha:base,previousHead:head,newCardIds:x.evidence.map(v=>v.cardId),mainWritten:false,pagesDeployed:false,branchWritten:x.mode==='publish',receiptSha256:hash,revision:2,head:'9'.repeat(40)};},
  rawVerifier:async({report})=>{calls.push('raw');return {...report,publicRawVerified:true};}};
 return {args,state,queue,ledger,calls};
}
test('production publish enabled; independent flag still prevents writes',async()=>{
 const f=fixture();a.equal(config.mode,'publish');a.equal(config.routinePublicationPolicy.schemaVersion,2);a.equal(config.routinePublicationPolicy.validThrough,null);
 a.deepEqual(publicationPolicy,{schemaVersion:1,automaticPublicationAllowed:true});
 a.equal(acquisitionPolicy.automaticPublicationAllowed,false);
 a.equal((await runDailyData({...f.args,config:{schemaVersion:1,mode:'disabled',routinePublicationPolicy:null}})).status,'disabled');
 a.equal((await runDailyData({...f.args,config:{...f.args.config,mode:'publish'},publicationPolicy:{schemaVersion:1,automaticPublicationAllowed:false}})).status,'publication-disabled-by-policy');
 a.deepEqual(f.calls,[]);
});
test('daily plan selects at most two, binds exact candidate receipts; publish requires Raw verification',async()=>{
 const f=fixture(),r=await runDailyData(f.args);
 a.equal(r.status,'planned');a.deepEqual(r.selectedIds,['39997','39998']);a.equal(r.branchWritten,false);
 const x=f.calls.at(-1);a.equal(x.expectedHead,head);a.equal(x.expectedRoutine[0].receiptSha256,hash);a.deepEqual(x.expectedRoutine.map(v=>v.cardId),r.selectedIds);
 const pub=await runDailyData({...f.args,config:{...f.args.config,mode:'publish'},publicationPolicy:{...publicationPolicy,automaticPublicationAllowed:true}});
 a.equal(pub.status,'published-raw-verified');a.equal(pub.publicRawVerified,true);a.equal(pub.mainWritten,false);a.equal(pub.pagesDeployed,false);a.equal(f.calls.at(-1),'raw');
 await a.rejects(runDailyData({...f.args,config:{...f.args.config,mode:'publish'},publicationPolicy:{...publicationPolicy,automaticPublicationAllowed:true},rawVerifier:async()=>{throw Error('Raw mismatch');}}),/Raw mismatch/);
});
test('stale branch or queue, old PR, wrong digest, acquisition stop and no pending all hold',async()=>{
 const f=fixture();
 f.state.head='1'.repeat(40);await a.rejects(runDailyData(f.args),/head drift/);f.state.head=head;
 f.state.catalog.cards.push({cardId:'39995',events:[]});await a.rejects(runDailyData(f.args),/snapshot drift/);f.state.catalog.cards=[];
 f.state.open=[{head:{ref:'automation/d072-release-stale'}}];a.equal((await runDailyData(f.args)).status,'legacy-proposal-open');f.state.open=[];
 f.queue.rows[1].routine.eventDigestsSha256='0'.repeat(64);await a.rejects(runDailyData(f.args),/queued receipt mismatch/);
 a.equal((await runDailyData({...f.args,auto:{...f.args.auto,stopReason:'source-refused'}})).status,'acquisition-stopped');
 a.equal((await runDailyData({...f.args,queue:{...f.queue,rows:[]}})).status,'no-pending-cards');
 a.ok(f.calls.every(x=>typeof x==='string'),'no append calls');
});

test('publication configuration is distinct from intake and validated even with no candidates',async()=>{
 const f=fixture(),active={...f.args,queue:{...f.queue,rows:[]}};
 await a.rejects(runDailyData({...active,publicationPolicy:acquisitionPolicy}),/separate publication policy/);
 await a.rejects(runDailyData({...active,publicationPolicy:undefined}),/separate publication policy/);
 for(const invalid of [{validThrough:'2000-01-01'},{reviewedAt:'2099-01-01'},{publicationApproved:false},{accessConditionsReviewed:false},{evidenceUrls:[]},{scope:'unapproved'}]){
  await a.rejects(runDailyData({...active,config:{...active.config,routinePublicationPolicy:{...routinePolicy,...invalid}}}),/explicit valid common policy/);
 }
 a.deepEqual(f.calls,[]);
 const approved={...publicationPolicy,automaticPublicationAllowed:true};
 const p=await runDailyData({...active,config:{...active.config,mode:'publish'},publicationPolicy:approved});
 a.equal(p.status,'no-pending-cards');a.equal(p.branchWritten,false);
 a.equal(acquisitionPolicy.automaticPublicationAllowed,false);
 const workflow=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../.github/workflows/derived-github-pending-intake.yml'),'utf8');
 a.match(workflow,/runAutomatic\(\{[\s\S]*?policy,existingCatalog:catalog/);
 a.match(workflow,/const publicationPolicy=require\('\.\/poc\/config\/d074-publication-policy\.v1\.json'\);/);
 a.match(workflow,/runDailyData\(\{config,publicationPolicy,/);
});

test('indefinite common policy stays valid, legacy expiry remains enforced',()=>{
 const {validatePolicy}=require('../src/d073_routine_publication_policy.cjs');
 a.equal(validatePolicy(config.routinePublicationPolicy,'2099-01-01'),config.routinePublicationPolicy);
 a.throws(()=>validatePolicy({...routinePolicy,schemaVersion:1,validThrough:'2026-11-28'},'2026-11-29'),/explicit valid/);
});
test('all live inline scripts compile and daily workflow has no external document baseline gate',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'../..'),workflow=fs.readFileSync(path.join(root,'.github/workflows/derived-github-pending-intake.yml'),'utf8');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const lines=workflow.split('\n');let n=0;
 for(let i=0;i<lines.length;i++){
  if(!/^\s*script: \|\s*$/.test(lines[i]))continue;
  const indent=lines[i].match(/^\s*/)[0].length,body=[];
  for(let j=i+1;j<lines.length;j++){
   if(lines[j].trim()&&lines[j].match(/^\s*/)[0].length<=indent)break;
   body.push(lines[j].slice(indent+2));
  }
  a.doesNotThrow(()=>new AsyncFunction('github','context','core',body.join('\n')),'script line '+(i+1));n++;
 }
 a.ok(n>0);
 a.doesNotMatch(workflow,/d075-condition-baseline|d075_conditions_monitor|verifyConditions|umamusume\.jp|privacy-policy|docs\/cla/);
 a.match(workflow,/daily\.mode==='disabled'\?\{attemptedIds:\[\],stopReason:'policy-disabled'/);
 const transport=fs.readFileSync(path.join(root,'poc/src/d069_card_json_transport.cjs'),'utf8');
 a.match(transport,/checkRobots\(robots,u\.pathname\)/);
 a.match(transport,/\[401,403,451\]/);
 a.match(transport,/r.status===429/);
});
test('prior refusal and non-routine candidates cannot publish',async()=>{
 const f=fixture(),active={...f.args,config:{...f.args.config,mode:'publish'},publicationPolicy};
 f.ledger.rows.push({cardId:'39996',sourcePin:{commit:'d'.repeat(40),cardBlob:'e'.repeat(40),skillBlob:'f'.repeat(40)},status:'uncertain',packetSha256:null,failureCode:'source-refused'});
 a.equal((await runDailyData(active)).status,'source-refused');
 f.ledger.rows.pop();
 f.queue.rows.forEach(r=>{r.status='held';});
 a.equal((await runDailyData(active)).status,'no-routine-candidates');
 a.ok(f.calls.every(x=>typeof x==='string'));
});

test('bad candidate preflight does not prevent independently valid card publication',async()=>{
 const f=fixture(),calls=[];
 const appender=async x=>{
  const ids=x.evidence.map(v=>v.cardId);calls.push([x.mode,ids]);
  if(ids.includes('39997'))throw Error('candidate drift');
  return f.args.appender(x);
 };
 const result=await runDailyData({...f.args,config:{...f.args.config,mode:'publish'},publicationPolicy,appender});
 a.deepEqual(result.heldIds,['39997']);a.deepEqual(result.selectedIds,['39998']);
 a.equal(result.status,'published-raw-verified');
 a.deepEqual(calls,[['plan',['39997','39998']],['plan',['39997']],['plan',['39998']],['publish',['39998']]]);
});

test('two consecutive held candidates do not starve a later valid candidate',async()=>{
 const f=fixture(),appender=async x=>{
  if(x.evidence.some(v=>v.cardId!=='39999'))throw Error('candidate drift');
  return f.args.appender(x);
 };
 const result=await runDailyData({...f.args,config:{...f.args.config,mode:'publish'},publicationPolicy,appender});
 a.deepEqual(result.heldIds,['39997','39998']);a.deepEqual(result.selectedIds,['39999']);
 a.equal(result.status,'published-raw-verified');
});
