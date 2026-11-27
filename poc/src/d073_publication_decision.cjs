'use strict';
// D073 mechanical fact verification plus explicit, content-bound publication
// decision. The named reviewer attests only to access/publication, not to
// independent game verification. Never create permission or evidence claims.
const {digest,secureUrl,verifyRelease}=require('./event_release_gate.cjs');
const fail=m=>{throw Error('D073 publication decision: '+m);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.split(',').sort().join(',');
const bounded=(x,n)=>typeof x==='string'&&!!x.trim()&&x.length<=n&&!/[\r\n\u0000-\u001f]/.test(x);
function generate({items,decisions}={}){
 if(!Array.isArray(items)||items.length<1||items.length>2||!Array.isArray(decisions)||decisions.length!==items.length||
    new Set(decisions.map(d=>d?.cardId)).size!==decisions.length)fail('batch scope');
 const cards=[],entries=[];
 for(const {packet,prepared:{candidate,receipt}} of items){
  if(receipt?.dataKind!=='d073-source-fact-receipt'||receipt.independentGameVerification!==false||
     receipt.publicationApproved!==false||candidate.publicationApproved!==false||candidate.card.cardId!==packet.cardId||
     receipt.packetSha256!==digest(packet)||candidate.packetSha256!==receipt.packetSha256||
     candidate.eventDigests.length!==candidate.card.events.length||candidate.card.events.some((e,i)=>candidate.eventDigests[i].eventId!==e.id||candidate.eventDigests[i].sha256!==digest(e)))fail('verified candidate required');
  const d=decisions.find(d=>d.cardId===packet.cardId);
  if(!exact(d,'schemaVersion,cardId,packetSha256,receiptSha256,eventDigestsSha256,reviewer,reviewedAt,accessConditionsReviewed,publicationApproved,evidenceUrls,publicationBasis')||
     d.schemaVersion!==1||d.packetSha256!==receipt.packetSha256||d.receiptSha256!==digest(receipt)||
     d.eventDigestsSha256!==digest({events:candidate.eventDigests})||
     d.accessConditionsReviewed!==true||d.publicationApproved!==true||
     !bounded(d.reviewer,120)||!/^\d{4}-\d{2}-\d{2}$/.test(d.reviewedAt||'')||
     !Number.isFinite(Date.parse(d.reviewedAt+'T00:00:00Z'))||new Date(d.reviewedAt+'T00:00:00Z').toISOString().slice(0,10)!==d.reviewedAt||
     !Array.isArray(d.evidenceUrls)||!d.evidenceUrls.length||d.evidenceUrls.length>20||d.evidenceUrls.some(x=>!secureUrl(x))||
     !exact(d.publicationBasis,'kind,reason')||!['permission','open-license','original-factual-description'].includes(d.publicationBasis.kind)||!bounded(d.publicationBasis.reason,2000))fail('explicit access and publication decision for exact content required');
  const sourceUrl=packet.sourceUrl,base='https://github.com/mee1080/umasim/blob/'+packet.sourcePin.commit+'/data/';
  const evidence={card:[sourceUrl,base+'support_card.txt'],event:[sourceUrl],choices:[sourceUrl],outcomes:[sourceUrl,base+'skill_data.txt'],
   dependencies:[sourceUrl,...receipt.chainEvidenceUrls],publication:d.evidenceUrls.slice()};
  cards.push(candidate.card);
  for(const e of candidate.eventDigests)entries.push({cardId:d.cardId,eventId:e.eventId,eventSha256:e.sha256,
   reviewer:'D073 mechanical facts; access/publication: '+d.reviewer,reviewedAt:d.reviewedAt,
   checks:{card:true,event:true,choices:true,outcomes:true,dependencies:true,publication:true},
   evidence:structuredClone(evidence),publicationBasis:structuredClone(d.publicationBasis)});
 }
 const approvals={schemaVersion:1,entries};
 verifyRelease({schemaVersion:1,cards},approvals);
 return approvals;
}
module.exports={generate};
