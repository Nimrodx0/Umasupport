'use strict';
/*
 * P2.15 original UmaSim cornerNumber semantics, source-pinned and
 * geometrically verified AGAINST the same model's course_data.json.
 * It is a projection of original source predicates onto actual GlobalSim
 * pre-skill positions, NOT execution of original UmaSim or the real game.
 * The source defines inclusive corner starts/ends and first overlap wins.
 * Near boundaries (source Double vs model telemetry), retain UNKNOWN.
 */
const crypto=require('node:crypto');
const full=require('./skill_full_condition_path_audit.cjs');
const REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const MODEL_REV='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const STATUS='P2.15-original-source-corner-formula-verified-model-course-geometry-not-game';
const EPS_METRES=1e-6;
const IDS=Object.freeze(['10502','10504']);
const SOURCE_CHECKER_ANCHORS=[
 '"corner" -> condition.checkInRace { cornerNumber }'
];
const SOURCE_STATE_ANCHORS=[
 'val cornerNumber: Int',
 'val corners = setting.trackDetail.corners',
 'val cornerIndex = corners.indexOfFirst { simulation.position in it.start..it.end }',
 'if (cornerIndex < 0) return 0',
 'return (16 + cornerIndex - corners.size) % 4 + 1'
];
const SOURCE_TRACK_ANCHORS=[
 'internal val rawCourseData = """',
 '"10502": {',
 '"10504": {'
];
const fail=(ok,msg)=>{if(!ok)throw Error('P2.15 source corner: '+msg);};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function extractOriginal(jsonKotlin){
 fail(typeof jsonKotlin==='string'&&jsonKotlin.length>30000,
  'pinned original UmaSim rawCourseData required');
 fail(jsonKotlin.includes('internal val rawCourseData = """'),
  'original Kotlin raw course literal missing');
 const chunks=jsonKotlin.split('"""');
 fail(chunks.length>=3,'original Kotlin triple quoted data incomplete');
 return JSON.parse(chunks[1]);
}
function sourceCourses(original){
 const ret={};
 for(const id of IDS){
  const matches=Object.values(original).filter(track=>
   track&&typeof track==='object'&&Object.hasOwn(track.courses??{},id));
  fail(matches.length===1,'missing or duplicate original course '+id);
  ret[id]=matches[0].courses[id];
 }
 return ret;
}
function checkCorners(course,courseLength,name){
 fail(course&&course.distance===courseLength&&
  Array.isArray(course.corners)&&course.corners.length>=1&&
  course.corners.length<=4,
  'unexpected geometry for '+name);
 let prev=-1;
 const corners=course.corners.map((x,i)=>{
  fail(Number.isFinite(x.start)&&Number.isFinite(x.length)&&
   x.start>=0&&x.length>0&&x.start+x.length<=courseLength&&
   x.start>=prev,'invalid or unsorted corner '+name+' #'+i);
  prev=x.start;
  return {start:x.start,length:x.length};
 });
 return corners;
}
function verifyPinnedSources(checker,state,rawCourseData,modelCourseData){
 const sourceSet=[
  ['SkillChecker.kt',checker,SOURCE_CHECKER_ANCHORS],
  ['RaceState.kt',state,SOURCE_STATE_ANCHORS],
  ['rawData.kt',rawCourseData,SOURCE_TRACK_ANCHORS]
 ];
 for(const [name,source,anchors] of sourceSet){
  fail(typeof source==='string'&&source.length>1000,'missing '+name);
  for(const anchor of anchors)fail(source.includes(anchor),
   'original pinned '+name+' changed: '+anchor);
 }
 const orig=sourceCourses(extractOriginal(rawCourseData));
 const model=JSON.parse(modelCourseData);
 fail(model&&typeof model==='object'&&!Array.isArray(model),
  'model course_data.json not a map');
 const courses={};
 for(const id of IDS){
  const fromOrig=checkCorners(orig[id],orig[id].distance,'UmaSim '+id);
  const fromModel=checkCorners(model[id],orig[id].distance,'GlobalSim '+id);
  fail(orig[id].distanceType===model[id].distanceType&&
   orig[id].surface===model[id].surface&&
   orig[id].raceTrackId===model[id].raceTrackId,
   'fixed original/model distance/surface/venue conflict '+id);
  fail(JSON.stringify(fromOrig)===JSON.stringify(fromModel),
   'fixed original/model corner intervals disagree '+id);
  courses[id]={courseId:Number(id),length:orig[id].distance,
   corners:fromOrig,sourceGeometryMatched:true};
 }
 return {schemaVersion:1,status:STATUS,originalUmaSimRevision:REV,
  globalSimRevision:MODEL_REV,courseIds:[...IDS],
  originalRawCourseSHA256:sha(rawCourseData),
  modelCourseDataSHA256:sha(modelCourseData),
  originalCheckerFormulaAnchored:true,
  originalRaceStateCornerFormulaAnchored:true,
  exactCourseCornersMatched:true,
  modelPositionIsActualUmaSimSimulationPosition:false,
  actualGameCornerStatusObserved:false,
  sourceSkillProcObserved:false,
  uncertainBoundaryHeldMetres:EPS_METRES,courses};
}
function validateEvidence(evidence){
 fail(evidence?.status===STATUS&&evidence.schemaVersion===1&&
  evidence.originalUmaSimRevision===REV&&evidence.globalSimRevision===MODEL_REV&&
  JSON.stringify(evidence.courseIds)===JSON.stringify(IDS)&&
  /^[a-f0-9]{64}$/.test(evidence.originalRawCourseSHA256)&&
  /^[a-f0-9]{64}$/.test(evidence.modelCourseDataSHA256)&&
  evidence.originalCheckerFormulaAnchored===true&&
  evidence.originalRaceStateCornerFormulaAnchored===true&&
  evidence.exactCourseCornersMatched===true&&
  evidence.modelPositionIsActualUmaSimSimulationPosition===false&&
  evidence.actualGameCornerStatusObserved===false&&
  evidence.sourceSkillProcObserved===false&&
  evidence.uncertainBoundaryHeldMetres===EPS_METRES&&
  evidence.courses&&Object.keys(evidence.courses).sort().join('|')===
   [...IDS].sort().join('|'),
  'unverified corner source/model join provenance');
 for(const id of IDS){
  const x=evidence.courses[id];
  fail(x?.courseId===Number(id)&&
   x.sourceGeometryMatched===true,'invalid course identity '+id);
  checkCorners({distance:x.length,corners:x.corners},x.length,id);
 }
 return true;
}
function numberAtModelPosition(pos,course){
 fail(Number.isFinite(pos)&&course&&
  Number.isSafeInteger(course.length)&&
  course.length>0&&Array.isArray(course.corners),
  'missing actual pre-skill position or verified course geometry');
 if(pos<0||pos>=course.length)return null;
 // Original Kotlin uses inclusive start..end, first corner wins; do not
 // invent a side at boundaries vulnerable to replay precision differences.
 if(course.corners.some(c=>Math.abs(pos-c.start)<=EPS_METRES||
    Math.abs(pos-(c.start+c.length))<=EPS_METRES))return null;
 const n=course.corners.length;
 const index=course.corners.findIndex(c=>
  pos>=c.start&&pos<=c.start+c.length);
 return index<0?0:(16+index-n)%4+1;
}
function observations(compiled,position,courseId,evidence){
 fail(compiled?.lookup instanceof Map,
  'original full skill AST and predicate identities required');
 validateEvidence(evidence);
 const c=evidence.courses[String(courseId)];
 fail(c&&c.courseId===courseId,'unverified fixed course id '+courseId);
 const cornerNumber=numberAtModelPosition(position,c);
 if(cornerNumber===null)return [];
 const facts=[];
 for(const ref of compiled.lookup.values()){
  if(ref.type!=='corner')continue;
  facts.push({...ref,satisfied:full.check(cornerNumber,ref.operator,ref.value)});
 }
 return facts;
}
module.exports={REV,MODEL_REV,STATUS,EPS_METRES,IDS,
 SOURCE_CHECKER_ANCHORS,SOURCE_STATE_ANCHORS,SOURCE_TRACK_ANCHORS,
 extractOriginal,sourceCourses,checkCorners,verifyPinnedSources,validateEvidence,
 numberAtModelPosition,observations};
