'use strict';
// One explicitly reviewed common policy, applied only to the narrow routine
// scope. No inferred permission, no source access, no scheduled publication.
const {digest,secureUrl}=require('./event_release_gate.cjs');
const {verify}=require('./d069_json_attempt_ledger.cjs');
const fail=m=>{throw Error('D073 routine policy: '+m);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.split(',').sort().join(',');
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const bounded=(s,n)=>typeof s==='string'&&!!s.trim()&&s.length<=n&&!/[\r\n\u0000-\u001f]/.test(s);
function derive({policy,items,ledger,today=new Date().toISOString().slice(0,10)}={}){
 verify(ledger);
 if(!exact(policy,'schemaVersion,scope,reviewer,reviewedAt,validThrough,accessConditionsReviewed,publicationApproved,evidenceUrls,publicationBasis')||
    policy.schemaVersion!==1||policy.scope!=='D073-normal-random-skill-path-identifying-titles-only'||
    !bounded(policy.reviewer,120)||!day(today)||!day(policy.reviewedAt)||!day(policy.validThrough)||
    policy.reviewedAt>today||policy.validThrough<today||
    policy.accessConditionsReviewed!==true||policy.publicationApproved!==true||
    !Array.isArray(policy.evidenceUrls)||!policy.evidenceUrls.length||policy.evidenceUrls.length>20||
    policy.evidenceUrls.some(x=>!secureUrl(x))||
    !exact(policy.publicationBasis,'kind,reason')||!['permission','open-license','original-factual-description'].includes(policy.publicationBasis.kind)||
    !bounded(policy.publicationBasis.reason,1600))fail('explicit valid common policy required');
 if(ledger.rows.some(r=>r.failureCode==='source-refused'))fail('prior source refusal; re-evaluation required');
 if(!Array.isArray(items)||items.length<1||items.length>2||new Set(items.map(x=>x?.packet?.cardId)).size!==items.length)fail('batch scope');
 const policySha=digest(policy);
 return items.map(({packet,input,prepared:{candidate,receipt}})=>{
  const row=ledger.rows.find(r=>r.cardId===packet?.cardId);
  require('./d069_review_packet_archive.cjs').scope(packet,row);
  if(row.status!=='awaiting-fact-review'||row.retry!==undefined||
     !packet.identifyingTitles||packet.events.some(e=>e.category!=='random')||
     input?.dataKind!=='d073-source-title-input'||input.titles!==null||input.chainEvidence!==null||
     receipt.dataKind!=='d073-source-fact-receipt'||receipt.chainEvidenceSha256!==null||
     receipt.independentGameVerification!==false||receipt.publicationApproved!==false||
     candidate.publicationApproved!==false||candidate.skillPathOnly!==true||
     receipt.packetSha256!==digest(packet)||candidate.packetSha256!==receipt.packetSha256)fail('outside routine scope');
  return {schemaVersion:1,cardId:packet.cardId,packetSha256:receipt.packetSha256,receiptSha256:digest(receipt),
   eventDigestsSha256:digest({events:candidate.eventDigests}),reviewer:policy.reviewer,reviewedAt:policy.reviewedAt,
   accessConditionsReviewed:true,publicationApproved:true,evidenceUrls:policy.evidenceUrls.slice(),
   publicationBasis:{kind:policy.publicationBasis.kind,reason:policy.publicationBasis.reason+' [D073 common policy SHA-256: '+policySha+']'}};
 });
}
module.exports={derive};
