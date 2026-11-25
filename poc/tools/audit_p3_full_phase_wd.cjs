'use strict';
// Exact same full-phase 720-race W/O baseline with paired seed halves.
// Apply existing D052 W/D selection rule; no new threshold or formal label.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {pairEnvelopes,choose}=require('../src/p3_rank_window_margin_screen.cjs');
const {COURSES,STYLES}=require('./globalsim_position_expanded.cjs');
const {PIN}=require('./globalsim_position_pilot.cjs');
const {BANDS}=require('./globalsim_rank_band_dominance.cjs');
const {andProjection}=require('../src/skill_order_rate_bounds.cjs');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {classify}=require('./audit_p3_style_rank_paths.cjs');
const {measuredCourses}=require('./audit_p3_practical_label_candidates.cjs');
const FULL_SHA='f512e24b2987ccd642f17f21f92865e965a43b90985ef37d622f1ae2f2ec9e58',SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),key=x=>[x.courseId,x.fieldSize,x.mode,x.phase,x.bandId,x.style].join('|');
function index(full,split){
 a.equal(full.status,'research-GlobalSim-10m-rank-opportunity-not-game-activation');a.equal(split.status,'p2-fixed-15-plus-15-full-phase-bands-not-game-activation');
 for(const p of [full,split]){a.equal(p.sourceRevision,PIN);a.equal(p.scenario,'balanced');}
 a.equal(full.simulations,720);a.equal(full.seedsPerCell,30);a.equal(split.baseRaces,720);a.equal(split.seedsPerHalf,15);
 a.equal(full.contextRows.length,4224);a.equal(split.contextRows.length,8448);
 const all=new Map(),halves=new Map();
 for(const [rows,map,isHalf] of [[full.contextRows,all,false],[split.contextRows,halves,true]])for(const x of rows){
  a(COURSES.some(c=>c.id===x.courseId)&&[9,12].includes(x.fieldSize)&&['equal','jitter10'].includes(x.mode)&&[0,1,2,3].includes(x.phase)&&BANDS.some(b=>b.id===x.bandId)&&STYLES.includes(x.style));
  a(Number.isSafeInteger(x.runners)&&x.runners>0);
  a(Number.isFinite(x.pointPercent)&&Number.isFinite(x.random10mOpportunityPercent)&&x.pointPercent>=0&&x.random10mOpportunityPercent<=100&&x.pointPercent<=x.random10mOpportunityPercent+1e-6);
  if(isHalf)a(['first15','last15'].includes(x.half));
  const k=key(x)+(isHalf?'|'+x.half:'');a(!map.has(k));map.set(k,x);
 }
 for(const [k,x] of all){
  const h=halves.get(k+'|first15'),j=halves.get(k+'|last15');a(h&&j);a.equal(x.runners,h.runners+j.runners);
  for(const f of ['pointPercent','random10mOpportunityPercent'])a(Math.abs(x[f]-(h[f]*h.runners+j[f]*j.runners)/x.runners)<=1e-5,'half recomposition');
 }
 return {all,halves};
}
function observationPairs(idx,phase,bandId,courseIds){
 const band=BANDS.find(b=>b.id===bandId);a(band);a(courseIds.length&&new Set(courseIds).size===courseIds.length);
 const styleRows=Object.fromEntries(STYLES.map(style=>[style,courseIds.flatMap(courseId=>[9,12].flatMap(fieldSize=>['equal','jitter10'].map(mode=>{
  const k=key({courseId,fieldSize,mode,phase,bandId,style}),x=idx.all.get(k),h=idx.halves.get(k+'|first15'),j=idx.halves.get(k+'|last15');a(x&&h&&j);
  const U=100*andProjection(band.predicates,fieldSize).positions.length/fieldSize;
  const metric=v=>({W:v.random10mOpportunityPercent,D:v.pointPercent-U});
  return {courseId,fieldSize,mode,all:metric(x),first15:metric(h),last15:metric(j)};
 })))]));
 return pairEnvelopes(styleRows);
}
function audit(raw,fullBytes,split,batch){
 a.equal(sha(raw),SOURCE_SHA);a.equal(sha(fullBytes),FULL_SHA);a.equal(batch.status,'D055-D056-batch-candidate-review-not-approved');
 const idx=index(JSON.parse(fullBytes),split);
 const src=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 const rows=[],summary={},margins=[0,5,10,20];
 for(const row of batch.rows.filter(x=>x.state==='phase-direction-candidate')){
  const p=row.proposal,record=src.get(row.sourceNumericId),r=evaluate(record,'running_style'),c=classify(record,r);
  a.equal(c.group,'existing-phase-rank-point-evidence-review');a.deepEqual(p.courseIds,measuredCourses(r));a.equal(p.band,c.items[0].bands[0]);a.equal(p.phase,Number(c.items[0].window.split(':')[1]));
  const pairs=observationPairs(idx,p.phase,p.band,p.courseIds);
  const sweeps=margins.map(margin=>({margin,WOnly:choose(pairs,margin,false),WAndD:choose(pairs,margin,true)}));
  const v=sweeps.find(x=>x.margin===10),state=v.WAndD.state;
  if(state==='targeted-window-candidate')a.deepEqual(v.WAndD,v.WOnly);
  summary[state]=(summary[state]||0)+1;
  rows.push({name:record.name,appSkillId:row.appSkillId,sourceNumericId:row.sourceNumericId,phase:p.phase,band:p.band,courseIds:p.courseIds,pointDirection:p.styles,pairs,sweeps,state,styles:v.WAndD.styles.map(s=>STYLES.indexOf(s)+1)});
 }
 a.equal(rows.length,29);a.equal(Object.values(summary).reduce((x,y)=>x+y,0),29);
 return {status:'P3-full-phase-WD-existing-rule-candidates',fullReportSHA256:FULL_SHA,seedSplitRows:8448,summary,rows,formalLabelsChanged:0};
}
if(require.main===module){const [raw,full,split,batch,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const r=audit(fs.readFileSync(raw),fs.readFileSync(full),read(split),read(batch));fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log('P3_FULL_PHASE_WD='+JSON.stringify({summary:r.summary,rows:r.rows.map(({name,state,styles,pointDirection})=>({name,state,styles,pointDirection}))}));}
module.exports={index,observationPairs,audit};
