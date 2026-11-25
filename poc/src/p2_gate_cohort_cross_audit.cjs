'use strict';
// Cross-audit the independently generated identity ledger, necessary-axis
// report and research intake. No new suitability or runtime inference.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const g1=require('./skill_p2_g1_source_gap_ledger.cjs');
const axis=require('./skill_p2_15_parameterized_axis_gates.cjs');
const g6=require('./p2_g6_research_handoff_881.cjs');
const p3=require('./p3_g6_research_intake.cjs');
const bridge=require('./skill_bridge.js');
const p243=require('./skill_p2_43_original_spurt_candidate_review.cjs');
const STATUS='P2-G1-G2-G6-cross-audit-fixed-cohort-no-product-rating';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function index(rows,key){
 const out=new Map();
 for(const row of rows){
  assert(typeof row[key]==='string'&&row[key]&&!out.has(row[key]),'duplicate or missing '+key);
  out.set(row[key],row);
 }
 return out;
}
function audit(ledger,axes,handoff,receipt){
 assert.equal(ledger.status,g1.STATUS);
 assert.equal(axes.status,axis.STATUS);
 assert.equal(handoff.status,g6.STATUS);
 assert.equal(receipt.status,p3.STATUS);
 assert.equal(ledger.source.revision,p243.PIN);
 assert.equal(ledger.source.sha256,g6.SOURCE_SHA);
 assert.equal(ledger.source.pinnedSha256,bridge.PINNED_SHA256);
 assert.equal(axes.source.skillRegistrySha256,g6.SOURCE_SHA);
 assert.equal(handoff.source.fixedOriginalSkillRegistrySHA256,g6.SOURCE_SHA);
 assert.equal(receipt.provenance.sourceUmaSimRegistrySHA256,g6.SOURCE_SHA);
 assert.equal(receipt.provenance.sourceP2G6DigestSHA256,digest(handoff));
 assert.equal(receipt.provenance.independentlyVerifiedAgainstFourP2Inputs,true);
 assert.deepEqual(axes.panelDefinition.contexts,axis.PANEL);
 const li=index(ledger.rows,'appSkillId'), ai=index(axes.sourceRows,'skillId'),
  hi=index(handoff.rows,'appSkillId'), pi=index(receipt.sourceAppResearchIndex,'appSkillId');
 for(const m of [ai,hi,pi])assert.equal(m.size,li.size,'cohort mismatch');
 const routeBySource=new Map(), routeKeys=new Set();
 for(const r of axes.routeRows){
  const k=g6.key(r);
  assert(!routeKeys.has(k),'duplicate exact source route');
  routeKeys.add(k);
  assert(r.groundStateEligibilityMasks.length===32&&r.groundStateEligibilityMasks.every(x=>Number.isInteger(x)&&x>=0&&x<=15),'invalid route mask');
  assert.equal(r.runtimeSourceConditionsVerified,false);
  const list=routeBySource.get(r.sourceNumericId)||[];
  list.push(r);
  routeBySource.set(r.sourceNumericId,list);
 }
 const counts={matched:0,unavailable:0,knownMaskCells:0,unknownMaskCells:0,
  routeRefs:0,emptyInvokeHeld:0,conditionalPartialWD:0,groundHeld:0,noNewShortWindowEvidence:0};
 const reasonCounts={}, byUnresolvedPredicateType={}, rows=[];
 for(const [id,l] of li){
  const a=ai.get(id),h=hi.get(id),p=pi.get(id);
  assert(a&&h&&p,'missing app identity '+id);
  assert.equal(l.eligibleForP3CardScoring,false);
  assert.equal(l.cardScore,null);
  assert.equal(l.originalFullSkillANDProven,false);
  assert.equal(h.evaluationOutcome.eligibleForP3CardScoring,false);
  assert.equal(h.evaluationOutcome.cardScore,null);
  assert.equal(h.evaluationOutcome.suitabilityLabel,null);
  assert.equal(h.evaluationOutcome.originalGameActivationRate,null);
  assert.equal(p.eligibleForP3CardScoring,false);
  assert.equal(p.cardScore,null);
  assert.equal(a.sourceNumericId,h.originalNumericSourceId);
  assert.equal(p.originalNumericSourceId,h.originalNumericSourceId);
  const v=h.explicitThreeAxisNecessaryOnly;
  assert.equal(p.explicitThreeAxisSourceNecessaryStatus,v.status);
  const wd=h.partialModelWD.decision;
  assert.equal(p.partialWDStudyDecision,wd);
  assert.equal(h.partialModelWD.originalWholeSkillANDNotEstablished,true);
  if(wd==='conditionally-use-short-window-rank-evidence'||wd==='conditionally-use-source-exception-branch-W-D')counts.conditionalPartialWD++;
  else if(wd==='hold-turf-model-transfer')counts.groundHeld++;
  else {assert.equal(wd,'no-new-short-window-evidence');counts.noNewShortWindowEvidence++;}
  let unresolved=[];
  if(l.sourceStructureAvailable){
   counts.matched++;
   assert.equal(l.disposition,'matched-current-or-pinned');
   assert.equal(l.sourceNumericId,a.sourceNumericId);
   assert.equal(v.status,a.status);
   assert.equal(v.dynamicConditionsProven,false);
   assert.equal(v.fullSkillTriggerProven,false);
   const routes=routeBySource.get(a.sourceNumericId)||[];
   const refs=v.sourceRoutes;
   assert.equal(refs.length,routes.length);
   const union=Array(32).fill(0);
   for(let i=0;i<routes.length;i++){
    const route=routes[i],q=refs[i];
    for(const k of ['invokeOffset','invokeIndex','conditionOrIndex','preconditionOrIndex'])assert.equal(q[k],route[k]);
    assert.deepEqual(q.necessaryGroundStateMasks,route.groundStateEligibilityMasks);
    assert.deepEqual(q.unresolvedPredicateTypes,route.unknownDynamicTypes);
    assert.equal(q.runtimeFullOriginalANDProven,false);
    route.groundStateEligibilityMasks.forEach((m,j)=>{union[j]|=m;});
   }
   counts.routeRefs+=routes.length;
   unresolved=[...new Set(routes.flatMap(r=>r.unknownDynamicTypes))].sort();
   for(const type of unresolved)byUnresolvedPredicateType[type]=(byUnresolvedPredicateType[type]||0)+1;
   if(a.status==='source-empty-condition-invoke-held'){
    counts.emptyInvokeHeld++;
    assert(a.potentialGroundStateMasks.every(m=>m===15));
   }else{
    assert.equal(a.status,'static-necessary-gates-only');
    assert(routes.length>0,'matched skill without routes or explicit empty Invoke hold');
    assert.deepEqual(a.potentialGroundStateMasks,union,'skill OR union changed');
   }
   assert.equal(a.potentialGroundStateMasks.length,32);
   assert.deepEqual(v.potentialGroundStateMasks,a.potentialGroundStateMasks);
   for(const [k,prop] of [['style','hasKnownStyleGateContrast'],['distance','hasKnownDistanceGateContrast'],['surface','hasKnownSurfaceGateContrast']]){
    assert.equal(a[prop],axis.discrimination(a.potentialGroundStateMasks,k));
    assert.equal(v.knownExplicitContrast[k],a[prop]);
   }
   counts.knownMaskCells+=32;
  }else{
   counts.unavailable++;
   assert(['hint-name-absent-from-current','numeric-id-absent-from-both-dictionaries'].includes(l.disposition),'unexpected fixed-cohort gap');
   reasonCounts[l.disposition]=(reasonCounts[l.disposition]||0)+1;
   assert.equal(a.sourceNumericId,null);
   assert.equal(a.status,'unmatched-source-no-gate-inference');
   assert.equal(v.status,'source-unavailable');
   assert.equal(v.potentialGroundStateMasks,null);
   assert.equal(h.originalSourceRef,null);
   assert.equal(wd,'no-new-short-window-evidence');
   counts.unknownMaskCells+=32;
  }
  rows.push({appSkillId:id,sourceIdentityDisposition:l.disposition,
   requestedSourceNumericId:l.sourceNumericId??null,
   matchedSourceNumericId:h.originalNumericSourceId,
   staticNecessaryStatus:v.status,partialWDDisposition:wd,
   unresolvedRoutePredicateTypes:l.sourceStructureAvailable?unresolved:null,
   originalWholeSkillCondition:'unknown',eligibleForP3CardScoring:false,cardScore:null});
 }
 assert.equal(counts.routeRefs,routeKeys.size);
 assert.equal(counts.matched,ledger.denominators.sourceStructureMatched);
 assert.equal(counts.unavailable,ledger.denominators.sourceUnavailable);
 assert.equal(counts.matched,axes.denominators.sourceMatchedSkills);
 assert.equal(counts.matched,handoff.denominators.sourceMatchedSkills);
 assert.equal(counts.matched,receipt.population.sourceMatchedSkills);
 assert.equal(counts.unavailable,receipt.population.sourceUnavailableSkills);
 assert.equal(counts.matched+counts.unavailable,li.size);
 assert.equal(counts.conditionalPartialWD+counts.groundHeld+counts.noNewShortWindowEvidence,li.size);
 return {schemaVersion:1,status:STATUS,source:{ledgerSHA256:digest(ledger),
  axesSHA256:digest(axes),handoffSHA256:digest(handoff),receiptSHA256:digest(receipt),
  originalSkillRegistrySHA256:g6.SOURCE_SHA},counts,reasonCounts,
  unresolvedPredicateTypeSkillCounts:byUnresolvedPredicateType,rows,
  boundary:{staticNonExcludedIsNotActivation:true,unknownIsNotZero:true,
   noActualOmissionsApplied:true,G3G4AndG6ParentPassNotGranted:true,formalScores:0}};
}
function main(args){
 assert.equal(args.length,5,'Usage: ledger axes handoff receipt output');
 const r=audit(...args.slice(0,4).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(args[4],JSON.stringify(r,null,2)+'\n');
 console.log('P2_GATE_CROSS_AUDIT='+JSON.stringify({counts:r.counts,reasonCounts:r.reasonCounts,
  unresolvedPredicateTypeSkillCounts:r.unresolvedPredicateTypeSkillCounts}));
}
if(require.main===module)try{main(process.argv.slice(2))}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,audit};
