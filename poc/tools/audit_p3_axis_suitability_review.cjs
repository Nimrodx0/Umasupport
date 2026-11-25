'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {AXES,review}=require('../src/p3_axis_suitability_review.cjs');
const {DOMAINS}=require('../src/skill_full_condition_path_audit.cjs');
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const bump=(o,k)=>o[k]=(o[k]||0)+1;
const [rawPath,labelsPath]=process.argv.slice(2),raw=fs.readFileSync(rawPath),labels=JSON.parse(fs.readFileSync(labelsPath));
a.equal(crypto.createHash('sha256').update(raw).digest('hex'),SOURCE_SHA);
a.equal(labels.status,'P3.4j-D052-initial-scoped-skill-labels');a.deepEqual(labels.counts,{general:257,targeted:43,undetermined:581});
a.equal(labels.rows.length,881);a.equal(new Set(labels.rows.map(r=>r.appSkillId)).size,881);
const records=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')),src=new Map(records.map(r=>[r.id,r]));
a.equal(src.size,records.length);
const stats=Object.fromEntries(AXES.map(k=>[k,{states:{},oldUnknown:{},oldGeneral:{},oldTargeted:{},blockers:{},scopeMaskChecks:0}]));
const examples=[],newStyleExamples=[];let matched=0;
for(const row of labels.rows){
 const record=src.get(row.sourceNumericId);if(row.sourceNumericId!==null){a(record);matched++;}
 const r=review(record);
 for(const k of AXES){
  const result=r[k],s=stats[k];bump(s.states,result.state);
  bump(s[({general:'oldGeneral',targeted:'oldTargeted',undetermined:'oldUnknown'})[row.label.state]],result.state);
  for(const t of result.holdTypes)bump(s.blockers,t);
  // Every context's eligibility must agree with the independently fixed P2 masks.
  if(result.cells.length){
   a(Array.isArray(row.explicitNecessaryMasks)&&row.explicitNecessaryMasks.length===32);
   for(const c of result.cells)for(const v of DOMAINS[k]){
    const x={...c.context,[k]:v},i=(x.running_style-1)*8+(x.distance_type-1)*2+x.ground_type-1;
    a.equal(c.eligible.includes(v),!!(row.explicitNecessaryMasks[i]&(1<<(x.ground_condition-1))),'explicit mask mismatch '+row.appSkillId+' '+k);
    s.scopeMaskChecks++;
   }
  }
 }
 if(record&&/^アオハル(?:点火|燃焼)/.test(record.name))examples.push({name:record.name,old:row.label.state,axes:Object.fromEntries(AXES.map(k=>[k,r[k].state]))});
 if(row.label.state==='undetermined'&&r.running_style.state.includes('neutral-candidate')&&newStyleExamples.length<12)newStyleExamples.push({name:record?.name,state:r.running_style.state});
}
a.equal(matched,818);a.equal(examples.length,10);
for(const e of examples)for(const k of AXES)a.equal(e.axes[k],'full-neutral-candidate');
for(const s of Object.values(stats)){a.equal(Object.values(s.states).reduce((a,b)=>a+b,0),881);a.equal(Object.values(s.oldUnknown).reduce((a,b)=>a+b,0),581);}
console.log('D055_STYLE_REVIEW='+JSON.stringify({fixedSkills:881,matched,stats,examples,newStyleExamples,formalLabelsChanged:0}));
