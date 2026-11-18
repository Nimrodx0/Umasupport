'use strict';
/* P2.36: One additional source rank intersection on the SAME fixed 720
 * balanced races. This never changes the SHA-pinned 11-band reports.
 * The exact original predicates are verified separately by P2.35.
 */
const bounds=require('../src/skill_order_rate_bounds.cjs');
const old=require('./globalsim_phase_random_10m.cjs');
const windowKey='phase_laterhalf_random:1';
const bandId='order>=2_and_order_rate<=50';
const styles=['Nige','Senkou','Sasi','Oikomi'];
const STATUS='P2.36-fixed-replay-narrow-rank-source-partial-model-not-skill-rate';
const round=n=>Number(n.toFixed(6));
function eligibleRanks(fieldSize){
 const base=bounds.andProjection([{type:'order_rate',operator:'<=',value:50}],fieldSize);
 if(base.status!=='rank-subcondition-projection')
  throw Error('P2.36 original top50 integer mapping unresolved');
 const ranks=base.positions.filter(n=>bounds.compare(n,'>=',2));
 const expected=fieldSize===9?[2,3,4,5]:[2,3,4,5,6];
 if(JSON.stringify(ranks)!==JSON.stringify(expected))
  throw Error('P2.36 original AND rank mapping drift');
 return ranks;
}
function collect(){
 const groups=new Map();
 function observe(plan,window,segments,histogram,style){
  if(plan.course.id!==10501||window.key!==windowKey)return;
  if(![9,12].includes(plan.fieldSize)||!['equal','jitter10'].includes(plan.mode)||
   !styles.includes(style)||!Number.isSafeInteger(plan.rep)||
   plan.rep<0||plan.rep>=30)
   throw Error('P2.36 invalid fixed source model context');
  const ranks=new Set(eligibleRanks(plan.fieldSize));
  const start=plan.course.distance*window.startRate,
   end=plan.course.distance*window.endRate;
  const measured=old.measureWindows(segments,ranks,start,end);
  const independent=histogram.rankFractions.reduce((total,amount,i)=>
   total+(ranks.has(i+1)?amount:0),0);
  if(Math.abs(independent-measured.pointOccupancy)>1e-6)
   throw Error('P2.36 original same-tick histogram occupancy disagrees with trajectory');
  const key=[plan.course.id,plan.fieldSize,plan.mode,style].join('|');
  if(!groups.has(key))groups.set(key,{
   courseId:plan.course.id,fieldSize:plan.fieldSize,mode:plan.mode,
   style,all:{n:0,O:0,W:0},first15:{n:0,O:0,W:0},
   last15:{n:0,O:0,W:0}
  });
  const g=groups.get(key);
  for(const k of ['all',plan.rep<15?'first15':'last15']){
   const part=g[k];part.n++;
   part.O+=measured.pointOccupancy;
   part.W+=measured.tenMetreWindowOpportunity;
  }
 }
 function report(){
  const data=[...groups.values()].sort((a,b)=>a.courseId-b.courseId||
   a.fieldSize-b.fieldSize||a.mode.localeCompare(b.mode)||
   a.style.localeCompare(b.style));
  if(data.length!==2*2*styles.length)throw Error('P2.36 missing 16 model contexts');
  const rows=data.map(g=>{
   const U=100*eligibleRanks(g.fieldSize).length/g.fieldSize;
   const summary=k=>{
    const v=g[k];
    if(!v.n||v.W>v.n+1e-8||v.O>v.n+1e-8||v.W+1e-8<v.O)
     throw Error('P2.36 invalid window opportunity/occupancy');
    const O=100*v.O/v.n,W=100*v.W/v.n;
    return {runners:v.n,W:round(W),O:round(O),U:round(U),
     D:round(O-U)};
   };
   const all=summary('all'),first15=summary('first15'),
    last15=summary('last15');
   if(all.runners!==first15.runners+last15.runners||
    all.runners<30||first15.runners<15||last15.runners<15)
    throw Error('P2.36 missing fixed 15+15 observations');
   const avg=(first15.W*first15.runners+last15.W*last15.runners)/
    all.runners;
   if(Math.abs(avg-all.W)>0.00001)
    throw Error('P2.36 split W does not reconstruct full W');
   const oAvg=(first15.O*first15.runners+last15.O*last15.runners)/
    all.runners;
   if(Math.abs(oAvg-all.O)>0.00001)
    throw Error('P2.36 split O does not reconstruct full O');
   return {courseId:g.courseId,fieldSize:g.fieldSize,mode:g.mode,
    style:g.style,windowKey,bandId,
    ranks:eligibleRanks(g.fieldSize),all,first15,last15};
  });
  return {schemaVersion:1,status:STATUS,
   originalModelRaces:720,sourceModelRevision:require('./globalsim_position_pilot.cjs').PIN,
   sourceTimePredicate:{type:'phase_laterhalf_random',operator:'==',value:1},
   sourceRankPredicates:[{type:'order',operator:'>=',value:2},
    {type:'order_rate',operator:'<=',value:50}],
   contextRows:rows,
   limitations:[
    'This is one exact rank intersection on the original fixed skill-free turf GlobalSim model, not a new race scenario.',
    'No source original all-AND activation or real-game event, no full skill rating, no P3 score.',
    'Source order_rate 9/12 field projection is from independently documented secondary semantics.'
   ]};
 }
 return {observe,report};
}
module.exports={STATUS,windowKey,bandId,eligibleRanks,collect};
