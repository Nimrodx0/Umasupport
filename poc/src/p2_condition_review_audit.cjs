'use strict';
const a=require('node:assert/strict'),fs=require('node:fs');
const g4=require('./p2_g4_occurrence_disposition.cjs');
const triage=require('./skill_condition_research_triage.cjs');
const g6=require('./p2_g6_research_handoff_881.cjs');
const staticTypes=new Set(['running_style','distance_type','ground_type','ground_condition']);
const rank=new Set(triage.BUCKETS['rank-opportunity-study']);
const timing=new Set(triage.BUCKETS['timing-or-geometry-only']);
function audit(ledger,proposal){
 a.equal(ledger.status,g4.STATUS);a.equal(ledger.source.registrySHA256,g6.SOURCE_SHA);
 a.equal(proposal.status,'P2.51-type-review-proposal-not-formal-adoption');
 const map=new Map();
 for(const p of proposal.rows){
  a(!map.has(p.type),'duplicate type');
  a(typeof p.reason==='string'&&p.reason.length>0);
  a.equal(p.ownerApproved,staticTypes.has(p.type)||g4.EXCLUDED_CONTEXT_RESEARCH.includes(p.type));
  a.equal(p.category==='既承認・研究省略',g4.EXCLUDED_CONTEXT_RESEARCH.includes(p.type));
  a.equal(p.category==='既承認・静的適用範囲',staticTypes.has(p.type));
  map.set(p.type,{...p,n:0,skillsSet:new Set(),sameAndRank:new Set(),sameAndOtherDynamic:new Set(),precondition:new Set(),sourcePaths:new Set(),seenDispositions:new Set()});
 }
 let total=0;
 for(const row of ledger.rows){
  if(row.occurrences===null)continue;
  const groups=new Map();
  for(const o of row.occurrences){
   const k=JSON.stringify([o.invokeOffset,o.sourceSide,o.orIndex]);
   if(!groups.has(k))groups.set(k,[]);
   groups.get(k).push(o);
  }
  for(const group of groups.values())for(const o of group){
   const p=map.get(o.type);a(p,'unreviewed actual condition '+o.type);
   total++;p.n++;p.skillsSet.add(row.appSkillId);p.seenDispositions.add(o.disposition);
   p.sourcePaths.add(JSON.stringify([row.appSkillId,o.invokeOffset,o.sourceSide,o.orIndex]));
   if(o.sourceSide==='preConditions')p.precondition.add(row.appSkillId);
   if(group.some(q=>q.type!==o.type&&rank.has(q.type)))p.sameAndRank.add(row.appSkillId);
   if(group.some(q=>q.type!==o.type&&!staticTypes.has(q.type)&&!rank.has(q.type)&&!timing.has(q.type)&&triage.typeDecision(q.type).group!=='explicit-eligibility'))p.sameAndOtherDynamic.add(row.appSkillId);
  }
 }
 const result=[...map.values()].map(p=>{
  a.equal(p.n,p.occurrences,p.type+' occurrence drift');a.equal(p.skillsSet.size,p.skills,p.type+' skill drift');
  a.deepEqual([...p.seenDispositions].sort(),[...p.previous].sort());
  return {type:p.type,category:p.category,ownerApproved:p.ownerApproved,skills:p.skills,occurrences:p.occurrences,
   originalAndGroups:p.sourcePaths.size,sameAndRankSkills:p.sameAndRank.size,sameAndOtherDynamicSkills:p.sameAndOtherDynamic.size,
   preconditionSkills:p.precondition.size,sourcePredicateRemoved:false,formalLabel:null};
 });
 a.equal(result.length,90);a.equal(total,2421);a.equal(ledger.denominators.occurrenceCount,total);
 return {status:'P2.51-proposal-audited-not-accepted',rows:result,formalLabels:0,actualOmissions:0};
}
if(require.main===module)try{
 const args=process.argv.slice(2);a.equal(args.length,3);
 const x=audit(...args.slice(0,2).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(args[2],JSON.stringify(x,null,2)+'\n');
 console.log('P2_51_TYPE_REVIEW='+JSON.stringify(x.rows));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={audit};
