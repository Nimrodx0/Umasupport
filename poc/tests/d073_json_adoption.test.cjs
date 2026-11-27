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
test('ordinary facts and unresolved topology are separated, never infer a chain',()=>{
 const r=classify(fixture({random:[ev(1)],arrows:[ev(2),ev(3)]}));
 a.equal(r.status,'exception-review');a.equal(r.exceptionEventCount,2);a.equal(r.events[0].factStatus,'source-facts-accepted');
 a.ok(r.events[1].reasonCodes.includes('chain-reachability-not-established'));
});
test('unknown codes, invalid scope, history, level-dependent data and legacy metadata are exceptions',()=>{
 for(const f of [fixture({random:[ev(1,{c:[{o:'',r:[{t:'weird'}]}]})]}),fixture({random:[ev(1,{history:[{}]})]}),fixture({random:[ev(1)]},{isLevelDependent:true}),fixture({random:[ev(1)]},{isLevelDependent:'yes'})]){
  a.equal(classify(f).status,'exception-review');
 }
 const f=fixture({random:[ev(1)]});delete f.packet.sourceContext;f.row.packetSha256=digest(f.packet);
 a.ok(classify(f).reasonCodes.includes('legacy-source-context-unavailable'));
 f.packet.events[0].groups[0].routes[0].hints[0].level=3;a.throws(()=>classify(f),/receipt mismatch/);
});

test('source candidates require only exact titles and explicitly established chain topology; unknowns remain blocked',()=>{
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
