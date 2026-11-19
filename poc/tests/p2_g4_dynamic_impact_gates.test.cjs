'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const g4=require('../tools/p2_g4_dynamic_impact_gates.cjs');
const p241=require('../tools/p2_g3g4_combined_short_window_881.cjs');
const p232=require('../src/skill_p2_32_research_queue.cjs');
const p237=require('../src/skill_p2_37_dynamic_state_evidence.cjs');
const SHA=g4.SOURCE_SHA;
const PIN=p237.PIN;
function fixture(){
 const source=[
  {id:'200512',type:'is_lastspurt',extra:['phase_firsthalf_random'],
   flags:{decision:'no-new-short-window-evidence'}},
  {id:'200600',type:'is_lastspurt',extra:['order_rate'],
   flags:{decision:'no-new-short-window-evidence'}},
  {id:'200700',type:'is_overtake',extra:['order_rate'],
   flags:{decision:'no-new-short-window-evidence'}},
  {id:'200701',type:'change_order_onetime',extra:['phase_random'],
   flags:{decision:'conditionally-use-short-window-rank-evidence'}}
 ];
 const joined={schemaVersion:1,status:p241.STATUS,
  sources:{sourceUmaSimSHA256:SHA},
  summary:{appSkills:5,sourceMatched:4,
   directlyModeledSourceSkills:1,sourceExceptionModeledSkills:0,
   uniqueSourceSkillsWithConditionalPartialWDEvidence:1,
   eligibleForP3CardScores:0,productSkillSuitabilityScores:0},
  rows:[...source.map(s=>({
   skillId:'skill:'+s.id,sourceNumericId:s.id,
   decision:s.flags.decision,wholeSkillSuitability:'not-established',
   eligibleForP3CardScoring:false,cardScore:null
  })),{skillId:'hint:unavailable',sourceNumericId:null,
   decision:'no-new-short-window-evidence',wholeSkillSuitability:'not-established',
   eligibleForP3CardScoring:false,cardScore:null}]};
 const routes=source.map(s=>({
  skillId:'skill:'+s.id,sourceNumericId:s.id,
  status:'source-route-research-candidates-only',
  routeFamilies:[{
   invokeOffset:0,invokeIndex:0,conditionOrIndex:0,preconditionOrIndex:null,
   conditionOrCount:1,preconditionOrCount:0,hasOtherInvokes:false,
   finiteCompatibleStyles:['逃げ','先行','差し','追込'],finiteIncompatibleStyles:[],
   unverifiedTypes:[s.type,...s.extra],researchGroup:'event-state-pilot-next'
  }]
 }));
 const queue={schemaVersion:1,status:p232.STATUS,
  source:{revision:PIN,skillRegistrySha256:SHA},
  denominators:{appSkills:5,sourceMatchedSkills:4,sourceUnavailableSkills:1,
   originalRouteFamilies:4,officialP3OrP4Ratings:0},
  rows:[...routes,{skillId:'hint:unavailable',sourceNumericId:null,
   status:'source-unavailable',routeFamilies:[]}]};
 const dyn={schemaVersion:1,status:p237.STATUS,sourceSkillRegistrySHA256:SHA,
  source:{revision:PIN,mechanismSourceVerified:true},
  summary:{byOriginalPredicate:{},
   noSourceApproximationsUsedAsRealStyleEvidence:true,
   productSkillSuitabilityScores:0,originalFullSourceANDProven:0},
  rows:{}};
 for(const type of g4.DYNAMIC){
  dyn.rows[type]=source.filter(x=>x.type===type).map(s=>{
   const f=queue.rows.find(x=>x.sourceNumericId===s.id).routeFamilies[0];
   return {sourceNumericId:s.id,skillId:'skill:'+s.id,
    invokeOffset:0,invokeIndex:0,conditionOrIndex:0,preconditionOrIndex:null,
    hasOtherInvokes:false,researchGroup:f.researchGroup,
    finiteCompatibleStyles:[...f.finiteCompatibleStyles],
    otherUnverifiedTypes:[...s.extra],
    sourcePredicates:[{side:'conditions',andOffset:0,operator:'==',value:1}],
    mechanism:p237.TYPES[type].mechanism,
    evaluationDecision:p237.TYPES[type].evaluationDecision,
    probabilityOrScore:null,wholeSkillSuitability:'not-established'};
  });
  dyn.summary.byOriginalPredicate[type]={
   sourceSkills:dyn.rows[type].length,
   originalRouteFamilies:dyn.rows[type].length,
   evaluationDecision:p237.TYPES[type].evaluationDecision};
 }
 return {joined,queue,dyn};
}
const go=f=>g4.audit(f.joined,f.queue,f.dyn);
test('read-only route decision joins P2.41, P2.32, P2.37 without claiming a source/game rate',()=>{
 const f=fixture(),before=JSON.stringify(f),report=go(f);
 assert.equal(JSON.stringify(f),before);
 assert.equal(report.status,g4.STATUS);
 assert.deepEqual(report.denominators,{
  appSkills:5,sourceMatchedSkills:4,sourceUnavailableSkills:1,
  allOriginalRouteFamilies:4,dynamicPredicateRouteRows:4,
  distinctDynamicSourceRouteIdentities:4,distinctDynamicSourceSkills:4,
  sourceSkillsWithConditionalP241PartialWD:1,
  originalFullANDProvenHere:0,realGameProcMeasurements:0,
  promotedP3OrP4Ratings:0
 });
 assert.equal(report.perType.is_lastspurt.sourceRouteFamilies,2);
 assert.equal(report.perType.change_order_onetime.sourceRouteFamilies,1);
 assert.equal(report.perType.is_overtake.sourceRouteFamilies,1);
 assert.equal(report.routeDecisions.find(r=>r.sourceNumericId==='200512').disposition,
  'already-observed-natural-source-spurt-AND-P2.39');
 assert.equal(report.routeDecisions.find(r=>r.sourceNumericId==='200700').disposition,
  'hold-approximate-source-state-not-real-game-style-evidence');
 assert.equal(report.selectedLimitedStudyRoutes.length,1);
 assert.equal(report.selectedLimitedStudyRoutes[0].sourceNumericId,'200600');
 assert(report.routeDecisions.every(r=>
  r.eligibleForP3CardScoring===false&&r.cardScore===null&&
  r.measuredGameOrModelSkillRate===null&&r.verifiedFourStyleDirection===null&&
  r.fullOriginalSourceANDObserved===false));
});
test('source identity, rank/OR route and P2.37 predicate provenance cannot be silently spliced',()=>{
 const f=fixture();f.dyn.rows.is_lastspurt[1].sourceNumericId='200700';
 assert.throws(()=>go(f),/source skill, route/);
 const g=fixture();g.dyn.rows.is_lastspurt[1].otherUnverifiedTypes=['motivation'];
 assert.throws(()=>go(g),/source skill, route/);
 const h=fixture();h.queue.rows[1].routeFamilies[0].conditionOrIndex=1;
 assert.throws(()=>go(h),/source skill, route/);
 const j=fixture();j.dyn.rows.is_lastspurt[1].sourcePredicates[0].operator='!';
 assert.throws(()=>go(j),/original source skill/);
 const k=fixture();k.joined.rows[1].cardScore=42;
 assert.throws(()=>go(k),/prior full source suitability/);
 const m=fixture();m.dyn.sourceSkillRegistrySHA256='unexpected';
 assert.throws(()=>go(m),/P2.37 pinned original dynamic/);
});
test('single-style, precondition, OR and multiple unknown AND do not auto-enter bounded queue',()=>{
 const f=fixture();const route=f.queue.rows[1].routeFamilies[0];
 route.finiteCompatibleStyles=['先行'];
 f.dyn.rows.is_lastspurt[1].finiteCompatibleStyles=['先行'];
 assert.equal(go(f).selectedLimitedStudyRoutes.length,0);
 assert.equal(go(f).routeDecisions.find(x=>x.sourceNumericId==='200600').disposition,
  'hold-no-multi-style-finite-source-route');
 const g=fixture();g.queue.rows[1].routeFamilies[0].conditionOrCount=2;
 assert.equal(go(g).routeDecisions.find(x=>x.sourceNumericId==='200600').disposition,
  'hold-complex-precondition-OR-or-invoke-not-one-AND');
 const h=fixture();h.queue.rows[1].routeFamilies[0].unverifiedTypes=[
  'is_lastspurt','rank_type','random_extra','blocked_side'];
 h.dyn.rows.is_lastspurt[1].otherUnverifiedTypes=[
  'rank_type','random_extra','blocked_side'];
 assert.equal(go(h).routeDecisions.find(x=>x.sourceNumericId==='200600').disposition,
  'hold-multiple-unverified-AND-dependencies');
});
test('no source-skill aggregation across two routes; one original OR does not prove another',()=>{
 const f=fixture(),q=f.queue.rows[1],old=q.routeFamilies[0];
 const r2={...old,conditionOrIndex:1,conditionOrCount:2};
 q.routeFamilies[0].conditionOrCount=2;
 q.routeFamilies.push(r2);
 f.queue.denominators.originalRouteFamilies++;
 // Even though one dynamic source route has been fully described, another
 // original source OR remains held and this cohort is no longer isolated.
 assert.equal(go(f).routeDecisions.find(x=>x.sourceNumericId==='200600').disposition,
  'hold-complex-precondition-OR-or-invoke-not-one-AND');
});
