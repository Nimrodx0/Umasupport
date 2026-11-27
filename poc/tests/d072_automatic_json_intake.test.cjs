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
 let ledger=empty(),loads=0,visits=[],factory=0;
 const store={load:async()=>structuredClone(ledger),compareAndSet:async(old,next,packets=[])=>{
  if(canonical(old)!==canonical(ledger))return false;
  ledger=structuredClone(next);return true;
 }};
 const plan={dataKind:'d069-event-driven-intake-plan',schemaVersion:1,sourcePin:{commit:sourcePin.commit,cardBlob:sourcePin.cardBlob},eligibleIds:ids,heldIds:[],batches:require('../src/direct_pending_review.cjs').partitionBatches(ids),siteAccessAuthorized:false,publicationApproved:false};
 const args={plan,sourcePin,policy,existingCatalog:{schemaVersion:1,cards:[]},store,
  loadSkillText:async()=>{loads++;return skillText;},
  observerFactory:opts=>{factory++;a.equal(opts.automaticAuthorized,true);return async batch=>{
   visits.push(batch);return batch.map(cardId=>({cardId,status:'not-listed'}));
  };}};
 return {args,counts:()=>({loads,visits,factory}),ledger:()=>ledger};
}
test('no new IDs means no skill fetch, observer creation or site access',async()=>{
 const f=fixture([]),r=await runAutomatic(f.args);
 a.equal(r.sourceRequestsPerformed,false);a.deepEqual(f.counts(),{loads:0,visits:[],factory:0});
});
test('only new unattempted IDs, all sequential batches, no revisit on replay',async()=>{
 const ids=['39995','39996','39997'],f=fixture(ids);
 const r=await runAutomatic(f.args);a.deepEqual(r.attemptedIds,ids);
 a.deepEqual(f.counts().visits,[ids.slice(0,2),ids.slice(2)]);
 a.equal(f.ledger().rows.length,3);a.equal(r.publicationApproved,false);
 a.equal((await runAutomatic(f.args)).sourceRequestsPerformed,false);
 a.equal(f.counts().loads,1);
});
test('stop at first failed batch, later IDs remain unattempted',async()=>{
 const f=fixture(['39995','39996','39997']);let calls=0;
 const r=await runAutomatic({...f.args,observerFactory:()=>async()=>{calls++;throw Error('source refused');}});
 a.equal(calls,1);a.equal(r.stopReason,'observation-failed');
 a.deepEqual(r.attemptedIds,['39995','39996']);
 a.ok(f.ledger().rows.every(x=>x.status==='uncertain'));
});

test('explicit source refusal stops future new-card automatic attempts without another request',async()=>{
 const f=fixture(['39995','39996','39997']);let requests=0;
 const {createObserver}=require('../src/d069_card_json_transport.cjs');
 const first=await runAutomatic({...f.args,observerFactory:opts=>createObserver({...opts,sleep:async()=>{},fetchImpl:async()=>{
  requests++;return new Response('refused',{status:429});
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
