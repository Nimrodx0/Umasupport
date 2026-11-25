'use strict';
// G4: every original predicate occurrence receives a scoped disposition.
// Evidence for a mechanism is not evidence for an entire source skill.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const spec=require('./skill_condition_spec_omission.cjs');
const triage=require('./skill_condition_research_triage.cjs');
const mechanism=require('./skill_p2_15_mechanism_evidence.cjs');
const g6=require('./p2_g6_research_handoff_881.cjs');
const cross=require('./p2_gate_cohort_cross_audit.cjs');
const STATUS='P2-G4-all-original-occurrence-dispositions-no-automatic-omissions';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const four=new Set(['running_style','distance_type','ground_type','ground_condition']);
const count=(o,k)=>{o[k]=(o[k]||0)+1;};
function decision(type,exactDynamic=[]){
 const s=spec.classify(type), m=mechanism.forType(type), t=triage.typeDecision(type);
 const common={type,axisScope:['style','distance','surface'],mechanismStatus:m.status,
  evidencePaths:m.evidencePaths,mechanismLimit:m.limitation,
  researchGroup:t.group,absoluteOpportunityImpact:'unknown-unless-evaluated-in-exact-context',
  actualOmissionApplied:false,wholeANDVerified:false};
 if(four.has(type))return {...common,disposition:'adopt-static-necessary-gate-only',
  reason:'Original finite predicate; retain in every applicable route.',
  absoluteOpportunityImpact:'explicit-necessary-restriction-not-a-rate',
  reopen:'Source revision or finite-domain counterexample.'};
 if(s.classification==='retain-explicit-eligibility'||t.group==='explicit-eligibility'&&type!=='motivation')
  return {...common,disposition:'retain-original-context-gate',
   reason:'Retain actual source prerequisite; not all context values are represented in the three-axis panel.',
   reopen:'Actual race/runner context required for a concrete eligibility or suitability decision.'};
 if(s.classification==='conditional-axis-omission-candidate')
  return {...common,disposition:'conditional-fixed-state-shortcut-candidate',
   reason:'Same satisfying motivation in every compared case; no unconditional omission.',
   requiredAssumptions:[...spec.SPEC_RULES[type].requiredAssumptions],
   sourceReference:spec.SPEC_RULES[type].sourceReference,
   reopen:'Different state distribution, unsatisfied predicate, or interaction with other AND/preconditions.'};
 if(exactDynamic.length){
  assert(['change_order_onetime','is_overtake','is_lastspurt'].includes(type));
  return {...common,disposition:type==='is_lastspurt'?'hold-spurt-full-conjunction':'reject-approximation-as-game-style-evidence',
   reason:'Exact original route research exists but does not establish whole-condition style W/D.',
   exactRouteDecisions:exactDynamic,
   reopen:'Source-exact same-tick relevant condition conjunction and credible comparison in the intended context.'};
 }
 if(m.status!=='no-specific-mechanism-evidence')
  return {...common,disposition:'conditional-mechanism-reference-only',
   reason:'Existing scoped mechanism evidence may be reused only with exact source values and matching context.',
   reopen:'Show the original route, missing conjunction, and decision that additional evidence could change.'};
 return {...common,disposition:'hold-unverified-impact',
  reason:t.rationale,reopen:'Demonstrate a plausible change to the intended label or opportunity estimate, and a credible source/observation test.'};
}
function audit(occ,handoff,cohort){
 assert.equal(occ.status,'p2-32-game-spec-conditional-omission-triage-only');
 assert.equal(occ.source.skillRegistrySha256,g6.SOURCE_SHA);
 assert.equal(occ.denominators.actualAppliedOmissions,0);
 assert.equal(handoff.status,g6.STATUS);
 assert.equal(cohort.status,cross.STATUS);
 assert.equal(cohort.source.handoffSHA256,digest(handoff));
 const hi=new Map(handoff.rows.map(r=>[r.appSkillId,r]));
 const ci=new Map(cohort.rows.map(r=>[r.appSkillId,r]));
 assert.equal(hi.size,handoff.rows.length);assert.equal(ci.size,hi.size);
 assert.equal(occ.rows.length,hi.size);
 const ids=new Set(),totals={},types={},rows=[];
 let occurrenceCount=0,matched=0,unavailable=0,routeCount=0;
 for(const row of occ.rows){
  assert(!ids.has(row.skillId),'duplicate app ID');ids.add(row.skillId);
  const h=hi.get(row.skillId),c=ci.get(row.skillId);
  assert(h&&c,'missing independent app identity');
  assert.equal(row.sourceNumericId,h.originalNumericSourceId);
  assert.equal(row.sourceNumericId,c.matchedSourceNumericId);
  if(row.sourceNumericId===null){
   unavailable++;assert.equal(row.occurrences.length,0);
   rows.push({appSkillId:row.skillId,sourceNumericId:null,sourceIdentityDisposition:c.sourceIdentityDisposition,
    partialWDDisposition:h.partialModelWD.decision,occurrences:null,wholeSkillSuitability:'undetermined'});continue;
  }
  matched++;
  const routes=h.explicitThreeAxisNecessaryOnly.sourceRoutes;
  assert(Array.isArray(routes)&&routes.length>0,'missing route references');
  routeCount+=routes.length;
  const sourceKeys=new Set(),used=new Set(),local={};
  const dispositions=row.occurrences.map(o=>{
   const key=[o.invokeOffset,o.sourceSide,o.orIndex,o.andIndex].join('|');
   assert(!sourceKeys.has(key),'duplicate original predicate occurrence');sourceKeys.add(key);
   assert.deepEqual({classification:o.classification,evidenceKind:o.evidenceKind,rule:o.rule},spec.classify(o.type));
   const matching=routes.filter(r=>r.invokeOffset===o.invokeOffset&&r.invokeIndex===o.invokeIndex&&
    (o.sourceSide==='conditions'?r.conditionOrIndex===o.orIndex:o.sourceSide==='preConditions'&&r.preconditionOrIndex===o.orIndex));
   assert(matching.length>0,'predicate outside original OR route');
   for(const r of matching)used.add(r);
   const dynamic=h.originalDynamicSourceResearch.filter(d=>d.type===o.type&&
    matching.some(r=>['invokeOffset','invokeIndex','conditionOrIndex','preconditionOrIndex'].every(k=>r[k]===d.originalRouteRef[k]))&&
    d.originalMatchedPredicates.some(p=>p.side===o.sourceSide&&p.andOffset===o.andIndex))
    .map(d=>({routeRef:d.originalRouteRef,disposition:d.evidenceDecision}));
   const d=decision(o.type,dynamic);
   count(totals,d.disposition);count(local,d.disposition);
   if(!types[o.type])types[o.type]={occurrences:0,dispositions:{},skills:new Set()};
   types[o.type].occurrences++;count(types[o.type].dispositions,d.disposition);types[o.type].skills.add(row.skillId);
   occurrenceCount++;
   return {invokeOffset:o.invokeOffset,invokeIndex:o.invokeIndex,sourceSide:o.sourceSide,orIndex:o.orIndex,andIndex:o.andIndex,...d};
  });
  for(const route of routes){
   assert(used.has(route),'empty or missing original route');
   const subset=row.occurrences.filter(o=>o.invokeOffset===route.invokeOffset&&
    (o.sourceSide==='conditions'?o.orIndex===route.conditionOrIndex:o.sourceSide==='preConditions'&&o.orIndex===route.preconditionOrIndex));
   assert.deepEqual([...new Set(subset.map(o=>o.type).filter(t=>!four.has(t)))].sort(),
    [...route.unresolvedPredicateTypes].sort(),'route predicate types drift');
  }
  rows.push({appSkillId:row.skillId,sourceNumericId:row.sourceNumericId,
   sourceIdentityDisposition:c.sourceIdentityDisposition,partialWDDisposition:h.partialModelWD.decision,
   dispositionCounts:local,occurrences:dispositions,wholeSkillSuitability:'undetermined'});
 }
 assert.equal(matched,occ.denominators.sourceMatchedSkills);
 assert.equal(unavailable,occ.denominators.sourceUnavailableSkills);
 assert.equal(routeCount,handoff.denominators.originalSourceRouteRefs);
 assert.equal(occurrenceCount,occ.denominators.originalPredicateOccurrences);
 assert.equal(Object.values(totals).reduce((a,b)=>a+b,0),occurrenceCount);
 const typeSummary=Object.entries(types).map(([type,v])=>({type,occurrences:v.occurrences,distinctSkills:v.skills.size,dispositions:v.dispositions}))
  .sort((a,b)=>b.distinctSkills-a.distinctSkills||a.type.localeCompare(b.type));
 return {schemaVersion:1,status:STATUS,source:{occurrenceLedgerSHA256:digest(occ),handoffSHA256:digest(handoff),crossAuditSHA256:digest(cohort),registrySHA256:g6.SOURCE_SHA},
  denominators:{appSkills:rows.length,matched,unavailable,routeCount,occurrenceCount,distinctTypes:typeSummary.length,actualAppliedOmissions:0,formalScores:0},
  totals,typeSummary,rows,boundary:{notWholeSkillActivation:true,unknownIsNotNeutral:true,conditionalOmissionRequiresAssumptions:true,G4ParentPassNotGranted:true}};
}
if(require.main===module)try{
 const a=process.argv.slice(2);assert.equal(a.length,4,'Usage: occurrence-ledger handoff cross-audit output');
 const x=audit(...a.slice(0,3).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(a[3],JSON.stringify(x,null,2)+'\n');
 console.log('P2_G4_OCCURRENCE_DECISIONS='+JSON.stringify({denominators:x.denominators,totals:x.totals,typeSummary:x.typeSummary}));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,decision,audit};
