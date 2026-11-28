'use strict';
// D077: bounded delayed retries, durable history, explicit hard-stop clearance.
const {digest}=require('./event_release_gate.cjs');
const HOUR=3600000, DAY=24*HOUR, JST=9*HOUR, MAX=4, UNLISTED_MAX=8;
// Use Japan calendar days so a delayed GitHub daily run does not skip the next day.
const dayStart=ms=>Math.floor((ms+JST)/DAY)*DAY-JST;
const deadline=a=>dayStart(Date.parse(a.firstAt))+8*DAY;
const limit=r=>r.status==='not-listed'&&r.attempt?.firstAt?UNLISTED_MAX:MAX;
const exhausted=(r,now)=>!r.attempt||r.attempt.count>=limit(r)||r.status==='not-listed'&&r.attempt.firstAt&&
 (Date.parse(r.attempt.nextAt)>=deadline(r.attempt)||Date.parse(now)>=deadline(r.attempt));
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const retryable=r=>!r.retry&&(r.status==='not-listed'||r.status==='uncertain'&&['network-transient','rate-limited'].includes(r.failureCode));
const hardRefusal=r=>r.failureCode==='source-refused'||r.failureCode==='rate-limited'&&!r.attempt;
const due=(r,now,clearances)=>r.attempt&&!exhausted(r,now)&&(retryable(r)&&Date.parse(r.attempt.nextAt)<=Date.parse(now)||hardRefusal(r)&&!activeRefusal({rows:[r]},clearances));
function validAttempt(r){
 const a=r.attempt;
 return a===undefined||a&&['count,nextAt,startedAt','count,firstAt,nextAt,startedAt'].includes(Object.keys(a).sort().join(','))&&Number.isInteger(a.count)&&a.count>=1&&a.count<=(a.firstAt===undefined?MAX:UNLISTED_MAX)&&date(a.startedAt)&&
 (a.firstAt===undefined||date(a.firstAt)&&Date.parse(a.firstAt)<=Date.parse(a.startedAt))&&
 (retryable(r)?date(a.nextAt)&&Date.parse(a.nextAt)>=Date.parse(a.startedAt):a.nextAt===null);
}
function reserve(old,now){
 if(!date(now)||old&&!due(old,now))throw Error('D077 retry not due');
 return {count:(old?.attempt.count??0)+1,startedAt:now,nextAt:null,...(!old?{firstAt:now}:old.attempt.firstAt?{firstAt:old.attempt.firstAt}:{})};
}
function finish(row,result,now,retryAfter=null){
 if(!row.attempt)return {};
 const retry=retryable({...row,...result});
 const n=Date.parse(now);
 const nextAt=retry?new Date(result.status==='not-listed'&&row.attempt.firstAt?dayStart(n)+DAY:Math.max(n+DAY*2**(Math.min(row.attempt.count,MAX)-1),retryAfter??0)).toISOString():null;
 return {attempt:{...row.attempt,nextAt}};
}
function activeRefusal(ledger,clearances=require('../config/d077-source-resume.v1.json')){
 if(clearances?.schemaVersion!==1||!Array.isArray(clearances.resolved)||clearances.resolved.some(x=>!x||Object.keys(x).sort().join(',')!=='reason,rowSha256'||!/^[a-f0-9]{64}$/.test(x.rowSha256)||typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>1000))throw Error('D077 invalid source clearance');
 const cleared=new Set(clearances.resolved.map(x=>x.rowSha256));
 return ledger.rows.some(r=>hardRefusal(r)&&!cleared.has(digest(r)));
}
function cooldown(ledger,now){
 return ledger.rows.some(r=>r.failureCode==='rate-limited'&&r.attempt&&Date.parse(r.attempt.nextAt)>Date.parse(now));
}
module.exports={MAX,UNLISTED_MAX,limit,exhausted,date,retryable,due,validAttempt,reserve,finish,activeRefusal,cooldown,hardRefusal};
