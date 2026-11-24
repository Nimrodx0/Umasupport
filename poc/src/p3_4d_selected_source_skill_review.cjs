'use strict';
/*
 * P3.4d: review FOUR concrete pinned source skills, not synthetic labels.
 * Original skill definition + pinned checker implementation + independently
 * validated 881-skill P3.4a receipts must agree. No official product labels.
 */
const crypto=require('node:crypto');
const p34=require('./p3_4_uncertainty_semantics.cjs');
const handoff=require('./p2_g6_research_handoff_881.cjs');
const STATUS='P3.4d-four-pinned-source-skills-distinct-style-logic-evidence-no-labels';
const PIN='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const CASES=Object.freeze([
 Object.freeze({id:'200432',name:'集中力',kind:'source-logic-style-neutral-only',
  conditions:[{type:'always',operator:'==',value:1}],
  expectedPartial:'no-additional-short-window-study'}),
 Object.freeze({id:'201312',name:'先行直線○',
  kind:'explicit-running-style-eligibility-not-inferred-bias',
  conditions:[{type:'running_style',operator:'==',value:2},
   {type:'straight_random',operator:'==',value:1}],
  expectedPartial:'no-additional-short-window-study'}),
 Object.freeze({id:'201591',name:'ウマ好み',
  kind:'nearby-opponent-special-state-model-held',
  conditions:[{type:'near_count',operator:'>=',value:3},
   {type:'accumulatetime',operator:'>=',value:5}],
  expectedPartial:'no-additional-short-window-study'}),
 Object.freeze({id:'203431',name:'才気煥発',
  kind:'distance-gated-spurt-timing-source-AND-held',
  conditions:[{type:'distance_type',operator:'==',value:3},
   {type:'is_lastspurt',operator:'==',value:1},
   {type:'phase_firsthalf_random',operator:'==',value:3}],
  expectedPartial:null})
]);
const fail=(yes,reason)=>{if(!yes)throw Error('P3.4d selected pinned skill: '+reason)};
const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
function verifyChecker(checker,model){
 fail(typeof checker==='string'&&checker.length>10000&&
  typeof model==='string'&&model.length>10000,
  'pinned full Kotlin checker and special state implementation required');
 const sections={
  always:['"always" -> condition.withAssert("==", 1) { { true } }',checker],
  running_style:['"running_style" -> condition.preChecked(baseSetting.basicRunningStyle.value)',checker],
  straight_random:['"straight_random" -> condition.withAssert("==", 1)',checker],
  nearby:['"near_count" -> condition.checkSpecialState()',checker],
  accumulatedTime:['"accumulatetime" -> condition.checkInRace { simulation.currentTime.toInt() }',checker],
  distance:['"distance_type" -> condition.preChecked(baseSetting.trackDetail.distanceType)',checker],
  spurt:['"is_lastspurt" -> condition.checkInRaceBool { isInSpurt() }',checker],
  phase:['"phase_firsthalf_random" -> checkInRandom(',checker],
  randomWindow:['baseSetting.initPhaseRandom(condition.value, 0.0 to 0.5)',checker],
  approxNear:['"near_count" to ApproximateMultiCondition(',model]
 };
 for(const [label,[needle,s]] of Object.entries(sections))
  fail(s.includes(needle),'pinned Kotlin mechanism drift: '+label);
 return {status:'pinned-kotlin-handler-signatures-rechecked',
  originalRevision:PIN,
  alwaysSourceHandlerReturnsTrue:true,
  runningStyleIsSourceStaticRacePrerequisite:true,
  nearCountUsesApproximateSpecialState:true,
  spurtAndRandomWindowAreDistinctRuntimePredicates:true};
}
function inspectOne(record,receiptRow,mechanisms){
 const sample=CASES.find(x=>x.id===record?.id);
 fail(sample&&receiptRow&&mechanisms?.status==='pinned-kotlin-handler-signatures-rechecked',
  'unknown or unfixed source example');
 fail(record.name===sample.name&&
  receiptRow.sourceNumericId===sample.id&&
  receiptRow.originalName===record.name&&
  receiptRow.staticSourceApplicability?.sourceMatch==='matched'&&
  Array.isArray(receiptRow.unresolvedReasons)&&
  receiptRow.unresolvedReasons.includes('full-original-AND-OR-Invoke-unverified')&&
  receiptRow.wholeSkillSuitability===null&&
  receiptRow.suitabilityLabel===null&&
  receiptRow.cardScore===null&&
  receiptRow.eligibleForP3CardScoring===false,
  'source/app identity mismatch or official P3 boundary crossed');
 fail(Array.isArray(record.invokes)&&record.invokes.length===1&&
  record.invokes[0].skillId===sample.id&&record.invokes[0].index===1&&
  (record.invokes[0].preConditions==null||
   (Array.isArray(record.invokes[0].preConditions)&&
    record.invokes[0].preConditions.length===0))&&
  eq(record.invokes[0].conditions,[sample.conditions]),
  'full original source trigger AND / invoke / preconditions drift');
 const partialStatus=receiptRow.modelPartialWD?.status;
 fail(['partial-source-window-research-only',
  'held-source-ground-not-covered-by-model',
  'no-additional-short-window-study'].includes(partialStatus),
  'unrecognized P3.4a partial research state');
 const selected=receiptRow.selectedSourceANDDisposition;
 if(sample.id==='203431')
  fail(selected==='reuse-P2.38-spurt-window-predicates-but-hold-middle-distance-full-AND-W',
   'P2.43 original distance AND hold was not preserved');
 else fail(selected===null,'unexpected selected original AND adjudication');
 const conclusions={
  '200432':{
   sourceConditionContrast:'source-current-trigger-condition-constant-across-styles',
   couldSupportFutureGeneralReview:true,
   notYetProven:['skill-activation-scheduling-and-lottery',
    'effect-usefulness-not-in-scope','final-product-general-adoption'],
   note:'single original Invoke, current AND is always == 1; source checker returns true, but it is NOT a measured game proc rate'
  },
  '201312':{
   sourceConditionContrast:'source-running-style-gate-restricts-eligibility-to-style-2',
   couldSupportFutureGeneralReview:false,
   notYetProven:['eligible-one-style-does-not-constitute-four-style-comparison',
    'source-restriction-does-not-automatically-certify-product-targeted-label'],
   note:'source running_style == 2 AND straight_random; explicit scope is not a measured contrast or target label'
  },
  '201591':{
   sourceConditionContrast:'source-special-state-near-count-unknown-across-styles',
   couldSupportFutureGeneralReview:false,
   notYetProven:['near-count-style-conditioned-opportunity',
    'special-state-approximation-is-not-game-frequency'],
   note:'source near_count >= 3 AND accumulatetime >= 5; Kotlin near_count uses approximated special state'
  },
  '203431':{
   sourceConditionContrast:'source-distance-gate-and-dynamic-spurt-phase-AND-unresolved',
   couldSupportFutureGeneralReview:false,
   notYetProven:['middle-distance-only-source-scope',
    'same-runner-tick-whole-original-AND-opportunity',
    'P2.38-partial-spurt-window-is-not-complete-skill'],
   note:'source distance_type == 3 AND is_lastspurt AND phase_firsthalf_random; P2.43 held the complete AND'
  }
 };
 return {
  sourceNumericId:record.id,originalName:sample.name,
  sourceRevision:PIN,fullSourceConditionAND:sample.conditions.map(x=>({...x})),
  fullSourceInvokesChecked:1,
  originalPreconditionsAbsent:true,
  sourceModelEvidenceStatus:partialStatus,
  sourceStaticContexts:receiptRow.staticSourceApplicability,
  sourceANDReview: selected,
  evidenceClass:sample.kind,
  ...conclusions[sample.id],
  productStyleLabel:null,
  illustrativeOnly:false,
  wholeOriginalSkillProcRate:null,
  productLabelApproved:false,
  cardScore:null
 };
}
function review({originalText,checkerText,approxText,preview}){
 fail(typeof originalText==='string'&&
  crypto.createHash('sha256').update(originalText).digest('hex')===handoff.SOURCE_SHA,
  'original skill registry not the pinned source digest');
 const mechanisms=verifyChecker(checkerText,approxText);
 fail(preview?.status===p34.STATUS&&
  preview.provenance?.officialPolicyApproved===false&&
  preview.denominators?.appSkills===881&&
  preview.denominators?.sourceMatchedSkills===818&&
  preview.denominators?.sourceUnavailableSkills===63&&
  preview.denominators?.officialSkillOrCardScores===0&&
  Array.isArray(preview.rows)&&preview.rows.length===881,
  'recomputed P3.4a 881 source receipt must remain unapproved');
 let original;
 try{original=JSON.parse(originalText.replace(/^\uFEFF/,''))}
 catch{fail(false,'pinned source text not valid JSON')}
 fail(Array.isArray(original)&&original.length>1000,'original source registry incomplete');
 const bySource=new Map(original.map(x=>[x.id,x]));
 fail(bySource.size===original.length,'duplicated original source IDs');
 const byReceipt=new Map(preview.rows.filter(x=>x.sourceNumericId!==null)
  .map(x=>[x.sourceNumericId,x]));
 fail(byReceipt.size===818,'independent P3.4a original numeric cohort mismatch');
 const rows=CASES.map(x=>inspectOne(bySource.get(x.id),byReceipt.get(x.id),mechanisms));
 fail(rows.length===4&&rows.every(x=>x.productStyleLabel===null&&
  x.productLabelApproved===false&&x.cardScore===null&&
  x.wholeOriginalSkillProcRate===null),
  'real source labels or scores must never be inferred in P3.4d');
 return {
  schemaVersion:1,status:STATUS,
  provenance:{pinnedUmaSimRevision:PIN,
   exactOriginalSkillRegistrySHA256:handoff.SOURCE_SHA,
   p34aIntakeStatus:preview.status,
   KotlinSemantics:mechanisms,
   formalProductPolicyApproved:false},
  summary:{reviewedOriginalAppSkills:rows.length,
   sourceConditionOnlyStyleNeutralCandidates:1,
   explicitStyleEligibilityRestricted:1,
   dynamicSpecialStateHeld:1,
   complexDistanceAndSpurtHeld:1,
   officiallyApprovedStyleLabels:0,gameSkillProcRates:0,
   officialSupportCardScores:0},
  decision:{
   userGeneralDefinition:'relative-style-bias-absent-independent-of-absolute-opportunity',
   importantDistinction:'proof-of-source-condition-style-neutrality-does-not-automatically-certify-product-skill-general',
   missingDecision:'choose when original condition structure is enough for product label; if dynamic conditions, compare only within same eligible scope',
   materialBiasThresholdApproved:false},
  rows
 };
}
module.exports={STATUS,PIN,CASES,verifyChecker,inspectOne,review};
