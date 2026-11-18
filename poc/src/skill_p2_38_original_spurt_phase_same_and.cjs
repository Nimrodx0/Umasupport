'use strict';
/*
 * P2.38: bounded exact ORIGINAL registered-source skill route audit:
 * 200511 / 200512. This establishes which two original predicates share
 * a current AND and permits the existing pinned Kotlin SkillChecker to be
 * tested on controlled state. It NEVER substitutes those observations for
 * measured spurt occurrence in a race or actual game.
 */
const p237=require('./skill_p2_37_dynamic_state_evidence.cjs');
const timing=require('./skill_rank_timing.js');
const SOURCE_IDS=Object.freeze(['200511','200512']);
const STATUS='P2.38-two-original-source-spurt-and-halfphase-route-identities-not-occurrence';
const fail=(ok,msg)=>{if(!ok)throw Error('P2.38 exact source spurt AND: '+msg)};
const norm=xs=>xs.map(x=>[x.type,x.operator,x.value].join('|')).sort();
function audit(model,queue,p237Evidence){
 fail(model&&Array.isArray(model.skills)&&
  model.skills.length===881&&model.skillById&&
  queue?.status==='P2.32-source-route-research-selection-not-complete-skill-suitability'&&
  queue.denominators?.sourceMatchedSkills===818&&
  queue.denominators?.originalRouteFamilies===970&&
  p237Evidence?.status===p237.STATUS&&
  p237Evidence?.source?.revision===p237.PIN&&
  p237Evidence?.source?.mechanismSourceVerified===true,
  'source cohort or independent fixed P2.37 mechanics not verified');
 const observed=p237Evidence.rows?.is_lastspurt;
 fail(Array.isArray(observed),'original spurt source-route listing missing');
 const sourceSkills=new Map(model.skills.filter(s=>
  s.activationProfile?.status==='source-structure'
 ).map(s=>[s.activationProfile.sourceNumericId,s]));
 const allRoutes=queue.rows;
 const result=SOURCE_IDS.map(id=>{
  const skill=sourceSkills.get(id),profile=skill?.activationProfile;
  const found=observed.filter(x=>x.sourceNumericId===id);
  const q=allRoutes.find(x=>x.sourceNumericId===id);
  fail(skill&&q&&q.skillId===skill.id&&found.length===1,
   'one original source per intended ID is mandatory: '+id);
  const route=found[0],qs=q.routeFamilies;
  fail(profile.sourceNumericId===id&&profile.invokes?.length===1&&
   qs.length===1&&route.invokeOffset===0&&route.invokeIndex===1&&
   route.conditionOrIndex===0&&route.preconditionOrIndex===null&&
   route.hasOtherInvokes===false&&
   route.sourcePredicates.length===1&&
   route.sourcePredicates[0].side==='conditions'&&
   route.sourcePredicates[0].operator==='=='&&
   route.sourcePredicates[0].value===1,
   'original spurt route topology or predicate not isolated: '+id);
  const inv=profile.invokes[0],cond=inv.conditions?.[0];
  fail(inv.index===1&&inv.conditions?.length===1&&
   inv.preConditions?.length===0&&
   Array.isArray(cond)&&cond.length===2&&
   qs[0].conditionOrCount===1&&qs[0].preconditionOrCount===0&&
   qs[0].invokeIndex===1&&qs[0].invokeOffset===0&&
   qs[0].preconditionOrIndex===null&&qs[0].conditionOrIndex===0&&
   qs[0].finiteCompatibleStyles?.length===4,
   'two-condition original AND/OR required: '+id);
  const sp=cond.filter(c=>c.type==='is_lastspurt'),
   time=cond.filter(c=>c.type==='phase_firsthalf_random');
  fail(sp.length===1&&time.length===1&&sp[0].operator==='=='&&
   sp[0].value===1&&time[0].operator==='=='&&
   time[0].value===3,
   'original AND source predicate meaning mismatch: '+id);
  const window=timing.timing(time[0]);
  fail(window?.status==='source-defined'&&
   window.kind==='random-within-first-half'&&
   window.windows?.length===1,
   'original halfphase has no source defined window: '+id);
  fail(norm(cond).join('&&')===
   norm([sp[0],time[0]]).join('&&'),
   'original AND has another operator or value');
  return {appSkillId:skill.id,sourceNumericId:id,skillName:skill.name,
   originalInvokeNumber:inv.index,originalInvokeArrayOffset:0,
   originalConditionOrIndex:0,originalPreconditionOrCount:0,
   sourceANDPredicates:cond.map(c=>({
    type:c.type,operator:c.operator,value:c.value
   })),sourcePhase:time[0].value,
   sourceWindow:{type:time[0].type,...window.windows[0]},
   styleEligibilityGate:'not-excluded-by-four-finite-styles-only',
   originalANDStructureVerified:true,
   originalRegisteredSkillRaceTicksMeasured:0,
   originalSourceCheckerControlledTicksMeasured:0,
   originalDynamicSpurtIncidenceMeasured:0,
   actualGameSkillActivationMeasured:0,
   productSkillOrCardScore:null};
 });
 fail(norm(result[0].sourceANDPredicates).join('&&')===
  norm(result[1].sourceANDPredicates).join('&&')&&
  result[0].sourcePhase===result[1].sourcePhase,
  'the two registered skill IDs do not share the same exact source AND');
 return {schemaVersion:1,status:STATUS,
  source:{originalUmaSimRevision:p237.PIN,originalMatchedSkills:818,
   priorP237Status:p237Evidence.status},
  summary:{skills:2,distinctCurrentAndMechanisms:1,
   sourceOriginalANDMatched:2,originalJvmSpurtObservations:0,
   originalSkillRaceFullANDTrueObservations:0,
   modeledGlobalSimSpurtIncidence:0,
   approvedSkillOrCardSuitabilityScores:0},
  rows:result,
  researchDecision:{
   adopted:'exact-original-is_lastspurt-AND-firsthalf-random-route-and-source-window-meaning',
   conditionalNext:'controlled-original-JVM-checker-truth-table-only-before-observed-spurt-incidence',
   held:'actual-spurt-incidence-by-style-and-whole-skill-W',
   notAdopted:'copying-window-only-W-or-borrowing-other-simulator-race-ticks',
   reopenWhen:'original-spurtParameters-and-position-at-same-runner-tick-are-available-with-race-settings'
  },
  limitations:[
   'Original source matches on exact operator/value and AND/Invoke/OR topology, not proc probability.',
   'An unmodified checker truth-table on artificially set spurt state proves Boolean mechanics, not observed actual race spurt onset.',
   'No GlobalSim frame is aligned to an independently generated UmaSim race tick.',
   'The source is a fixed third-party simulator, not an official game implementation.',
   'No original skill activation frequency, four-style score or P3 card rating.'
  ]};
}
module.exports={SOURCE_IDS,STATUS,audit};
