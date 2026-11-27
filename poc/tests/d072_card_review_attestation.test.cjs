'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {expandAttestations}=require('../src/d072_card_review_attestation.cjs');
const {digest,verifyRelease}=require('../src/event_release_gate.cjs');
const fields=['card','event','choices','outcomes','dependencies','publication'];
function fixture(){
 const cardId='39998',packetSha256='1'.repeat(64),independentEvidenceSha256='2'.repeat(64);
 const card={cardId,coverageStatus:'partial',events:[1,2].map(i=>({id:'gt-json:'+cardId+':'+i,name:'Synthetic '+i,type:'auto',rewards:[]}))};
 const events=card.events.map(e=>({eventId:e.id,sha256:digest(e)}));
 const prepared=[{candidate:{card,packetSha256,publicationApproved:false,eventDigests:events},receipt:{cardId,packetSha256,independentEvidenceSha256,reviewedAt:'2026-11-27',publicationApproved:false}}];
 const attestations=[{schemaVersion:1,cardId,packetSha256,independentEvidenceSha256,events:structuredClone(events),
  reviewer:'synthetic fixture',reviewedAt:'2026-11-27',checks:Object.fromEntries(fields.map(k=>[k,true])),
  evidence:Object.fromEntries(fields.map(k=>[k,['https://example.org/synthetic']])),
  publicationBasis:{kind:'original-factual-description',reason:'synthetic only'}}];
 return {prepared,attestations};
}
test('explicit card-wide confirmation produces individual exact approval entries',()=>{
 const f=fixture(),before=structuredClone(f),ledger=expandAttestations(f);
 a.equal(ledger.entries.length,2);a.deepEqual(f,before);
 for(const [i,e] of ledger.entries.entries()){
  a.equal(e.eventSha256,digest(f.prepared[0].candidate.card.events[i]));
  a.deepEqual(e.checks,f.attestations[0].checks);
 }
 a.equal(verifyRelease({schemaVersion:1,cards:[f.prepared[0].candidate.card]},ledger).reviewedEvents,2);
});
test('missing, stale or incomplete attestation cannot generate approval',()=>{
 for(const mutate of [
  f=>f.attestations=[],f=>f.attestations.push(f.attestations[0]),
  f=>f.attestations[0].events.pop(),f=>f.attestations[0].events.reverse(),
  f=>f.attestations[0].packetSha256='0'.repeat(64),
  f=>f.attestations[0].independentEvidenceSha256='0'.repeat(64),
  f=>f.attestations[0].checks.publication=false,
  f=>delete f.attestations[0].checks.dependencies,
  f=>f.attestations[0].evidence.outcomes=[],
  f=>f.attestations[0].evidence.publication=['http://example.org'],
  f=>f.attestations[0].publicationBasis.reason='',
  f=>f.attestations[0].reviewedAt='2026-11-26',
  f=>f.attestations[0].reviewedAt='2026-02-31',
  f=>f.prepared[0].candidate.card.events[0].name='changed'
 ]){const f=fixture();mutate(f);a.throws(()=>expandAttestations(f),/D072 card attestation/);}
});
