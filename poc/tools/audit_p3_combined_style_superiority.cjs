'use strict';
// D058/D059: reclassify existing evidence, preserving D052/D056 inputs.
// No live bundle change until exact digest and browser acceptance.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {classify,windowCells,fullPhaseCells,dynamicCells,STYLES,MARGIN}=require('../src/p3_combined_style_superiority.cjs');
const {index}=require('./audit_p3_full_phase_wd.cjs');
const {pairEnvelopes}=require('../src/p3_rank_window_margin_screen.cjs');
const {audit:validateDynamic}=require('../src/p3_dynamic_scope_screen.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const FULL_SHA='f512e24b2987ccd642f17f21f92865e965a43b90985ef37d622f1ae2f2ec9e58';
function agreement(parts,margin){
 const rs=parts.map(c=>classify(c,margin));
 if(!rs.every(r=>JSON.stringify(r.styles)===JSON.stringify(rs[0].styles)))return {state:'branch-results-differ-held',styles:[],branches:rs};
 return {...rs[0],branches:rs};
}
function audit(preview,wd,fullBytes,split,short,direct,exception,dynamic){
 a.equal(preview.status,'next-style-label-release-preview-not-approved');
 a.deepEqual(preview.counts,{general:298,targeted:67,undetermined:516});
 a.equal(wd.status,'P3-full-phase-WD-existing-rule-candidates');a.equal(wd.rows.length,29);
 a.equal(sha(fullBytes),FULL_SHA);const idx=index(JSON.parse(fullBytes),split);
 a.equal(short.status,'P3.4h-paired-rank-window-margins-and-source-branch-consistency-only');a.equal(short.rows.length,81);
 a.equal(direct.items.length,75);a.equal(exception.rows.length,12);
 const oldDynamic=validateDynamic(dynamic);
 const ds=new Map(direct.items.map(x=>[x.skillId,x])),es=new Map(exception.rows.map(x=>[x.skillId,x]));
 const bySource=new Map();for(const r of dynamic.rows){if(!bySource.has(r.sourceNumericId))bySource.set(r.sourceNumericId,[]);bySource.get(r.sourceNumericId).push(r);}
 const rows=[],record=(row,kind,parts,scope)=>{
  const sweeps=[5,10,15,20].map(margin=>({margin,...agreement(parts,margin)}));
  rows.push({appSkillId:row.appSkillId,sourceNumericId:row.sourceNumericId,kind,scope,sweeps});
 };
 for(const r of wd.rows)record(r,'full-phase',[fullPhaseCells(idx,r.phase,r.band,r.courseIds)],{kind:'rank-window-fixed-model',branches:[{distanceType:null,courseIds:r.courseIds,windowKey:'phase_random:'+r.phase,bandId:r.band}],ground_type:1,ground_condition:1,fieldSizes:[9,12],scenarios:['balanced'],modelAbilityModes:['equal','jitter10']});
 for(const r of short.rows){
  if(r.branches.some(b=>b.pairs===null))continue;
  let bs;
  if(ds.has(r.appSkillId)&&r.branches.length===1){const x=ds.get(r.appSkillId);a.equal(x.sourceNumericId,r.sourceNumericId);bs=[Object.fromEntries(STYLES.map(s=>[s,x.styles[s].detail]))];}
  else{const x=es.get(r.appSkillId);a(x);a.equal(x.sourceNumericId,r.sourceNumericId);bs=x.branchAnalyses.map(b=>b.observationContextsByStyle);}
  a.equal(bs.length,r.branches.length);
  for(let i=0;i<bs.length;i++)a.deepEqual(pairEnvelopes(bs[i]),r.branches[i].pairs);
  record(r,'short-window',bs.map(windowCells),{kind:'rank-window-fixed-model',branches:r.branches.map(({distanceType,courseIds,windowKey,bandId})=>({distanceType,courseIds,windowKey,bandId})),ground_type:1,ground_condition:1,fieldSizes:[9,12],scenarios:['balanced'],modelAbilityModes:['equal','jitter10']});
 }
 const app=new Map(preview.rows.filter(r=>r.sourceNumericId!==null).map(r=>[r.sourceNumericId,r]));
 for(const r of oldDynamic.rows){
  const q=dynamicCells(bySource.get(r.sourceNumericId));if(!q)continue;
  const v=app.get(r.sourceNumericId);a(v);
  record(v,'dynamic',[q.cells],{kind:'dynamic-fixed-model',contexts:q.contexts,ground_type:1,ground_condition:1,modelAbilityModes:['equal']});
 }
 const m=new Map(rows.map(r=>[r.appSkillId,r]));a.equal(m.size,rows.length);a.equal(rows.length,29+51+42);
 const sensitivity={};for(const margin of [5,10,15,20]){const counts={};for(const r of rows){const s=r.sweeps.find(x=>x.margin===margin);if(s.state==='targeted')counts[r.kind]=(counts[r.kind]||0)+1;}sensitivity[margin]=counts;}
 a.deepEqual(sensitivity[10],{'full-phase':29,'short-window':49,dynamic:14});
 const changed=[],counts={general:0,targeted:0,undetermined:0};
 const next=preview.rows.map(r=>{
  const p=m.get(r.appSkillId);if(r.label.state==='general'){a(!p);counts.general++;return r;}
  const s=p?.sweeps.find(x=>x.margin===MARGIN);
  if(r.label.state==='targeted'){a(s&&s.state==='targeted');a(r.label.styles.every(x=>s.styles.includes(x)));}
  if(s?.state!=='targeted'){counts[r.label.state]++;return r;}
  const label={state:'targeted',styles:s.styles,reason:'D-058-D-059-combined-relative-superiority',scope:p.scope};
  if(r.label.state!=='targeted'||JSON.stringify(r.label.styles)!==JSON.stringify(label.styles))changed.push({appSkillId:r.appSkillId,sourceNumericId:r.sourceNumericId,kind:p.kind,old:r.label.styles,new:label.styles,individual:s.individual,group:s.group});
  counts.targeted++;return {...r,label};
 });
 a.deepEqual(counts,{general:298,targeted:92,undetermined:491});
 const byApp=new Map(next.map(r=>[r.appSkillId,r])),cardSummary={cards:0,pairs:0,general:0,targeted:0,undetermined:0,cardsWithAnyTargeted:0};
 const cards=preview.cards.map(c=>{cardSummary.cards++;const skills=c.skills.map(s=>{const label=byApp.get(s.appSkillId).label;cardSummary.pairs++;cardSummary[label.state]++;return {...s,label};});if(skills.some(s=>s.label.state==='targeted'))cardSummary.cardsWithAnyTargeted++;return {...c,skills};});
 a.equal(cardSummary.cards,566);a.equal(cardSummary.pairs,5434);
 return {status:'D058-D059-combined-label-verification',counts,cardSummary,rows:next,cards,sensitivity,changed,comparisonRows:rows,publicDeployment:false};
}
if(require.main===module){const [p,w,f,s,h,d,e,j,out]=process.argv.slice(2),read=x=>JSON.parse(fs.readFileSync(x,'utf8'));const r=audit(read(p),read(w),fs.readFileSync(f),read(s),read(h),read(d),read(e),read(j));fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log('D059_COMBINED='+JSON.stringify({counts:r.counts,cardSummary:r.cardSummary,sensitivity:r.sensitivity,changed:r.changed,publicDeployment:false}));}
module.exports={audit,agreement};
