#!/usr/bin/env node
'use strict';
/* Source-derived aggregate inventory for integer rank boundaries.
 * No third-party skill dictionary content is stored in the repo artifact.
 * Pure ranking subconditions are never conflated with full skill activation. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const m=require('../src/skill_order_rate_bounds.cjs');
const REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const PINNED='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const id=x=>String(x.id);
const key=c=>c.operator+String(c.value);
function audit(records){
 if(!Array.isArray(records)||!records.length)
  throw Error('Missing UmaSim source registry');
 const seen=new Set(),terms=new Map(),cohorts=[];
 const totals={sourceSkills:0,skillsWithOrderRate:0,
  rankTerms:0,rankAndRows:0,rankPreconditionRows:0,
  compoundRankRows:0,rowsWithAdditionalAndConditions:0,
  zeroBoundaryHeld9:0,zeroBoundaryHeld12:0,
  emptyProjected9:0,emptyProjected12:0,
  conditionsWithDifferent9vs12Boundaries:0};
 for(const skill of records){
  if(!skill||!Array.isArray(skill.invokes)||!skill.id||seen.has(id(skill)))
   throw Error('Malformed or duplicate source skill');
  seen.add(id(skill));totals.sourceSkills++;
  let hasRank=false;
  for(const invoke of skill.invokes){
   for(const side of ['conditions','preConditions']){
    const rows=invoke[side]||[];
    if(!Array.isArray(rows))throw Error('Missing OR branches');
    for(const row of rows){
     if(!Array.isArray(row))throw Error('Malformed AND row');
     const rr=row.filter(x=>x?.type==='order_rate');
     if(!rr.length)continue;
     hasRank=true;totals.rankAndRows++;
     if(side==='preConditions')totals.rankPreconditionRows++;
     if(rr.length>1)totals.compoundRankRows++;
     if(row.length>rr.length)totals.rowsWithAdditionalAndConditions++;
     const projection=m.byField(row);
     const small=projection.byField[9],large=projection.byField[12];
     if(small.status==='held-unverified-boundary')totals.zeroBoundaryHeld9++;
     if(large.status==='held-unverified-boundary')totals.zeroBoundaryHeld12++;
     if(small.status==='rank-subcondition-empty-under-reference-mapping')
      totals.emptyProjected9++;
     if(large.status==='rank-subcondition-empty-under-reference-mapping')
      totals.emptyProjected12++;
     const distinct=[...new Set(rr.map(key))];
     if(cohorts.length<16&&rr.length>1)cohorts.push({
      skillId:id(skill),side,
      predicateTokens:rr.map(c=>c.operator+c.value),
      ranks9:small.positions,ranks12:large.positions,
      nonRankAndCount:row.length-rr.length
     });
     for(const cond of rr){
      totals.rankTerms++;
      const k=key(cond);
      if(!terms.has(k))terms.set(k,{operator:cond.operator,
       value:cond.value,occurrences:0,skillIds:new Set(),bySource:{}});
      const t=terms.get(k);
      t.occurrences++;t.skillIds.add(id(skill));
      t.bySource[side]=(t.bySource[side]||0)+1;
      if(m.cutoff(9,cond.value)!==m.cutoff(12,cond.value))
       totals.conditionsWithDifferent9vs12Boundaries++;
     }
   }
  }
  }
  if(hasRank)totals.skillsWithOrderRate++;
 }
 const byOperatorValue=[...terms.values()].map(t=>{
  const c={type:'order_rate',operator:t.operator,value:t.value};
  const converted=Object.fromEntries([9,12].map(n=>{
   const x=m.predicate(c,n);
   return [n,{status:x.status,boundary:x.boundary,positions:x.positions}];
  }));
  return {sourceOperator:t.operator,sourceValue:t.value,
   sourceCode:t.operator+String(t.value),
   occurrences:t.occurrences,uniqueSkills:t.skillIds.size,
   inActivationOrPrecondition:t.bySource,
   integerRankProjection:converted};
 }).sort((a,b)=>b.uniqueSkills-a.uniqueSkills||
  b.occurrences-a.occurrences||a.sourceCode.localeCompare(b.sourceCode));
 return {schemaVersion:1,
  status:'source-pinned-aggregate-rank-projections-not-skill-activation-probabilities',
  source:{repository:'mee1080/umasim',revision:REV,
   skillDictionarySha256:PINN},
  rankMapping:m.SOURCE,version:m.VERSION,
  fields:[9,12],totals,byOperatorValue,
  compoundRowExamples:cohorts,
  examples:[
   {sourcePredicate:'order_rate<=50',
    nine:m.andProjection([{type:'order_rate',operator:'<=',value:50}],9).positions,
    twelve:m.andProjection([{type:'order_rate',operator:'<=',value:50}],12).positions},
   {sourcePredicate:'order_rate>=40 && order_rate<=80',
    nine:m.andProjection([{type:'order_rate',operator:'>=',value:40},
     {type:'order_rate',operator:'<=',value:80}],9).positions,
    twelve:m.andProjection([{type:'order_rate',operator:'>=',value:40},
     {type:'order_rate',operator:'<=',value:80}],12).positions}
  ],
  limitations:[
   'Only the 9/12 fields have reference cross-checks, not 18-runner numerical assertions.',
   'UmaSim SkillChecker.kt ignores order_rate. The conversion is supported by GameTora documentation and the existing GlobalSim model, not a directly verified Japan client implementation.',
   'AND/OR projection is rank-only. Non-rank conditions, per-runner race context and skill activation opportunities have not been evaluated.',
   'Position occupied as fraction of course is not game activation probability.',
   'Rank cutoff 0 under extremely small percentages is held, not artificially clamped to first place.',
   'No support-card, user-facing skill fit, or published app data modified.'
  ]};
}
function main(argv){
 const [input,output]=argv;
 if(!input||!output)throw Error('Usage: order_rate_integer_audit.cjs pinned_skill_data.txt summary.json');
 const raw=fs.readFileSync(input);
 const sha=crypto.createHash('sha256').update(raw).digest('hex');
 if(sha!==PINNED)throw Error('Original skill dictionary SHA mismatch');
 const records=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
 const result=audit(records);
 if(result.totals.sourceSkills!==2162||
  result.totals.skillsWithOrderRate!==858||
  result.totals.rankTerms!==1465)
  throw Error('Source rank inventory drift: '+JSON.stringify(result.totals));
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({source:result.source,totals:result.totals,
  topCodes:result.byOperatorValue.slice(0,14),
  examples:result.examples},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={REV,PINNED,audit,main};
