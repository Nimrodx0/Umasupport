/* View-only skill filtering and group-aware sorting.
 * Counts and coverage are supplied by core; never derive direct providers from lowerId. */
(function(g){
'use strict';
const norm=x=>String(x??'').normalize('NFKC').toLocaleLowerCase().trim();
const validTiers=new Set(['all','gold','white','unknown']);
const validRoutes=new Set(['all','hint','event','both']);
const validCoverage=new Set(['all','direct','indirect','uncovered','conditional']);
const validSorts=new Set(['name','total-desc','main-desc','inherit-desc','goals-first']);
const count=(r,k)=>Number(r[k]?.count||0);
function hasRoute(row,source){
 return ['main','inherit'].some(k=>Object.values(row[k]?.providers||{}).some(p=>
  (p.routes||[]).some(route=>route.source===source)));
}
function goalUncovered(r,core,data){
 if(!r.goal)return false;
 const m=r.mainCover?.kind!=='missing'&&!!r.mainCover, i=r.inheritCover?.kind!=='missing'&&!!r.inheritCover;
 switch(r.goal.scope){case 'main':return !m;case 'inherit':return !i;case 'both':return !(m&&i);default:return !(m||i);}
}
function matches(r,options,core,data){
 const o=options||{},query=norm(o.query);
 if(query&&!norm(r.skill.name).includes(query)&&!norm(r.skill.id).includes(query))return false;
 if(o.onlyGoals&&!r.goal)return false;
 if(o.onlyDuplicate&&!((count(r,'main')>1)||(count(r,'inherit')>1)||
   (count(r,'main')>0&&count(r,'inherit')>0)))return false;
 const tier=o.tier||'all',route=o.route||'all',coverage=o.coverage||'all';
 if(!validTiers.has(tier)||!validRoutes.has(route)||!validCoverage.has(coverage))return false;
 const actualTier=['gold','white'].includes(r.skill.tier)?r.skill.tier:'unknown';
 if(tier!=='all'&&tier!==actualTier)return false;
 const hint=hasRoute(r,'hint'),event=hasRoute(r,'event');
 if(route==='hint'&&!hint||route==='event'&&!event||route==='both'&&!(hint&&event))return false;
 const direct=count(r,'main')>0||count(r,'inherit')>0;
 const indirect=r.mainCover?.kind==='indirect'||r.inheritCover?.kind==='indirect';
 const conditional=['main','inherit'].some(k=>Object.values(r[k]?.providers||{}).some(p=>
   (p.routes||[]).some(rt=>rt.conditional)));
 if(coverage==='direct'&&!direct||coverage==='indirect'&&!(indirect&&!direct)||
    coverage==='uncovered'&&!goalUncovered(r,core,data)||
    coverage==='conditional'&&!conditional)return false;
 return true;
}
function compare(a,b,sort){
 const countTotal=r=>count(r,'main')+count(r,'inherit');
 let delta=0;
 if(sort==='total-desc')delta=countTotal(b)-countTotal(a);
 else if(sort==='main-desc')delta=count(b,'main')-count(a,'main');
 else if(sort==='inherit-desc')delta=count(b,'inherit')-count(a,'inherit');
 else if(sort==='goals-first')delta=Number(!!b.goal)-Number(!!a.goal);
 return delta||a.skill.name.localeCompare(b.skill.name,'ja')||a.skill.id.localeCompare(b.skill.id);
}
function build(rows,core,data,options={}){
 if(!Array.isArray(rows)||!core||typeof core.hierarchyRows!=='function')throw Error('Invalid skill view inputs');
 const sort=options.sort||'name';
 if(!validSorts.has(sort))throw Error('Unsupported skill sort mode');
 const subset=rows.filter(r=>matches(r,options,core,data));
 const flat=core.hierarchyRows(subset,data),groups=[];
 for(const row of flat){
  if(!groups.length||row.hierarchyDepth===0)groups.push([row]);
  else groups[groups.length-1].push(row);
 }
 // Keep gold and all visible descendants adjacent when ranking by provider counts.
 // The rank uses the ROOT skill's own direct count, not sums of descendants.
 groups.sort((a,b)=>compare(a[0],b[0],sort));
 return groups.flat();
}
const api={matches,build,hasRoute,goalUncovered};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillTable=api;
})(typeof globalThis!=='undefined'?globalThis:this);
