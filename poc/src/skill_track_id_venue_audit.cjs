'use strict';
/*
 * P2.15 source-exact track_id VENUE mapping in fixed model courses.
 * Research metadata only. track_id is preChecked against raceTrackId
 * (track / venue), not against the individual course ID.
 *
 * Static matching of an original AND + one original precondition alternative
 * never proves a full skill proc or a real-game rate.
 */
const fs=require('node:fs');
const full=require('./skill_full_condition_path_audit.cjs');
const fixed=require('../tools/globalsim_roster32.cjs');
const blockers=require('./skill_source_path_blocker_impact.cjs');
const STATIC=new Set(['running_style','distance_type','ground_type','track_id']);
const STATUS='P2.15-source-track-venue-static-gate-not-whole-skill-proc';
const uniq=x=>[...new Set(x)].sort();
function parseSourceCourses(raw){
 if(typeof raw!=='string')throw Error('Original UmaSim Kotlin course source required');
 const match=/internal\s+val\s+rawCourseData\s*=\s*"""\s*([\s\S]*?)\s*"""/.exec(raw);
 if(!match)throw Error('UmaSim rawCourseData not found in original source');
 const parsed=JSON.parse(match[1]),map=new Map();
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
  throw Error('Invalid UmaSim track data map');
 for(const [venueKey,venue] of Object.entries(parsed)){
  if(!/^\d+$/.test(venueKey)||!venue||
   !venue.courses||typeof venue.courses!=='object')
   throw Error('Invalid UmaSim source venue');
  for(const [courseKey,detail] of Object.entries(venue.courses)){
   if(!/^\d+$/.test(courseKey)||map.has(courseKey)||!detail||
    !Number.isSafeInteger(detail.raceTrackId)||
    String(detail.raceTrackId)!==venueKey||
    !Number.isSafeInteger(detail.distance)||
    ![1,2,3,4].includes(detail.distanceType)||
    ![1,2].includes(detail.surface)||
    !Number.isSafeInteger(detail.turn))
    throw Error('Source course / raceTrackId mismatch: '+courseKey);
   map.set(courseKey,{courseId:Number(courseKey),
    venueId:detail.raceTrackId,surface:detail.surface,
    distanceType:detail.distanceType,distance:detail.distance,turn:detail.turn});
  }
 }
 if(map.size<fixed.COURSES.length)throw Error('Incomplete source courses');
 return map;
}
function verifyFixedCourses(umaRaw,globalRaw,checkerRaw){
 const canonical='"track_id" -> condition.preChecked(baseSetting.trackDetail.raceTrackId)';
 if(typeof checkerRaw!=='string'||!checkerRaw.includes(canonical))
  throw Error('Original UmaSim track_id runtime semantic changed');
 const original=parseSourceCourses(umaRaw);
 const glob=JSON.parse(globalRaw);
 if(!glob||typeof glob!=='object'||Array.isArray(glob))
  throw Error('Original GlobalSim registry missing');
 const out=[],seen=new Set();
 for(const course of fixed.COURSES){
  const key=String(course.id);
  const u=original.get(key),g=glob[key];
  if(!u||!g||seen.has(key)||
   u.venueId!==g.raceTrackId||
   u.surface!==g.surface||
   u.distance!==g.distance||
   u.distanceType!==g.distanceType||
   u.turn!==g.turn||
   u.distance!==course.distance||
   u.distanceType!==course.distanceType||
   u.surface!==(course.surface==='turf'?1:2))
   throw Error('UmaSim/GlobalSim fixed course mapping drift: '+key);
  seen.add(key);
  out.push({...u});
 }
 if(out.length!==12||new Set(out.map(x=>x.courseId)).size!==12)
  throw Error('Fixed model course scope unexpectedly changed');
 return out.sort((a,b)=>a.courseId-b.courseId);
}
function conjunctions(skill){
 const p=skill.activationProfile;
 if(!p||p.status!=='source-structure'||!Array.isArray(p.invokes))
  return [];
 const branches=[];
 for(const [invokeOffset,invoke] of p.invokes.entries()){
  if(!Array.isArray(invoke.conditions)||!Array.isArray(invoke.preConditions))
   throw Error('Malformed original source AND/OR');
  const pre=invoke.preConditions.length?invoke.preConditions:[[]];
  for(const [orIndex,terms] of invoke.conditions.entries())
   for(const [preIndex,prior] of pre.entries()){
    if(!Array.isArray(terms)||!Array.isArray(prior))
     throw Error('Invalid original source AND/precondition OR');
    const all=[...terms,...prior];
    if(!all.some(x=>x?.type==='track_id'))continue;
    for(const q of all)
     if(!q||typeof q.type!=='string'||
      !['==','!=','>','>=','<','<='].includes(q.operator)||
      !Number.isSafeInteger(q.value))
      throw Error('Invalid original source static predicate');
    branches.push({
     invokeOffset,orIndex,
     preconditionOrIndex:invoke.preConditions.length?preIndex:null,
     originalTrackPredicateCount:all.filter(x=>x.type==='track_id').length,
     isTrackInPrecondition:prior.some(x=>x.type==='track_id'),
     isTrackInNormalCondition:terms.some(x=>x.type==='track_id'),
     unmeasuredOtherTypes:uniq(all.filter(x=>!STATIC.has(x.type))
      .map(x=>x.type)),
     all
    });
   }
 }
 return branches;
}
function evaluateSourceFixedCourse(terms,styleId,course){
 if(![1,2,3,4].includes(styleId)||
  !course||!Number.isSafeInteger(course.venueId)||
  ![1,2].includes(course.surface)||
  ![1,2,3,4].includes(course.distanceType))
  throw Error('Invalid fixed style/course');
 if(full.checkCombination(terms,styleId)!=='not-excluded-by-known-domains')
  return false;
 const context={running_style:styleId,
  distance_type:course.distanceType,
  ground_type:course.surface,track_id:course.venueId};
 return terms.filter(x=>STATIC.has(x.type)).every(x=>
  full.check(context[x.type],x.operator,x.value));
}
function audit(app,courses){
 if(!app||!Array.isArray(app.skills)||!app.skillById||
  !Array.isArray(courses)||courses.length!==12||
  new Set(courses.map(c=>c.courseId)).size!==12)
  throw Error('P2.15 venue audit requires matched app and 12 validated courses');
 const sourceCells=[],rows=[];
 let matched=0,unmatched=0,seenNames=new Set();
 const summary={
  matchedSourceSkillsWithTrackPredicate:0,
  trackPredicateSourceBranches:0,
  trackPredicatePreconditionBranches:0,
  trackPredicateNormalBranches:0,
  sourceStyleCellsWithTrackPredicate:0,
  sourceStyleCellsWithSomeCompatibleFixedCourse:0,
  sourceStyleCellsWithoutCompatibleFixedCourse:0,
  singletonTrackCandidateSourceStyleCells:0,
  singletonTrackCandidateStyleCellsWithCompatibleCourse:0,
  sourceSkillsWithAnyCompatibleFixedCourse:0,
  singletonTrackCandidateSourceSkillsWithCompatibleCourse:0,
  provenWholeSkillActivations:0
 };
 const validatedSources=new Set(),candidateSkills=new Set();
 for(const skill of app.skills){
  if(!skill||typeof skill.id!=='string'||seenNames.has(skill.id))
   throw Error('Duplicate or malformed app skill identity');
  seenNames.add(skill.id);
  if(skill.activationProfile?.status!=='source-structure'){unmatched++;continue;}
  matched++;
  const id=skill.activationProfile.sourceNumericId;
  if(!/^\d+$/.test(id))throw Error('Non-numeric original source skill');
  const branches=conjunctions(skill);
  if(!branches.length)continue;
  summary.matchedSourceSkillsWithTrackPredicate++;
  summary.trackPredicateSourceBranches+=branches.length;
  summary.trackPredicatePreconditionBranches+=
   branches.filter(b=>b.isTrackInPrecondition).length;
  summary.trackPredicateNormalBranches+=
   branches.filter(b=>b.isTrackInNormalCondition).length;
  const blockersByStyle=blockers.analyzeSkill(skill).byStyle;
  const byStyle={};
  for(const style of full.STYLES){
   const candidates=branches.map(branch=>{
    const compatible=courses.filter(c=>evaluateSourceFixedCourse(
     branch.all,style.id,c)).map(c=>c.courseId);
    return {invokeOffset:branch.invokeOffset,
     conditionOrIndex:branch.orIndex,
     preconditionOrIndex:branch.preconditionOrIndex,
     sourceTrackPredicateCount:branch.originalTrackPredicateCount,
     trackConditionSide:branch.isTrackInPrecondition?
      branch.isTrackInNormalCondition?'both':'preConditions':'conditions',
     compatibleFixedCourseIds:compatible,
     otherUnmeasuredConditionTypes:branch.unmeasuredOtherTypes,
     disposition:'fixed-venue-and-known-static-gate-only-no-skill-proc'};
   });
   const compatibleIds=uniq(candidates.flatMap(c=>c.compatibleFixedCourseIds));
   const any=compatibleIds.length>0;
   const isSingleton=blockersByStyle[style.name]
    .singleTypeResearchCandidates.includes('track_id');
   summary.sourceStyleCellsWithTrackPredicate++;
   if(any){
    summary.sourceStyleCellsWithSomeCompatibleFixedCourse++;
    validatedSources.add(id);
   }else summary.sourceStyleCellsWithoutCompatibleFixedCourse++;
   if(isSingleton){
    summary.singletonTrackCandidateSourceStyleCells++;
    if(any){
     summary.singletonTrackCandidateStyleCellsWithCompatibleCourse++;
     candidateSkills.add(id);
    }
   }
   byStyle[style.name]={
    sourceCompatibleFixedVenueCourseIds:compatibleIds,
    hasSomeCompatibleFixedCourse:any,
    singletonTrackTypeResearchCandidate:isSingleton,
    branches:candidates
   };
  }
  rows.push({sourceNumericId:id,sourceInvokeCount:skill.activationProfile.invokes.length,
   originalTrackBranches:branches.length,byStyle});
 }
 if(matched!==818||unmatched!==63||seenNames.size!==881||
  summary.sourceStyleCellsWithTrackPredicate!==
   4*summary.matchedSourceSkillsWithTrackPredicate||
  summary.sourceStyleCellsWithSomeCompatibleFixedCourse+
   summary.sourceStyleCellsWithoutCompatibleFixedCourse!==
    summary.sourceStyleCellsWithTrackPredicate)
  throw Error('P2.15 venue source cohort changed');
 summary.sourceSkillsWithAnyCompatibleFixedCourse=validatedSources.size;
 summary.singletonTrackCandidateSourceSkillsWithCompatibleCourse=
  candidateSkills.size;
 return {schemaVersion:1,status:STATUS,
  source:{umaSimSkillSha256:fixed.SOURCE_SHA,
   globalSimRevision:fixed.PIN,
   trackPredicate:'UmaSim SkillChecker condition.preChecked(baseSetting.trackDetail.raceTrackId)',
   courseSource:'UmaSim rawCourseData raceTrackId; crosschecked against GlobalSim course_data raceTrackId'},
  scope:{matchedSourceSkills:matched,sourceUnmatchedSkills:unmatched,
   fixedModelCourses:courses.length,fixedModelVenues:new Set(
    courses.map(c=>c.venueId)).size,
   courseVenueMapping:courses},
  summary,rows,
  limitations:[
   'track_id compares a venue raceTrackId (100xx), not a unique course key (101xx/105xx/etc).',
   'The audited 12 fixed artificial model courses cannot establish compatibility for other courses/venues.',
   'Original AND plus one preConditions OR branch is tested only for track_id and static style/distance/surface. Ground condition, other terms, and temporal preconditions remain untested.',
   'Another Invoke/OR branch may omit track_id; absence of a matching tracked branch never proves the whole skill is ineligible.',
   'A source skill/style cell matching an eligible course is NOT a completed skill-activation observation or rate.',
   'No game proc, random timing, global rank-time W or D=O-U, P3 card suitability or public UX is inferred.'
  ]};
}
function main(args){
 if(args.length!==4)throw Error('Usage: source_track_id_venue.cjs <source-rawData.kt> <global-course_data.json> <source-SkillChecker.kt> <model-catalog.json>');
 const [raw,glob,checker,modelFile]=args;
 const courses=verifyFixedCourses(fs.readFileSync(raw,'utf8'),
  fs.readFileSync(glob,'utf8'),fs.readFileSync(checker,'utf8'));
 const app=JSON.parse(fs.readFileSync(modelFile,'utf8'));
 const result=audit(app,courses);
 console.log('P2_15_TRACK_VENUE_SCOPE='+JSON.stringify({
  mapping:courses.map(c=>({courseId:c.courseId,venueId:c.venueId})),
  summary:result.summary}));
}
module.exports={STATUS,parseSourceCourses,verifyFixedCourses,conjunctions,
 evaluateSourceFixedCourse,audit};
