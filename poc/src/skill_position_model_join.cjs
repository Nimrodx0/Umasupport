/* P2 research-only join from vetted source-condition paths to fixed GlobalSim
 * style/position observations. NO actual skill activation probabilities,
 * model-wide aggregation or production eligibility labels. */
'use strict';
const SIM_REVISION='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const SKILL_REVISION='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const SKILL_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const STYLE_NAMES={'Nige':'逃げ','Senkou':'先行','Sasi':'差し','Oikomi':'追込'};
const COURSES=Object.freeze({
 10501:{metres:1200,distanceType:1},
 10504:{metres:2000,distanceType:3},
 10506:{metres:2500,distanceType:4}
});
const TIMING=Object.freeze({
 'phase_random==1':'middle-full',
 'phase_firsthalf_random==2':'final-first-half',
 'phase_random==2':'final-full',
 'phase_laterhalf_random==2':'final-later-half'
});
const sourceCondition=c=>String(c.type)+String(c.operator)+String(c.value);
const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
function interpret(item){
 if(!isObject(item)||!Array.isArray(item.paths)||!item.paths.length)
  return {status:'unreadable-condition-path',reason:'No isolated vetted source path'};
 if(item.paths.length!==1)
  return {status:'multiple-condition-paths',reason:'OR/invoke alternatives not combined'};
 const p=item.paths[0];
 if(!Array.isArray(p.sourceConditions)||!Array.isArray(p.periods)||
  p.periods.length!==1||!Array.isArray(p.rank?.operatorValues))
  return {status:'unreadable-condition-path',reason:'No exact source condition trace'};
 const period=p.periods[0],windowId=TIMING[
  String(period.code)+String(period.operator)+String(period.value)];
 if(!windowId||period.randomWindow!==true)
  return {status:'unsupported-timing',reason:'No comparable simulator window'};
 const rankCodes=p.rank.operatorValues.map(x=>String(x.operator)+String(x.value));
 const rankSide=rankCodes.length===1&&rankCodes[0]==='<=50'?'top-half':
  rankCodes.length===1&&rankCodes[0]==='>50'?'back-half':null;
 if(!rankSide)return {status:'unsupported-rank',
  reason:'The simulator report only measures <=50 and >50'};
 if(p.rank.empty||p.rank.excluded?.length)
  return {status:'unsupported-rank',reason:'Rank interval not an exact model band'};
 const allowed=new Set([
  'order_rate'+rankCodes[0],
  String(period.code)+String(period.operator)+String(period.value)]);
 const extra=[];
 let distanceType=null;
 for(const c of p.sourceConditions){
  if(allowed.has(sourceCondition(c)))continue;
  if(c.type==='distance_type'&&c.operator==='=='&&
   Number.isSafeInteger(c.value)&&c.value>=1&&c.value<=4&&
   distanceType===null){distanceType=c.value;continue}
  extra.push(c);
 }
 if(extra.length)return {status:'unmodelled-additional-conditions',
  reason:'Additional AND predicates have not been measured',
  additionalConditions:extra.map(c=>({type:c.type,operator:c.operator,value:c.value}))};
 // A source review created for a fully inferred skill already rejects
 // preconditions, multiple invokes, unverified branches and explicit styles.
 // The current gate checks condition fragments again, without changing labels.
 return {status:'rank-condition-comparable',
  windowId,rankSide,distanceType,
  sourceConditions:p.sourceConditions.map(c=>({type:c.type,
   operator:c.operator,value:c.value}))};
}
function verifyInputs(audit,model){
 if(!isObject(audit)||audit.auditVersion!==7||
  audit.source?.revision!==SKILL_REVISION||
  audit.source?.sha256!==SKILL_SHA||
  !isObject(audit.p2StyleReview)||
  !Array.isArray(audit.p2StyleReview.groups)||
  !Number.isSafeInteger(audit.p2StyleReview.total))
  throw Error('Expected exact, vetted pinned P2 source audit');
 const items=audit.p2StyleReview.groups.flatMap(g=>g.skills||[]);
 const seen=new Set();
 if(items.length!==audit.p2StyleReview.total)
  throw Error('P2 review count does not match source');
 for(const s of items){
  if(!s?.sourceNumericId||!s?.name||!s?.id||
   seen.has(s.sourceNumericId)||s.tendency!==undefined&&
   !['逃げ・先行寄り','差し・追込寄り'].includes(s.tendency))
   throw Error('Invalid or repeated skill review identity');
  seen.add(s.sourceNumericId);
 }
 if(!isObject(model)||model.schemaVersion!==1||
  model.status!=='GlobalSim-seed-sensitivity-not-game-skill-activation-rate'||
  model.sourceRevision!==SIM_REVISION||
  !Number.isSafeInteger(model.seedCount)||model.seedCount<1||
  !Array.isArray(model.rows)||model.rows.length!==model.totalCells||
  !Number.isSafeInteger(model.raceCount)||model.raceCount<1)
  throw Error('Expected pinned GlobalSim seed-stability report');
 const keys=new Set();
 for(const row of model.rows){
  const k=[row.courseId,row.fieldSize,row.scenario,row.mode,row.windowId,row.style].join('|');
  if(keys.has(k))throw Error('Repeated model cell '+k);
  keys.add(k);
  if(!Object.hasOwn(COURSES,row.courseId)||![9,12].includes(row.fieldSize)||
   !STYLES.includes(row.style)||!Object.values(TIMING).includes(row.windowId)||
   !Number.isSafeInteger(row.runnerObservations)||row.runnerObservations<0||
   !Number.isSafeInteger(row.racesWithStyle)||row.racesWithStyle<0||
   !['estimate','held-unresolved-runners','no-style-runner-observations'].includes(row.status))
   throw Error('Invalid model cell identity '+k);
  if(row.status==='estimate'?
   !validNumber(row.topHalfPercent)||row.topHalfPercent<0||
    row.topHalfPercent>100:
   row.topHalfPercent!==null)
   throw Error('Invalid model percentage '+k);
 }
 return items;
}
const percentage=n=>Number(n.toFixed(6));
function styleMeasurement(row,side){
 if(!row)return {status:'not-measured'};
 if(row.status!=='estimate')
  return {status:row.status,runners:row.runnerObservations,
   racesWithStyle:row.racesWithStyle};
 let low=null,high=null;
 if(row.bootstrap95?.status==='descriptive-race-block-bootstrap-interval'){
  const b=row.bootstrap95;
  if(!validNumber(b.lowerPercent)||!validNumber(b.upperPercent)||
   b.lowerPercent>b.upperPercent)
   throw Error('Invalid bootstrap interval');
  low=side==='top-half'?b.lowerPercent:percentage(100-b.upperPercent);
  high=side==='top-half'?b.upperPercent:percentage(100-b.lowerPercent);
 }
 return {status:'model-only-position-occupancy',
  positionPercent:side==='top-half'?row.topHalfPercent:
   percentage(100-row.topHalfPercent),
  descriptiveIntervalPercent:low===null?null:[low,high],
  runners:row.runnerObservations,racesWithStyle:row.racesWithStyle};
}
function compare(audit,model){
 const skills=verifyInputs(audit,model);
 const index=new Map(model.rows.map(r=>[[
  r.courseId,r.fieldSize,r.scenario,r.mode,r.windowId,r.style].join('|'),r]));
 const strata=[...new Set(model.rows.map(r=>[
  r.courseId,r.fieldSize,r.scenario,r.mode].join('|')))]
  .map(s=>{const [courseId,fieldSize,scenario,mode]=s.split('|');
   return {courseId:Number(courseId),fieldSize:Number(fieldSize),scenario,mode}})
  .sort((a,b)=>a.courseId-b.courseId||a.fieldSize-b.fieldSize||
   a.scenario.localeCompare(b.scenario)||a.mode.localeCompare(b.mode));
 const cases=skills.map(item=>{
  const interpreted=interpret(item);
  const common={sourceNumericId:item.sourceNumericId,skillId:item.id,
   name:item.name,qualitativeLabel:item.tendency,
   sourceStatus:interpreted.status};
  if(interpreted.status!=='rank-condition-comparable')
   return {...common,status:'not-evaluated',reason:interpreted.reason,
    unsupportedConditions:interpreted.additionalConditions||[],strata:[]};
  const allowed=strata.filter(s=>interpreted.distanceType===null||
   COURSES[s.courseId].distanceType===interpreted.distanceType);
  if(!allowed.length)return {...common,
   status:'no-matching-course',reason:'No matching distance category in the fixed simulator report',
   match:{windowId:interpreted.windowId,rankSide:interpreted.rankSide,
    distanceType:interpreted.distanceType},strata:[]};
  const matches=allowed.map(s=>{
   const values={};
   for(const style of STYLES){
    const k=[s.courseId,s.fieldSize,s.scenario,s.mode,
     interpreted.windowId,style].join('|');
    values[STYLE_NAMES[style]]=styleMeasurement(index.get(k),interpreted.rankSide);
   }
   return {...s,distanceMetres:COURSES[s.courseId].metres,styles:values};
  });
  const comparable=matches.filter(s=>Object.values(s.styles).every(
   x=>x.status==='model-only-position-occupancy')).length;
  return {...common,status:comparable===matches.length?
   'model-conditional-comparison':'partial-model-coverage',
   match:{windowId:interpreted.windowId,rankSide:interpreted.rankSide,
    distanceType:interpreted.distanceType,
    sourceConditions:interpreted.sourceConditions},
   comparableStrata:comparable,totalStrata:matches.length,strata:matches};
 });
 return {schemaVersion:1,status:'research-source-rank-match-not-skill-activation-probability',
  source:{skillRevision:SKILL_REVISION,skillSha256:SKILL_SHA,
   simulatorRevision:SIM_REVISION,simulatedRaceCount:model.raceCount,
   simulatorSeedCount:model.seedCount},
  limitation:'Only exact 50% rank bands and four random-phase windows; no AND event, draw timing, speed effects, or actual Japanese-game activation model.',
  cases,counts:{
   total:cases.length,
   compared:cases.filter(x=>x.status==='model-conditional-comparison').length,
   partial:cases.filter(x=>x.status==='partial-model-coverage').length,
   missingCourse:cases.filter(x=>x.status==='no-matching-course').length,
   notEvaluated:cases.filter(x=>x.status==='not-evaluated').length
  }};
}
module.exports={interpret,verifyInputs,styleMeasurement,compare,
 TIMING,COURSES,STYLES,SKILL_REVISION,SKILL_SHA,SIM_REVISION};
