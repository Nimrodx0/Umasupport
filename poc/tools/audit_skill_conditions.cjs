#!/usr/bin/env node
/* Deliberately manual / PR-scoped real-source audit. No upstream data is
 * published as a repository asset. Machine-readable report remains a CI artifact. */
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const bridge=require('../src/skill_bridge.js');
const loader=require('../src/live_loader.js');
const publicEvents=require('../src/public_event_catalog.js');
const {inventory}=require('../src/skill_condition_inventory.cjs');
const profiles=require('../src/skill_condition_profiles.js');
const combinations=require('../src/skill_condition_combinations.cjs');
const rankTime=require('../src/skill_rank_timing_audit.cjs');
const styleTendency=require('../src/skill_style_tendency.js');
const skillTags=require('../src/skill_condition_tags.js');
const styleReview=require('../src/skill_style_review.cjs');
const coarseReview=require('../src/skill_coarse_style_review.cjs');
const fullPaths=require('../src/skill_full_condition_path_audit.cjs');
const blockerImpact=require('../src/skill_source_path_blocker_impact.cjs');
const phaseSource=require('../src/skill_phase_random_source_window_audit.cjs');
const venueAudit=require('../src/skill_track_id_venue_audit.cjs');
const halfFeasibility=require('../src/skill_halfphase_feasibility.cjs');
const researchTriage=require('../src/skill_condition_research_triage.cjs');
const specOmission=require('../src/skill_condition_spec_omission.cjs');
const researchQueue=require('../src/skill_p2_32_research_queue.cjs');
const mechanismReuse=require('../src/skill_p2_32_mechanism_reuse.cjs');
const axisGates=require('../src/skill_p2_15_parameterized_axis_gates.cjs');
const rankRandomHandoff=require('../src/skill_p2_15_rank_random_same_and_handoff.cjs');
const mixedResearch=require('../src/skill_condition_mixed_cohort.cjs');
const rankCorner=require('../src/skill_rank_corner_source_cohort.cjs');
const changeOrderSource=require('../src/skill_change_order_source_paths.cjs');
const REVISION=process.env.UMASIM_REVISION||'f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const BASE='https://raw.githubusercontent.com/mee1080/umasim/'+REVISION+'/data/';
const get=async url=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('upstream HTTP '+response.status+': '+url);
 return await response.text();
};
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
function matchedRecord(skill,live,old){
 const name=norm(skill.name);
 const numeric=skill.sourceNumericId||(/^skill:(\d+)$/.exec(skill.id)||[])[1];
 if(numeric){
  const cur=live.byId.get(String(numeric)),pin=old.byId.get(String(numeric));
  return cur?.name===name?{record:cur,source:'live'}:pin?.name===name?{record:pin,source:'pinned'}:null;
 }
 if(skill.id.startsWith('hint:')){
  const matches=live.byName.get(name)||[];
  return matches.length===1?{record:matches[0],source:'live'}:null;
 }
 return null;
}
(async()=>{
 const [skillText,supportText,pinnedText,umaCourseText,
  globalCourseText,umaSkillCheckerText]=await Promise.all([
  get(BASE+'skill_data.txt'),get(BASE+'support_card.txt'),get(bridge.PINNED_URL),
  get('https://raw.githubusercontent.com/mee1080/umasim/'+REVISION+
   '/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/data/rawData.kt'),
  get('https://raw.githubusercontent.com/daftuyda/GlobalSim/'+
   '80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1/data/course_data.json'),
  get('https://raw.githubusercontent.com/mee1080/umasim/'+REVISION+
   '/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt')]);
 const raw=JSON.parse(skillText.replace(/^\uFEFF/,''));
 const pinnedRaw=JSON.parse(pinnedText.replace(/^\uFEFF/,''));
 const source=bridge.parseSource(skillText),old=bridge.parseSource(pinnedText);
 const whole=inventory(raw);
 const model=loader.buildModel(supportText,{mode:'online'});
 const published=JSON.parse(fs.readFileSync('poc/data/reviewed_events.v1.json','utf8'));
 publicEvents.attach(model,published,{skillText,pinnedSkillText:pinnedText,
  fullRegistry:true,allowReviewedLegacy:true});
 const seen=new Map(),unknown=[],sourceCounts={live:0,pinned:0};
 for(const skill of model.skills){
  const found=matchedRecord(skill,source,old);
  if(!found){unknown.push({id:skill.id,name:skill.name});continue;}
  const record=(found.source==='live'?raw:pinnedRaw).find(r=>r.id===found.record.id);
  if(!record)throw Error('Parsed registry ID absent from original: '+found.record.id);
  sourceCounts[found.source]++;
  seen.set(record.id,record);
 }
 const relevant=inventory([...seen.values()]);
 const p2Triage=researchTriage.examine(whole,relevant,
  {matchedRecords:[...seen.values()]});
 const mixed=mixedResearch.analyze([...seen.values()]);
 const pilotCandidates=rankCorner.inspect([...seen.values()]);
 const changeOrder=changeOrderSource.audit([...seen.values()]);
 if(changeOrder.summary.sourceSkills!==30)throw Error('Original change_order_onetime source cohort changed: '+changeOrder.summary.sourceSkills);
 if(pilotCandidates.summary.absoluteOrder.distinctSkills!==34||
    pilotCandidates.summary.cornerRank.distinctSkills!==13)
  throw Error('Fixed candidate population unexpected: '+
   JSON.stringify(pilotCandidates.summary));

 if(mixed.mixedSkills!==p2Triage.summary.matchedSkillStructure.candidateAndDeferredMixed)
  throw Error('P2 mixed cohort no longer matches independent triage population');

 const applied=profiles.attach(model,{skillText,pinnedSkillText:pinnedText});
 if(applied.matched!==relevant.shape.valid||
    applied.unavailable!==unknown.length||applied.noActivationRecord!==0)
   throw Error('P1 profile coverage mismatch with independent P0 cohort: '+
    JSON.stringify(applied));
 const profileTags=model.skills.filter(s=>s.activationProfile?.angleTags?.length).length;
 if(profileTags!==relevant.shape.withTags)
   throw Error('P1 bracket-label mismatch against P0 inventory: '+
     profileTags+' != '+relevant.shape.withTags);
 const profileByAxis={};
 for(const skill of model.skills)for(const invoke of skill.activationProfile?.invokes||[])
  for(const side of ['preConditions','conditions'])
   for(const orGroup of invoke[side])for(const c of orGroup)
    if(c.axis)profileByAxis[c.axis]=(profileByAxis[c.axis]||0)+1;
 const combosAll=combinations.examine(raw);
 const combosApp=combinations.examine([...seen.values()]);
 if(combosAll.skills!==whole.total||combosApp.skills!==relevant.total)
  throw Error('P2 combination audit source-population mismatch');
 const rankTimingAll=rankTime.cohort(raw);
 const rankTimingApp=rankTime.cohort([...seen.values()]);
 if(rankTimingAll.totalRecords!==whole.total||
    rankTimingApp.totalRecords!==relevant.total)
  throw Error('P2 rank-timing cohort denominator drift');
 const cardsBefore=JSON.stringify(model.cards);
 const styleApp=styleTendency.attach(model);
 if(cardsBefore!==JSON.stringify(model.cards))
  throw Error('P2 inference mutated card/event/hint catalog');
 if(styleApp.total!==model.skills.length||styleApp.unavailable!==unknown.length)
  throw Error('P2 style tendency app coverage mismatch: '+JSON.stringify(styleApp));
 const allInferredReview=styleReview.summarize(model);
 const skillBySkill=coarseReview.report(model);
 const halfPhaseStudy=halfFeasibility.cohort(model);
 const p215=fullPaths.audit(model);
 // P2.32: pinned model specification can justify CONDITIONAL axis comparison
 // without simulation. Preserve full source branches; never apply omissions.
 const p232=specOmission.audit(model);
 if(p232.denominators.appSkills!==p215.denominators.appSkills||
    p232.denominators.sourceMatchedSkills!==p215.denominators.sourceMatched||
    p232.denominators.sourceUnavailableSkills!==p215.denominators.unavailable||
    p232.denominators.actualAppliedOmissions!==0||
    p232.denominators.officialSkillOrCardRatings!==0)
  throw Error('P2.32 original-source app cohort or research-only boundary drift');
 const p215Blockers=blockerImpact.audit(model,
  [...new Set(changeOrder.paths.map(x=>x.sourceNumericId))]);
 const p232Queue=researchQueue.audit(model,{
  blockerReport:p215Blockers,specReport:p232
 });
 if(p232Queue.denominators.sourceMatchedSkills!==
    p215Blockers.denominators.sourceMatchedSkills||
    p232Queue.denominators.actualAppliedOmissions!==0||
    p232Queue.denominators.officialP3OrP4Ratings!==0)
  throw Error('P2.32 route research queue cohort or no-scoring boundary changed');
 const p232Mechanism=mechanismReuse.audit(model,p232Queue);
 if(p232Mechanism.denominators.sourceRouteFamilies!==
    p232Queue.denominators.originalRouteFamilies||
    p232Mechanism.denominators.formalSkillCardSuitabilityRatings!==0||
    p232Mechanism.denominators.sourceRouteWholeActivationProofs!==0||
    p232Mechanism.denominators.actualAppliedOmissions!==0)
  throw Error('P2.32 evidence mechanism grouping cohort or research-only boundary changed');
 const p215AxisGates=axisGates.audit(model,p232Mechanism);
 if(p215AxisGates.denominators.sourceRouteFamilies!==
    p232Mechanism.denominators.sourceRouteFamilies||
    p215AxisGates.denominators.completedWholeSkillConditionEvaluations!==0||
    p215AxisGates.denominators.officialSkillCardSuitabilityScores!==0||
    p215AxisGates.denominators.actualAppliedOmissions!==0)
  throw Error('P2.15 source parameterized axis-gate cohort or no-scoring boundary drift');
 const p215RankRandom=rankRandomHandoff.audit(model,p215AxisGates);
 if(p215RankRandom.denominators.sourceMatchedSkills!==
    p215AxisGates.denominators.sourceMatchedSkills||
    p215RankRandom.denominators.observedOriginalSourceRandomDraws!==0||
    p215RankRandom.denominators.provenCompleteOriginalSkillActivation!==0||
    p215RankRandom.denominators.officialP3P4SuitabilityEvaluations!==0)
  throw Error('P2.15 rank-random source-AND handoff research boundary changed');
 const p215Phase=phaseSource.audit(model,p215Blockers,umaSkillCheckerText);
 const sourceVenueCourses=venueAudit.verifyFixedCourses(
  umaCourseText,globalCourseText,umaSkillCheckerText);
 const sourceVenueAudit=venueAudit.audit(model,sourceVenueCourses);
 if(sourceVenueAudit.scope.matchedSourceSkills!==818||
    sourceVenueAudit.scope.sourceUnmatchedSkills!==63||
    sourceVenueAudit.scope.fixedModelCourses!==12||
    sourceVenueAudit.summary.provenWholeSkillActivations!==0)
  throw Error('P2.15 source venue audit population changed');

 if(p215Blockers.denominators.sourceMatchedSkills!==818||
    p215Blockers.denominators.sourceUnmatchedSkills!==63||
    p215Blockers.denominators.allSourceStyleCells!==3272||
    p215Blockers.denominators.signedRankSourceSkills!==30||
    Object.values(p215Blockers.byMinimumUnknownTypeCount)
      .reduce((a,b)=>a+b,0)!==3272)
  throw Error('P2.15 source blocker research population drift');
 for(const row of p215Blockers.rows){
  const old=p215.rows.find(x=>x.sourceNumericId===row.sourceNumericId);
  if(!old)throw Error('P2.15 blocker lost original skill');
  for(const style of fullPaths.STYLES){
   const previous=old.byStyle[style.name].status;
   const now=row.byStyle[style.name].status;
   if((previous==='all-recorded-paths-explicitly-exclude-style')!==
      (now==='no-finite-domain-compatible-route'))
    throw Error('P2.15 blocker contradicts fixed style exclusion: '+
     row.sourceNumericId+' '+style.name);
  }
 }
 const explicitlyExcluded=Object.values(p215.byStyles)
  .reduce((n,statuses)=>n+(statuses['all-recorded-paths-explicitly-exclude-style']||0),0);
 if(explicitlyExcluded!==skillBySkill.perStyleCounts['explicit-ineligible'])
  throw Error('P2.15 full-source explicit exclusions disagree with P2 coarse audit: '+
   explicitlyExcluded+' != '+skillBySkill.perStyleCounts['explicit-ineligible']);
 if(p215.denominators.appSkills!==881||p215.denominators.sourceMatched!==818||
    p215.denominators.unavailable!==63||
    p215.denominators.reportedStylePathCells!==
      p215.denominators.reportedPathRows*4)
  throw Error('P2.15 source-path structure population drift: '+
   JSON.stringify(p215.denominators));
 if(halfPhaseStudy.baseline.appSkills!==skillBySkill.appSkillCount||
    halfPhaseStudy.baseline.sourceMatched!==skillBySkill.sourceMatchedSkills||
    halfPhaseStudy.baseline.heldSkills!==skillBySkill.skillCoverage.held)
  throw Error('Source half-phase feasibility cohort disagrees with per-skill review');
 if(skillBySkill.appSkillCount!==881||skillBySkill.sourceMatchedSkills!==818||
  skillBySkill.skillCoverage.unavailable!==63)
  throw Error('Coarse four-style review did not preserve fixed app cohort');
 if(allInferredReview.total!==styleApp.inferred)
  throw Error('P2 review list lost inferred skills');
 const sourceStyles=raw.map(rec=>{
  const inference=styleTendency.infer({
   status:'source-structure',sourceNumericId:rec.id,
   invokes:rec.invokes,angleTags:skillTags.recognized(rec.info)});
  return {id:rec.id,name:rec.name,inference};
 });
 const styleFull={total:sourceStyles.length,
  statuses:{},labels:{},reviewReasons:{},examples:{front:[],back:[],
   needsReview:[],explicitOnly:[],notInferable:[]}};
 const inc=(obj,k)=>{obj[k]=(obj[k]||0)+1;};
 for(const item of sourceStyles){
  const x=item.inference;
  inc(styleFull.statuses,x.status);
  if(x.status==='inferred'){
   inc(styleFull.labels,x.label);
   const examples=x.basisRuleIds[0]===styleTendency.RULES.FRONT.id?
    styleFull.examples.front:styleFull.examples.back;
   if(examples.length<12)examples.push({id:item.id,name:item.name,
     ruleIds:x.basisRuleIds,sourceConditions:x.branches[0].sourceConditions});
  }else{
   if(x.reason)inc(styleFull.reviewReasons,x.reason);
   const list=x.status==='explicit-only'?styleFull.examples.explicitOnly:
    x.status==='not-inferable'?styleFull.examples.notInferable:
    styleFull.examples.needsReview;
   if(list.length<12)list.push({id:item.id,name:item.name,reason:x.reason});
  }
 }
 const mustAgree=[
  ['201052','逃げ・先行寄り'],['200702','差し・追込寄り'],
  ['202312','逃げ・先行寄り'],
  ['202311','逃げ・先行寄り'],
  ['202672','逃げ・先行寄り'],['202671','逃げ・先行寄り']];
 for(const [id,expected] of mustAgree){
  const found=sourceStyles.find(x=>x.id===id);
  if(!found||found.inference.status!=='inferred'||found.inference.label!==expected)
   throw Error('P2 named skill regression: '+id+' != '+expected+
    ' (actual '+JSON.stringify(found?.inference)+')');
 }
 for(const id of ['200542','200592']){
  const found=sourceStyles.find(x=>x.id===id);
  if(!found||found.inference.status!=='explicit-only')
   throw Error('P2 explicit-style card wrongly inferred: '+id);
 }
 // The full and app cohorts must never silently acquire a 75%-based
 // four-style eligibility classification. The late-phase opportunity
 // is contextual evidence, not a proven style likelihood threshold.
 for(const [id,expectedEnd] of [['202312',0.83333333],['202311',0.83333333],
  ['202672',0.75],['202671',0.75]]){
  const found=sourceStyles.find(x=>x.id===id);
  const actual=found?.inference?.branches?.[0]?.timingContext?.latestPossibleRate;
  if(actual!==expectedEnd)throw Error('P2 phase window boundary mismatch '+id+': '+actual);
 }
 if(styleApp.broadLateFront!==undefined)
  throw Error('Obsolete broad-late-front eligibility cohort still present');
 if(styleFull.total!==Object.values(styleFull.statuses).reduce((a,b)=>a+b,0))
  throw Error('P2 style tendency full count mismatch');
 const report={
  auditVersion:7,source:{revision:REVISION,sha256:digest(skillText),
   pinnedRevision:bridge.PINNED_URL.split('/')[5],pinnedSha256:digest(pinnedText),
   supportRevision:REVISION,supportSha256:digest(supportText)},
  fullRegistry:whole,
  p2Combinations:{all:combosAll,app:combosApp},
  p2RankTiming:{all:rankTimingAll,app:rankTimingApp},
  p2StyleTendency:{all:styleFull,app:styleApp},
  p2StyleReview:allInferredReview,
  app:{cards:model.cards.length,skills:model.skills.length,
   matchedEntries:seen.size,unmatched:unknown.length,unmatchedExamples:unknown.slice(0,25),
   sourceCounts,inventory:relevant,profiles:{...applied,profileTags,profileByAxis}}
 };
 if(whole.shape.invalid||relevant.shape.invalid)
  throw Error('Unexpected malformed source skill predicates: '+whole.shape.invalid+'/'+relevant.shape.invalid);
 fs.writeFileSync('skill-condition-inventory-audit.json',JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync('p2-change-order-source-paths.json',
  JSON.stringify({source:{revision:REVISION,sha256:digest(skillText)},...changeOrder},null,2)+'\n');
 console.log('P2_CHANGE_ORDER_SOURCE_PATHS_START');
 console.log(JSON.stringify(changeOrder.summary,null,2));
 console.log('P2_CHANGE_ORDER_SOURCE_PATHS_END');
 fs.writeFileSync('p2-rank-corner-source-cohort.json',
  JSON.stringify({source:{revision:REVISION,sha256:digest(skillText)},...pilotCandidates},
  null,2)+'\n');
 console.log('P2_RANK_CORNER_CANDIDATES_START');
 console.log(JSON.stringify(pilotCandidates.summary,null,2));
 console.log('P2_RANK_CORNER_MEASURABLE_PATHS_START');
 console.log(JSON.stringify(pilotCandidates.paths.filter(x=>x.feasibility!=='held-source-window-or-compound')
  .map(x=>({id:x.sourceNumericId,candidate:x.candidate,
   index:x.sourceCornerIndex,time:x.timingPredicates,
   rank:x.rankPredicates,explicit:x.explicitPredicates,
   other:x.otherAndTypes,side:x.side,
   orCount:x.siblingORCount,preCount:x.preconditionsGroups,
   invokes:x.invokeCount})),null,2));
 console.log('P2_RANK_CORNER_MEASURABLE_PATHS_END');
 console.log('P2_RANK_CORNER_CANDIDATES_END');
 fs.writeFileSync('p2-mixed-rank-deferred-audit.json',
  JSON.stringify({source:{revision:REVISION,sha256:digest(skillText)},...mixed},
   null,2)+'\n');
 console.log('P2_MIXED_RANK_COHORT_SUMMARY_START');
 console.log(JSON.stringify({mixedSkills:mixed.mixedSkills,
  byRelation:mixed.byRelation,byDeferredType:mixed.byDeferredType,
  cases:mixed.cases.map(c=>({sourceNumericId:c.sourceNumericId,
   skillName:c.skillName,cohort:c.cohort,
   allRankTypes:c.allRankTypes,allDeferredTypes:c.allDeferredTypes,
   sameAndRows:c.sameAndRows}))},null,2));
 console.log('P2_MIXED_RANK_COHORT_SUMMARY_END');
 fs.writeFileSync('p2-halfphase-feasibility.json',
  JSON.stringify({source:report.source,...halfPhaseStudy},null,2)+'\n');
 console.log('P2_HALF_PHASE_FEASIBILITY_START');
 console.log(JSON.stringify({status:halfPhaseStudy.status,
  baseline:halfPhaseStudy.baseline,counts:halfPhaseStudy.counts,
  halfTimingRowsByType:halfPhaseStudy.halfTimingRowsByType,
  directExamples:halfPhaseStudy.examples.filter(x=>x.paths.some(p=>p.direct)).slice(0,8).map(x=>({
   skillId:x.skillId,name:x.name,
   time:x.paths.filter(p=>p.direct).map(p=>p.timeType)}))},null,2));
 console.log('P2_HALF_PHASE_FEASIBILITY_END');
 fs.writeFileSync('p2-15-track-venue-context.json',
  JSON.stringify({dataSource:{
   umaSimRevision:REVISION,umaSimCourseSourceSha256:digest(umaCourseText),
   umaSimSkillCheckerSourceSha256:digest(umaSkillCheckerText),
   globalSimCourseSourceSha256:digest(globalCourseText)},
   ...sourceVenueAudit},null,2)+'\n');
 console.log('P2_15_TRACK_VENUE_CONTEXT='+JSON.stringify({
  scope:sourceVenueAudit.scope,summary:sourceVenueAudit.summary
 }));
 fs.writeFileSync('p2-15-phase-random-window-shape.json',
  JSON.stringify({source:{
   revision:REVISION,skillRegistrySha256:digest(skillText),
   originalSkillCheckerSha256:digest(umaSkillCheckerText)},...p215Phase},
   null,2)+'\n');
 console.log('P2_15_PHASE_RANDOM_SOURCE_WINDOW='+JSON.stringify(p215Phase.summary));
 fs.writeFileSync('p2-15-source-blocker-impact.json',
  JSON.stringify({source:{revision:REVISION,sha256:digest(skillText)},
   ...p215Blockers},null,2)+'\n');
 console.log('P2_15_SOURCE_BLOCKER_IMPACT='+JSON.stringify({
  denominators:p215Blockers.denominators,
  byMinimumUnknownTypeCount:p215Blockers.byMinimumUnknownTypeCount,
  zeroTypeBlockerSourceSkills:p215Blockers.zeroTypeBlockerSourceSkills,
  oneTypeBlockerSourceSkills:p215Blockers.oneTypeBlockerSourceSkills,
  signedRankCohort:p215Blockers.cohortByMinimumUnknownTypeCount,
  mostPromisingSingleTypes:p215Blockers.impactIfOneTypeCouldBeMeasured.slice(0,20)
 }));
 fs.writeFileSync('p2-15-rank-random-same-and-handoff.json',
  JSON.stringify({source:{
   revision:REVISION,skillRegistrySha256:digest(skillText),
   supportRegistrySha256:digest(supportText)},...p215RankRandom},null,2)+'\n');
 console.log('P2_15_RANK_RANDOM_SAME_AND='+JSON.stringify({
  denominators:p215RankRandom.denominators,
  firstGroups:p215RankRandom.byExactSourceFamily.slice(0,10),
  examples:p215RankRandom.candidates.slice(0,8).map(c=>({
   id:c.sourceNumericId,invoke:c.invokeIndex,OR:c.conditionOrIndex,
   family:c.familyId,pre:c.originalHistoricalPreconditionANDSize,
   modelNine:c.supportedRankPanels.find(p=>p.fieldSize===9),
   otherTypes:c.otherCurrentUnknownOrContextTypes
  }))
 }));
 fs.writeFileSync('p2-15-parameterized-axis-gates.json',
  JSON.stringify({source:{revision:REVISION,
   skillRegistrySha256:digest(skillText),
   supportRegistrySha256:digest(supportText)},...p215AxisGates},null,2)+'\n');
 console.log('P2_15_PARAMETERIZED_AXIS_GATES='+JSON.stringify({
  denominators:p215AxisGates.denominators,
  firstDistinctFamilyPatterns:p215AxisGates.familyStaticPatternSummaries
   .filter(x=>x.distinctAxisGatePatterns>1).slice(0,10)
 }));
 fs.writeFileSync('p2-32-mechanism-reuse-families.json',
  JSON.stringify({source:{revision:REVISION,
   skillRegistrySha256:digest(skillText),
   supportRegistrySha256:digest(supportText)},...p232Mechanism},null,2)+'\n');
 console.log('P2_32_MECHANISM_REUSE='+JSON.stringify({
  denominators:p232Mechanism.denominators,
  selectedFamilies:p232Mechanism.initialMechanismFamilyPilots,
  mostCommonFamilies:p232Mechanism.mechanismFamilies.slice(0,10).map(g=>({
   familyId:g.familyId,types:g.mechanismTypes,
   sourceSkills:g.distinctSourceSkills,variants:g.distinctExactNumericParameterSets,
   existingEvidence:g.priorP215Evidence.map(e=>[e.type,e.status]),
   next:g.nextMechanismResearchAction
  }))
 }));
 fs.writeFileSync('p2-32-source-route-research-queue.json',
  JSON.stringify({source:{revision:REVISION,
   skillRegistrySha256:digest(skillText),
   supportRegistrySha256:digest(supportText)},...p232Queue},null,2)+'\n');
 console.log('P2_32_SOURCE_ROUTE_PRIORITY='+JSON.stringify({
  denominators:p232Queue.denominators,
  byResearchGroup:p232Queue.byResearchGroup,
  leadingTypes:p232Queue.nextTypeResearch.slice(0,18),
  firstStudySample:p232Queue.initialP215Pilots,
  leadingRoutes:p232Queue.priorityRouteCandidates.slice(0,12).map(r=>({
   id:r.sourceNumericId,invoke:r.invokeIndex,
   conditionOr:r.conditionOrIndex,preconditionOr:r.preconditionOrIndex,
   group:r.researchGroup,types:r.unverifiedTypes,
   styles:r.finiteCompatibleStyles,
   fixedStateRequired:r.fixedStateAssumptionsRequired
  }))
 }));
 fs.writeFileSync('p2-32-spec-conditional-omission.json',
  JSON.stringify({source:{
   revision:REVISION,skillRegistrySha256:digest(skillText),
   pinnedSkillRegistrySha256:digest(pinnedText),
   supportRegistrySha256:digest(supportText)},...p232},null,2)+'\n');
 console.log('P2_32_SPEC_CONDITIONAL_OMISSION='+JSON.stringify({
  denominators:p232.denominators,byClassification:p232.byClassification
 }));
 fs.writeFileSync('p2-15-full-condition-paths.json',
  JSON.stringify({source:{revision:REVISION,sha256:digest(skillText),
   pinnedSha256:digest(pinnedText),supportSha256:digest(supportText)},...p215},
  null,2)+'\n');
 console.log('P2_15_FULL_PATH_AUDIT_SUMMARY='+JSON.stringify({
  denominators:p215.denominators,shape:p215.shape,byStyles:p215.byStyles,
  mostFrequentUnverifiedTypes:p215.sourceConditionTypesOnNonExcludedPaths.slice(0,18),
  preconditionTypes:p215.typesInPreconditions.slice(0,12)}));
 fs.writeFileSync('p2-skill-coarse-four-style-review.json',
  JSON.stringify({source:report.source,...skillBySkill},null,2)+'\n');
 console.log('P2_COARSE_SKILL_REVIEW_SUMMARY_START');
 console.log(JSON.stringify({status:skillBySkill.status,
  appSkills:skillBySkill.appSkillCount,
  sourceMatched:skillBySkill.sourceMatchedSkills,
  coverage:skillBySkill.skillCoverage,
  perStyleCounts:skillBySkill.perStyleCounts},null,2));
 console.log('P2_COARSE_SKILL_REVIEW_SUMMARY_END');
 fs.writeFileSync('p2-condition-research-triage.json',
  JSON.stringify({source:report.source,...p2Triage},null,2)+'\n');
 console.log('P2_CONDITION_TRIAGE_SUMMARY_START');
 console.log(JSON.stringify({
  summary:p2Triage.summary,
  topAppTypes:p2Triage.byType.slice(0,30).map(x=>({
   type:x.type,matchedSkills:x.appMatchedSkills,
   group:x.group,treatment:x.treatment
  }))},null,2));
 console.log('P2_CONDITION_TRIAGE_SUMMARY_END');
 const mini=v=>({total:v.total,shape:v.shape,
  conditionTypes:v.counts.distinctConditionTypes,
  occurrences:v.counts.occurrences,
  candidateExplicitConditionTypes:v.counts.candidateExplicitConditionTypes,
  operators:v.counts.operators,
  invokeCounts:v.counts.invokeCounts,
  matrixShapes:v.counts.matrixShapes,
  tagTypes:v.counts.tagTypes,
  tags:Object.fromEntries(Object.entries(v.counts.tags).slice(0,45)),
  types:Object.fromEntries(Object.entries(v.counts.byType).map(([t,z])=>[t,{
   occurrences:z.occurrences,skills:z.skills,operators:z.operators,
   distinctValues:z.values.length,valuesSample:z.values.slice(0,15),examples:z.examples.slice(0,2)
  }]))});
 console.log('SKILL_CONDITION_P0_REPORT_START');
 console.log(JSON.stringify({source:report.source,
  all:mini(whole),
  app:{...report.app,unmatchedExamples:unknown.slice(0,10),inventory:mini(relevant)}},null,2));
 console.log('SKILL_CONDITION_P0_REPORT_END');
 const compact=x=>({skills:x.skills,clauseCount:x.clauseCount,
  rankClauseCount:x.rankClauseCount,positionWithoutTrackedPhase:x.positionWithoutTrackedPhase,
  multiInvokeRank:x.multiInvokeRank,pairKinds:x.pairKinds,
  focused:Object.fromEntries(Object.entries(x.focused).map(([k,v])=>[k,{
   andSkills:v.sameAnd.skills,invokeOnlySkills:v.sameInvokeOnly.skills,
   andExamples:v.sameAnd.examples.slice(0,4),
   invokeOnlyExamples:v.sameInvokeOnly.examples.slice(0,2)}])),
  rankWithPhase:Object.fromEntries(Object.entries(x.rankWithPhase).slice(0,30)
   .map(([k,v])=>[k,{skills:v.skills,examples:v.examples.slice(0,2)}])),
  cases:Object.fromEntries(Object.entries(x.cases)
   .filter(([k])=>!k.startsWith('position:')).map(([k,v])=>
    [k,{skills:v.skills,examples:v.examples.slice(0,5)}])),
  topPairs:Object.fromEntries(Object.entries(x.topPairs).slice(0,25)
   .map(([k,v])=>[k,{skills:v.skills}]))});
 console.log('SKILL_CONDITION_P2_REPORT_START');
 console.log(JSON.stringify({full:compact(combosAll),app:compact(combosApp)},null,2));
 console.log('SKILL_CONDITION_P2_REPORT_END');
 console.log('SKILL_RANK_TIMING_P2_REPORT_START');
 const rankMini=x=>({totalRecords:x.totalRecords,withRankTimePair:x.withRankTimePair,
  withoutRankTimePair:x.withoutRankTimePair,totalPairs:x.totalPairs,
  isolatedPairs:x.isolatedPairs,needsReviewPairs:x.needsReviewPairs,
  isolatedWithoutExplicitStyle:x.isolatedWithoutExplicitStyle,
  reviewReasons:x.reviewReasons,byTimeCode:x.byTimeCode,byPhase:x.byPhase,
  byRankConstraint:x.byRankConstraint,
  topPairEntries:Object.entries(x.byPair).slice(0,30),
  samples:x.samples});
 console.log(JSON.stringify({full:rankMini(rankTimingAll),app:rankMini(rankTimingApp)},null,2));
 console.log('SKILL_RANK_TIMING_P2_REPORT_END');
 console.log('SKILL_STYLE_TENDENCY_P2_REPORT_START');
 console.log(JSON.stringify({all:styleFull,app:styleApp,
  checkedNamedSkills:mustAgree},null,2));
 console.log('SKILL_STYLE_TENDENCY_P2_REPORT_END');
 console.log('SKILL_STYLE_REVIEW_P2_REPORT_START');
 console.log(JSON.stringify(allInferredReview,null,2));
 console.log('SKILL_STYLE_REVIEW_P2_REPORT_END');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
