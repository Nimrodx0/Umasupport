'use strict';
/*
 * Previously obtained P2.15 evidence, scoped by original predicate TYPE.
 * This is a mechanism-reuse inventory, NOT proof that a source skill
 * satisfied its whole AND/OR/Invoke or that the game behaves like GlobalSim.
 *
 * Statuses are deliberately narrower than generic "researched":
 *  - selected-model-tick: source meaning mapped to GlobalSim ticks in a
 *    fixed (typically 253 source skills / 8 artificial races) cohort.
 *  - geometry-counterfactual: fixed-source window construction and
 *    counterfactual positions, NOT actual UmaSim draws at the source tick.
 *  - source-static-context: fixed-course source mapping, limited course set.
 *  - conditional-fixed-state: condition can be held fixed for axis contrast
 *    when source predicate is satisfied, not removed from actual activation.
 *  - no-specific-mechanism-evidence: no automatic inference.
 */
const DEFINITIONS=Object.freeze({
 running_style:{
  status:'source-finite-eligibility',
  facet:'Source running_style operator evaluated against one of four finite style IDs; necessary eligibility contradiction only',
  references:['skill-p2-15-full-path-gate-audit-20261111.md'],
  limitation:'Style eligibility restriction is not a model observation of an entire source route.'
 },
 distance_type:{
  status:'source-finite-eligibility',
  facet:'Source distance-type operator checked for satisfiability within the four finite distance classes',
  references:['skill-p2-15-full-path-gate-audit-20261111.md'],
  limitation:'A finite-domain possibility is not evidence of dynamic condition conjunction at any specific course.'
 },
 ground_type:{
  status:'source-finite-eligibility',
  facet:'Source turf/dirt condition checked against its finite domain as an explicit gate',
  references:['skill-p2-15-full-path-gate-audit-20261111.md'],
  limitation:'Do not infer racecourse-specific running dynamics from turf/dirt eligibility.'
 },
 ground_condition:{
  status:'source-finite-eligibility',
  facet:'Source ground-state operator finite-domain feasibility check only',
  references:['skill-p2-15-full-path-gate-audit-20261111.md'],
  limitation:'The actual track-condition state was not observed in the fixed GlobalSim races.'
 },
 order_rate:{
  status:'selected-model-tick',
  facet:'GlobalSim pre-skill model rank plus externally documented 9/12-runner order_rate boundary',
  references:['skill-p2-15-source-rank-plus-distance-20261112.md','skill-p2-15-rank-position-full-join-20261113.md'],
  limitation:'Fixed UmaSim checker ignores order_rate; this is neither original runtime verification nor a whole-source-AND measurement.'
 },
 order:{
  status:'selected-model-tick',
  facet:'GlobalSim pre-skill absolute position/rank observation and source-operator-preserving conditional interpretation',
  references:['skill-p2-15-rank-position-full-join-20261113.md'],
  limitation:'Fixed UmaSim checker ignores order; game-specific semantics and out-of-cohort applicability are not established.'
 },
 distance_rate:{
  status:'selected-model-tick',
  facet:'Source distance-rate condition applied to same-runner pre-skill GlobalSim position tick in selected 253-skill cohort',
  references:['skill-p2-15-source-distance-rate-real-ticks-20261112.md'],
  limitation:'Position-based no-skill model evaluation, not runtime skill activation or all skills.'
 },
 phase:{
  status:'selected-model-tick',facet:'Source phase condition mapped to selected GlobalSim position ticks',
  references:['skill-p2-15-source-position-family-join-20261113.md'],
  limitation:'Only selected distance_rate cohort and studied course boundaries; not a general runtime claim.'
 },
 phase_firsthalf:{
  status:'selected-model-tick',facet:'Source half-phase condition mapped to selected GlobalSim ticks',
  references:['skill-p2-15-source-position-family-join-20261113.md'],
  limitation:'Do not conflate phase_firsthalf with phase_firsthalf_random draw semantics.'
 },
 phase_laterhalf:{
  status:'selected-model-tick',facet:'Source latter-half phase condition mapped to selected GlobalSim ticks',
  references:['skill-p2-15-source-position-family-join-20261113.md'],
  limitation:'Do not conflate phase_laterhalf with phase_laterhalf_random.'
 },
 remain_distance:{
  status:'selected-model-tick',facet:'Source remaining-distance expression at selected pre-skill GlobalSim ticks',
  references:['skill-p2-15-source-position-family-join-20261113.md'],
  limitation:'Requires course/rounding/source boundary equivalence; no game trigger rate.'
 },
 furlong:{
  status:'selected-model-tick',facet:'Source 200m furlong expression at selected pre-skill GlobalSim ticks',
  references:['skill-p2-15-source-position-family-join-20261113.md'],
  limitation:'Model tick observation is not a whole-source-skill runtime check.'
 },
 corner:{
  status:'selected-model-tick',facet:'Source cornerNumber mapped to two source-matched model course positions',
  references:['skill-p2-15-source-corner-full-join-20261113.md'],
  limitation:'Only source-matched two model courses, corner NUMBER rather than corner_random draw.'
 },
 phase_random:{
  status:'geometry-counterfactual',
  facet:'UmaSim source random window formula plus full-uniform-draw geometry against observed no-skill GlobalSim positions; separately GlobalSim equipped sample rank+window AND',
  references:[
   'skill-p2-15-phase-random-source-window-20261112.md',
   'skill-p2-15-original-phase-draw-support-20261112.md',
   'skill-p2-15-equipped-phase-rank-conjunction-20261112.md'
  ],
  limitation:'The equipped sample is GlobalSim, not source UmaSim skills. No original-skill draw and entire AND at same source runtime tick.'
 },
 track_id:{
  status:'source-static-context',
  facet:'Source raceTrackId distinguished from course ID; fixed 12 model courses checked',
  references:['skill-p2-15-track-id-venue-static-gate-20261112.md'],
  limitation:'Partial static eligibility only; 12 courses cannot generalize to all courses or dynamic AND.'
 },
 motivation:{
  status:'conditional-fixed-state',
  facet:'Pinned UmaSim pre-race condition value; same satisfying motivation value fixed across style/distance/surface contrast',
  references:['skill-p2-32-game-spec-omission-20261113.md'],
  limitation:'A conditional comparison shortcut, not an unconditional source predicate or actual occurrence probability.'
 }
});
const DEFAULT=Object.freeze({
 status:'no-specific-mechanism-evidence',
 facet:'Only source predicate presence/type-level triage is available in this mechanism reuse registry.',
 references:[],
 limitation:'No mechanism or full-source-route validation is inferred. Older evidence may need manual assessment before new simulations.'
});
const docsPrefix='docs/evidence/skills/';
const known=x=>Object.hasOwn(DEFINITIONS,x);
function forType(type){
 if(typeof type!=='string'||!type)throw Error('P2.32 mechanism: invalid type');
 const def=known(type)?DEFINITIONS[type]:DEFAULT;
 return {type,status:def.status,facet:def.facet,
  evidencePaths:def.references.map(x=>docsPrefix+x),
  limitation:def.limitation,
  originalSourcePredicateEvaluatedForAllSkills:false,
  fullSourceANDProven:false,
  autoSuitableForP3:false};
}
function forTypes(types){
 if(!Array.isArray(types)||types.some(x=>typeof x!=='string'||!x))
  throw Error('P2.32 mechanism: malformed type list');
 return [...new Set(types)].sort().map(forType);
}
module.exports={DEFINITIONS,DEFAULT,forType,forTypes};
