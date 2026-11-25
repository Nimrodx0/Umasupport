'use strict';
// D-051 interim research receipt. Never turn excluded research into TRUE.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const g4=require('./p2_g4_occurrence_disposition.cjs'),g6=require('./p2_g6_research_handoff_881.cjs');
const p49=require('./p2_scope_handoff_supplement.cjs');
const p52=require('./p2_omission_candidate_review.cjs'),p53=require('./p2_remaining_route_review.cjs');
const p54=require('./p2_limited_study_screen.cjs'),axis=require('./skill_p2_15_parameterized_axis_gates.cjs');
const STATUS='P2.58-D051-interim-research-receipt-no-formal-label';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const key=o=>JSON.stringify([o.invokeOffset,o.sourceSide,o.orIndex,o.andIndex,o.type]);
function index(rows){const out=new Map();for(const r of rows){a(!out.has(r.appSkillId));out.set(r.appSkillId,r);}return out;}
function allFourInSameContext(masks,panel=axis.PANEL){
 a.equal(masks.length,panel.length);
 const groups=new Map();
 for(let i=0;i<panel.length;i++){
  const c=panel[i],k=c.distance_type+'|'+c.ground_type;
  if(!groups.has(k))groups.set(k,new Map());
  const g=groups.get(k);a(!g.has(c.running_style));g.set(c.running_style,masks[i]);
 }
 return [...groups.values()].some(g=>g.size===4&&[...g.values()].reduce((a,b)=>a&b,15)!==0);
}
function scopeFor(o,scope){
 if(g4.EXCLUDED_CONTEXT_RESEARCH.includes(o.type))return 'D-049-excluded-context-research';
 if(scope.geometry.includes(o.type))return 'D-051-standalone-geometry-research-excluded';
 if(scope.cost.includes(o.type))return 'D-051-dedicated-context-research-excluded';
 if(['running_style','distance_type','ground_type','ground_condition'].includes(o.type))return 'static-necessary-only';
 if(['order','order_rate'].includes(o.type))return 'existing-rank-research-only';
 return 'pending-G4-review';
}
function audit(raw,ledger,handoff,old,oldReceipt,proposal,scope,prior,omission,routes,decisions,screen){
 a.equal(ledger.status,g4.STATUS);a.equal(handoff.status,g6.STATUS);a.equal(old.status,p49.STATUS);
 a.equal(oldReceipt.status,'P3-G6-scope-supplement-accepted-research-only');
 a.equal(oldReceipt.sourceSupplementSHA256,digest(old));
 a.equal(ledger.source.handoffSHA256,digest(handoff));
 a.equal(old.source.ledgerSHA256,digest(ledger));a.equal(old.source.handoffSHA256,digest(handoff));
 a.deepEqual(p52.audit(raw,ledger,proposal,prior),omission);
 a.deepEqual(p53.audit(raw,ledger,proposal,omission,handoff,scope),routes);
 a.deepEqual(p54.audit(raw,routes,handoff,scope,decisions),screen);
 const hi=index(handoff.rows),oi=index(old.rows),ri=index(oldReceipt.sourceIndex),mi=index(omission.rows);
 const typeRows=new Map();
 for(const row of routes.rows){
  const k=row.appSkillId+'|'+row.type;a(!typeRows.has(k));typeRows.set(k,row);
 }
 const decisionsByType=new Map(decisions.rows.map(r=>[r.type,r]));
 a.equal(decisionsByType.size,42);
 const totals={matched:0,missing:0,occurrences:0,scopeCounts:{},oldLogicCandidates:0,newLogicCandidates:0,intersection:0,unionCandidates:0,candidateWithFourCommonContext:0,candidateWithExplicitStyleRestriction:0,candidateWithHistory:0};
 const rows=[];
 for(const l of ledger.rows){
  const h=hi.get(l.appSkillId),o=oi.get(l.appSkillId),r=ri.get(l.appSkillId);a(h&&o&&r);
  a.equal(l.sourceNumericId,h.originalNumericSourceId);a.equal(l.sourceNumericId,o.sourceNumericId);a.equal(l.sourceNumericId,r.sourceNumericId);
  a.equal(r.cardScore,null);a.equal(r.suitabilityLabel,null);
  if(l.occurrences===null){
   totals.missing++;a.equal(l.sourceNumericId,null);
   rows.push({appSkillId:l.appSkillId,sourceNumericId:null,occurrences:null,formalLabel:null,cardScore:null});
   continue;
  }
  totals.matched++;
  const m=mi.get(l.appSkillId);
  const oldCandidate=o.logicCandidate!=='hold-other-source-logic';
  a(['style-independent-always-only-candidate','style-independent-conditional-context-candidate','hold-other-source-logic'].includes(o.logicCandidate));
  const newCandidate=m?.status?.endsWith('logic-candidate')??false;
  const candidate=oldCandidate||newCandidate;
  if(oldCandidate)totals.oldLogicCandidates++;
  if(newCandidate)totals.newLogicCandidates++;
  if(oldCandidate&&newCandidate)totals.intersection++;
  if(candidate)totals.unionCandidates++;
  const masks=h.explicitThreeAxisNecessaryOnly.potentialGroundStateMasks;
  const common=allFourInSameContext(masks);
  const styleRestriction=l.occurrences.some(p=>p.type==='running_style');
  const history=l.occurrences.some(p=>p.sourceSide==='preConditions');
  if(candidate&&common)totals.candidateWithFourCommonContext++;
  if(candidate&&styleRestriction)totals.candidateWithExplicitStyleRestriction++;
  if(candidate&&history)totals.candidateWithHistory++;
  const oldKeys=new Set(Object.values(o.predicateGroups).flat().map(key));
  a.equal(oldKeys.size,l.occurrences.length);
  const occurrences=l.occurrences.map(p=>{
   a(oldKeys.has(key(p)));a.equal(p.actualOmissionApplied,false);
   const bucket=scopeFor(p,scope);
   totals.occurrences++;totals.scopeCounts[bucket]=(totals.scopeCounts[bucket]||0)+1;
   let remainingReview=null;
   if(bucket==='pending-G4-review'){
    const t=typeRows.get(l.appSkillId+'|'+p.type),d=decisionsByType.get(p.type);a(t&&d);
    const ref=t.occurrences.find(x=>x.invokeOffset===p.invokeOffset&&x.sourceSide===p.sourceSide&&x.orIndex===p.orIndex&&x.andIndex===p.andIndex);a(ref);
    remainingReview={group:d.group,comparableNecessaryRoute:ref.comparableNecessaryRoute,proposalOnly:true};
   }
   return {invokeOffset:p.invokeOffset,invokeIndex:p.invokeIndex,sourceSide:p.sourceSide,orIndex:p.orIndex,andIndex:p.andIndex,type:p.type,
    originalEvidenceDisposition:p.disposition,researchScope:bucket,remainingReview,
    sourcePredicateRetained:true,assumeTrue:false,wholeANDVerified:false};
  });
  rows.push({appSkillId:l.appSkillId,sourceNumericId:l.sourceNumericId,occurrences,
   oldLogicCandidate:o.logicCandidate,newLogicCandidate:m?.status??null,
   sourceLogicCandidateForFurtherReview:candidate,
   commonFourStyleNecessaryContext:common,explicitStyleRestrictionPresent:styleRestriction,historyPresent:history,
   sourceNecessaryMasks:masks,partialWDDisposition:l.partialWDDisposition,
   formalLabel:null,cardScore:null,eligibleForCardScoring:false});
 }
 a.equal(rows.length,881);a.equal(totals.matched,818);a.equal(totals.missing,63);a.equal(totals.occurrences,2421);
 a.deepEqual(totals.scopeCounts,{'static-necessary-only':821,
  'D-049-excluded-context-research':97,
  'D-051-standalone-geometry-research-excluded':814,
  'D-051-dedicated-context-research-excluded':49,
  'existing-rank-research-only':306,'pending-G4-review':334});
 a.equal(totals.oldLogicCandidates,61);a.equal(totals.newLogicCandidates,270);
 a.equal(totals.unionCandidates,61+270-totals.intersection);
 return {status:STATUS,source:{registrySHA256:g6.SOURCE_SHA,decisions:['D-049','D-051'],ledgerSHA256:digest(ledger),scopeSHA256:digest(scope),omissionSHA256:digest(omission),remainingRoutesSHA256:digest(routes),limitedScreenSHA256:digest(screen)},
 totals,rows,boundary:{noSourceTermRemoved:true,unknownNotTrue:true,scopeDoesNotProveNeutrality:true,G4ReapprovalPending:true,G6ParentPassNotGranted:true,formalLabels:0,cardScores:0}};
}
function accept(result,...inputs){
 const recomputed=audit(...inputs);a.deepEqual(result,recomputed);
 return {status:'P3-G6-D051-interim-research-received-not-approved-labels',sourceSHA256:digest(recomputed),totals:recomputed.totals,
  rows:recomputed.rows.map(r=>({appSkillId:r.appSkillId,sourceNumericId:r.sourceNumericId,scopeCandidate:r.sourceLogicCandidateForFurtherReview??null,
   commonFourStyleNecessaryContext:r.commonFourStyleNecessaryContext??null,
   formalLabel:null,cardScore:null,eligibleForCardScoring:false})),G6ParentPassNotGranted:true};
}
if(require.main===module)try{
 const args=process.argv.slice(2);a.equal(args.length,14);
 const inputs=[fs.readFileSync(args[0]),...args.slice(1,12).map(p=>JSON.parse(fs.readFileSync(p,'utf8')))];
 const result=audit(...inputs);fs.writeFileSync(args[12],JSON.stringify(result,null,2)+'\n');
 const receipt=accept(JSON.parse(fs.readFileSync(args[12],'utf8')),...inputs);
 fs.writeFileSync(args[13],JSON.stringify(receipt,null,2)+'\n');
 console.log('P2_58_SCOPE_RECEIPT='+JSON.stringify(result.totals));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={audit,accept,allFourInSameContext,scopeFor};
