/* Determine numeric event effects: GameTora-derived baseline; GameWith resolves
 * flagged conflicts. Game8 is diagnostic only, never a deciding vote.
 * This is an OFFLINE editorial decision and does not approve publication.
 */
'use strict';
const {URL}=require('node:url');
const POLICY=require('../config/event-source-priority.v1.json');
const {checkContract,validateGtWebsiteCheck}=require('./event_exception_adjudication.cjs');
const hostBySource=Object.freeze({GameWith:'gamewith.jp',Game8:'game8.jp'});
const fail=msg=>{throw Error('イベント優先参照: '+msg);};
function validSourceUrl(url,source){
 if(typeof url!=='string'||!Object.hasOwn(hostBySource,source))return false;
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&!u.username&&!u.password&&
   u.hostname===hostBySource[source]&&u.pathname!=='/'&&
   !u.search&&!u.hash;
 }catch{return false;}
}
function validatePolicy(){
 checkContract();
 if(POLICY.schemaVersion!==2||POLICY.baselineSource!=='GameTora-derived'||
    POLICY.canonicalExceptionSource!=='GameWith'||
    !/^[a-f0-9]{40}$/.test(POLICY.baselineRevision)||
    POLICY.automaticPublicationAllowed!==false)
  fail('GameTora基準の方針設定が不正');
}
function decideNumericEffect(claims,{suspected=false,gtWebsiteReview=null}={}){
 validatePolicy();
 if(!Array.isArray(claims)||claims.length===0)fail('数値出典が必要');
 if(typeof suspected!=='boolean')fail('疑義フラグが不正');
 const bySource=new Map();
 for(const row of claims){
  if(!row||!['GameTora-derived','GameWith','Game8'].includes(row.source)||
     !Number.isFinite(row.value))fail('不正な数値・出典');
  if(row.source==='GameTora-derived'){
   if(row.revision!==POLICY.baselineRevision)fail('GameTora基準版が一致しません');
  }else if(!validSourceUrl(row.url,row.source))fail('不正な出典URL');
  if(bySource.has(row.source)){
   const prev=bySource.get(row.source);
   if(prev.value!==row.value||prev.revision!==row.revision||prev.url!==row.url)
    fail('同じ出典に矛盾する値');
  }else bySource.set(row.source,{source:row.source,value:row.value,
    ...(row.revision?{revision:row.revision}:{}),
    ...(row.url?{url:row.url}:{})});
 }
 const baseline=bySource.get('GameTora-derived');
 const other=[...bySource.values()].filter(x=>x.source!=='GameTora-derived');
 if(!baseline){
  const gameWith=bySource.get('GameWith');
  if(!gameWith)return {status:'unresolved-baseline-missing',selected:null,
   baselineCoverageGap:true,disagreements:[],
   gameVerified:false,publicationApproved:false};
  if(!gtWebsiteReview)return {
   status:'pending-gametora-live-site-check',
   selected:null,candidate:gameWith,baseline:null,
   baselineCoverageGap:true,disagreements:[],
   gameVerified:false,publicationApproved:false};
  validateGtWebsiteCheck(gtWebsiteReview.cardId,
   gtWebsiteReview.sourceEventOrdinal,gtWebsiteReview.gtWebsite);
  return {
   status:'adjudicated-missing-baseline-by-gamewith',
   selected:gameWith,baseline:null,
   baselineCoverageGap:true,
   gameToraWebsiteCheck:gtWebsiteReview.gtWebsite,
   disagreements:[],
   gameVerified:false,publicationApproved:false
  };
 }
 const disagree=other.filter(x=>x.value!==baseline.value);
 const hasIssue=suspected||disagree.length>0;
 const adjudicator=bySource.get('GameWith');
 if(hasIssue){
  if(!adjudicator)return {status:'pending-gamewith-adjudication',
    selected:null,baseline,disagreements:disagree,
    gameVerified:false,publicationApproved:false};
  return {status:'adjudicated-by-gamewith',
    selected:adjudicator,baseline,disagreements:disagree,
    gameVerified:false,publicationApproved:false};
 }
 return {status:adjudicator?'baseline-corroborated-by-gamewith':'baseline-accepted',
  selected:baseline,baseline,disagreements:[],
  gameVerified:false,publicationApproved:false};
}
module.exports={decideNumericEffect,validSourceUrl};
