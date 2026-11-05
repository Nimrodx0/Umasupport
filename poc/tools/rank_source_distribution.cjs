#!/usr/bin/env node
'use strict';
/* P2 source-only distribution: publishes aggregate condition-code counts,
 * not third-party source records or skill-specific activation guesses. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const REVISION='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const SHA256='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const OPS=new Set(['==','!=','>','>=','<','<=']);
const TIMING_PREFIX=/^phase(?:_|$)/;
function audit(records){
 if(!Array.isArray(records)||!records.length)throw Error('Expected original skill registry');
 const codes=new Map(),thresholds=new Map();
 let skillsWithRank=0,rankTerms=0,rankBranches=0;
 const timingByType={},totalSkillIds=new Set();
 for(const skill of records){
  if(!skill||typeof skill.id!=='string'||totalSkillIds.has(skill.id)||
   !Array.isArray(skill.invokes))throw Error('Invalid or duplicate skill record');
  totalSkillIds.add(skill.id);
  let seenInSkill=false;
  for(const invoke of skill.invokes)
   for(const side of ['conditions','preConditions']){
    const groups=invoke[side]||[];
    if(!Array.isArray(groups))throw Error('Invalid condition alternatives');
    for(const andTerms of groups){
     if(!Array.isArray(andTerms))throw Error('Invalid condition branch');
     const rank=andTerms.filter(c=>c?.type==='order_rate');
     if(!rank.length)continue;
     rankBranches++;seenInSkill=true;
     const phases=[...new Set(andTerms.filter(c=>
      typeof c?.type==='string'&&TIMING_PREFIX.test(c.type)).map(c=>c.type))];
     for(const p of phases)timingByType[p]=(timingByType[p]||0)+1;
     for(const c of rank){
      if(!OPS.has(c.operator)||!Number.isSafeInteger(c.value))
       throw Error('Unsupported order_rate condition');
      rankTerms++;
      const key=c.operator+String(c.value),cut=String(c.value);
      for(const [map,id] of [[codes,key],[thresholds,cut]]){
       if(!map.has(id))map.set(id,{occurrences:0,skillIds:new Set(),
        sourceConditions:new Set(),timingTypes:new Set()});
       const entry=map.get(id);
       entry.occurrences++;entry.skillIds.add(skill.id);
       entry.sourceConditions.add(side);
       for(const p of phases)entry.timingTypes.add(p);
      }
     }
    }
   }
  if(seenInSkill)skillsWithRank++;
 }
 const clean=map=>[...map.entries()].map(([code,x])=>({
  code,occurrences:x.occurrences,uniqueSkills:x.skillIds.size,
  sourceConditions:[...x.sourceConditions].sort(),
  timingTypes:[...x.timingTypes].sort()
 })).sort((a,b)=>b.uniqueSkills-a.uniqueSkills||
  b.occurrences-a.occurrences||a.code.localeCompare(b.code,'en'));
 return {schemaVersion:1,status:'fixed-UmaSim-original-order-rate-condition-frequency',
  sourceRevision:REVISION,totalSkills:records.length,skillsWithRank,
  rankBranches,rankTerms,byOperatorValue:clean(codes),
  byValue:clean(thresholds),rankBranchesWithTiming:timingByType,
  caution:'Counts are original source predicates, not independent events, activation probabilities, or simulated race proportions.'};
}
function main(args){
 const [input,output]=args;
 if(!input||!output)throw Error('Usage: rank_source_distribution.cjs pinned_skill_data.txt result.json');
 const raw=fs.readFileSync(input),sha=crypto.createHash('sha256').update(raw).digest('hex');
 if(sha!==SHA256)throw Error('Source skill registry hash mismatch');
 const out=audit(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')));
 fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({skillsWithRank:out.skillsWithRank,
  rankTerms:out.rankTerms,topSourceCodes:out.byOperatorValue.slice(0,15),
  topValues:out.byValue.slice(0,15)},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e);process.exitCode=1}
module.exports={audit,main,REVISION,SHA256};
