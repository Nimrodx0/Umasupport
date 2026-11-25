'use strict';
// Review only: separate failure to meet the old admission rule from evidence of bias.
// This does not change D-052, assign new labels or reproduce the game.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const scope=require('../data/p2_approved_research_scope_d051.v1.json');
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const AXES=['running_style','distance_type','ground_type','ground_condition'];
const approved=new Set([...scope.geometry,...scope.cost,'motivation','track_id','weather','base_speed','base_stamina','base_power','base_guts','base_wiz']);
const bump=(obj,k)=>obj[k]=(obj[k]||0)+1;
function inspect(record){
 if(!record)return {category:'source-missing',terms:[],history:[],explicit:[],outsideReviewed:[]};
 if(!Array.isArray(record.invokes)||!record.invokes.length)return {category:'no-invoke',terms:[],history:[],explicit:[],outsideReviewed:[]};
 const normal=new Set(),history=new Set();
 for(const i of record.invokes){
  for(const [side,set] of [['conditions',normal],['preConditions',history]])for(const group of i[side]||[])for(const p of group){a(typeof p.type==='string');set.add(p.type);}
 }
 const terms=[...new Set([...normal,...history])].sort(),explicit=terms.filter(t=>AXES.includes(t)),outsideReviewed=terms.filter(t=>!AXES.includes(t)&&!approved.has(t));
 const category=outsideReviewed.length?'unreviewed-or-dynamic-condition':history.size?'reviewed-types-with-preconditions':explicit.includes('running_style')?'reviewed-types-with-explicit-style':'reviewed-types-no-explicit-style';
 return {category,terms,history:[...history].sort(),explicit,outsideReviewed};
}
function audit(raw,labels,preview){
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),SOURCE_SHA);
 a.equal(labels.status,'P3.4j-D052-initial-scoped-skill-labels');a.deepEqual(labels.counts,{general:257,targeted:43,undetermined:581});
 a.equal(preview.status,'P3.4g-source-logic-label-preview-not-approved');a.equal(labels.rows.length,881);a.equal(preview.rows.length,881);
 const records=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
 const src=new Map(records.map(r=>[r.id,r]));a.equal(src.size,records.length);
 const old=new Map(preview.rows.map(r=>[r.appSkillId,r]));a.equal(old.size,881);
 const counts={},oldReasons={},unreviewedTypes={},examples=[],signatures={},axisExplicit={running_style:0,distance_type:0,ground_type:0,ground_condition:0};
 let matched=0,unknown=0;
 for(const row of labels.rows){
  const p=old.get(row.appSkillId);a(p);a.equal(p.sourceNumericId,row.sourceNumericId);
  const record=src.get(row.sourceNumericId),v=inspect(record);
  if(row.sourceNumericId!==null){a(record);matched++;}
  if(row.label.state==='undetermined'){
   unknown++;bump(counts,v.category);bump(oldReasons,p.preview.reason);
   for(const t of v.outsideReviewed)bump(unreviewedTypes,t);
   for(const t of v.explicit)axisExplicit[t]++;
   const key=v.terms.join(' + ')||v.category;bump(signatures,key);
  }
  if(record&&/^アオハル(?:点火|燃焼)/.test(record.name))examples.push({name:record.name,oldLabel:row.label.state,oldReason:p.preview.reason,...v});
 }
 a.equal(matched,818);a.equal(unknown,581);a.equal(Object.values(counts).reduce((x,y)=>x+y,0),581);
 return {fixedSkills:881,matched,unknown,counts,oldReasons,axisExplicit,unreviewedTypes,topSignatures:Object.entries(signatures).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,40),examples,formalLabelsChanged:0};
}
if(require.main===module){const [raw,labels,preview]=process.argv.slice(2);const r=audit(fs.readFileSync(raw),JSON.parse(fs.readFileSync(labels)),JSON.parse(fs.readFileSync(preview)));console.log('PRACTICAL_REVIEW='+JSON.stringify(r));}
module.exports={inspect,audit};
