'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const STATUS='P3.4g-source-logic-label-preview-not-approved';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function preview(row){
 if(!row.cells)return {state:'undetermined',targetedStyles:[],reason:row.disposition,applicableContexts:null};
 const cells=row.cells.filter(c=>c.eligibleStyles.length);
 if(cells.length&&cells.every(c=>c.disposition==='four-style-identical-surviving-logic'))
  return {state:'general',targetedStyles:[],reason:'same-original-residual-logic-under-D049-D051-scope',applicableContexts:cells.map(({distance_type,ground_type,ground_condition})=>({distance_type,ground_type,ground_condition}))};
 return {state:'undetermined',targetedStyles:[],reason:row.disposition,applicableContexts:null};
}
function audit(logic,cards,wd){
 a.equal(logic.status,'P3.4e-context-specific-source-logic-equivalence-candidate-only');
 a.equal(cards.status,'P3.3b-all-fixed-card-direct-candidates-with-research-only-evidence');
 a.equal(cards.logicSHA256,digest(logic));
 a.equal(wd.status,'P3.4a-uncertainty-interpreted-source-research-only-no-scoring-policy');
 a.equal(logic.rows.length,881);a.equal(wd.rows.length,881);a.equal(cards.cards.length,566);
 const wm=new Map(wd.rows.map(r=>[r.appSkillId,r]));a.equal(wm.size,881);
 const counts={},overlap={},rows=logic.rows.map(r=>{
  const p=preview(r),w=wm.get(r.appSkillId);a(w);a.equal(w.sourceNumericId,r.sourceNumericId);a.equal(r.formalLabel,null);
  counts[p.state]=(counts[p.state]||0)+1;
  const k=p.state+'|'+w.modelPartialWD.status;overlap[k]=(overlap[k]||0)+1;
  return {appSkillId:r.appSkillId,sourceNumericId:r.sourceNumericId,preview:p,
   partialWDStatus:w.modelPartialWD.status,formalLabel:null};
 });
 const sm=new Map(rows.map(r=>[r.appSkillId,r]));a.equal(sm.size,881);
 const totals={pairs:0,previewGeneralPairs:0,previewUndeterminedPairs:0,cardsWithGeneralCandidate:0,stageHintPairs:0,stageHintGeneralPairs:0};
 const cardRows=cards.cards.map(c=>{
  const skills=c.skills.map(s=>{
   const p=sm.get(s.appSkillId);a(p);a.equal(p.sourceNumericId,s.sourceNumericId);a.equal(s.formalLabel,null);
   totals.pairs++;if(p.preview.state==='general')totals.previewGeneralPairs++;else totals.previewUndeterminedPairs++;
   return {appSkillId:s.appSkillId,previewState:p.preview.state,directCandidates:s.directCandidates,formalLabel:null};
  });
  if(skills.some(s=>s.previewState==='general'))totals.cardsWithGeneralCandidate++;
  const stages=[0,1,2,3,4].map(stage=>{
   const hints=skills.filter(s=>s.directCandidates.some(r=>r.source==='normal-hint'&&r.stages.includes(stage)));
   const general=hints.filter(s=>s.previewState==='general').length;
   totals.stageHintPairs+=hints.length;totals.stageHintGeneralPairs+=general;
   return {stage,normalHintSkills:hints.length,generalCandidateHints:general,undeterminedHints:hints.length-general};
  });
  return {cardId:c.cardId,skills,stages,formalCardScore:null};
 });
 a.deepEqual(counts,{general:257,undetermined:624});
 a.equal(totals.pairs,5434);a.equal(totals.previewGeneralPairs,1622);a.equal(totals.cardsWithGeneralCandidate,507);
 return {status:STATUS,counts,overlap,totals,rows,cards:cardRows,
  boundary:{proposalOnly:true,formalLabels:0,formalScores:0,modelTargetLabelsNotAdopted:true,absoluteOpportunityNotRequired:true,unknownNotZero:true}};
}
if(require.main===module)try{
 const args=process.argv.slice(2);a.equal(args.length,4);
 const r=audit(...args.slice(0,3).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(args[3],JSON.stringify(r,null,2)+'\n');
 console.log('P3_4G_PREVIEW='+JSON.stringify({counts:r.counts,overlap:r.overlap,totals:r.totals}));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={preview,audit};
