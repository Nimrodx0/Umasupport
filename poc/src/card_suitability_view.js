/* P3.5/P4 view adapter: no weights, no probability, no changes to core. */
(function(g){
'use strict';
const core=typeof module!=='undefined'&&module.exports?require('./core.js'):g.UmaCore;
const fit=typeof module!=='undefined'&&module.exports?require('./skill_suitability.js'):g.UmaSkillSuitability;
const search=typeof module!=='undefined'&&module.exports?require('./card_search.js'):g.UmaCardSearch;
const catalog=typeof module!=='undefined'&&module.exports?require('./skill_catalog.js'):g.UmaSkillCatalog;
const uniq=xs=>[...new Set(xs)];
const index=rows=>{const m=new Map();for(const r of rows){if(m.has(r.appSkillId))throw Error('Duplicate skill ID');m.set(r.appSkillId,r);}return m;};
function trustedRow(id,data,labels){
 const r=labels.get(id),sk=data.skillById[id];
 if(!r||!sk||r.sourceNumericId===null||sk.activationProfile?.status!=='source-structure'||sk.activationProfile.sourceNumericId!==r.sourceNumericId)return null;
 return r;
}
function summarize(ids,data,labels,context){
 const rows=uniq(ids).map(id=>({appSkillId:id,...fit.present(trustedRow(id,data,labels),context,false)}));
 const counts={total:rows.length,general:0,targeted:0,undetermined:0,explicitOutside:0,scopeUnknown:0};
 for(const r of rows){counts[r.labelState]++;if(r.applicability==='outside')counts.explicitOutside++;if(r.applicability==='unknown')counts.scopeUnknown++;}
 return {rows,counts};
}
function cardView(card,config,data,labels,context){
 const stage=config?.stage??4;
 if(![0,1,2,3,4].includes(stage))throw Error('Invalid limit break');
 const verified=card.sourceStatus?.startsWith('verified_hints');
 const hints=verified?(card.hintsByStage?.[String(stage)]??[]):[];
 const events=search.approvedEventSkillIds(card,data);
 const available=uniq([...hints,...events]);
 // Core is authoritative for current selections and chain dependencies.
 // Its event routes may still be conditional on event occurrence/outcome.
 const direct=core.directRoutes(card,{...config,stage}).filter(r=>r.source==='hint'?verified&&hints.includes(r.skillId):events.has(r.skillId));
 const selected=uniq(direct.map(r=>r.skillId));
 const current=summarize(selected,data,labels,context),potential=summarize(available,data,labels,context);
 const absent=available.filter(id=>!selected.includes(id));
 return {cardId:card.id,stage,current,potential,unselectedOrUnreachableCandidates:absent,
  currentRoutes:direct,cardScore:null,eventCatalog:search.eventCatalogState(card,data)};
}
function deckView(deck,data,labels,context){
 const by=core.aggregate(deck,data),direct=summarize(Object.keys(by),data,labels,context);
 const indirect=summarize((data.skills||[]).filter(s=>!by[s.id]&&core.coverage(s.id,by,data).kind==='indirect').map(s=>s.id),data,labels,context);
 return {direct,indirect,providerCounts:Object.fromEntries(Object.entries(by).map(([id,r])=>[id,r.count])),cardScore:null};
}
function matchesCard(card,config,data,labels,options={}){
 if((options.mode??'all')==='all')return true;
 const v=cardView(card,config,data,labels,options.context);
 // A card with no recorded candidates may still have unrecorded events.
 if(!v.potential.rows.length)return ['possible','undetermined'].includes(options.mode);
 return v.potential.rows.some(r=>fit.matches(trustedRow(r.appSkillId,data,labels),options));
}
// Browse suitability without requiring a hypothetical opponent roster.
// Counts are mutually exclusive direct skill IDs, never scores. The source
// mask is independent of label admission, so single-style restrictions work
// even with no local bundle. Other targeted styles are not positive matches.
function browseSummary(ids,data,labels,context){
 const style=context?.running_style;
 if(![1,2,3,4].includes(style))throw Error('Select a running style');
 const counts={total:0,explicitOnly:0,general:0,targeted:0,otherTargeted:0,undetermined:0,outside:0,scopeUnknown:0,scopePending:0};
 const rows=[],matchingByTier={gold:0,white:0,other:0};
 for(const id of uniq(ids)){
  const sk=data.skillById[id];if(!sk)continue;
  const r={explicitNecessaryMasks:catalog.masks(sk.activationProfile),label:trustedRow(id,data,labels)?.label??null};
  const {applicability:app,evidence:e,permittedStyles:permitted,category:aptitudeCategory,scopePending,matching}=catalog.assessment(r,context);
  const category=scopePending?'scopePending':aptitudeCategory;
  counts[category]++;counts.total++;
  if(matching)matchingByTier[['gold','white'].includes(sk.tier)?sk.tier:'other']++;
  rows.push({appSkillId:id,category,aptitudeCategory,scopePending,matching,applicability:app,evidence:e,permittedStyles:permitted});
 }
 return {counts,rows,matchingByTier,matching:counts.explicitOnly+counts.general+counts.targeted};
}
function candidateList(card,config,data,labels,context={}){
 const stage=config?.stage??4;
 if(![0,1,2,3,4].includes(stage))throw Error('Invalid limit break');
 const hints=new Set(card.sourceStatus?.startsWith('verified_hints')?(card.hintsByStage?.[String(stage)]??card.hints??[]):[]);
 const events=search.approvedEventSkillIds(card,data);
 const current=core.directRoutes(card,{...config,stage}).filter(r=>r.source==='hint'?hints.has(r.skillId):events.has(r.skillId));
 return uniq([...hints,...events]).filter(id=>data.skillById[id]).map(id=>{
  const skill=data.skillById[id],row={skill,explicitNecessaryMasks:catalog.masks(skill.activationProfile),label:trustedRow(id,data,labels)?.label??null};
  return {...row,scopeSummary:catalog.scopeSummary(row.explicitNecessaryMasks),...catalog.assessment(row,context),hint:hints.has(id),event:events.has(id),current:current.filter(r=>r.skillId===id)};
 });
}
function browseCard(card,config,data,labels,context){
 const stage=config?.stage??4;
 if(![0,1,2,3,4].includes(stage))throw Error('Invalid limit break');
 const hints=card.sourceStatus?.startsWith('verified_hints')?(card.hintsByStage?.[String(stage)]??card.hints??[]):[];
 const events=search.approvedEventSkillIds(card,data);
 const current=core.directRoutes(card,{...config,stage}).filter(r=>r.source==='hint'?hints.includes(r.skillId):events.has(r.skillId));
 return {cardId:card.id,stage,potential:browseSummary([...hints,...events],data,labels,context),current:browseSummary(current.map(r=>r.skillId),data,labels,context),eventCatalog:search.eventCatalogState(card,data),cardScore:null};
}
const api={index,trustedRow,summarize,cardView,deckView,matchesCard,browseSummary,browseCard,candidateList};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaCardSuitabilityView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
