'use strict';
// A conservative source-logic comparison, not a rate or a product label.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const g6=require('./p2_g6_research_handoff_881.cjs'),g4=require('./p2_g4_occurrence_disposition.cjs');
const full=require('./skill_full_condition_path_audit.cjs'),axis=require('./skill_p2_15_parameterized_axis_gates.cjs');
const STATUS='P3.4e-context-specific-source-logic-equivalence-candidate-only';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const AXES=['running_style','distance_type','ground_type','ground_condition'];
const ALL_CONTEXTS=[1,2,3,4].flatMap(d=>[1,2].flatMap(g=>[1,2,3,4].map(c=>({distance_type:d,ground_type:g,ground_condition:c}))));
function signature(invokes,ctx,allowed){
 a(Array.isArray(invokes)&&invokes.length>0);
 const active=[];
 invokes.forEach((inv,io)=>{
  a(Array.isArray(inv.conditions)&&inv.conditions.length>0);
  a(Array.isArray(inv.preConditions??[])&&(inv.preConditions??[]).length===0,'history must be held');
  const or=[];
  inv.conditions.forEach((terms,oi)=>{
   a(Array.isArray(terms)&&terms.length>0);
   const residual=[];let eligible=true;
   terms.forEach((p,ai)=>{
    a(typeof p.type==='string'&&Number.isSafeInteger(p.value)&&['==','!=','<','<=','>','>='].includes(p.operator));
    if(AXES.includes(p.type)){
     a(Object.hasOwn(ctx,p.type));if(!full.check(ctx[p.type],p.operator,p.value))eligible=false;
    }else if(p.type==='always'&&p.operator==='=='&&p.value===1){
     // Only exact known always is interpreted as TRUE, never a scope exclusion.
    }else{
     a(allowed.has(p.type)&&p.type!=='always','not a reviewed source-logic candidate: '+p.type);
     // Identity matters: distinct OR/Invoke/window occurrences need not share a draw.
     residual.push({andIndex:ai,type:p.type,operator:p.operator,value:p.value});
    }
   });
   if(eligible)or.push({orIndex:oi,residual});
  });
  if(or.length)active.push({invokeOffset:io,invokeIndex:inv.index??io,or});
 });
 return active;
}
function compare(invokes,ctx,allowed){
 const sig=[1,2,3,4].map(style=>signature(invokes,{...ctx,running_style:style},allowed));
 const eligibleStyles=sig.flatMap((x,i)=>x.length?[i+1]:[]);
 if(!eligibleStyles.length)return {disposition:'no-statically-eligible-style',eligibleStyles};
 if(eligibleStyles.length===1)return {disposition:'one-statically-eligible-style',eligibleStyles};
 const same=eligibleStyles.every(s=>JSON.stringify(sig[s-1])===JSON.stringify(sig[eligibleStyles[0]-1]));
 const residualTerms=sig.some(x=>x.some(i=>i.or.some(o=>o.residual.length)));
 return {disposition:!same?'different-surviving-source-paths-held':
  eligibleStyles.length===4?'four-style-identical-surviving-logic':'restricted-style-identical-surviving-logic',
  eligibleStyles,residualTerms};
}
function audit(raw,supplement,receipt,scope){
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),g6.SOURCE_SHA);
 a.equal(supplement.status,'P2.58-D051-interim-research-receipt-no-formal-label');
 a.equal(receipt.status,'P3-G6-D051-interim-research-received-not-approved-labels');
 a.equal(receipt.sourceSHA256,digest(supplement));a.deepEqual(receipt.totals,supplement.totals);
 a.equal(scope.decisionId,'D-051');a.equal(supplement.source.scopeSHA256,digest(scope));
 a.equal(scope.geometry.length,22);a.equal(scope.cost.length,12);
 const allowed=new Set([...scope.geometry,...scope.cost,...g4.EXCLUDED_CONTEXT_RESEARCH]);
 const recs=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
 const src=new Map(recs.map(r=>[r.id,r]));a.equal(src.size,recs.length);
 const recv=new Map(receipt.rows.map(r=>[r.appSkillId,r]));a.equal(recv.size,881);a.equal(receipt.rows.length,881);a.equal(supplement.rows.length,881);
 const result=[],counts={},contextCounts={};let cross=0,candidate=0,notCandidate=0,missing=0,allFourSomewhere=0;
 for(const s of supplement.rows){
  const r=recv.get(s.appSkillId);a(r);a.equal(r.sourceNumericId,s.sourceNumericId);a.equal(r.formalLabel,null);
  a.equal(r.scopeCandidate,s.sourceLogicCandidateForFurtherReview??null);
  if(s.sourceNumericId===null){missing++;result.push({appSkillId:s.appSkillId,sourceNumericId:null,disposition:'source-missing',formalLabel:null});continue;}
  if(!r.scopeCandidate){notCandidate++;result.push({appSkillId:s.appSkillId,sourceNumericId:s.sourceNumericId,disposition:'outside-324-logic-candidate-cohort',formalLabel:null});continue;}
  candidate++;a.equal(s.historyPresent,false);
  const source=src.get(s.sourceNumericId);a(source);
  const cells=ALL_CONTEXTS.map(ctx=>{
   const c=compare(source.invokes,ctx,allowed);
   const staticStyles=[1,2,3,4].filter(style=>{
    const i=axis.PANEL.findIndex(p=>p.running_style===style&&p.distance_type===ctx.distance_type&&p.ground_type===ctx.ground_type);
    a(i>=0);return !!(s.sourceNecessaryMasks[i]&(1<<(ctx.ground_condition-1)));
   });
   a.deepEqual(c.eligibleStyles,staticStyles);
   contextCounts[c.disposition]=(contextCounts[c.disposition]||0)+1;
   return {...ctx,...c};
  });
  const four=cells.some(c=>c.eligibleStyles.length===4);
  a.equal(four,s.commonFourStyleNecessaryContext);if(four)allFourSomewhere++;
  if(four&&s.explicitStyleRestrictionPresent)cross++;
  const differing=cells.some(c=>c.disposition==='different-surviving-source-paths-held');
  const allFourEquivalent=cells.some(c=>c.disposition==='four-style-identical-surviving-logic');
  const restrictedEquivalent=cells.some(c=>c.disposition==='restricted-style-identical-surviving-logic');
  const disposition=differing?'hold-at-least-one-comparable-context':
   allFourEquivalent?'four-style-identical-logic-candidate':
   restrictedEquivalent?'restricted-multi-style-logic-candidate':
   'no-comparable-style-pair';
  counts[disposition]=(counts[disposition]||0)+1;
  result.push({appSkillId:s.appSkillId,sourceNumericId:s.sourceNumericId,disposition,
   explicitStyleRestrictionPresent:s.explicitStyleRestrictionPresent,
   commonFourStyleNecessaryContext:four,cells,formalLabel:null,cardScore:null});
 }
 a.equal(candidate,324);a.equal(notCandidate,494);a.equal(missing,63);
 a.equal(allFourSomewhere,257);
 a.equal(Object.values(contextCounts).reduce((a,b)=>a+b,0),324*32);
 return {status:STATUS,sourceSupplementSHA256:digest(supplement),
  totals:{candidate,notCandidate,missing,allFourSomewhere,explicitRestrictionAndCommonFourOverlap:cross,counts,contextCounts},
  rows:result,boundary:{formalLabels:0,cardScores:0,sourceTermsRemoved:0,noScopePredicateAssumedTrue:true,
   equalSourcePathNotGameNeutrality:true,G4ReapprovalPending:true}};
}
if(require.main===module)try{
 const args=process.argv.slice(2);a.equal(args.length,5);
 const r=audit(fs.readFileSync(args[0]),...args.slice(1,4).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(args[4],JSON.stringify(r,null,2)+'\n');console.log('P3_4E_SOURCE_LOGIC='+JSON.stringify(r.totals));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={signature,compare,audit};
