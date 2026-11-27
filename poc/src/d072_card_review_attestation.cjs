'use strict';
// Expand an explicit card-wide attestation into the existing individual
// approval ledger. No inference of checks, permission, or reviewer identity.
const {canonical,digest,secureUrl,verifyRelease}=require('./event_release_gate.cjs');
const fields=['card','event','choices','outcomes','dependencies','publication'];
const exact=(x,ks)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===ks.slice().sort().join(',');
const same=(a,b)=>canonical(a)===canonical(b);
const fail=m=>{throw Error('D072 card attestation: '+m);};
function expandAttestations({prepared,attestations}={}){
 if(!Array.isArray(prepared)||prepared.length<1||prepared.length>2||!Array.isArray(attestations)||
    attestations.length!==prepared.length||new Set(attestations.map(x=>x?.cardId)).size!==attestations.length)fail('batch scope');
 const cards=[],entries=[];
 for(const {candidate,receipt} of prepared){
  if(candidate?.publicationApproved!==false||receipt?.publicationApproved!==false||
     candidate.card?.cardId!==receipt.cardId||candidate.packetSha256!==receipt.packetSha256||
     !/^[a-f0-9]{64}$/.test(receipt.independentEvidenceSha256||''))fail('candidate receipt');
  const v=attestations.find(x=>x?.cardId===receipt.cardId);
  const expected=candidate.card.events.map(e=>({eventId:e.id,sha256:digest(e)}));
  if(!expected.length||!same(candidate.eventDigests,expected)||
    !exact(v,['schemaVersion','cardId','packetSha256','independentEvidenceSha256','events','reviewer','reviewedAt','checks','evidence','publicationBasis'])||
    v.schemaVersion!==1||v.packetSha256!==receipt.packetSha256||v.independentEvidenceSha256!==receipt.independentEvidenceSha256||
    !same(v.events,expected))fail('exact card and event digest coverage required');
  if(typeof v.reviewer!=='string'||!v.reviewer.trim()||v.reviewer.length>120||
    typeof v.reviewedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.reviewedAt)||
    !Number.isFinite(Date.parse(v.reviewedAt+'T00:00:00Z'))||
    new Date(v.reviewedAt+'T00:00:00Z').toISOString().slice(0,10)!==v.reviewedAt||
    v.reviewedAt<receipt.reviewedAt||
    !exact(v.checks,fields)||fields.some(k=>v.checks[k]!==true)||
    !exact(v.evidence,fields)||fields.some(k=>!Array.isArray(v.evidence[k])||!v.evidence[k].length||v.evidence[k].length>20||
      v.evidence[k].some(u=>!secureUrl(u)))||
    !exact(v.publicationBasis,['kind','reason'])||
    !['permission','open-license','original-factual-description'].includes(v.publicationBasis.kind)||
    typeof v.publicationBasis.reason!=='string'||!v.publicationBasis.reason.trim()||v.publicationBasis.reason.length>2000)fail('explicit six checks and publication basis required');
  cards.push(candidate.card);
  for(const e of expected)entries.push({cardId:v.cardId,eventId:e.eventId,eventSha256:e.sha256,
   reviewer:v.reviewer,reviewedAt:v.reviewedAt,checks:structuredClone(v.checks),evidence:structuredClone(v.evidence),
   publicationBasis:structuredClone(v.publicationBasis)});
 }
 const approvals={schemaVersion:1,entries};
 verifyRelease({schemaVersion:1,cards},approvals);
 return approvals;
}
module.exports={expandAttestations};
