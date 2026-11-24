'use strict';
/* P3.4 pre-decision research receipt only.
 * Validates the complete reproducible P2 G6 handoff against its four inputs,
 * then indexes source identities and unresolved status. NOT a P3 score.
 * This supplements, rather than silently replacing, P3.1's historic 10
 * original-source-condition W-only receipt.
 */
const crypto=require('node:crypto');
const g6=require('./p2_g6_research_handoff_881.cjs');
const STATUS='P3-G6-quarantined-881-research-received-no-card-suitability';
const fail=(ok,why)=>{if(!ok)throw Error('P3 G6 research intake: '+why)};
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function validateHandoff(handoff,axes,partial,dynamic,selected){
 const computed=g6.build(axes,partial,dynamic,selected);
 fail(handoff?.schemaVersion===1&&handoff.status===g6.STATUS&&
  JSON.stringify(handoff)===JSON.stringify(computed),
  'P2 research handoff changed, missing source data or not reproducible');
 fail(handoff.g6Decision?.G6ParentPass===false&&
  handoff.denominators?.approvedSkillCardSuitabilityScores===0&&
  handoff.denominators?.observedRealGameActivationRates===0,
  'P2 source handoff was promoted into product ratings');
 return true;
}
function accept(handoff,axes,partial,dynamic,selected){
 validateHandoff(handoff,axes,partial,dynamic,selected);
 const categories={},sourceIndex=new Map(),rows=[];
 for(const r of handoff.rows){
  const q=r.evaluationOutcome;
  fail(q?.status==='P3-research-intake-only-not-approved-skill-or-card-suitability'&&
   q?.originalGameActivationRate===null&&
   q?.acquiredFromAnyCard===null&&q?.suitabilityLabel===null&&
   q?.eligibleForP3CardScoring===false&&q?.cardScore===null&&
   r.explicitThreeAxisNecessaryOnly?.status&&
   r.partialModelWD?.decision&&
   r.partialModelWD.originalWholeSkillANDNotEstablished===true,
   'skill-level P3 research-only nonpromotion invariant broken');
  const decision=r.partialModelWD.decision;
  categories[decision]=(categories[decision]||0)+1;
  if(r.originalNumericSourceId!==null){
   fail(!sourceIndex.has(r.originalNumericSourceId),'duplicate source ID in P3');
   sourceIndex.set(r.originalNumericSourceId,r.appSkillId);
  }
  rows.push({
   appSkillId:r.appSkillId,originalNumericSourceId:r.originalNumericSourceId,
   explicitThreeAxisSourceNecessaryStatus:
    r.explicitThreeAxisNecessaryOnly.status,
   partialWDStudyDecision:decision,
   perSourceDynamicResearchDecisions:r.originalDynamicSourceResearch.map(d=>({
    type:d.type,
    originalRouteRef:structuredClone(d.originalRouteRef),
    disposition:d.evidenceDecision
   })),
   sourceExactReviewDecision:r.selectedOriginalANDReview?.disposition??null,
   fullSourceSkillRate:'not-measured',
   originalSkillAcquisition:'not-evaluated',
   cardScore:null,eligibleForP3CardScoring:false
  });
 }
 fail(rows.length===handoff.denominators.appSkills&&
  sourceIndex.size===handoff.denominators.sourceMatchedSkills,
  'research source/app cohort size drift');
 return {schemaVersion:1,status:STATUS,
  provenance:{
   sourceP2G6Status:handoff.status,
   sourceP2G6DigestSHA256:digest(handoff),
   sourceUmaSimRegistrySHA256:
    handoff.source.fixedOriginalSkillRegistrySHA256,
   sourceFixedModelRevision:handoff.source.fixedOriginalSourceRevision,
   P3ExistingLegacy10WReceiptNotReplaced:true,
   independentlyVerifiedAgainstFourP2Inputs:true
  },
  population:{
   appSkills:rows.length,
   sourceMatchedSkills:sourceIndex.size,
   sourceUnavailableSkills:rows.length-sourceIndex.size,
   byP2PartialWindowStudyDecision:categories,
   originalDynamicSourceRouteRows:
    handoff.denominators.originalDynamicTypeRouteRows,
   P2SelectedSourceANDReviews:
    handoff.denominators.selectedSourceANDReviews,
   formalSkillSuitabilityScores:0,
   verifiedCardAcquisitionPaths:0
  },
  sourceAppResearchIndex:rows,
  evaluationRestrictions:{
   sourceGatesAreNecessaryNotActivation:true,
   originalFullANDOrAndTemporalPreconditionUnknown:true,
   partialWDNotWholeSkillProcRate:true,
   P2G4SourceApproximateNearLaneOvertakeNotRealGameEvidence:true,
   cardAcquisitionSeparateP3_2AndP3_3Gate:true,
   P3_4ScoringAndUncertaintyPolicyNotApproved:true,
   P4ProductionUINotApproved:true
  }
 };
}
function validateReceipt(receipt,handoff,axes,partial,dynamic,selected){
 const expected=accept(handoff,axes,partial,dynamic,selected);
 fail(JSON.stringify(receipt)===JSON.stringify(expected),
  'P3 research receipt is not a reproducible G6 research-only intake');
 return true;
}
function lookupBySourceId(receipt,handoff,axes,partial,dynamic,selected,id){
 validateReceipt(receipt,handoff,axes,partial,dynamic,selected);
 fail(typeof id==='string'&&/^\d+$/.test(id),
  'only original numeric source ID may be queried');
 const x=receipt.sourceAppResearchIndex.find(r=>r.originalNumericSourceId===id);
 return x?{status:'quarantined-research-not-suitability',evidence:structuredClone(x),
  eligibleForP3CardScoring:false}:
  {status:'source-ID-outside-this-app-cohort-or-unmatched',evidence:null,
   eligibleForP3CardScoring:false};
}
module.exports={STATUS,validateHandoff,accept,validateReceipt,lookupBySourceId};
