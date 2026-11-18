'use strict';
/* P2.37, G4: distinguish simulator approximation from mechanically observed
 * predicates in exact source routes. The output NEVER estimates real event
 * probability, reverses style rankings or produces a skill/card score.
 */
const queueModule=require('./skill_p2_32_research_queue.cjs');
const PIN='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const STATUS='P2.37-source-state-approximation-and-spurt-evidence-decision-only';
const TYPES=Object.freeze({
 change_order_onetime:{
  mechanism:'source-randomized-signed-rank-change-approximation',
  evaluationDecision:'reject-model-approximation-as-actual-style-evidence',
  nextStep:'hold-relative-style-W; do not interpret random +/- rank-change as observed race-order change'
 },
 is_overtake:{
  mechanism:'source-style-parameterized-random-overtake-approximation',
  evaluationDecision:'reject-model-approximation-as-actual-style-evidence',
  nextStep:'requires real position/lane/state observations if this predicate can change a style judgment'
 },
 is_lastspurt:{
  mechanism:'source-computed-spurt-position-state',
  evaluationDecision:'conditionally-adopt-mechanism-meaning-only; hold-skill-W',
  nextStep:'use original spurtParameters and runner position at the same tick, then examine original AND only when relevant'
 }
});
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const fail=(x,what)=>{if(!x)throw Error('P2.37 dynamic-state source: '+what)};
function verifySource(source){
 fail(source?.revision===PIN&&
  ['checker','calculator','skillData'].every(k=>typeof source[k]==='string'),
  'pinned original source text is required');
 const c=source.checker,a=source.calculator,d=source.skillData;
 fail(c.includes('"change_order_onetime" -> condition.checkSpecialState()')&&
  c.includes('"is_overtake" -> condition.checkSpecialState()')&&
  c.includes('"is_lastspurt" -> condition.checkInRaceBool { isInSpurt() }')&&
  c.includes('simulation.specialState[key] ?: 0')&&
  c.includes('val spurtParameters = simulation.spurtParameters ?: return false')&&
  c.includes('spurtParameters.distance + simulation.position >= setting.courseLength'),
  'source skill checker mechanism drift');
 fail(d.includes('"change_order_onetime" to ApproximateRandomRates(')&&
  d.includes('listOf(-1 to 0.2, 1 to 0.2)')&&
  d.includes('"overtake" to ApproximateMultiCondition(')&&
  d.includes('ApproximateStartContinue("逃げ", 0.05, 0.50)')&&
  d.includes('ApproximateStartContinue("先行", 0.15, 0.55)')&&
  d.includes('ApproximateStartContinue("その他", 0.20, 0.60)')&&
  d.includes('"change_order_onetime" to "change_order_onetime"')&&
  d.includes('"is_overtake" to "overtake"'),
  'source approximate-state generation, parameters or type-to-key drift');
 fail(a.includes('if (changeSecond) {')&&
  a.includes('approximateConditions.forEach { entry ->')&&
  a.includes('simulation.specialState[entry.key] = entry.value.update(this, simulation.specialState[entry.key] ?: 0)'),
  'source specialState timed update drift');
 return {mechanismSourceVerified:true,
  observedOriginalRankChangeEvents:0,
  observedOriginalOvertakeEvents:0,
  observedOriginalSpurtAndSkillAND:0};
}
function sourcePredicates(skill,f,type){
 const profile=skill.activationProfile;
 fail(profile?.status==='source-structure'&&
  profile.sourceNumericId===skill.sourceNumericId,
  'original skill/source profile mismatch');
 const inv=profile.invokes?.[f.invokeOffset];
 fail(inv&&inv.index===f.invokeIndex&&
  inv.conditions?.length===f.conditionOrCount&&
  inv.preConditions?.length===f.preconditionOrCount&&
  (profile.invokes.length>1)===f.hasOtherInvokes,
  'original Invoke number, offset or branch cardinality changed');
 const current=inv.conditions[f.conditionOrIndex];
 const pre=f.preconditionOrIndex===null?[]:inv.preConditions[f.preconditionOrIndex];
 fail(Array.isArray(current)&&Array.isArray(pre)&&
  (f.preconditionOrIndex===null)===(inv.preConditions.length===0),
  'original AND/OR or precondition topology changed');
 const matched=[];
 for(const [side,arr] of [['conditions',current],['preConditions',pre]])
  for(const [andOffset,c] of arr.entries())
   if(c.type===type){
    fail(typeof c.operator==='string'&&Number.isSafeInteger(c.value),
     'original predicate operator/value malformed');
    matched.push({side,andOffset,operator:c.operator,value:c.value});
   }
 fail(matched.length>0,'source route no longer contains requested dynamic predicate');
 return matched;
}
function audit(model,queueReport,source){
 const verification=verifySource(source);
 fail(model&&Array.isArray(model.skills)&&isObj(model.skillById)&&
  queueReport?.status===queueModule.STATUS&&
  queueReport.denominators?.appSkills===881&&
  queueReport.denominators?.sourceMatchedSkills===818&&
  queueReport.denominators?.originalRouteFamilies===970&&
  queueReport.denominators?.officialP3OrP4Ratings===0&&
  Array.isArray(queueReport.rows)&&queueReport.rows.length===881,
  'original app, P2.32 route or no-scoring cohort drift');
 const skills=new Map(model.skills.map(x=>[x.id,x]));
 fail(skills.size===881,'duplicate or missing app skills');
 const bySource=new Map();
 for(const type of Object.keys(TYPES))bySource.set(type,[]);
 for(const record of queueReport.rows){
  if(record.status==='source-unavailable')continue;
  const skill=skills.get(record.skillId);
  fail(skill?.activationProfile?.status==='source-structure'&&
   skill.activationProfile.sourceNumericId===record.sourceNumericId,
   'source skill record not identical to P2.32 route');
  for(const f of record.routeFamilies){
   const types=f.unverifiedTypes.filter(type=>Object.hasOwn(TYPES,type));
   for(const type of types){
    const predicates=sourcePredicates({...skill,
     sourceNumericId:record.sourceNumericId},f,type);
    bySource.get(type).push({
     skillId:record.skillId,sourceNumericId:record.sourceNumericId,
     invokeOffset:f.invokeOffset,invokeIndex:f.invokeIndex,
     conditionOrIndex:f.conditionOrIndex,
     preconditionOrIndex:f.preconditionOrIndex,
     hasOtherInvokes:f.hasOtherInvokes,
     researchGroup:f.researchGroup,
     finiteCompatibleStyles:[...f.finiteCompatibleStyles],
     sourcePredicates:predicates,
     otherUnverifiedTypes:f.unverifiedTypes.filter(x=>x!==type),
     mechanism:TYPES[type].mechanism,
     evaluationDecision:TYPES[type].evaluationDecision,
     probabilityOrScore:null,
     wholeSkillSuitability:'not-established'
    });
   }
  }
 }
 const count={};const rows={};
 for(const type of Object.keys(TYPES)){
  const items=bySource.get(type);
  const uniq=new Set(items.map(x=>x.sourceNumericId));
  const researchGroups={};
  for(const x of items)researchGroups[x.researchGroup]=(researchGroups[x.researchGroup]||0)+1;
  count[type]={sourceSkills:uniq.size,originalRouteFamilies:items.length,
   byP232ResearchGroup:researchGroups,
   evaluationDecision:TYPES[type].evaluationDecision,
   nextStep:TYPES[type].nextStep};
  rows[type]=items;
 }
 const expected={change_order_onetime:[30,30],is_overtake:[21,27],
  is_lastspurt:[55,61]};
 for(const [type,[skillsExpected,routesExpected]] of Object.entries(expected))
  fail(count[type].sourceSkills===skillsExpected&&
   count[type].originalRouteFamilies===routesExpected,
   'fixed original source dynamic predicate cohort changed: '+type);
 return {schemaVersion:1,status:STATUS,
  source:{revision:PIN,p232RouteStatus:queueReport.status,
   originalAppSkills:881,sourceMatchedSkills:818,
   ...verification},
  summary:{byOriginalPredicate:count,
   noSourceApproximationsUsedAsRealStyleEvidence:true,
   selectedNewRealGameMeasurements:0,
   originalFullSourceANDProven:0,
   productSkillSuitabilityScores:0},
  rows,
  limitations:[
   'Source status is from a fixed original UmaSim simulation implementation, not a verified original Japanese commercial game engine.',
   'The checker consumes specialState that RaceCalculator regenerates once per second from declared approximations for change_order_onetime and is_overtake.',
   'The source-computed is_lastspurt uses spurtParameters and position, but this does not prove that any particular original skill AND is true.',
   'P2.32 route counts include overlapping skills and OR alternatives; never add them as independent experimental subjects.',
   'No event frequency, model-to-game calibration, validated suitability labels or card/skill score is inferred.'
  ]};
}
module.exports={PIN,STATUS,TYPES,verifySource,sourcePredicates,audit};
