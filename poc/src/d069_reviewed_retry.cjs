'use strict';
// An explicit reviewed retry is not an automatic retry. Only a previously
// completed not-listed or uncertain observation may be retried once.
// Reserved rows may still correspond to active executions; held/review
// rows have data and should be reviewed offline, not fetched again.
const {verify}=require('./d069_json_attempt_ledger.cjs');
const {canonical,digest}=require('./event_release_gate.cjs');
const fail=m=>{throw Error('D069 reviewed retry: '+m);};
const SHA=/^[a-f0-9]{64}$/,GIT=/^[a-f0-9]{40}$/;
const same=(a,b)=>canonical(a)===canonical(b);
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&!Number.isNaN(Date.parse(x));
function reserveRetry({ledger,approval,sourcePin,existingCatalog,now}={}){
 verify(ledger);
 if(!approval||Object.keys(approval).sort().join(',')!=='cardId,decision,notBefore,priorRowSha256,reason,reviewEvidence,reviewedAt,schemaVersion,sourcePin'||
    approval.schemaVersion!==1||approval.decision!=='explicit-single-retry'||
    !SHA.test(approval.priorRowSha256||'')||!date(approval.reviewedAt)||!date(approval.notBefore)||!date(now)||
    Date.parse(approval.notBefore)<Date.parse(approval.reviewedAt)||Date.parse(now)<Date.parse(approval.notBefore)||
    !Array.isArray(approval.reviewEvidence)||!approval.reviewEvidence.length||approval.reviewEvidence.length>5||
    approval.reviewEvidence.some(x=>typeof x!=='string'||!/^https:\/\/github\.com\/Nimrodx0\/Umasupport\/(?:issues|pull|actions\/runs)\/[1-9]\d*(?:#issuecomment-[1-9]\d*)?$/.test(x))||
    !['listing-now-available','confirmed-transient-failure-resolved'].includes(approval.reason)||
    Object.keys(sourcePin||{}).sort().join(',')!=='cardBlob,commit,skillBlob'||!Object.values(sourcePin).every(x=>GIT.test(x||''))||
    !same(approval.sourcePin,sourcePin)||existingCatalog?.schemaVersion!==1||!Array.isArray(existingCatalog.cards)||
    existingCatalog.cards.some(c=>c.cardId===approval.cardId))fail('approval scope, timing or source pin');
 const row=ledger.rows.find(r=>r.cardId===approval.cardId);
 if(!row||row.retry!==undefined||!['not-listed','uncertain'].includes(row.status)||
    digest(row)!==approval.priorRowSha256||
    (row.status==='not-listed'?approval.reason!=='listing-now-available':approval.reason!=='confirmed-transient-failure-resolved'))fail('prior state, reason or retry already consumed');
 return verify({...ledger,revision:ledger.revision+1,rows:ledger.rows.map(r=>r===row?{
  cardId:r.cardId,status:'reserved',sourcePin:structuredClone(sourcePin),packetSha256:null,
  retry:{priorRowSha256:digest(row),approvalSha256:digest(approval),priorStatus:row.status}
 }:r)});
}
module.exports={reserveRetry};
