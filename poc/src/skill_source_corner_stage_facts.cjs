'use strict';
/*
 * P2.15: pinned UmaSim cornerNumber formula projected onto real GlobalSim
 * PRE-skill priority position using ONLY exactly concordant pinned courses.
 * Full source predicate identity/OR/AND/precondition is kept by caller.
 * UmaSim uses simulation.position, NOT its startPosition, for cornerNumber.
 * No original UmaSim runtime skill proc or Japanese game rank is observed.
 */
const full=require('./skill_full_condition_path_audit.cjs');
const ORIGINAL_REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const MODEL_REV='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const STATUS='P2.15-source-corner-concordant-model-course-geometry-not-game';
const FIXED_COURSE_IDS=Object.freeze([10502,10504]);
const EPS_METRES=1e-6;
const fail=(ok,msg)=>{if(!ok)throw Error('P2.15 source corner: '+msg);};
const STATE_ANCHORS=[
 'val cornerNumber: Int',
 'val corners = setting.trackDetail.corners',
 'corners.indexOfFirst { simulation.position in it.start..it.end }',
 'if (cornerIndex < 0) return 0',
 'return (16 + cornerIndex - corners.size) % 4 + 1'
];
const CHECKER_ANCHOR='"corner" -> condition.checkInRace { cornerNumber }';
const DATA_ANCHOR='internal val rawCourseData = """';
function parseOriginal(original){
 fail(typeof original==='string'&&original.includes(DATA_ANCHOR),
  'pinned UmaSim rawCourseData source required');
 const parts=original.split(DATA_ANCHOR);
 fail(parts.length===2&&parts[1].includes('""".trimIndent()'),
  'unexpected original Kotlin course data encoding');
 let data;
 try{data=JSON.parse(parts[1].split('""".trimIndent()')[0]);}
 catch(e){throw Error('P2.15 source corner: invalid pinned UmaSim course JSON: '+e.message);}
 return data;
}
function verifyPinnedSources(state,checker,originalRawCourseData,modelCourseData){
 fail(typeof state==='string'&&typeof checker==='string'&&
  typeof modelCourseData==='string',
  'source Kotlin and model course text required');
 for(const anchor of STATE_ANCHORS)
  fail(state.includes(anchor),'source cornerNumber changed: '+anchor);
 fail(checker.includes(CHECKER_ANCHOR),
  'original UmaSim corner predicate formula changed');
 const source=parseOriginal(originalRawCourseData);
 let model;
 try{model=JSON.parse(modelCourseData);}
 catch(e){throw Error('P2.15 source corner: invalid model course data: '+e.message);}
 const verified={};
 for(const id of FIXED_COURSE_IDS){
  const code=String(id),m=model[code];
  fail(m&&Number.isSafeInteger(m.raceTrackId)&&
   Number.isSafeInteger(m.distance),'missing fixed GlobalSim course '+code);
  const o=source[String(m.raceTrackId)]?.courses?.[code];
  fail(o&&o.distance===m.distance&&o.surface===m.surface&&
   o.distanceType===m.distanceType,
   'original/model course identity differs: '+code);
  fail(Array.isArray(o.corners)&&o.corners.length>0&&
   o.corners.length===m.corners?.length,
   'source/model corner count changed: '+code);
  const corners=[];
  for(let i=0;i<o.corners.length;i++){
   const a=o.corners[i],b=m.corners[i];
   fail([a.start,a.length,b.start,b.length].every(Number.isFinite)&&
    a.start===b.start&&a.length===b.length&&
    a.start>=0&&a.length>0&&a.start+a.length<=o.distance,
    'original/model corner geometry mismatch at '+code+' index '+i);
   corners.push({start:a.start,end:a.start+a.length});
  }
  verified[code]={distance:m.distance,corners};
 }
 return {status:STATUS,originalUmaSimRevision:ORIGINAL_REV,
  fixedGlobalSimRevision:MODEL_REV,verifiedCourseIds:[...FIXED_COURSE_IDS],
  verifiedCourses:verified,
  originalUmaSimPositionObserved:false,actualGameSkillProcObserved:false,
  geometryConcordanceOnly:true,boundaryGuardMetres:EPS_METRES};
}
function validateEvidence(evidence,plans){
 fail(evidence?.status===STATUS&&
  evidence.originalUmaSimRevision===ORIGINAL_REV&&
  evidence.fixedGlobalSimRevision===MODEL_REV&&
  JSON.stringify(evidence.verifiedCourseIds)===JSON.stringify(FIXED_COURSE_IDS)&&
  evidence.originalUmaSimPositionObserved===false&&
  evidence.actualGameSkillProcObserved===false&&
  evidence.geometryConcordanceOnly===true&&
  evidence.boundaryGuardMetres===EPS_METRES,
  'unverified pinned source corner evidence');
 for(const p of plans){
  const course=evidence.verifiedCourses?.[String(p.course.id)];
  fail(course&&course.distance===p.course.distance&&
   Array.isArray(course.corners)&&course.corners.length>0,
   'unverified fixed course in model race: '+p.course.id);
  for(const c of course.corners)
   fail(Number.isFinite(c.start)&&Number.isFinite(c.end)&&
    c.end>c.start&&c.start>=0&&c.end<=course.distance,
    'invalid verified corner bounds');
 }
 return true;
}
function atModelPosition(position,course){
 fail(Number.isFinite(position)&&course&&
  Number.isSafeInteger(course.distance)&&Array.isArray(course.corners),
  'invalid position or verified course geometry');
 if(position<0||position>=course.distance)return null;
 for(const c of course.corners)
  if(Math.abs(position-c.start)<=EPS_METRES||
   Math.abs(position-c.end)<=EPS_METRES)return null;
 const corners=course.corners;
 const index=corners.findIndex(c=>position>c.start&&position<c.end);
 return index<0?0:(16+index-corners.length)%4+1;
}
function observations(compiled,position,course){
 fail(compiled?.lookup instanceof Map,
  'compiled original source skill predicate AST required');
 const corner=atModelPosition(position,course);
 if(corner===null)return [];
 const facts=[];
 for(const ref of compiled.lookup.values()){
  if(ref.type!=='corner')continue;
  facts.push({...ref,satisfied:full.check(corner,ref.operator,ref.value)});
 }
 return facts;
}
module.exports={STATUS,ORIGINAL_REV,MODEL_REV,FIXED_COURSE_IDS,
 EPS_METRES,STATE_ANCHORS,CHECKER_ANCHOR,parseOriginal,
 verifyPinnedSources,validateEvidence,atModelPosition,observations};
