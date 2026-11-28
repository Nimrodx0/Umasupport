'use strict';
// D077: bounded delayed retries, durable history, explicit hard-stop clearance.
const {digest}=require('./event_release_gate.cjs');
const HOUR=3600000, MAX=4;
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const retryable=r=>!r.retry&&(r.status==='not-listed'||r.status==='uncertain'&&['network-transient','rate-limited'].includes(r.failureCode));
const due=(r,now)=>retryable(r)&&r.attempt&&r.attempt.count<MAX&&Date.parse(r.attempt.nextAt)<=Date.parse(now);
function validAttempt(r){
 const a=r.attempt;
 return a===undefined||a&&Object.keys(a).sort().join(',')==='count,nextAt,startedAt'&&Number.isInteger(a.count)&&a.count>=1&&a.count<=MAX&&date(a.startedAt)&&
 (retryable(r)?date(a.nextAt)&&Date.parse(a.nextAt)>=Date.parse(a.startedAt):a.nextAt===null);
}
function reserve(old,now){
 if(!date(now)||old&&!due(old,now))throw Error('D077 retry not due');
 return {count:(old?.attempt.count??0)+1,startedAt:now,nextAt:null};
}
function finish(row,result,now,retryAfter=null){
 if(!row.attempt)return {};
 const retry=retryable({...row,...result});
 const n=Date.parse(now);
 const nextAt=retry?new Date(Math.max(n+24*HOUR*2**(row.attempt.count-1),retryAfter??0)).toISOString():null;
 return {attempt:{...row.attempt,nextAt}};
}
function activeRefusal(ledger,clearances=require('../config/d077-source-resume.v1.json')){
 if(clearances?.schemaVersion!==1||!Array.isArray(clearances.resolved)||clearances.resolved.some(x=>!x||Object.keys(x).sort().join(',')!=='reason,rowSha256'||!/^[a-f0-9]{64}$/.test(x.rowSha256)||typeof x.reason!=='string'||!x.reason.trim()))throw Error('D077 invalid source clearance');
 const cleared=new Set(clearances.resolved.map(x=>x.rowSha256));
 return ledger.rows.some(r=>r.failureCode==='source-refused'&&!cleared.has(digest(r)));
}
function cooldown(ledger,now){
 return ledger.rows.some(r=>r.failureCode==='rate-limited'&&r.attempt&&Date.parse(r.attempt.nextAt)>Date.parse(now));
}
module.exports={MAX,date,retryable,due,validAttempt,reserve,finish,activeRefusal,cooldown};
