'use strict';
/*
 * P2.15 source-exact phase_random window audit.
 *
 * This inspects only the branch-local predicate shape and the pinned UmaSim
 * SkillChecker's window logic.  It does NOT calculate a random outcome,
 * same-tick full AND, whole-skill proc, W/D metric or card suitability.
 */
const full=require('./skill_full_condition_path_audit.cjs');
const blockers=require('./skill_source_path_blocker_impact.cjs');
const STATUS='P2.15-original-phase-random-window-shape-not-trigger-or-suitability';
const SOURCE_REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const PHASE_IDS=new Set([0,1,2,3]);
const fail=(ok,why)=>{if(!ok)throw Error('P2.15 phase source: '+why);};
const CHECKER_ANCHORS=[
 '"phase_random" -> checkInRandom(calculatedAreas, condition.type + condition.value) {',
 'baseSetting.initPhaseRandom(condition.value)',
 'fun RaceSetting.initPhaseRandom(phase: Int, options: Pair<Double, Double> = 0.0 to 1.0)',
 'val (zoneStart, zoneEnd) = getPhaseStartEnd(phase)',
 'return chooseRandom(zoneStart + zoneLength * startRate, zoneEnd - zoneLength * (1 - endRate))',
 'RandomPosition.RANDOM -> Random.nextDouble()',
 'val start = min(rate * (zoneEnd - zoneStart) + zoneStart, zoneEnd - 2.0)',
 'val end = min(start + 10.0, zoneEnd)',
 'val areas = calculated.getOrPut(key, calcAreas)',
 'return { areas.any { simulation.position in it } }'
];
function verifyPinnedChecker(sourceText){
 fail(typeof sourceText==='string'&&sourceText.length>1000,
  'missing pinned original SkillChecker code');
 for(const fragment of CHECKER_ANCHORS){
  fail(sourceText.includes(fragment),
   'missing, duplicate or changed pinned window implementation: '+fragment);
 }
 // Do not accept another branch with the same name that could shadow the
 // checked definition. The Kotlin branch itself has no operator test.
 const branch=sourceText.match(/"phase_random"\s*->\s*checkInRandom\([^\n]+\)\s*\{\s*baseSetting\.initPhaseRandom\(condition\.value\)\s*\}/g)||[];
 fail(branch.length===1,'phase_random dispatch is not the pinned source branch');
 return {
  fixedUmaSimRevision:SOURCE_REV,
  conditionDispatch:'phase_random -> initPhaseRandom(value) -> cached interval membership',
  modeledWindow:'uniform source phase interval, start clipped to end-2m, at most 10m long',
  sourceConditionOperatorUsedByThisDispatch:false,
  simulationAndTrueSkillTriggerMeasured:false
 };
}
function sourceRow(skill,sourceNumericId){
 fail(skill&&skill.activationProfile?.status==='source-structure'&&
  skill.activationProfile.sourceNumericId===sourceNumericId&&
  Array.isArray(skill.activationProfile.invokes),
  'missing exact app skill/source numeric ID');
}
function audit(model,blockerAudit,sourceText){
 const semantics=verifyPinnedChecker(sourceText);
 fail(model&&Array.isArray(model.skills)&&model.skillById&&
  blockerAudit?.status===blockers.sourceStatus&&
  Array.isArray(blockerAudit.rows)&&
  blockerAudit.denominators?.sourceMatchedSkills===
   blockerAudit.rows.length&&
  blockerAudit.denominators?.appSkills===model.skills.length,
  'source model/blocker audit not aligned');
 const before=JSON.stringify(model.cards||[]);
 const seen=new Set(),bySkill=[],cells=[];
 for(const record of blockerAudit.rows){
  fail(!seen.has(record.sourceNumericId)&&
   record.status==='original-source-branch-structure-audited-not-runtime-measured',
   'duplicate or unverified original skill');
  seen.add(record.sourceNumericId);
  const skill=model.skillById[record.skillId];
  sourceRow(skill,record.sourceNumericId);
  for(const style of full.STYLES){
   const info=record.byStyle?.[style.name];
   fail(info&&Array.isArray(info.singleTypeResearchCandidates),
    'missing P2.15 per-style candidate analysis');
   if(!info.singleTypeResearchCandidates.includes('phase_random'))continue;
   fail(info.status==='one-unverified-predicate-type-away-in-some-route'&&
    info.minimumRemainingTypeCount===1,
    'phase source promoted across another unverified predicate');
   const alternatives=blockers.routes(skill,style.id)
    .filter(r=>r.finiteGateStatus==='not-excluded-by-known-domains'&&
     r.blockerTypeCount===1&&
     r.unresolvedTypes.length===1&&
     r.unresolvedTypes[0]==='phase_random');
   fail(alternatives.length>0,'P2.15 phase candidate has no exact source path');
   const rows=alternatives.map(r=>{
    const inv=skill.activationProfile.invokes[r.invokeOffset];
    const normal=inv?.conditions?.[r.conditionOrIndex];
    const pre=r.preconditionOrIndex===null?[]:
     inv?.preConditions?.[r.preconditionOrIndex];
    fail(Array.isArray(normal)&&Array.isArray(pre),
     'source AND/OR/precondition row moved');
    fail(full.checkCombination([...normal,...pre],style.id)===
     'not-excluded-by-known-domains','known finite AND conflict');
    const positions=[
     ...normal.map((p,i)=>({side:'conditions',index:i,p})),
     ...pre.map((p,i)=>({side:'preConditions',index:i,p}))
    ].filter(x=>x.p.type==='phase_random');
    fail(positions.length>0,'missing phase_random original predicate');
    const observed=positions.map(({side,index,p})=>({
     side,predicateIndex:index,operator:p.operator,phaseId:p.value,
     operatorInterpretedAsRuntimeComparison:false,
     windowSemantic:'source-cached-random-position-in-phase',
     phaseNumberSupportedByResearch:PHASE_IDS.has(p.value)
    }));
    const supported=observed.every(p=>p.operator==='=='&&
     p.phaseNumberSupportedByResearch);
    return {
     invokeOffset:r.invokeOffset,invokeIndex:r.invokeIndex,
     conditionOrIndex:r.conditionOrIndex,
     preconditionOrIndex:r.preconditionOrIndex,
     conditionOrCount:r.conditionOrCount,
     preconditionOrCount:r.preconditionOrCount,
     totalSourcePhasePredicates:observed.length,
     phasePredicates:observed,
     otherUnverifiedTypes:[],
     allFinitePredicatesActuallyMeasured:false,
     state:supported?
      'original-window-shape-verified-not-same-tick-evaluated':
      'unsupported-original-operator-or-phase-number',
     noFullConditionOrProcClaim:true
    };
   });
   cells.push({sourceNumericId:record.sourceNumericId,style:style.name,
    researchPaths:rows,
    windowShapesSupported:rows.filter(r=>r.state===
      'original-window-shape-verified-not-same-tick-evaluated').length,
    fullyEvaluatedSourceRoutes:0,completeSkillProcs:0});
  }
 }
 fail(before===JSON.stringify(model.cards||[]),'mutated application card model');
 const ids=new Set(cells.map(x=>x.sourceNumericId));
 const supported=cells.flatMap(x=>x.researchPaths).filter(x=>
  x.state==='original-window-shape-verified-not-same-tick-evaluated').length;
 const held=cells.flatMap(x=>x.researchPaths).filter(x=>
  x.state!=='original-window-shape-verified-not-same-tick-evaluated').length;
 return {
  schemaVersion:1,status:STATUS,
  provenance:{
   fixedOriginalSourceRevision:SOURCE_REV,
   implementationVerified:semantics,
   sourceCohort:'P2.15-minimum-unknown-type-count-exactly-one',
   upstreamContentEmbedded:false
  },
  summary:{
   originalMatchedSkills:seen.size,
   phaseRandomSingletonCandidateSkills:ids.size,
   phaseRandomSingletonCandidateStyleCells:cells.length,
   exactPhaseWindowSourcePaths:supported+held,
   phaseWindowSourcePathsWithVerifiedShape:supported,
   phaseWindowSourcePathsHeldForOperatorOrPhaseNumber:held,
   fullyEvaluatedSourceRoutes:0,actualSkillProcObservations:0,
   officialSkillSuitabilityRatings:0
  },
  rows:cells,
  limitations:[
   'This resolves source phase_random window SHAPE for a narrow P2.15 one-type-away cohort, not the drawn window in any model tick.',
   'Although the pinned reference code does not compare condition.operator in phase_random dispatch, only the nominal == operator is researched; others remain held.',
   'An original window shape does not prove that an avatar traverses a sampled interval while remaining eligible.',
   'Finite gates are only screened for contradictions, not all tested for equality to a specific race.',
   'preConditions can represent persistent historical state; OR alternatives and multiple Invoke effects are not collapsed or assigned independent probabilities.',
   'Existing W rank-window measurements must not be conflated with this source window or promoted to whole-skill activation, D, grade or UI.'
  ]
 };
}
module.exports={STATUS,SOURCE_REV,PHASE_IDS,CHECKER_ANCHORS,verifyPinnedChecker,audit};
