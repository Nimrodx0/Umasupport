'use strict';
// D055 rank review. Preserve original path identities and exact 9/12 rank
// projection; no new thresholds, no actual trigger rate or product labels.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {DOMAINS,check}=require('../src/skill_full_condition_path_audit.cjs');
const rank=require('../src/skill_order_rate_bounds.cjs');
const {BANDS}=require('./globalsim_rank_band_dominance.cjs');
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const RANK=new Set(['order','order_rate']);
const geometry=require('../data/p2_approved_research_scope_d051.v1.json').geometry;
const STATIC=new Set(Object.keys(DOMAINS));
const TIMING=new Set(geometry.filter(t=>t!=='always'));
const short=new Set(['phase_firsthalf_random:1','phase_laterhalf_random:1','phase_firsthalf_random:2','phase_laterhalf_random:2']);
const bump=(o,k)=>o[k]=(o[k]||0)+1;
function ranks(terms,n){
 const r=terms.filter(p=>RANK.has(p.type));
 if(!r.length)return null;
 const pct=r.filter(p=>p.type==='order_rate');
 const positions=pct.length?rank.andProjection(pct,n).positions:Array.from({length:n},(_,i)=>i+1);
 if(positions===null)return null;
 return positions.filter(i=>r.filter(p=>p.type==='order').every(p=>check(i,p.operator,p.value)));
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function shape(terms){
 const r9=ranks(terms,9),r12=ranks(terms,12);
 const bands=BANDS.filter(b=>r9!==null&&r12!==null&&equal(r9,ranks(b.predicates,9))&&equal(r12,ranks(b.predicates,12))).map(b=>b.id);
 const timing=terms.filter(p=>TIMING.has(p.type));
 const extra=terms.filter(p=>!STATIC.has(p.type)&&!RANK.has(p.type)&&!TIMING.has(p.type)&&!(p.type==='always'&&p.operator==='=='&&p.value===1));
 const window=timing.length===1&&timing[0].operator==='=='?timing[0].type+':'+timing[0].value:null;
 return {r9,r12,bands,window,timing,extraTypes:[...new Set(extra.map(p=>p.type))].sort(),fullRank:r9?.length===9&&r12?.length===12};
}
function eligiblePaths(record,result){
 const keys=new Map();
 for(const c of result.cells.filter(x=>x.eligible.length>1))for(const style of c.eligible){
  const ctx={...c.context,running_style:style};
  const eligible=terms=>terms.every(p=>!STATIC.has(p.type)||check(ctx[p.type],p.operator,p.value));
  for(const [i,inv] of record.invokes.entries()){
   const pre=inv.preConditions?.length?inv.preConditions:[[]];
   for(const [j,row] of inv.conditions.entries())for(const [k,pr] of pre.entries()){
    if(!eligible(row)||!eligible(pr))continue;
    const key=[i,j,k].join('|');
    if(!keys.has(key))keys.set(key,{i,j,k,row,pr});
   }
  }
 }
 return [...keys.values()];
}
function classify(record,result){
 const paths=eligiblePaths(record,result),rankPaths=paths.filter(p=>[...p.row,...p.pr].some(t=>RANK.has(t.type)));
 const items=rankPaths.map(p=>({...shape(p.row),history:p.pr.length>0,rankHistory:p.pr.some(t=>RANK.has(t.type)),invoke:p.i,or:p.j,pre:p.k}));
 let group;
 if(rankPaths.length!==paths.length||items.length!==1||items.some(x=>x.history))group='complex-path-or-history';
 else if(items[0].r9===null||items[0].r12===null)group='rank-boundary-unresolved';
 else if(items[0].extraTypes.length)group='rank-plus-other-condition';
 else if(items[0].fullRank)group='rank-all-positions-in-reference-fields';
 else if(items[0].bands.length&&short.has(items[0].window))group='existing-short-band-window-review';
 else if(items[0].bands.length&&items[0].window?.startsWith('phase_random:'))group='existing-phase-rank-point-evidence-review';
 else group='different-rank-band-or-timing';
 return {group,items};
}
function audit(raw,labels,win,dyn){
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),SOURCE_SHA);
 a.equal(labels.status,'P3.4j-D052-initial-scoped-skill-labels');a.deepEqual(labels.counts,{general:257,targeted:43,undetermined:581});
 a.equal(win.status,'P3.4h-paired-rank-window-margins-and-source-branch-consistency-only');
 a.equal(dyn.status,'P3.4i-scope-local-dynamic-top-group-screen-not-general-label');
 const w=new Set(win.rows.map(r=>r.appSkillId)),d=new Set(dyn.rows.map(r=>r.sourceNumericId));
 const src=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 const groups={},examples={},patterns={},dynamicWithin=[],distinctPaths=[],oldGeneralHeld=[];
 let n=0;
 for(const row of labels.rows){
  const record=src.get(row.sourceNumericId),r=evaluate(record,'running_style');
  if(row.label.state==='general'&&r.state==='held')oldGeneralHeld.push({name:record.name,types:r.holdTypes,review:r.holdTypes.every(t=>t==='post_number')?'conditional-independent-draw-review':'dependency-review'});
  if(row.label.state!=='undetermined'||r.state!=='held')continue;
  if(d.has(row.sourceNumericId)){
   const q=dyn.rows.find(x=>x.sourceNumericId===row.sourceNumericId).sweeps.find(x=>x.margin===10);
   if(q.state==='within-margin-in-eligible-fixed-contexts')dynamicWithin.push({name:record.name,contexts:q.evaluatedContexts,types:r.holdTypes});
  }
  if(!r.holdTypes.length){
   distinctPaths.push({name:record.name,invokes:record.invokes.map(i=>({conditions:i.conditions,preConditions:i.preConditions??[]}))});
   continue;
  }
  if(w.has(row.appSkillId)||d.has(row.sourceNumericId)||!r.holdTypes.some(t=>RANK.has(t)))continue;
  n++;const c=classify(record,r);bump(groups,c.group);
  for(const x of c.items)bump(patterns,JSON.stringify({r9:x.r9,r12:x.r12,window:x.window,bands:x.bands,extra:x.extraTypes,history:x.history}));
  (examples[c.group]??=[]);if(examples[c.group].length<10)examples[c.group].push({name:record.name,items:c.items});
 }
 a.equal(n,79);a.equal(dynamicWithin.length,2);a.equal(distinctPaths.length,4);a.equal(oldGeneralHeld.length,7);
 return {rankSkills:n,groups,patterns:Object.entries(patterns).sort((a,b)=>b[1]-a[1]).slice(0,25),examples,dynamicWithin,distinctPaths,oldGeneralHeld,formalLabelsChanged:0};
}
if(require.main===module){const [raw,l,w,d]=process.argv.slice(2);const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));console.log('D055_RANK_REVIEW='+JSON.stringify(audit(fs.readFileSync(raw),read(l),read(w),read(d))));}
module.exports={ranks,shape,classify,audit};
