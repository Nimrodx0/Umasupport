/* P2 read-only evidence: which predicates appear together in a source AND
 * clause versus merely in the same Invoke. No style suitability inference. */
'use strict';
const PHASE_TYPES=new Set(['phase','phase_random','phase_firsthalf',
 'phase_firsthalf_random','phase_laterhalf','phase_laterhalf_random',
 'phase_firstquarter','phase_firstquarter_random','phase_corner_random',
 'phase_straight_random','phase_latter_half_straight_random',
 'phase_first_half_straight_random','distance_rate','distance_rate_after_random']);
const POSITION_TYPES=new Set(['order_rate','order']);
const FOCUS_PAIRS=[
 ['order_rate','phase'],['order_rate','phase_random'],
 ['order_rate','phase_firsthalf_random'],['order_rate','phase_laterhalf_random'],
 ['order_rate','distance_rate'],['order_rate','running_style'],
 ['order_rate','is_overtake'],['order_rate','change_order_onetime'],
 ['order_rate','blocked_side_continuetime'],['order_rate','is_lastspurt'],
 ['order','phase_random'],['is_overtake','phase_random']
];
const field=c=>c.type+c.operator+c.value;
const types=row=>new Set(row.map(x=>x.type));
const pairKey=(a,b)=>[a,b].sort().join(' + ');
function examine(skills,{exampleLimit=5}={}){
 if(!Array.isArray(skills))throw Error('skills must be an array');
 const registry=new Map(),focus={},timeRanks=new Map(),cases={};
 const inc=(map,key,id,example)=>{
  let x=map.get(key);
  if(!x){x={skills:new Set(),occurrences:0,examples:[]};map.set(key,x);}
  x.occurrences++;
  if(!x.skills.has(id)&&x.examples.length<exampleLimit&&example)
   x.examples.push(example);
  x.skills.add(id);
 };
 const addCase=(label,id,example)=>inc(cases,label,id,example);
 let clauseCount=0,rankClauseCount=0,positionWithoutTime=0,
   sameInvokeButDifferentClause=0,multiInvokeRank=0;
 for(const s of skills){
  if(!Array.isArray(s?.invokes))throw Error('Invalid skill invokes: '+s?.id);
  const ident={id:s.id,name:s.name,rarity:s.rarity};
  if(s.invokes.length>1&&s.invokes.some(x=>
    [...(x.conditions||[]),...(x.preConditions||[])]
     .some(row=>row.some(c=>POSITION_TYPES.has(c.type)))))multiInvokeRank++;
  for(const [invokeOffset,invoke] of s.invokes.entries()){
   const clausePairs=new Set(),typesInInvoke=new Set();
   const ctx={...ident,invokeIndex:invoke.index??invokeOffset,
    preConditions:(invoke.preConditions||[]).map(g=>g.map(field)),
    conditions:(invoke.conditions||[]).map(g=>g.map(field))};
   for(const side of ['preConditions','conditions']){
    const rows=invoke[side]||[];
    for(const [orIndex,row] of rows.entries()){
     clauseCount++;
     const observed=[...types(row)].sort();
     const detail={...ctx,side,orIndex,clause:row.map(field)};
     for(const kind of observed)typesInInvoke.add(kind);
     for(let i=0;i<observed.length;i++)for(let j=i+1;j<observed.length;j++){
      const key=pairKey(observed[i],observed[j]);
      clausePairs.add(key);
      inc(registry,key,s.id,detail);
     }
     const rankRows=row.filter(x=>POSITION_TYPES.has(x.type));
     if(!rankRows.length)continue;
     rankClauseCount++;
     const phases=row.filter(x=>PHASE_TYPES.has(x.type));
     if(!phases.length){positionWithoutTime++;addCase('position-without-time-in-same-AND',s.id,detail);}
     for(const rank of rankRows){
      for(const phase of phases){
       const key=field(rank)+' & '+field(phase);
       inc(timeRanks,key,s.id,detail);
      }
      const p=(rank.type==='order_rate'?rank.operator+rank.value:rank.type+rank.operator+rank.value);
      addCase('position:'+p,s.id,detail);
     }
     if(row.some(x=>x.type==='order_rate')&&row.some(x=>x.type==='is_overtake'))
      addCase('rank-and-overtake-in-same-AND',s.id,detail);
     if(row.some(x=>x.type==='order_rate')&&rows.length>1)
      addCase('rank-in-OR-alternatives',s.id,detail);
     if(row.some(x=>x.type==='order_rate')&&s.invokes.length>1)
      addCase('rank-in-multiple-Invoke',s.id,detail);
    }
   }
   const names=[...typesInInvoke].sort();
   for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
    const key=pairKey(names[i],names[j]);
    if(!clausePairs.has(key)){
     sameInvokeButDifferentClause++;
     inc(focus,key+':same-invoke-only',s.id,ctx);
    }
   }
  }
 }
 const reduce=map=>Object.fromEntries([...map.entries()]
  .sort((a,b)=>b[1].skills.size-a[1].skills.size||a[0].localeCompare(b[0]))
  .map(([key,x])=>[key,{skills:x.skills.size,
   occurrences:x.occurrences,examples:x.examples}]));
 const sameAnd=reduce(registry),invokeOnly=reduce(focus),rankTime=reduce(timeRanks);
 const focused=Object.fromEntries(FOCUS_PAIRS.map(([a,b])=>{
  const key=pairKey(a,b);
  return [key,{sameAnd:sameAnd[key]||{skills:0,occurrences:0,examples:[]},
   sameInvokeOnly:invokeOnly[key+':same-invoke-only']||{skills:0,occurrences:0,examples:[]}}];
 }));
 return {skills:skills.length,clauseCount,rankClauseCount,
  positionWithoutTime,sameInvokeButDifferentClause,multiInvokeRank,
  pairKinds:Object.keys(sameAnd).length,
  focused,rankWithPhase:rankTime,
  topPairs:Object.fromEntries(Object.entries(sameAnd).slice(0,50)),
  cases:reduce(cases)};
}
module.exports={examine,PHASE_TYPES,POSITION_TYPES,FOCUS_PAIRS};
