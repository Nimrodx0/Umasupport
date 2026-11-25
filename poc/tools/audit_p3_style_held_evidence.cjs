'use strict';
// Review only. Keep D052 labels unchanged. Join existing evidence, not new rates.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {DOMAINS,check}=require('../src/skill_full_condition_path_audit.cjs');
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const bump=(o,k)=>o[k]=(o[k]||0)+1;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function compatible(terms,ctx){return terms.every(p=>!Object.hasOwn(DOMAINS,p.type)||check(ctx[p.type],p.operator,p.value));}
// P2.55 specifically observed phase 3 full/first-half windows, fixed
// adequate ability, single runner. Never substitute max-speed lastspurt.
function spurtWindow(record,result){
 if(result.holdTypes.length!==1||result.holdTypes[0]!=='is_lastspurt')return false;
 for(const c of result.cells.filter(c=>c.eligible.length>1))for(const style of c.eligible){
  const ctx={...c.context,running_style:style};
  for(const i of record.invokes){
   const pre=(i.preConditions?.length?i.preConditions:[[]]).filter(r=>compatible(r,ctx));
   if(!pre.length)continue;
   for(const row of i.conditions.filter(r=>compatible(r,ctx))){
    if(pre.some(r=>r.some(p=>p.type==='is_lastspurt')))return false;
    const spurt=row.filter(p=>p.type==='is_lastspurt');
    if(!spurt.length)continue;
    if(!spurt.every(p=>p.operator==='=='&&p.value===1))return false;
    if(!row.some(p=>['phase_random','phase_firsthalf_random'].includes(p.type)&&p.operator==='=='&&p.value===3))return false;
   }
  }
 }
 return true;
}
function audit(raw,labels,window,dynamic){
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),SOURCE_SHA);
 a.equal(labels.status,'P3.4j-D052-initial-scoped-skill-labels');
 a.deepEqual(labels.counts,{general:257,targeted:43,undetermined:581});
 a.equal(window.status,'P3.4h-paired-rank-window-margins-and-source-branch-consistency-only');
 a.equal(dynamic.status,'P3.4i-scope-local-dynamic-top-group-screen-not-general-label');
 const source=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 const w=new Map(window.rows.map(r=>[r.appSkillId,r])),d=new Map(dynamic.rows.map(r=>[r.sourceNumericId,r]));
 a.equal(w.size,81);a.equal(d.size,98);a(window.rows.every(x=>!d.has(x.sourceNumericId)));
 const summary={},groupExamples={},signatures={},blockers={},oldGeneralHeld=[],newNeutral=[],modelStates={},spurtExamples=[];
 let n=0;
 for(const row of labels.rows){
  const record=source.get(row.sourceNumericId),r=evaluate(record,'running_style');
  if(row.label.state==='general'&&r.state==='held')oldGeneralHeld.push({name:record.name,types:r.holdTypes});
  if(row.label.state==='undetermined'&&r.state==='full-neutral-candidate')newNeutral.push(record.name);
  if(row.label.state!=='undetermined'||r.state!=='held')continue;
  n++;const win=w.get(row.appSkillId),dyn=d.get(row.sourceNumericId);
  let category,modelState=null;
  if(win){a.equal(win.sourceNumericId,row.sourceNumericId);const s=win.sweeps.find(s=>s.margin===10);a(s);modelState=s.WAndD.state;category='existing-window-evidence';}
  else if(dyn){const s=dyn.sweeps.find(s=>s.margin===10);a(s);modelState=s.state;category='existing-dynamic-evidence';}
  else if(spurtWindow(record,r))category='spurt-window-conditional-neutral-review';
  else if(r.holdTypes.length===1&&r.holdTypes[0]==='is_lastspurt')category='spurt-other-window-held';
  else if(r.holdTypes.some(t=>t==='order'||t==='order_rate'))category='rank-without-matching-approved-study';
  else if(!r.holdTypes.length)category='different-source-paths';
  else category='other-condition-dependency';
  bump(summary,category);if(modelState)bump(modelStates,category+'|'+modelState);
  const key=r.holdTypes.join('+')||'different-paths';bump(signatures,key);
  for(const t of r.holdTypes)bump(blockers,t);
  const example={name:record.name,types:r.holdTypes,modelState};
  (groupExamples[category]??=[]);if(groupExamples[category].length<8)groupExamples[category].push(example);
  if(category==='spurt-window-conditional-neutral-review')spurtExamples.push(record.name);
 }
 a.equal(n,228);a.equal(oldGeneralHeld.length,7);a.equal(newNeutral.length,13);a.equal(Object.values(summary).reduce((x,y)=>x+y,0),228);
 return {held:n,summary,modelStates,oldGeneralHeld,newNeutral,spurtExamples,groupExamples,signatures:Object.entries(signatures).sort((a,b)=>b[1]-a[1]).slice(0,30),formalLabelsChanged:0};
}
if(require.main===module){const [raw,l,w,d]=process.argv.slice(2);console.log('D055_HELD_TRIAGE='+JSON.stringify(audit(fs.readFileSync(raw),read(l),read(w),read(d))));}
module.exports={spurtWindow,audit};
