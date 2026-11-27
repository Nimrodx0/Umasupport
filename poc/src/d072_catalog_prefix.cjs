'use strict';
// Recover the exact observed catalog only if it is a prefix of the
// current catalog. No old cards or root metadata can be edited or removed.
const crypto=require('node:crypto');
const {canonical,digest}=require('./event_release_gate.cjs');
function findObservedCatalog(current,expectedSha){
 if(!current||current.schemaVersion!==1||!Array.isArray(current.cards)||
    !/^[a-f0-9]{64}$/.test(expectedSha||''))throw Error('D072 catalog prefix: invalid input');
 const ids=current.cards.map(c=>c?.cardId);
 if(ids.some(id=>typeof id!=='string'||!/^[1-9]\d{4}$/.test(id))||new Set(ids).size!==ids.length)
  throw Error('D072 catalog prefix: invalid card IDs');
 const keys=Object.keys(current).sort(),i=keys.indexOf('cards');
 const field=k=>JSON.stringify(k)+':'+canonical(current[k]);
 const prefix='{'+keys.slice(0,i).map(field).join(',')+(i?',':'')+'"cards":[';
 const suffix=']'+keys.slice(i+1).map(k=>','+field(k)).join('')+'}';
 const running=crypto.createHash('sha256').update(prefix);
 for(let n=0;n<=current.cards.length;n++){
  if(running.copy().update(suffix).digest('hex')===expectedSha){
   const base={...current,cards:current.cards.slice(0,n)};
   if(digest(base)!==expectedSha)throw Error('D072 catalog prefix: canonical hash disagreement');
   return {catalog:base,addedCardIds:ids.slice(n)};
  }
  if(n<current.cards.length)running.update((n?',':'')+canonical(current.cards[n]));
 }
 return null;
}
module.exports={findObservedCatalog};
