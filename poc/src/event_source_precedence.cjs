/* Offline advisory source preference for event EFFECT measurements only.
 * Source preference does NOT verify a claim, event ID, rights, or publication. */
'use strict';
const {URL}=require('node:url');
const POLICY=require('../config/event-source-priority.v1.json');
const hostBySource=Object.freeze({GameWith:'gamewith.jp',Game8:'game8.jp'});
function validSourceUrl(url,source){
 if(typeof url!=='string')return false;
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname===hostBySource[source]&&u.pathname!=='/';
 }catch{return false;}
}
function decideNumericEffect(claims){
 if(!Array.isArray(claims)||claims.length===0)throw Error('イベント優先参照: 数値出典が必要');
 const bySource=new Map();
 for(const row of claims){
  if(!row||!Object.hasOwn(hostBySource,row.source)||
     !validSourceUrl(row.url,row.source)||!Number.isFinite(row.value))
   throw Error('イベント優先参照: 不正な数値・出典URL・サイト');
  // Never accept two contradictory values attributed to the same site.
  if(bySource.has(row.source)){
   const prev=bySource.get(row.source);
   if(prev.value!==row.value||prev.url!==row.url)
    throw Error('イベント優先参照: 同じサイトの矛盾する記録');
  }else bySource.set(row.source,{source:row.source,value:row.value,url:row.url});
 }
 if(POLICY.schemaVersion!==1||POLICY.eventEffectPrimary!=='GameWith'||
    POLICY.missingPrimary!=='unresolved'||POLICY.automaticPublicationAllowed!==false)
  throw Error('イベント優先参照: 方針設定が不正');
 const primary=bySource.get(POLICY.eventEffectPrimary);
 const secondary=[...bySource.values()].filter(row=>row.source!==POLICY.eventEffectPrimary);
 if(!primary)return {
  status:'unresolved-primary-missing',selected:null,
  disagreements:[],gameVerified:false,publicationApproved:false
 };
 return {
  status:'provisional',
  selected:primary,
  disagreements:secondary.filter(row=>row.value!==primary.value),
  gameVerified:false,
  publicationApproved:false
 };
}
module.exports={decideNumericEffect,validSourceUrl};
