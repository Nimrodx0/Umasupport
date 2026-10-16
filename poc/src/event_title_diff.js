/* Pure, non-mutating cross-source coverage comparator.
 * No third-party event descriptions or option text are stored in the output.
 * Name matches are candidates, NOT verified game IDs.
 */
(function(root){
'use strict';
const norm=v=>String(v).normalize('NFKC').replace(/\s+/g,' ').trim();
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const eventNames=events=>{
 if(!Array.isArray(events))return null;
 const out=new Set();
 for(const event of events){
   if(!obj(event)||Object.keys(event).length!==1)return null;
   out.add(norm(Object.keys(event)[0]));
 }
 return out;
};
function compare(model,checker,cruise){
 if(!Array.isArray(model?.cards)||!obj(checker?.Skills)||!obj(cruise?.Support))throw Error('Invalid comparison input');
 const index=new Map();
 for(const c of model.cards.filter(c=>c.rarity==='SSR'||c.rarity==='SR')){
   const key=c.rarity+'|'+norm(c.name);
   const cards=index.get(key)||[];cards.push(c);index.set(key,cards);
 }
 const collect=(groups,getEvents)=>{
   const out=new Map(),unknown=[];
   for(const rarity of ['SSR','SR']){
     if(!obj(groups[rarity]))throw Error('Missing '+rarity);
     for(const [name,value] of Object.entries(groups[rarity])){
       const ids=index.get(rarity+'|'+norm(name))||[];
       const names=getEvents(value);
       if(ids.length!==1||names===null){unknown.push({rarity,reason:ids.length===1?'invalid-events':'unmatched-or-ambiguous-name'});continue}
       if(out.has(ids[0].id)){unknown.push({rarity,reason:'duplicate-card'});out.delete(ids[0].id);continue}
       out.set(ids[0].id,names);
     }
   }
   return {out,unknown};
 };
 const left=collect(checker.Skills,v=>eventNames(v?.Events));
 const right=collect(cruise.Support,v=>eventNames(v?.Event));
 const perCard=[];
 let commonTitles=0,checkerOnlyTitles=0,cruiseOnlyTitles=0,checkerEvents=0,cruiseEvents=0;
 for(const [id,names] of left.out){
   const other=right.out.get(id);if(!other)continue;
   const common=[...names].filter(n=>other.has(n)).length, onlyChecker=names.size-common;
   const onlyCruise=other.size-common;
   commonTitles+=common;checkerOnlyTitles+=onlyChecker;cruiseOnlyTitles+=onlyCruise;
   checkerEvents+=names.size;cruiseEvents+=other.size;
   perCard.push({cardId:id,commonTitles:common,checkerOnlyTitles:onlyChecker,cruiseOnlyTitles:onlyCruise,
     checkerTitles:names.size,cruiseTitles:other.size});
 }
 perCard.sort((a,b)=>b.cruiseOnlyTitles-a.cruiseOnlyTitles||a.cardId.localeCompare(b.cardId));
 return {
   comparedCards:perCard.length,
   checkerEvents,cruiseEvents,commonTitles,checkerOnlyTitles,cruiseOnlyTitles,
   cardsWithCruiseOnly:perCard.filter(x=>x.cruiseOnlyTitles>0).length,
   cardsWithCheckerOnly:perCard.filter(x=>x.checkerOnlyTitles>0).length,
   cardsSameTitleSets:perCard.filter(x=>!x.cruiseOnlyTitles&&!x.checkerOnlyTitles).length,
   titleMismatchExamples:perCard.filter(x=>x.cruiseOnlyTitles>0).slice(0,20),
   unmatchedCheckerNames:left.unknown.length,unmatchedCruiseNames:right.unknown.length,
   note:'Normalized-title differences are review candidates only; names, event relationships and source completeness are not proven.'
 };
}
const api={compare};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.UmaEventTitleDiff=api;
})(typeof globalThis!=='undefined'?globalThis:this);
