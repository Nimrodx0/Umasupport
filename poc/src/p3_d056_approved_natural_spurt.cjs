'use strict';
// D-056: add approved standard-build natural-spurt labels, retaining D-052.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {spurtWindow}=require('../tools/audit_p3_style_held_evidence.cjs');
const policy=require('../data/p3_approved_suitability_policy_d056.v1.json');
const cat=require('./skill_catalog.js');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const policySHA256=sha(JSON.stringify(policy));
function addition(record){
 const before=evaluate(record,'running_style');
 if(before.state!=='held'||!spurtWindow(record,before))return null;
 const after=evaluate(record,'running_style',{allowNaturalSpurt:true});
 if(after.state!=='full-neutral-candidate')return null;
 const contexts=after.cells.filter(c=>c.state==='full-neutral-candidate').map(c=>c.context);
 a(contexts.length);a(after.cells.every(c=>c.state==='outside'||c.state==='full-neutral-candidate'));
 return {state:'general',styles:[],reason:'D-056-natural-spurt-adequate-stamina',scope:{kind:'source-logic',contexts,assumption:'adequate-stamina-standard-build'}};
}
function derive(raw,base){
 a.equal(sha(raw),cat.SOURCE_HASH);
 a.equal(base.status,'P3.4j-D052-initial-scoped-skill-labels');a.equal(base.policySHA256,cat.POLICY_HASH);
 a.deepEqual(base.counts,{general:257,targeted:43,undetermined:581});
 a.equal(base.rows.length,881);a.equal(new Set(base.rows.map(r=>r.appSkillId)).size,881);
 a.equal(policy.decisionId,'D-056');
 const src=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 const added=[],counts={general:0,targeted:0,undetermined:0};
 const rows=base.rows.map(r=>{
  const record=src.get(r.sourceNumericId);if(r.sourceNumericId!==null)a(record);
  const label=r.label.state==='undetermined'?addition(record):null;
  if(label){a(Array.isArray(r.explicitNecessaryMasks)&&r.explicitNecessaryMasks.length===32);
   for(const c of label.scope.contexts)for(let style=1;style<=4;style++){
    const i=(style-1)*8+(c.distance_type-1)*2+c.ground_type-1;
    a(r.explicitNecessaryMasks[i]&(1<<(c.ground_condition-1)));
   }
   added.push({appSkillId:r.appSkillId,sourceNumericId:r.sourceNumericId,name:record.name});
  }
  const out=label?{...r,label}:r;counts[out.label.state]++;return out;
 });
 a.equal(added.length,policy.naturalSpurt.expectedAddedGeneral);
 a.deepEqual(counts,{general:281,targeted:43,undetermined:557});
 const changed=new Set(added.map(r=>r.appSkillId));
 for(let i=0;i<rows.length;i++)if(!changed.has(rows[i].appSkillId))a.deepEqual(rows[i],base.rows[i]);
 const byId=new Map(rows.map(r=>[r.appSkillId,r])),cardSummary={cards:0,pairs:0,general:0,targeted:0,undetermined:0,cardsWithAnyTargeted:0};
 const cards=base.cards.map(c=>{cardSummary.cards++;const skills=c.skills.map(s=>{const label=byId.get(s.appSkillId).label;cardSummary.pairs++;cardSummary[label.state]++;return {...s,label};});if(skills.some(s=>s.label.state==='targeted'))cardSummary.cardsWithAnyTargeted++;return {...c,skills};});
 a.equal(cardSummary.cards,566);a.equal(cardSummary.pairs,5434);a.equal(cardSummary.targeted,base.cardSummary.targeted);
 const result={...base,status:'D056-approved-natural-spurt-labels',decisionId:'D-056',policySHA256,counts,cardSummary,rows,cards,added};
 const bundle={schemaVersion:1,decisionId:'D-056',sourceRegistrySHA256:cat.SOURCE_HASH,policySHA256,rows:rows.filter(r=>r.label.state!=='undetermined').map(({appSkillId,sourceNumericId,explicitNecessaryMasks,label})=>({appSkillId,sourceNumericId,explicitNecessaryMasks,label}))};
 return {result,bundle};
}
if(require.main===module){const [raw,base,out,bundlePath]=process.argv.slice(2);const {result,bundle}=derive(fs.readFileSync(raw),JSON.parse(fs.readFileSync(base,'utf8')));const bytes=JSON.stringify(bundle)+'\n';fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');fs.writeFileSync(bundlePath,bytes);console.log('D056_APPROVED='+JSON.stringify({counts:result.counts,added:result.added.map(r=>r.name),cardSummary:result.cardSummary,policySHA256,bundleSHA256:sha(bytes),publicDeployment:false}));}
module.exports={addition,derive,policySHA256};
