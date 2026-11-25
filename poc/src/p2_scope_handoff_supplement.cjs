'use strict';
// G6 supplement: preserve the research scope decision separately from proof of
// predicate truth, source identity and partial W/D. No source term is removed.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const g4=require('./p2_g4_occurrence_disposition.cjs');
const ctx=require('./p2_context_logic_review.cjs');
const g6=require('./p2_g6_research_handoff_881.cjs');
const p34=require('./p3_4_uncertainty_semantics.cjs');
const STATUS='P2.49-G6-scope-and-evidence-disposition-supplement-not-product-labels';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const unique=xs=>[...new Set(xs)].sort();
function index(rows){const m=new Map();for(const row of rows){a(typeof row.appSkillId==='string'&&!m.has(row.appSkillId),'duplicate app ID');m.set(row.appSkillId,row);}return m;}
function partition(occurrences){
 const groups={necessaryStatic:[],excludedResearch:[],retainedContext:[],otherUnresolved:[]};
 const keys=new Set();
 for(const o of occurrences){
  const key=JSON.stringify([o.invokeOffset,o.invokeIndex,o.sourceSide,o.orIndex,o.andIndex,o.type]);
  a(!keys.has(key),'duplicate occurrence');keys.add(key);
  a.equal(o.actualOmissionApplied,false);a.equal(o.wholeANDVerified,false);
  a.deepEqual(o.researchScope,g4.researchScope(o.type),'scope mismatch');
  const ref={invokeOffset:o.invokeOffset,invokeIndex:o.invokeIndex,sourceSide:o.sourceSide,
   orIndex:o.orIndex,andIndex:o.andIndex,type:o.type,disposition:o.disposition};
  if(o.researchScope!==null)groups.excludedResearch.push({...ref,researchScope:o.researchScope});
  else if(o.disposition==='adopt-static-necessary-gate-only')groups.necessaryStatic.push(ref);
  else if(o.disposition==='retain-original-context-gate'||o.disposition==='conditional-fixed-state-shortcut-candidate')groups.retainedContext.push(ref);
  else {
   a(['hold-spurt-full-conjunction','conditional-mechanism-reference-only','hold-unverified-impact','reject-approximation-as-game-style-evidence'].includes(o.disposition),'unknown disposition');
   groups.otherUnresolved.push(ref);
  }
 }
 a.equal(Object.values(groups).flat().length,occurrences.length);
 return groups;
}
function audit(ledger,logic,preview,handoff){
 a.equal(ledger.status,g4.STATUS);a.equal(logic.status,ctx.STATUS);
 a.equal(preview.status,p34.STATUS);a.equal(handoff.status,g6.STATUS);
 for(const sha of [ledger.source.registrySHA256,logic.source.registrySHA256,preview.provenance.sourceOriginalRegistrySHA256,handoff.source.fixedOriginalSkillRegistrySHA256])a.equal(sha,g6.SOURCE_SHA);
 a.equal(ledger.source.handoffSHA256,digest(handoff));
 a.equal(logic.denominators.formalLabels,0);a.equal(logic.denominators.actualOmissions,0);
 a.equal(ledger.denominators.actualAppliedOmissions,0);
 const li=index(ledger.rows),ci=index(logic.rows),pi=index(preview.rows),hi=index(handoff.rows);
 a.equal(li.size,pi.size);a.equal(li.size,hi.size);
 let totals={sourceUnavailable:0,sourceMatched:0,excludedResearchOccurrences:0,
  skillsWithExcludedResearch:0,skillsWithExcludedAndOtherUnresolved:0,
  logicAlwaysOnly:0,logicFixedContextOnly:0,logicOtherHeld:0,
  otherUnresolvedOccurrences:0,retainedContextOccurrences:0,necessaryStaticOccurrences:0};
 const rows=[];
 for(const [id,l] of li){
  const p=pi.get(id),h=hi.get(id);a(p&&h);
  a.equal(l.sourceNumericId,p.sourceNumericId);a.equal(l.sourceNumericId,h.originalNumericSourceId);
  a.equal(l.partialWDDisposition,h.partialModelWD.decision);
  a.equal(p.suitabilityLabel,null);a.equal(p.cardScore,null);a.equal(p.eligibleForP3CardScoring,false);
  const c=ci.get(id);
  if(l.sourceNumericId===null){
   a.equal(l.occurrences,null);a.equal(c,undefined);totals.sourceUnavailable++;
   rows.push({appSkillId:id,sourceNumericId:null,sourceIdentityDisposition:l.sourceIdentityDisposition,
    predicateGroups:null,logicCandidate:null,partialWDDisposition:l.partialWDDisposition,
    evidenceUse:'hold-unmatched-source',suitabilityLabel:null,cardScore:null});continue;
  }
  totals.sourceMatched++;a(c);a.equal(c.sourceNumericId,l.sourceNumericId);a.equal(c.formalLabel,null);
  const groups=partition(l.occurrences);
  totals.excludedResearchOccurrences+=groups.excludedResearch.length;
  totals.necessaryStaticOccurrences+=groups.necessaryStatic.length;
  totals.retainedContextOccurrences+=groups.retainedContext.length;
  totals.otherUnresolvedOccurrences+=groups.otherUnresolved.length;
  if(groups.excludedResearch.length)totals.skillsWithExcludedResearch++;
  if(groups.excludedResearch.length&&(groups.otherUnresolved.length||groups.retainedContext.length))totals.skillsWithExcludedAndOtherUnresolved++;
  const logicCandidate=c.disposition;
  if(logicCandidate==='style-independent-always-only-candidate')totals.logicAlwaysOnly++;
  else if(logicCandidate==='style-independent-conditional-context-candidate')totals.logicFixedContextOnly++;
  else {a.equal(logicCandidate,'hold-other-source-logic');totals.logicOtherHeld++;}
  const evidenceUse=p.modelPartialWD.status==='partial-source-window-research-only'?'scoped-partial-W-D-only':
   p.modelPartialWD.status==='held-source-ground-not-covered-by-model'?'hold-ground-transfer':
   logicCandidate!=='hold-other-source-logic'?'source-logic-candidate-only':'no-new-window-evidence-keep-unresolved';
  // No replacement of held W/D or original full conditions even when an
  // excluded research condition shares an AND with a measured rank condition.
  rows.push({appSkillId:id,sourceNumericId:l.sourceNumericId,sourceIdentityDisposition:l.sourceIdentityDisposition,
   predicateGroups:groups,logicCandidate,partialWDDisposition:l.partialWDDisposition,evidenceUse,
   otherUnresolvedTypes:unique(groups.otherUnresolved.map(o=>o.type)),
   excludedResearchTypes:unique(groups.excludedResearch.map(o=>o.type)),
   sourceNecessaryMasks:[...h.explicitThreeAxisNecessaryOnly.potentialGroundStateMasks],
   modelPartialWD:structuredClone(p.modelPartialWD),
   originalWholeAND:'unknown',absoluteGameRate:null,suitabilityLabel:null,cardScore:null});
 }
 a.equal(totals.sourceMatched,ci.size);
 a.equal(totals.sourceMatched,ledger.denominators.matched);a.equal(totals.sourceUnavailable,ledger.denominators.unavailable);
 a.equal(totals.logicAlwaysOnly+totals.logicFixedContextOnly+totals.logicOtherHeld,totals.sourceMatched);
 a.equal(totals.excludedResearchOccurrences+totals.otherUnresolvedOccurrences+totals.retainedContextOccurrences+totals.necessaryStaticOccurrences,ledger.denominators.occurrenceCount);
 const scopedCount=Object.values(logic.targetSummary).reduce((n,t)=>n+t.occurrences,0);
 a.equal(scopedCount,totals.excludedResearchOccurrences);
 return {schemaVersion:1,status:STATUS,source:{registrySHA256:g6.SOURCE_SHA,ledgerSHA256:digest(ledger),
  logicSHA256:digest(logic),previewSHA256:digest(preview),handoffSHA256:digest(handoff),ownerDecision:'D-049'},
  totals,rows,boundary:{researchExclusionIsNotPredicateTruth:true,notZeroImpactProof:true,
   originalSourceRetained:true,modelWDNotGameRate:true,formalLabels:0,actualOmissions:0,G6ParentPassNotGranted:true}};
}
function accept(supplement,...inputs){
 const expected=audit(...inputs);a.deepEqual(supplement,expected,'G6 supplement cannot be independently reproduced');
 return {schemaVersion:1,status:'P3-G6-scope-supplement-accepted-research-only',
  sourceSupplementSHA256:digest(expected),ownerDecision:'D-049',totals:expected.totals,
  sourceIndex:expected.rows.map(r=>({appSkillId:r.appSkillId,sourceNumericId:r.sourceNumericId,
   evidenceUse:r.evidenceUse,logicCandidate:r.logicCandidate,
   excludedResearchTypes:r.excludedResearchTypes??null,otherUnresolvedTypes:r.otherUnresolvedTypes??null,
   eligibilityForCardScoring:false,cardScore:null,suitabilityLabel:null})),formalLabels:0};
}
if(require.main===module)try{
 const args=process.argv.slice(2);a.equal(args.length,6,'Usage: ledger logic preview handoff supplement receipt');
 const inputs=args.slice(0,4).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
 const result=audit(...inputs);fs.writeFileSync(args[4],JSON.stringify(result,null,2)+'\n');
 const receipt=accept(JSON.parse(fs.readFileSync(args[4],'utf8')),...inputs);
 fs.writeFileSync(args[5],JSON.stringify(receipt,null,2)+'\n');
 console.log('P2_49_SCOPE_RECEIPT='+JSON.stringify({totals:result.totals,formalLabels:receipt.formalLabels}));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,partition,audit,accept};
