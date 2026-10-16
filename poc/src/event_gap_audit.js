/* Read-only audit: compare EVENT RECORD PRESENCE by normalized card and event name.
 * Never emit or redistribute copyrighted event text. Names remain internal to process.
 * All name-based IDs, even unique ones, are PROVISIONAL until verified against game IDs.
 */
(function(g){
'use strict';
const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
const split=s=>{const m=/^\[([^\]]+)\](.+)$/.exec(norm(s));return m?{title:m[1],character:m[2]}:{title:norm(s),character:''};};
const simple=s=>norm(s).toLowerCase().replace(/[\s!"'’“”‘「」『』（）()！？!?,.，．・:：\-‐〜～♯#♪☆★∞&＆]/g,'');
function edit(a,b){
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next;}
 return prev[b.length];
}
function eventNames(events){
 const names=[];
 for(const obj of events||[]){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))continue;
  for(const key of Object.keys(obj)){const n=norm(key);if(n)names.push(n);}
 }
 return new Set(names);
}
function compare({modelCards,checkerCards,cruiseCards}){
 if(!Array.isArray(modelCards)||!Array.isArray(checkerCards)||!Array.isArray(cruiseCards))throw Error('Invalid source inventory');
 const eligible=modelCards.filter(x=>x.rarity==='SSR'||x.rarity==='SR');
 const unmatched=[],assigned=new Map();
 const index=entries=>{
  const byStrict=new Map();
  for(const e of entries){
   if(!['SSR','SR'].includes(e.rarity)||typeof e.name!=='string'||!Array.isArray(e.events))continue;
   const key=e.rarity+'|'+norm(e.name);
   const bucket=byStrict.get(key)||[];bucket.push(e);byStrict.set(key,bucket);
  }
  return byStrict;
 };
 function join(entries){
  const idx=index(entries),used=new Set(),resolved=new Map(),aliasCandidates=[],ambiguous=[];
  for(const card of eligible){
   const matches=idx.get(card.rarity+'|'+norm(card.name))||[];
   if(matches.length===1){resolved.set(card.id,{entry:matches[0],review:'strict-name'});used.add(matches[0]);}
   else if(matches.length>1)ambiguous.push({cardId:card.id,reason:'duplicate-name'});
  }
  // Only consider one-to-one same character + <=1 edit in support title.
  const proposed=new Map();
  for(const card of eligible){
   if(resolved.has(card.id)||ambiguous.some(x=>x.cardId===card.id))continue;
   const wanted=split(card.name);
   const candidates=entries.filter(e=>e.rarity===card.rarity&&!used.has(e)).filter(e=>{
    const src=split(e.name);return wanted.character&&src.character===wanted.character&&edit(simple(src.title),simple(wanted.title))<=1;
   });
   if(candidates.length===1)proposed.set(card.id,candidates[0]);
   else ambiguous.push({cardId:card.id,reason:candidates.length===0?'no-name-candidate':'multiple-name-candidates'});
  }
  const proposalsByEntry=new Map();
  for(const [id,e] of proposed){const ids=proposalsByEntry.get(e)||[];ids.push(id);proposalsByEntry.set(e,ids);}
  for(const [id,e] of proposed){
   if(proposalsByEntry.get(e).length!==1){ambiguous.push({cardId:id,reason:'many-to-one'});continue;}
   resolved.set(id,{entry:e,review:'provisional-alias'});
   aliasCandidates.push(id);
  }
  return {resolved,aliasCandidates,ambiguous};
 }
 const checker=join(checkerCards),cruise=join(cruiseCards);
 const rows=[],summary={bothCards:0,checkerCards:checker.resolved.size,cruiseCards:cruise.resolved.size,
  checkerOnlyEventRecords:0,cruiseOnlyEventRecords:0,matchedTitleRecords:0,
  cardsWithAnyCruiseOnlyEvent:0,cardsWithAnyCheckerOnlyEvent:0,emptyInChecker:0};
 for(const card of eligible){
  const c=checker.resolved.get(card.id),u=cruise.resolved.get(card.id);
  const ca=eventNames(c?.entry.events),ua=eventNames(u?.entry.events);
  if(c&&u)summary.bothCards++;
  if(c&&ca.size===0)summary.emptyInChecker++;
  // Retain punctuation to avoid claiming that two different titles are identical.
  const onlyChecker=[...ca].filter(s=>!ua.has(s)).length;
  const onlyCruise=[...ua].filter(s=>!ca.has(s)).length;
  const matched=[...ca].filter(s=>ua.has(s)).length;
  if(c&&u){
   summary.checkerOnlyEventRecords+=onlyChecker;
   summary.cruiseOnlyEventRecords+=onlyCruise;
   summary.matchedTitleRecords+=matched;
   if(onlyChecker)summary.cardsWithAnyCheckerOnlyEvent++;
   if(onlyCruise)summary.cardsWithAnyCruiseOnlyEvent++;
  }
  rows.push({cardId:card.id,rarity:card.rarity,checkerEvents:ca.size,cruiseEvents:ua.size,
   checkerOnly: c&&u?onlyChecker:null,cruiseOnly:c&&u?onlyCruise:null,
   matched:c&&u?matched:null,checkerJoin:c?.review||null,cruiseJoin:u?.review||null});
 }
 return {totalSSR_SR:eligible.length,summary,
   aliasCandidateCounts:{checker:checker.aliasCandidates.length,cruise:cruise.aliasCandidates.length},
   unresolvedCardIds:{checker:checker.ambiguous,cruise:cruise.ambiguous},
   // Never claim a source discrepancy proves an actual in-game missing event.
   possibleGaps:rows.filter(r=>r.cruiseOnly>0).sort((a,b)=>b.cruiseOnly-a.cruiseOnly).slice(0,30),
   zeroEventCardIds:rows.filter(r=>r.checkerJoin&&r.checkerEvents===0).map(r=>r.cardId),
   warning:'Name-based joins are provisional; title-only differences may be spelling variants, and agreement between GameWith-derived sources does not establish game-wide completeness.'};
}
const api={compare};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaEventGapAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this);
