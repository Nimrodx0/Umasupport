'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {inspect}=require('../src/d069_json_review_bridge.cjs'),{classify}=require('../src/d073_json_adoption.cjs');
const {digest}=require('../src/event_release_gate.cjs'),{gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const skillText=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(990001+i),name:'Synthetic '+i,rarity:'normal',group:i})));
const cardId='39998',sourcePin={commit:'a'.repeat(40),cardBlob:'b'.repeat(40),skillBlob:gitBlobSha(skillText)};
const ev=(i,extra={})=>({i,n:'Synthetic event '+i,c:[{o:'',r:[{t:'sk',v:'+2',d:990001}]}],...extra});
function fixture(doc,flags={}){
 const packet=inspect({cardId,sourceUrl:'https://gametora.com/ja/umamusume/supports/39998-example',buildId:'synthetic',
  sourcePin,skillText,existingCatalog:{schemaVersion:1,cards:[]},body:JSON.stringify({pageProps:{sourceData:{support_id:39998},eventData:{ja:JSON.stringify(doc)},...flags}})});
 const row={cardId,sourcePin,status:packet.status==='held'?'held':'awaiting-fact-review',packetSha256:digest(packet)};
 return {packet,row,skillText};
}
test('ordinary explicit facts accepted from JSON alone, not published or game verified',()=>{
 const f=fixture({random:[ev(1),ev(2,{c:[{o:'A',r:[{t:'sk',v:'+1',d:990002}]},{o:'B',r:[{t:'pt',v:'+5'}]}]})]});
 const r=classify(f);a.equal(r.status,'source-facts-accepted');a.equal(r.exceptionEventCount,0);
 a.equal(r.publicationApproved,false);a.equal(r.independentGameVerification,false);a.equal(r.identifyingTitlesRequired,true);
 a.doesNotMatch(JSON.stringify(r),/Synthetic event|pageProps|eventData/);
});
test('ordinary chain classification uses D035/D038; abnormal stage groups remain exceptions',()=>{
 const r=classify(fixture({random:[ev(1)],arrows:[ev(2),ev(3)]}));
 a.equal(r.status,'source-facts-accepted');a.equal(r.exceptionEventCount,0);
 for(const arrows of [[ev(2)],[ev(2),ev(3),ev(4),ev(5)],[ev(2,{c:[{o:'',r:[{t:'ee'}]}]}),ev(3)]]]){
  const q=classify(fixture({random:[ev(1)],arrows}));
  a.equal(q.status,'exception-review');
  a.ok(q.events[1].reasonCodes.includes('chain-reachability-not-established'));
 }
});
test('unknown codes, invalid scope, history, level-dependent data and legacy metadata are exceptions',()=>{
 for(const f of [fixture({random:[ev(1,{c:[{o:'',r:[{t:'weird'}]}]})]}),fixture({random:[ev(1,{history:[{}]})]}),fixture({random:[ev(1)]},{isLevelDependent:true}),fixture({random:[ev(1)]},{isLevelDependent:'yes'})]){
  a.equal(classify(f).status,'exception-review');
 }
 const f=fixture({random:[ev(1)]});delete f.packet.sourceContext;f.row.packetSha256=digest(f.packet);
 a.ok(classify(f).reasonCodes.includes('legacy-source-context-unavailable'));
 f.packet.events[0].groups[0].routes[0].hints[0].level=3;a.throws(()=>classify(f),/receipt mismatch/);
});

test('manual chain evidence remains supported; missing evidence or policy is blocked',()=>{
 const {prepareSourceCandidate}=require('../src/d073_json_adoption.cjs');
 const f=fixture({random:[ev(1)],arrows:[ev(2),ev(3)]});
 const ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:2,rows:[f.row]};
 const input={dataKind:'d073-source-title-input',schemaVersion:1,cardId,packetSha256:digest(f.packet),titles:[1,2,3].map(i=>({sourceEventId:i,title:'Synthetic event '+i})),chainEvidence:null};
 const args={packet:f.packet,skillText,ledger,existingCatalog:{schemaVersion:1,cards:[]},input};
 a.throws(()=>prepareSourceCandidate(args),/explicit chain evidence/);
 input.chainEvidence={reviewer:'synthetic fixture',reviewedAt:'2026-11-28',evidenceUrls:['https://example.org/synthetic'],events:[{sourceEventId:2,previousSourceEventId:null},{sourceEventId:3,previousSourceEventId:2}]};
 const x=prepareSourceCandidate(args);
 a.equal(x.candidate.publicationApproved,false);a.equal(x.receipt.independentGameVerification,false);
 a.equal(x.candidate.card.events[0].requires,undefined);
 a.deepEqual(x.candidate.card.events[2].requires,{all:[{eventId:'gt-json:39998:2'}]});
 a.equal(x.receipt.chainEvidenceSha256,digest(input.chainEvidence));
 input.chainEvidence.events[1].previousSourceEventId=null;
 a.throws(()=>prepareSourceCandidate(args),/topology/);
});

test('ordinary chain policy preserves per-result stop and downstream reachability',()=>{
 const {prepareSourceCandidate,ordinaryChainEvidence}=require('../src/d073_json_adoption.cjs');
 const f=fixture({random:[ev(1)],arrows:[
  ev(2,{c:[{o:'A',r:[{t:'sk',v:'+1',d:990002},{t:'di'},{t:'ee'}]},{o:'B',r:[{t:'ee'}]}]}),
  ev(3),ev(4)]});
 const ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:2,rows:[f.row]};
 const chainEvidence=ordinaryChainEvidence(f.packet);
 const input={dataKind:'d073-source-title-input',schemaVersion:1,cardId,packetSha256:digest(f.packet),
  titles:[1,2,3,4].map(i=>({sourceEventId:i,title:'Synthetic event '+i})),chainEvidence};
 const args={packet:f.packet,skillText,ledger,existingCatalog:{schemaVersion:1,cards:[]},input};
 const {candidate,receipt}=prepareSourceCandidate(args);
 const es=candidate.card.events,first=es[1],last=es[3],{reachability}=require('../src/core.js');
 a.deepEqual(last.requires,{all:[{eventId:es[2].id}]});
 a.equal(first.choices[0].outcomes[1].terminal,true);
 a.equal(first.choices[0].outcomes[0].terminal,undefined);
 a.equal(reachability(last,{},es).status,'blocked');
 a.equal(reachability(last,{[first.id]:'c1'},es).status,'conditional');
 a.equal(reachability(last,{[first.id]:'c1'},es,{[first.id]:'r1'}).status,'reachable');
 a.equal(reachability(last,{[first.id]:'c1'},es,{[first.id]:'r2'}).status,'blocked');
 a.equal(reachability(last,{[first.id]:'c2'},es).status,'blocked');
 a.equal(receipt.chainEvidenceSha256,digest(chainEvidence));
 a.equal(receipt.independentGameVerification,false);a.equal(candidate.publicationApproved,false);
 for(const bad of [{...chainEvidence,packetSha256:'0'.repeat(64)},{...chainEvidence,events:chainEvidence.events.slice(1)},{...chainEvidence,policy:'fake'}]){
  a.throws(()=>prepareSourceCandidate({...args,input:{...input,chainEvidence:bad}}),/policy scope or digest/);
 }
});
