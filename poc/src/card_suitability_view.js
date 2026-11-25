/* P3.5/P4 view adapter: no weights, no probability, no changes to core. */
(function(g){
'use strict';
const core=typeof module!=='undefined'&&module.exports?require('./core.js'):g.UmaCore;
const fit=typeof module!=='undefined'&&module.exports?require('./skill_suitability.js'):g.UmaSkillSuitability;
const search=typeof module!=='undefined'&&module.exports?require('./card_search.js'):g.UmaCardSearch;
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
const api={index,trustedRow,summarize,cardView,deckView,matchesCard};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaCardSuitabilityView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
