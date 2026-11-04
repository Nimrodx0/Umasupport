/* P2 narrow, factual interpreter of rank-percentage + race phase.
 * The output says WHICH source conditions coexist, never HOW OFTEN a style
 * satisfies them. Preserve alternatives, supplemental restrictions and provenance.
 * No rank-to-style heuristic; no effect usefulness scoring. */
(function(root){
'use strict';
const PHASE_NAMES=['序盤','中盤','終盤前半','終盤後半'];
const PHASE_BOUNDARIES=[0,1/6,2/3,5/6,1];
const TIME_SPECS=Object.freeze({
 phase:{kind:'phase-interval',fraction:0,offset:0},
 phase_random:{kind:'random-within-phase',fraction:0,offset:0},
 phase_firsthalf:{kind:'phase-first-half',fraction:0.5,offset:0},
 phase_firsthalf_random:{kind:'random-within-first-half',fraction:0.5,offset:0},
 phase_laterhalf:{kind:'phase-latter-half',fraction:0.5,offset:0.5},
 phase_laterhalf_random:{kind:'random-within-latter-half',fraction:0.5,offset:0.5},
 phase_firstquarter_random:{kind:'random-within-first-quarter',fraction:0.25,offset:0},
 phase_straight_random:{kind:'random-on-phase-straights',fraction:0,offset:0,courseDependent:true},
 phase_first_half_straight_random:{kind:'random-on-first-half-straights',fraction:0.5,offset:0,courseDependent:true},
 phase_latter_half_straight_random:{kind:'random-on-latter-half-straights',fraction:0.5,offset:0.5,courseDependent:true},
 phase_corner_random:{kind:'random-on-phase-corners',fraction:0,offset:0,courseDependent:true}
});
const CONTEXT=new Set(['running_style','distance_type','ground_type',
 'ground_condition','rotation','track_id','is_basis_distance']);
const OP=new Set(['==','!=','>=','<=','>','<']);
const valid=c=>c&&typeof c.type==='string'&&OP.has(c.operator)&&Number.isSafeInteger(c.value);
const compare=(actual,operator,reference)=>{
 switch(operator){
 case '==':return actual===reference;
 case '!=':return actual!==reference;
 case '>=':return actual>=reference;
 case '<=':return actual<=reference;
 case '>':return actual>reference;
 case '<':return actual<reference;
 default:return false;
 }
};
function timing(c){
 if(!valid(c)||!TIME_SPECS[c.type])return null;
 const spec=TIME_SPECS[c.type],available=[];
 if(c.type==='phase'){
  for(let k=0;k<4;k++)if(compare(k,c.operator,c.value))available.push(k);
 }else if(c.operator==='=='&&c.value>=0&&c.value<=3){
  available.push(c.value);
 }
 if(!available.length)return {type:c.type,operator:c.operator,value:c.value,
  status:'unresolved',reason:'unsupported-or-empty-phase',kind:spec.kind,
  phaseIndexes:[],windows:[]};
 const windows=available.map(k=>{
  const a=PHASE_BOUNDARIES[k],b=PHASE_BOUNDARIES[k+1];
  const len=b-a,part=spec.fraction||1;
  return {phase:k,phaseName:PHASE_NAMES[k],
   startRate:Number((a+len*spec.offset).toFixed(8)),
   endRate:Number((a+len*(spec.offset+part)).toFixed(8))};
 });
 return {type:c.type,operator:c.operator,value:c.value,
  status:'source-defined',kind:spec.kind,
  phaseIndexes:available,windows,courseDependent:!!spec.courseDependent,
  randomWindow:spec.kind.startsWith('random-')};
}
function rankRange(predicates){
 const src=predicates.filter(c=>c.type==='order_rate');
 if(!src.length)return null;
 let lo=null,hi=null;
 const exclusions=[];
 for(const c of src){
  if(!valid(c))throw Error('Invalid rank predicate');
  const v=c.value;
  if(c.operator==='=='||c.operator==='>='||c.operator==='>'){
   const n=c.operator==='>'?v+1:v;
   lo=lo===null?n:Math.max(lo,n);
  }
  if(c.operator==='=='||c.operator==='<='||c.operator==='<'){
   const n=c.operator==='<'?v-1:v;
   hi=hi===null?n:Math.min(hi,n);
  }
  if(c.operator==='!=')exclusions.push(v);
 }
 const empty=(lo!==null&&hi!==null&&lo>hi)||
  (lo!==null&&hi!==null&&hi-lo<exclusions.length+1&&
   Array.from({length:hi-lo+1},(_,k)=>k+lo).every(x=>exclusions.includes(x)));
 return {operatorValues:src.map(c=>({operator:c.operator,value:c.value})),
  lowerInclusive:lo,upperInclusive:hi,excluded:[...new Set(exclusions)].sort((a,b)=>a-b),
  empty,domain:'integer-condition-thresholds-not-race-ranks'};
}
function analyze(record){
 if(!record||!Array.isArray(record.invokes))
  return {status:'unavailable',id:String(record?.id??''),name:record?.name||'',
   pairs:[],reason:'source-invokes-unavailable'};
 const pairs=[];
 const allRestrictions=[];
 for(const invoke of record.invokes)
  for(const side of ['conditions','preConditions'])
   for(const row of invoke[side]||[])
    for(const c of row)if(c.type==='running_style')allRestrictions.push(c);
 for(const [invokeOffset,invoke] of record.invokes.entries()){
  const rows=invoke.conditions||[];
  const pres=invoke.preConditions||[];
  for(const [orIndex,row] of rows.entries()){
   if(!Array.isArray(row)||row.some(c=>!valid(c)))throw Error('Invalid source condition row');
   const ranks=row.filter(c=>c.type==='order_rate');
   const times=row.filter(c=>TIME_SPECS[c.type]);
   if(!ranks.length||!times.length)continue;
   const other=row.filter(c=>c.type!=='order_rate'&&!TIME_SPECS[c.type]);
   const supplemental=other.filter(c=>!CONTEXT.has(c.type));
   const strict=other.filter(c=>CONTEXT.has(c.type));
   const reasons=[];
   if(times.length!==1)reasons.push('multiple-timing-conditions');
   if(supplemental.length)reasons.push('additional-opportunity-conditions');
   if(pres.length)reasons.push('preconditions-not-interpreted');
   if(rows.length>1)reasons.push('or-alternative-exists');
   if(record.invokes.length>1)reasons.push('multiple-invokes');
   if(allRestrictions.length)reasons.push('explicit-running-style-restrictions');
   const timeFacts=times.map(timing);
   if(timeFacts.some(t=>t.status!=='source-defined'))
    reasons.push('unresolved-timing');
   const range=rankRange(ranks);
   if(range.empty)reasons.push('contradictory-rank-range');
   pairs.push({sourceNumericId:record.id,name:record.name,
    invokeIndex:invoke.index??invokeOffset,invokeOffset,orIndex,
    rank:range,timing:timeFacts,
    sourceConditionRow:row.map(c=>({type:c.type,operator:c.operator,value:c.value})),
    preConditions:pres.map(g=>g.map(c=>({type:c.type,operator:c.operator,value:c.value}))),
    explicitRestrictions:strict.map(c=>({type:c.type,operator:c.operator,value:c.value})),
    additionalConditions:supplemental.map(c=>({type:c.type,operator:c.operator,value:c.value})),
    hasAnyExplicitStyleConstraint:allRestrictions.length>0,
    status:reasons.length?'needs-review':'isolated-factual-pair',
    reviewReasons:reasons
   });
  }
 }
 return {status:'source-structure',id:record.id,name:record.name,
  invokeCount:record.invokes.length,hasExplicitStyleConstraint:!!allRestrictions.length,pairs};
}
const api={analyze,timing,rankRange,PHASE_BOUNDARIES,PHASE_NAMES,TIME_SPECS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.UmaSkillRankTiming=api;
})(typeof globalThis!=='undefined'?globalThis:this);
