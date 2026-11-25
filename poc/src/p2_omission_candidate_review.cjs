'use strict';
// Review omission of dedicated research, not omission of source predicates.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const g4=require('./p2_g4_occurrence_disposition.cjs');
const g6=require('./p2_g6_research_handoff_881.cjs');
const triage=require('./skill_condition_research_triage.cjs');
const p51=require('./p2_condition_review_audit.cjs');
const STATUS='P2.52-omission-candidates-whole-source-review-only';
const STATIC=new Set(['running_style','distance_type','ground_type','ground_condition']);
const RANK=new Set(triage.BUCKETS['rank-opportunity-study']);
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const key=o=>JSON.stringify([o.invokeOffset,o.invokeIndex,o.sourceSide,o.orIndex,o.andIndex,o.type]);
function review(invokes,geometry,cost){
 a(Array.isArray(invokes)&&invokes.length);
 const occurrences=[];
 let history=false,empty=false;
 invokes.forEach((inv,invokeOffset)=>{
  const cond=inv.conditions??[],pre=inv.preConditions??[];
  a(Array.isArray(cond)&&Array.isArray(pre));
  if(pre.length)history=true;
  if(!cond.length||cond.some(x=>!x.length)||pre.some(x=>!x.length))empty=true;
  for(const side of ['conditions','preConditions']) (inv[side]??[]).forEach((and,orIndex)=>{
   a(Array.isArray(and));
   and.forEach((p,andIndex)=>{
    a(typeof p.type==='string'&&['==','!=','<','<=','>','>='].includes(p.operator)&&Number.isSafeInteger(p.value));
    const kind=p.type==='always'&&!(p.operator==='=='&&p.value===1)?'other-unknown':
     geometry.has(p.type)?'geometry-or-always':cost.has(p.type)?'cost-candidate':
     g4.EXCLUDED_CONTEXT_RESEARCH.includes(p.type)?'D-049':STATIC.has(p.type)?'static':
     RANK.has(p.type)?'rank':'other-unknown';
    occurrences.push({invokeOffset,invokeIndex:inv.index??invokeOffset,sourceSide:side,orIndex,andIndex,type:p.type,kind});
   });
  });
 });
 const kinds=new Set(occurrences.map(o=>o.kind));
 const candidate=occurrences.some(o=>geometry.has(o.type)||cost.has(o.type));
 let status='not-in-34-candidate-cohort';
 if(candidate)status=history||empty?'hold-history-or-empty-alternative':
  kinds.has('rank')||kinds.has('other-unknown')?'retain-mixed-condition-research':
  kinds.has('cost-candidate')||kinds.has('D-049')?'context-policy-dependent-logic-candidate':
  'geometry-and-static-only-logic-candidate';
 return {status,occurrences,history,empty,explicitStyleRestrictionPresent:occurrences.some(o=>o.type==='running_style'),
  formalLabel:null,actualOmissions:0,cardScore:null};
}
function audit(raw,ledger,proposal,prior){
 a.equal(digest(raw),g6.SOURCE_SHA);
 a.equal(ledger.status,g4.STATUS);a.equal(ledger.source.registrySHA256,g6.SOURCE_SHA);
 a.deepEqual(p51.audit(ledger,proposal),prior);
 const geom=new Set(proposal.rows.filter(x=>x.category==='仕様による省略候補').map(x=>x.type));
 const cost=new Set(proposal.rows.filter(x=>x.category==='費用対効果による省略候補').map(x=>x.type));
 a.equal(geom.size,22);a.equal(cost.size,12);
 const records=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
 const src=new Map(records.map(x=>[x.id,x]));a.equal(src.size,records.length);
 const rows=[],counts={},typeCounts=Object.fromEntries([...geom,...cost].map(t=>[t,{skills:0,occurrences:0,wholeSkillMixedOrHistory:0,wholeSkillLogicCandidate:0}]));
 let matched=0,missing=0,total=0;
 for(const l of ledger.rows){
  if(l.sourceNumericId===null){missing++;a.equal(l.occurrences,null);continue;}
  matched++;const s=src.get(l.sourceNumericId);a(s);
  const v=review(s.invokes,geom,cost);
  a.deepEqual(v.occurrences.map(key).sort(),l.occurrences.map(key).sort());
  const used=new Set();
  for(const o of v.occurrences)if(Object.hasOwn(typeCounts,o.type)){typeCounts[o.type].occurrences++;total++;used.add(o.type);}
  for(const t of used){const z=typeCounts[t];z.skills++;
   if(v.status.endsWith('logic-candidate'))z.wholeSkillLogicCandidate++;else z.wholeSkillMixedOrHistory++;
  }
  counts[v.status]=(counts[v.status]||0)+1;
  if(used.size)rows.push({appSkillId:l.appSkillId,sourceNumericId:l.sourceNumericId,
   candidateTypes:[...used].sort(),...v});
 }
 a.equal(matched,818);a.equal(missing,63);a.equal(total,863);
 for(const p of proposal.rows.filter(p=>Object.hasOwn(typeCounts,p.type))){
  const v=typeCounts[p.type];a.equal(v.skills,p.skills);a.equal(v.occurrences,p.occurrences);
  a.equal(v.wholeSkillMixedOrHistory+v.wholeSkillLogicCandidate,v.skills);
 }
 return {status:STATUS,sourceRegistrySHA256:g6.SOURCE_SHA,counts,typeCounts,rows,
  denominators:{matched,missing,candidateSkills:rows.length,candidateOccurrences:total},
  boundary:{noPredicateRemoval:true,noFormalLabels:true,noOwnerApprovalInferred:true,geometryNotGuaranteedReachable:true}};
}
if(require.main===module)try{
 const x=process.argv.slice(2);a.equal(x.length,5);
 const out=audit(fs.readFileSync(x[0]),...x.slice(1,4).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(x[4],JSON.stringify(out,null,2)+'\n');
 console.log('P2_52_OMISSION_REVIEW='+JSON.stringify({counts:out.counts,denominators:out.denominators,typeCounts:out.typeCounts}));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STATUS,review,audit};
