'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {runAutomatic}=require('../src/d072_automatic_json_intake.cjs');
const {empty}=require('../src/d069_json_attempt_ledger.cjs');
const {gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const {canonical}=require('../src/event_release_gate.cjs');
const policy=require('../config/direct-event-intake-policy.v1.json');
function fixture(ids){
 const skillText=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(990001+i),name:'Synthetic '+i,rarity:'normal',group:i})));
 const sourcePin={commit:'a'.repeat(40),cardBlob:'b'.repeat(40),skillBlob:gitBlobSha(skillText)};
 let ledger=empty(),loads=0,visits=[],factory=0,now='2026-11-28T00:00:00.000Z';
 const store={load:async()=>structuredClone(ledger),compareAndSet:async(old,next,packets=[])=>{
  if(canonical(old)!==canonical(ledger))return false;
  require('../src/d069_github_attempt_store.cjs').transition(old,next);ledger=structuredClone(next);return true;
 }};
 const plan={dataKind:'d069-event-driven-intake-plan',schemaVersion:1,sourcePin:{commit:sourcePin.commit,cardBlob:sourcePin.cardBlob},eligibleIds:ids,heldIds:[],batches:require('../src/direct_pending_review.cjs').partitionBatches(ids),siteAccessAuthorized:false,publicationApproved:false};
 const args={plan,sourcePin,policy,existingCatalog:{schemaVersion:1,cards:[]},store,clock:()=>now,
  loadSkillText:async()=>{loads++;return skillText;},
  observerFactory:opts=>{factory++;a.equal(opts.automaticAuthorized,true);a.deepEqual(Object.keys(opts).sort(),['automaticAuthorized','knownIds']);return async batch=>{
   visits.push(batch);return batch.map(cardId=>({cardId,status:'not-listed'}));
  };}};
 return {args,counts:()=>({loads,visits,factory}),ledger:()=>ledger,advance:hours=>{now=new Date(Date.parse(now)+hours*3600000).toISOString();}};
}
test('no new IDs means no skill fetch, observer creation or site access',async()=>{
 const f=fixture([]),r=await runAutomatic(f.args);
 a.equal(r.sourceRequestsPerformed,false);a.deepEqual(f.counts(),{loads:0,visits:[],factory:0});
});
test('only new unattempted IDs, all sequential batches, no revisit on replay',async()=>{
 const ids=['39995','39996','39997'],f=fixture(ids);
 const r=await runAutomatic(f.args);a.deepEqual(r.attemptedIds,ids);
 a.deepEqual(f.counts().visits,ids.map(id=>[id]));
 a.equal(f.ledger().rows.length,3);a.equal(r.publicationApproved,false);
 a.equal((await runAutomatic(f.args)).sourceRequestsPerformed,false);
 a.equal(f.counts().loads,1);
});
test('stop at first failed batch, later IDs remain unattempted',async()=>{
 const f=fixture(['39995','39996','39997']);let calls=0;
 const r=await runAutomatic({...f.args,observerFactory:()=>async()=>{calls++;throw Error('source refused');}});
 a.equal(calls,1);a.equal(r.stopReason,'observation-failed');
 a.deepEqual(r.attemptedIds,['39995']);
 a.ok(f.ledger().rows.every(x=>x.status==='uncertain'));
});

test('explicit source refusal stops future new-card automatic attempts without another request',async()=>{
 const f=fixture(['39995','39996','39997']);let requests=0;
 const {createObserver}=require('../src/d069_card_json_transport.cjs');
 const first=await runAutomatic({...f.args,observerFactory:opts=>createObserver({...opts,sleep:async()=>{},fetchImpl:async()=>{
  requests++;return new Response('refused',{status:403});
 }})});
 a.equal(first.stopReason,'observation-failed');
 a.equal(requests,1);
 a.ok(f.ledger().rows.every(x=>x.status==='uncertain'&&x.failureCode==='source-refused'));
 const ids=['39997','39998'],plan={...f.args.plan,eligibleIds:ids,batches:require('../src/direct_pending_review.cjs').partitionBatches(ids)};
 const before=structuredClone(f.ledger());
 const second=await runAutomatic({...f.args,plan});
 a.deepEqual(second,{attemptedIds:[],stopReason:'prior-source-refused',sourceRequestsPerformed:false,publicationApproved:false});
 a.equal(requests,1);a.equal(f.counts().loads,1);a.equal(f.counts().factory,0);a.deepEqual(f.ledger(),before);
});

test('ordinary acquisition has no DOM parser, browser or display comparison dependency',()=>{
 const fs=require('node:fs'),path=require('node:path');
 for(const file of ['d072_automatic_json_intake.cjs','d069_card_json_transport.cjs','d069_json_attempt_ledger.cjs','d069_review_packet_archive.cjs']){
  const source=fs.readFileSync(path.join(__dirname,'../src',file),'utf8');
  a.doesNotMatch(source,/require\(['"].*(?:d072_display_corroboration|route_dom_extractor|playwright|live_event_assembler)/);
  a.doesNotMatch(source,/observeHtml|domObservation|displayObserver/);
 }
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/derived-github-pending-intake.yml'),'utf8');
 a.doesNotMatch(workflow,/playwright|chromium|needs_display_browser/i);
});

test('finite delayed retry of unlisted card, no request between attempts',async()=>{
 const f=fixture(['39995']);
 for(const hours of [0,24,48,96]){
  f.advance(hours);
  a.deepEqual((await runAutomatic(f.args)).attemptedIds,['39995']);
  a.equal((await runAutomatic(f.args)).sourceRequestsPerformed,false);
 }
 a.equal(f.ledger().rows[0].attempt.count,4);
 f.advance(1000);a.equal((await runAutomatic(f.args)).sourceRequestsPerformed,false);
});
test('rate limit honors Retry-After and stops requests for all cards until cooldown',async()=>{
 const f=fixture(['39995','39996']);
 const {createObserver}=require('../src/d069_card_json_transport.cjs');
 // Use a deterministic relative wait injected by the real response parser's clock.
 let requests=0;
 const args={...f.args,clock:()=>new Date().toISOString(),observerFactory:opts=>createObserver({...opts,sleep:async()=>{},fetchImpl:async()=>{requests++;return new Response('rate limit',{status:429,headers:{'retry-after':'172800'}});}})};
 const r=await runAutomatic(args);a.equal(r.stopReason,'observation-failed');a.equal(requests,1);
 a.equal(f.ledger().rows[0].failureCode,'rate-limited');
 a.ok(Date.parse(f.ledger().rows[0].attempt.nextAt)>=Date.now()+47*3600000);
 a.equal((await runAutomatic(args)).stopReason,'rate-limit-cooldown');a.equal(requests,1);
});
test('later card failure does not discard earlier completed result',async()=>{
 const f=fixture(['39995','39996','39997']);
 const r=await runAutomatic({...f.args,observerFactory:()=>async ([id])=>{if(id==='39996')throw Error('bad shape');return [{cardId:id,status:'not-listed'}];}});
 a.deepEqual(r.attemptedIds,['39995','39996']);
 a.deepEqual(f.ledger().rows.map(x=>x.status),['not-listed','uncertain']);
 a.deepEqual((await runAutomatic(f.args)).attemptedIds,['39997']);
});

test('hard refusal clearance is exact row-bound and history remains intact',()=>{
 const {activeRefusal,due}=require('../src/d077_intake_recovery.cjs'),{digest}=require('../src/event_release_gate.cjs');
 const row={cardId:'39999',status:'uncertain',failureCode:'source-refused',packetSha256:null};
 const ledger={rows:[row]};
 a.equal(activeRefusal(ledger,{schemaVersion:1,resolved:[]}),true);
 a.equal(activeRefusal(ledger,{schemaVersion:1,resolved:[{rowSha256:digest(row),reason:'reviewed access restored'}]}),false);
 a.equal(activeRefusal({rows:[{...row,cardId:'39998'}]},{schemaVersion:1,resolved:[{rowSha256:digest(row),reason:'reviewed'}]}),true);
 const timed={...row,attempt:{count:1,startedAt:'2026-11-28T00:00:00.000Z',nextAt:null}};
 a.equal(due(timed,'2026-11-29T00:00:00.000Z',{schemaVersion:1,resolved:[]}),false);
 a.equal(due(timed,'2026-11-29T00:00:00.000Z',{schemaVersion:1,resolved:[{rowSha256:digest(timed),reason:'reviewed'}]}),true);
});
test('health distinguishes temporary retry and actionable holds, missing acceptance is retried',async()=>{
 const {health,pendingAcceptance}=require('../src/d077_daily_health.cjs');
 const f=fixture(['39995']);await runAutomatic(f.args);
 const q={rows:[{cardId:'39995',status:'not-listed'}]},auto={stopReason:null};
 a.deepEqual(health({ledger:f.ledger(),queue:q,auto}).alerts,[]);
 for(const hours of [24,48,96]){f.advance(hours);await runAutomatic(f.args);}
 a.match(health({ledger:f.ledger(),queue:q,auto}).alerts[0],/retry exhausted/);
 const snapshot={head:'a'.repeat(40),manifest:{revision:2}};
 const github={rest:{repos:{getCombinedStatusForRef:async()=>({data:{statuses:[]}})}}};
 a.equal(await pendingAcceptance({github,owner:'o',repo:'r',snapshot}),true);
 github.rest.repos.getCombinedStatusForRef=async()=>({data:{statuses:[{context:'umasupport/data-acceptance',state:'success'}]}});
 a.equal(await pendingAcceptance({github,owner:'o',repo:'r',snapshot}),false);
});
