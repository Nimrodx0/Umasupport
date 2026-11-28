(function(g){
'use strict';
// Presentation only. Counts and eligible routes always come from UmaCore.
const routes={workspace:'workspace',compare:'workspace',cards:'card-library',skills:'catalog',owned:'owned-manager',settings:'settings'};
function pageFromHash(hash){
 const name=String(hash||'').replace(/^#\/?/,'');
 if(/^events\/(main|inherit)$/.test(name))return {kind:'deck-events',deckKey:name.split('/')[1],route:name};
 return {kind:routes[name]||'workspace',route:routes[name]?name:'workspace'};
}
function matrixCells(row){
 return ['main','inherit'].flatMap(deck=>Array.from({length:6},(_,index)=>{
  const provider=Object.values(row[deck]?.providers||{}).find(p=>p.slotIndex===index);
  const routes=provider?.routes||[];
  return {deck,index,cardId:provider?.cardId||null,
   hint:routes.some(r=>r.source==='hint'),event:routes.some(r=>r.source==='event'),
   conditional:routes.some(r=>r.conditional),conditionalOnly:routes.length>0&&routes.every(r=>r.conditional),
   routes};
 }));
}
const api={pageFromHash,matrixCells};
if(typeof module==='object'&&module.exports)module.exports=api;
else g.UmaWorkspaceUI=api;
})(typeof window!=='undefined'?window:globalThis);
