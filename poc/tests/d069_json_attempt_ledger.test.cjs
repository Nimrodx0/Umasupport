'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {empty,verify,runBatch}=require('../src/d069_json_attempt_ledger.cjs');
const {gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const {canonical}=require('../src/event_release_gate.cjs');
const policy=require('../config/direct-event-intake-policy.v1.json');
const skillText=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(990001+i),name:'合成'+i,rarity:'normal',group:i})));
const sourcePin={commit:'a'.repeat(40),cardBlob:'b'.repeat(40),skillBlob:gitBlobSha(skillText)};
function fixture(){
 let ledger=empty(),observations=0;
 const store={load:async()=>structuredClone(ledger),compareAndSet:async(old,next)=>{
  if(canonical(old)!==canonical(ledger))return false;
  ledger=structuredClone(next);return true;
 }};
 const ids=['39998','39999'];
 const input={plan:{dataKind:'d069-event-driven-intake-plan',schemaVersion:1,sourcePin:{commit:sourcePin.commit,cardBlob:sourcePin.cardBlob},
 eligibleIds:ids,heldIds:[],batches:[ids],siteAccessAuthorized:false,publicationApproved:false},
 targetIds:ids,sourcePin,policy,existingCatalog:{schemaVersion:1,cards:[]},skillText,store,
 observeBatch:async ids=>{
  observations++;
  a.ok(ledger.rows.every(r=>r.status==='reserved'));
  return ids.map((cardId,i)=>i===0?{cardId,status:'not-listed'}:{cardId,status:'json',buildId:'example',
    sourceUrl:'https://gametora.com/ja/umamusume/supports/'+cardId+'-example',
    body:JSON.stringify({pageProps:{sourceData:{support_id:Number(cardId)},eventData:{ja:JSON.stringify({random:[{i:1,n:'非保存タイトル',c:[{o:'',r:[{t:'sk',v:'+2',d:990001}]}]}]})}}})});
 }};
 return {input,ledger:()=>ledger,observations:()=>observations};
}
test('reserve before observation, record only metadata, never revisit on replay',async()=>{
 const f=fixture(),r=await runBatch(f.input);
 a.deepEqual(r.results.map(x=>x.status),['not-listed','awaiting-fact-review']);
 a.equal(f.ledger().revision,2);a.equal(f.observations(),1);
 a.doesNotMatch(JSON.stringify(f.ledger()),/非保存タイトル|body|選択肢/);
 a.equal(r.publicationApproved,false);
 const repeat=await runBatch(f.input);
 a.deepEqual(repeat.selectedIds,[]);a.deepEqual(repeat.previouslyAttemptedIds,f.input.targetIds);
 a.equal(f.observations(),1);
});
test('transport failure is uncertain and permanently held until a separate reviewed retry mechanism',async()=>{
 const f=fixture();
 const r=await runBatch({...f.input,observeBatch:async()=>{throw Error('private source content');}});
 a.equal(r.stopReason,'observation-failed');a.ok(f.ledger().rows.every(r=>r.status==='uncertain'));
 a.doesNotMatch(JSON.stringify(f.ledger()),/private source content/);
 a.deepEqual((await runBatch(f.input)).selectedIds,[]);
});
test('CAS failure before access, and reservation retained if commit after access fails',async()=>{
 const f=fixture();
 await a.rejects(runBatch({...f.input,store:{...f.input.store,compareAndSet:async()=>false}}),/reservation conflict/);
 a.equal(f.observations(),0);
 let writes=0;
 await a.rejects(runBatch({...f.input,store:{...f.input.store,compareAndSet:async(old,next)=>++writes===1?f.input.store.compareAndSet(old,next):false}}),/completion conflict/);
 a.ok(f.ledger().rows.every(r=>r.status==='reserved'));
 a.deepEqual((await runBatch(f.input)).selectedIds,[]);
 a.equal(f.observations(),1);
});
test('empty selection, wrong target, imported card, policy drift and malformed ledger',async()=>{
 const f=fixture();
 a.deepEqual((await runBatch({...f.input,targetIds:[]})).results,[]);
 await a.rejects(runBatch({...f.input,targetIds:['39997']}),/scope/);
 await a.rejects(runBatch({...f.input,existingCatalog:{schemaVersion:1,cards:[{cardId:'39998'}]}}),/imported/);
 await a.rejects(runBatch({...f.input,policy:{...policy,automaticScheduledSiteAccessAllowed:true}}),/policy/);
 a.throws(()=>verify({...empty(),rows:[{cardId:'39998',status:'reserved',sourcePin,packetSha256:null,body:'raw'}]}),/shape/);
 a.equal(f.observations(),0);
});

test('daily plan excludes attempted cards but preserves their pending identity',async()=>{
 const f=fixture(),{excludeAttempted}=require('../src/d069_json_attempt_ledger.cjs');
 await runBatch({...f.input,targetIds:['39998']});
 const p=excludeAttempted(f.input.plan,f.ledger());
 a.deepEqual(p.eligibleIds,['39999']);a.deepEqual(p.heldIds,['39998']);
 a.deepEqual(p.batches,[['39999']]);a.deepEqual(p.attemptedIds,['39998']);
 a.equal(p.siteAccessAuthorized,false);a.equal(p.publicationApproved,false);
 a.equal(f.observations(),1);
 const none=excludeAttempted({...f.input.plan,eligibleIds:[],heldIds:[],batches:[]},f.ledger());
 a.deepEqual(none.attemptedIds,[]);
});

test('reviewed retry consumes exactly one approval and retains previous-state digest',async()=>{
 const {digest}=require('../src/event_release_gate.cjs'),{transition}=require('../src/d069_github_attempt_store.cjs');
 const f=fixture(),targetIds=['39998'];
 await runBatch({...f.input,targetIds});
 const old=f.ledger(),row=old.rows[0];
 const approval={schemaVersion:1,cardId:row.cardId,decision:'explicit-single-retry',priorRowSha256:digest(row),reason:'listing-now-available',reviewedAt:'2026-11-27T11:00:00Z',notBefore:'2026-11-27T12:00:00Z',sourcePin,reviewEvidence:['https://github.com/Nimrodx0/Umasupport/issues/549']};
 const args={...f.input,targetIds,retryApproval:approval,now:'2026-11-27T12:01:00Z'};
 await a.rejects(runBatch({...args,now:'2026-11-27T11:30:00Z'}),/timing/);
 await a.rejects(runBatch({...args,retryApproval:{...approval,priorRowSha256:'0'.repeat(64)}}),/prior state/);
 a.equal(f.observations(),1);
 const store={...f.input.store,compareAndSet:async(before,next)=>{transition(before,next);return f.input.store.compareAndSet(before,next);}};
 await runBatch({...args,store});a.equal(f.observations(),2);
 a.equal(f.ledger().rows[0].retry.priorRowSha256,digest(row));
 a.equal(f.ledger().rows[0].retry.approvalSha256,digest(approval));
 await a.rejects(runBatch(args),/already consumed/);
 a.equal(f.observations(),2);
});
