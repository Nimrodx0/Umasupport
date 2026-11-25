'use strict';
// D-052 initial labels. Scope is a first-class field; no card scores.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const STATUS='P3.4j-D052-initial-scoped-skill-labels';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const {resolve}=require('./skill_suitability.js');
function unique(rows,key){const m=new Map();for(const r of rows){a(!m.has(r[key]));m.set(r[key],r);}return m;}
function approvedStyles(xs){a(Array.isArray(xs)&&xs.length>=1&&xs.length<4&&new Set(xs).size===xs.length&&xs.every(x=>[1,2,3,4].includes(x)));return [...xs].sort((x,y)=>x-y);}
function audit(receipt,preview,window,dynamic,policy){
 a.equal(receipt.status,'P3-G6-D052-research-accepted');a.equal(receipt.policySHA256,digest(policy));a.equal(policy.decisionId,'D-052');a.equal(policy.marginPoints,10);
 a.equal(preview.status,'P3.4g-source-logic-label-preview-not-approved');
 a.equal(window.status,'P3.4h-paired-rank-window-margins-and-source-branch-consistency-only');
 a.equal(dynamic.status,'P3.4i-scope-local-dynamic-top-group-screen-not-general-label');
 a.equal(receipt.rows.length,881);a.equal(preview.rows.length,881);a.equal(window.rows.length,81);a.equal(dynamic.rows.length,98);
 const g=unique(preview.rows,'appSkillId'),w=unique(window.rows,'appSkillId'),d=unique(dynamic.rows,'sourceNumericId');
 const sourceIds=new Set(window.rows.map(x=>x.sourceNumericId));a.equal(sourceIds.size,81);a(dynamic.rows.every(x=>!sourceIds.has(x.sourceNumericId)));
 const seenW=new Set(),seenD=new Set(),counts={general:0,targeted:0,undetermined:0},groups={window:0,dynamic:0};
 const rows=receipt.rows.map(r=>{
  const p=g.get(r.appSkillId),q=w.get(r.appSkillId),v=d.get(r.sourceNumericId);a(p);a.equal(p.sourceNumericId,r.sourceNumericId);
  if(q){a.equal(q.sourceNumericId,r.sourceNumericId);seenW.add(r.appSkillId);}
  if(v)seenD.add(r.sourceNumericId);
  let label={state:'undetermined',styles:[],reason:r.sourceNumericId===null?'source-missing':'no-approved-bias-evidence'};
  const wr=q?.sweeps.find(x=>x.margin===policy.marginPoints),dr=v?.sweeps.find(x=>x.margin===policy.marginPoints);
  if(q)a(wr);if(v)a(dr);
  if(p.preview.state==='general'){
   a(!q&&!v&&r.sourceNumericId!==null);a(p.preview.applicableContexts.length>0);
   label={state:'general',styles:[],reason:'same-residual-source-logic-under-approved-research-scope',scope:{kind:'source-logic',contexts:p.preview.applicableContexts}};
  }else if(wr?.WAndD.state==='targeted-window-candidate'){
   a.deepEqual(wr.WAndD,wr.WOnly);a(q.branches.every(b=>b.pairs!==null&&b.courseIds.length));
   label={state:'targeted',styles:approvedStyles(wr.WAndD.styles.map(s=>STYLES.indexOf(s)+1)),reason:'fixed-window-W-gap-and-D-support',
    scope:{kind:'rank-window-fixed-model',branches:q.branches.map(({distanceType,courseIds,windowKey,bandId})=>({distanceType,courseIds,windowKey,bandId})),ground_type:1,ground_condition:1,fieldSizes:[9,12],scenarios:['balanced'],modelAbilityModes:['equal','jitter10']}};
   groups.window++;
  }else if(dr?.state==='targeted-in-eligible-fixed-contexts'){
   a(dr.evaluatedContexts.length>0);
   label={state:'targeted',styles:approvedStyles(dr.styles),reason:'fixed-model-unknown-bound-gap',scope:{kind:'dynamic-fixed-model',contexts:dr.evaluatedContexts,ground_type:1,ground_condition:1,modelAbilityModes:['equal']}};
   groups.dynamic++;
  }
  counts[label.state]++;
  return {appSkillId:r.appSkillId,sourceNumericId:r.sourceNumericId,explicitNecessaryMasks:r.sourceNecessaryMasks,label,cardScore:null};
 });
 a.equal(seenW.size,81);a.equal(seenD.size,98);a.equal(new Set(rows.map(x=>x.appSkillId)).size,881);
 a.deepEqual(counts,{general:policy.generalCount,targeted:policy.windowTargetedCount+policy.dynamicTargetedCount,undetermined:881-policy.generalCount-policy.windowTargetedCount-policy.dynamicTargetedCount});
 a.deepEqual(groups,{window:policy.windowTargetedCount,dynamic:policy.dynamicTargetedCount});
 const skills=unique(rows,'appSkillId');a.equal(preview.cards.length,566);
 const cardSummary={cards:0,pairs:0,general:0,targeted:0,undetermined:0,cardsWithAnyTargeted:0};
 const cards=preview.cards.map(c=>{
  const skillsForCard=c.skills.map(s=>{const q=skills.get(s.appSkillId);a(q);cardSummary.pairs++;cardSummary[q.label.state]++;return {appSkillId:s.appSkillId,label:q.label,explicitNecessaryMasks:q.explicitNecessaryMasks,directCandidates:s.directCandidates};});
  cardSummary.cards++;if(skillsForCard.some(s=>s.label.state==='targeted'))cardSummary.cardsWithAnyTargeted++;
  return {cardId:c.cardId,skills:skillsForCard,cardScore:null};
 });
 a.equal(cardSummary.cards,566);a.equal(cardSummary.pairs,5434);a.equal(cardSummary.general,1622);
 return {status:STATUS,decisionId:policy.decisionId,policySHA256:digest(policy),counts,groups,cardSummary,rows,cards,
  boundary:{initialApprovedSkillLabels:true,modelScopesRequired:true,gameRates:false,cardScores:0,publicDeployment:false}};
}
if(require.main===module)try{const x=process.argv.slice(2);a.equal(x.length,6);const v=audit(...x.slice(0,5).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));fs.writeFileSync(x[5],JSON.stringify(v,null,2)+'\n');console.log('P3_4J_APPROVED='+JSON.stringify({counts:v.counts,groups:v.groups,cardSummary:v.cardSummary}));}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={audit,resolve,approvedStyles};
