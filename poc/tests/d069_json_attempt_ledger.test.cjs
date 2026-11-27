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
