'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {buildReviewQueue}=require('../src/d072_offline_review_queue.cjs');
const {inspect}=require('../src/d069_json_review_bridge.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const {gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const catalog={schemaVersion:1,cards:[]};
const skillText=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(990001+i),name:'Synthetic '+i,rarity:'normal',group:i})));
const pin={commit:'a'.repeat(40),cardBlob:'b'.repeat(40),skillBlob:gitBlobSha(skillText)};
function packet(cardId,category='random',count=1){
 return inspect({cardId,sourceUrl:'https://gametora.com/ja/umamusume/supports/'+cardId+'-example',buildId:'synthetic',sourcePin:pin,skillText,existingCatalog:catalog,
 body:JSON.stringify({pageProps:{sourceData:{support_id:Number(cardId)},eventData:{ja:JSON.stringify({[category]:Array.from({length:count},(_,i)=>({i:i+1,n:'Synthetic title'+(i===0?'':i+1),c:[{o:'',r:[{t:'sk',v:'+2',d:990001}]}]}))})}}})});
}
function fixture(){
 const packets=new Map([['39995',packet('39995')],['39996',packet('39996','special')],['39997',packet('39997')]]);
 const rows=[...packets].map(([cardId,p])=>({cardId,sourcePin:pin,status:p.status==='held'?'held':'awaiting-fact-review',packetSha256:digest(p)}));
 rows.push({cardId:'39998',sourcePin:pin,status:'uncertain',packetSha256:null,failureCode:'source-refused'});
 const ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:4,rows};
 let calls=0,reads=0;
 const store={load:async()=>structuredClone(ledger),loadPacket:async id=>{reads++;return structuredClone(packets.get(id));}};
 const args={store,pendingIds:['39995','39996','39997','39998','39999'],existingCatalog:catalog,
 loadSkillText:async source=>{calls++;a.deepEqual(source,pin);return skillText;}};
 return {args,ledger,packets,counts:()=>({calls,reads})};
}
test('read-only queue identifies review work, holds and missing observations without generating approvals',async()=>{
 const f=fixture(),before=structuredClone(f.ledger),q=await buildReviewQueue(f.args);
 a.deepEqual(q.rows.map(r=>r.status),['ready-for-independent-review','held','ready-for-independent-review','uncertain','unattempted']);
 a.equal(q.rows[0].eventChecks[0].exactTitleSha256,f.packets.get('39995').events[0].exactTitleSha256);
 a.equal(q.rows[0].eventChecks[0].routeFactsSha256,digest({groups:f.packets.get('39995').events[0].groups}));
 a.deepEqual(q.rows[0].eventChecks[0].resultCounts,[1]);
 a.equal(q.rows[0].adoption.status,'source-facts-accepted');a.equal(q.rows[0].adoption.publicationApproved,false);
 a.ok(q.rows[1].reasonCodes.includes('unsupported-event-category'));
 a.deepEqual(q.rows[3].reasonCodes,['source-refused']);a.deepEqual(f.counts(),{calls:1,reads:3});
 a.equal(q.publicationApproved,false);a.ok(q.rows.every(r=>r.publicationApproved===false));
 a.doesNotMatch(JSON.stringify(q),/Synthetic title|pageProps|eventData|previousSourceEventId/);
 a.deepEqual(f.ledger,before);
});
test('zero pending IDs does not read any packet or skill blob',async()=>{
 const f=fixture(),q=await buildReviewQueue({...f.args,pendingIds:[]});
 a.deepEqual(q.rows,[]);a.deepEqual(f.counts(),{calls:0,reads:0});
});
test('missing or tampered archive, stale catalog and invalid pinned dictionary never enter review-ready state',async()=>{
 const f=fixture();
 f.packets.get('39995').events[0].groups[0].routes[0].hints[0].level=7;
 f.packets.delete('39997');
 let q=await buildReviewQueue(f.args);
 a.equal(q.rows[0].status,'packet-unavailable-or-invalid');a.equal(q.rows[2].status,'packet-unavailable-or-invalid');
 const g=fixture();
 q=await buildReviewQueue({...g.args,existingCatalog:{schemaVersion:1,cards:[{cardId:'39994',events:[]}],changed:true}});
 a.equal(q.rows[0].status,'catalog-drift');a.equal(g.counts().calls,0);
 q=await buildReviewQueue({...g.args,existingCatalog:{schemaVersion:1,cards:[{cardId:'39994',events:[]}]}});
 a.equal(q.rows[0].status,'ready-for-independent-review');a.equal(q.rows[0].baseCatalogStatus,'verified-append-only-prefix');
 q=await buildReviewQueue({...g.args,loadSkillText:async()=> 'wrong'});
 a.equal(q.rows[0].status,'skill-dictionary-unavailable-or-invalid');
 await a.rejects(buildReviewQueue({...g.args,existingCatalog:{schemaVersion:1,cards:[{cardId:'39995'}]}}),/already imported/);
});

test('catalog prefix proof accepts append only, rejects mutation, reordering and deletion',()=>{
 const {findObservedCatalog}=require('../src/d072_catalog_prefix.cjs');
 const aCard={cardId:'39991',events:[{id:'a',name:'synthetic',type:'auto',rewards:[]}]};
 const bCard={cardId:'39992',events:[]},cCard={cardId:'39993',events:[]};
 const base={aaa:'metadata before cards',schemaVersion:1,zzz:{other:true},cards:[aCard,bCard]};
 const expected=digest(base),extended={...base,cards:[aCard,bCard,cCard]};
 a.deepEqual(findObservedCatalog(extended,expected),{catalog:base,addedCardIds:['39993']});
 a.deepEqual(findObservedCatalog(base,expected),{catalog:base,addedCardIds:[]});
 for(const changed of [
  {...extended,cards:[{...aCard,events:[]},bCard,cCard]},
  {...extended,cards:[bCard,aCard,cCard]},
  {...extended,cards:[aCard,cCard]},
  {...extended,zzz:{other:false}}
 ])a.equal(findObservedCatalog(changed,expected),null);
 a.throws(()=>findObservedCatalog({...base,cards:[aCard,aCard]},expected),/card IDs/);
});

test('daily queue prepares an archived normal card with metadata only and no new review input',async()=>{
 const f=fixture(),p=f.packets.get('39995');
 p.identifyingTitles=[{sourceEventId:1,title:'Synthetic title'}];
 f.ledger.rows[0].packetSha256=digest(p);
 const q=await buildReviewQueue(f.args),row=q.rows[0];
 a.equal(row.status,'ready-for-publication-decision');
 a.equal(row.sourceCandidateInputReady,true);
 a.deepEqual(row.routine.input,{dataKind:'d073-source-title-input',schemaVersion:1,cardId:'39995',packetSha256:digest(p),titles:null,chainEvidence:null});
 const {candidate,receipt}=require('../src/d073_json_adoption.cjs').prepareSourceCandidate({packet:p,ledger:f.ledger,input:row.routine.input,skillText,existingCatalog:catalog});
 a.equal(row.routine.receiptSha256,digest(receipt));
 a.equal(row.routine.eventDigestsSha256,digest({events:candidate.eventDigests}));
 a.deepEqual(row.routine.events,candidate.eventDigests);
 a.equal(row.routine.publicationApproved,false);
 a.doesNotMatch(JSON.stringify(q),/Synthetic title|pageProps|eventData/);
 a.equal(q.rows[2].routine,undefined);
});

test('daily queue prepares normal two-stage chains without human chain evidence; abnormal lengths held',async()=>{
 const f=fixture();
 for(const [id,n] of [['39995',2],['39997',4]]){
  const p=packet(id,'arrows',n);
  p.identifyingTitles=p.events.map((e,i)=>({sourceEventId:e.sourceEventId,title:'Synthetic title'+(i===0?'':i+1)}));
  f.packets.set(id,p);f.ledger.rows.find(r=>r.cardId===id).packetSha256=digest(p);
 }
 const q=await buildReviewQueue(f.args);
 a.equal(q.rows[0].status,'ready-for-publication-decision');
 a.equal(q.rows[0].routine.input.chainEvidence.dataKind,'d073-ordinary-chain-policy');
 a.equal(q.rows[0].routine.events.length,2);
 a.equal(q.rows[2].status,'ready-for-independent-review');a.equal(q.rows[2].routine,undefined);
 a.doesNotMatch(JSON.stringify(q),/Synthetic title|pageProps|eventData/);
});
