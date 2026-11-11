'use strict';
/*
 * P2.15: source-structure-only necessary-condition audit.
 * Preserve every Invoke, its condition OR rows, and its precondition OR rows.
 * Evaluate only finite, explicitly named domains to identify provable gate
 * contradictions. Unknown predicates, timing and rank-model evidence remain
 * unresolved; this code NEVER computes a trigger rate or style suitability.
 */
const STYLES=Object.freeze([
 {id:1,name:'逃げ'},{id:2,name:'先行'},
 {id:3,name:'差し'},{id:4,name:'追込'}
]);
const DOMAINS=Object.freeze({
 running_style:[1,2,3,4],
 distance_type:[1,2,3,4],
 ground_type:[1,2],
 ground_condition:[1,2,3,4]
});
const OPS=new Set(['==','!=','<','<=','>','>=']);
const COND=p=>p&&typeof p.type==='string'&&p.type.length>0&&
 OPS.has(p.operator)&&Number.isSafeInteger(p.value);
const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const unique=x=>[...new Set(x)].sort();
function check(v,op,n){
 switch(op){
 case '==':return v===n;
 case '!=':return v!==n;
 case '<':return v<n;
 case '<=':return v<=n;
 case '>':return v>n;
 case '>=':return v>=n;
 default:throw Error('Invalid source predicate operator');
 }
}
function validMatrix(rows,where){
 if(!Array.isArray(rows)||rows.some(row=>!Array.isArray(row)||
   row.some(c=>!COND(c))))
  throw Error('P2.15 invalid '+where+' AND/OR matrix');
 return rows;
}
function domainAllows(predicates,axis,styleId){
 const axisTerms=predicates.filter(c=>c.type===axis);
 if(!axisTerms.length)return true;
 const domain=axis==='running_style'?[styleId]:DOMAINS[axis];
 return domain.some(value=>axisTerms.every(c=>
  check(value,c.operator,c.value)));
}
function checkCombination(terms,styleId){
 // Other source predicate types are intentionally NOT interpreted as
 // satisfiable. A 'possible' result only means no contradiction was proved.
 if(!domainAllows(terms,'running_style',styleId))
  return 'style-excluded';
 for(const axis of ['distance_type','ground_type','ground_condition'])
  if(!domainAllows(terms,axis,styleId))return 'known-context-conflict';
 return 'not-excluded-by-known-domains';
}
function analyzePath(terms,preconditionRows,styleId){
 if(!Array.isArray(terms)||terms.some(c=>!COND(c))||
  !Number.isSafeInteger(styleId)||styleId<1||styleId>4)
  throw Error('P2.15 invalid condition row/style');
 validMatrix(preconditionRows,'precondition');
 const alternatives=preconditionRows.length?preconditionRows:[[]];
 const results=alternatives.map(pre=>checkCombination([...terms,...pre],styleId));
 const allowed=results.filter(x=>x==='not-excluded-by-known-domains').length;
 const styleAllowed=results.filter(x=>x!=='style-excluded').length;
 const sourceTypes=unique([...terms,...alternatives.flat()].map(c=>c.type));
 return {
  status:allowed?'not-excluded-by-known-domains':
   styleAllowed?'known-context-conflict':'style-excluded',
  preconditionAlternatives:preconditionRows.length,
  compatiblePreconditionAlternatives:allowed,
  rejectedStyleAlternatives:results.filter(x=>x==='style-excluded').length,
  rejectedContextAlternatives:results.filter(x=>x==='known-context-conflict').length,
  sourceConditionTypes:sourceTypes,
  // These are not evaluated here, even if an independent P2 model studies
  // their isolated rank/timing subcondition.
  unverifiedConditionTypes:sourceTypes.filter(t=>!Object.hasOwn(DOMAINS,t))
 };
}
function analyzeSkill(skill){
 if(!isObject(skill)||typeof skill.id!=='string'||
  typeof skill.name!=='string')throw Error('P2.15 invalid app skill');
 const p=skill.activationProfile;
 if(p?.status!=='source-structure')
  return {skillId:skill.id,status:'source-unavailable',
   reason:p?.reason||p?.status||'no-matched-source'};
 if(!/^[0-9]+$/.test(p.sourceNumericId||'')||
  !Array.isArray(p.invokes)||!p.invokes.length)
  throw Error('P2.15 source profile missing numeric ID or invokes');
 const paths=[],allTypes=new Set(),preTypes=new Set();
 let conditionalOR=0,preconditionOR=0,emptyConditions=0;
 for(const [invokeOffset,invoke] of p.invokes.entries()){
  if(!isObject(invoke))throw Error('P2.15 invalid invoke');
  const pre=validMatrix(invoke.preConditions,'precondition');
  const conditions=validMatrix(invoke.conditions,'condition');
  if(pre.length>1)preconditionOR++;
  if(conditions.length>1)conditionalOR++;
  for(const row of [...pre,...conditions])
   for(const t of row)allTypes.add(t.type);
  for(const row of pre)for(const t of row)preTypes.add(t.type);
  if(!conditions.length){
   emptyConditions++;
   paths.push({invokeOffset,invokeIndex:invoke.index??invokeOffset,
    orIndex:null,status:'no-source-condition-rows',
    preconditionAlternatives:pre.length,
    sourceConditionTypes:unique(pre.flat().map(x=>x.type)),
    byStyle:Object.fromEntries(STYLES.map(s=>[s.name,{
     status:'not-assessable-no-condition-row'}]))});
   continue;
  }
  for(const [orIndex,row] of conditions.entries()){
   paths.push({invokeOffset,invokeIndex:invoke.index??invokeOffset,
    orIndex,preconditionAlternatives:pre.length,
    sourceConditionTypes:unique([...row,...pre.flat()].map(x=>x.type)),
    byStyle:Object.fromEntries(STYLES.map(s=>[
     s.name,analyzePath(row,pre,s.id)
    ]))});
  }
 }
 const byStyle=Object.fromEntries(STYLES.map(style=>{
  const evaluated=paths.map(x=>x.byStyle[style.name]);
  const unknown=evaluated.some(x=>x.status==='not-assessable-no-condition-row');
  const viable=evaluated.filter(x=>x.status==='not-excluded-by-known-domains');
  const excluded=evaluated.filter(x=>x.status==='style-excluded');
  const conflicts=evaluated.filter(x=>x.status==='known-context-conflict');
  const status=unknown?'unknown-empty-source-invoke':
   viable.length?'at-least-one-path-not-excluded':
   conflicts.length?'all-paths-known-context-conflict-or-style-excluded':
   'all-recorded-paths-explicitly-exclude-style';
  return [style.name,{status,notExcludedPaths:viable.length,
   explicitExcludedPaths:excluded.length,contextConflictPaths:conflicts.length,
   unknownPaths:evaluated.length-viable.length-excluded.length-conflicts.length,
   // Count distinct source type IDs, not independent model evidence.
   unverifiedSourceTypes:unique(viable.flatMap(x=>x.unverifiedConditionTypes))}];
 }));
 return {
  skillId:skill.id,sourceNumericId:p.sourceNumericId,
  sourceStatus:p.source,
  status:'source-structure-reviewed-necessary-gates-only',
  invokeCount:p.invokes.length,conditionalORInvokes:conditionalOR,
  preconditionORInvokes:preconditionOR,
  hasPreconditions:p.invokes.some(x=>x.preConditions.length>0),
  emptyConditionInvokes:emptyConditions,
  sourceTypes:unique([...allTypes]),
  preconditionTypes:unique([...preTypes]),
  paths,byStyle
 };
}
function audit(model){
 if(!model||!Array.isArray(model.skills)||!model.skillById)
  throw Error('P2.15 missing app model');
 const before=JSON.stringify(model.cards||[]);
 const rows=model.skills.map(analyzeSkill);
 if(before!==JSON.stringify(model.cards||[]))
  throw Error('P2.15 audit mutated card roster');
 if(new Set(rows.map(r=>r.skillId)).size!==rows.length)
  throw Error('P2.15 duplicate app skill ID');
 const matched=rows.filter(r=>r.status!=='source-unavailable');
 const unavailable=rows.filter(r=>r.status==='source-unavailable');
 const sum=xs=>xs.reduce((n,x)=>n+x,0);
 const types=new Map(),priorities=new Map();
 const typeSkillCounts=new Map(),preTypeSkillCounts=new Map();
 const count=(map,key)=>map.set(key,(map.get(key)||0)+1);
 for(const r of matched){
  for(const t of r.sourceTypes)count(typeSkillCounts,t);
  for(const t of r.preconditionTypes)count(preTypeSkillCounts,t);
  const blockers=unique(r.paths.flatMap(path=>
   STYLES.flatMap(style=>{
    const info=path.byStyle[style.name];
    if(info.status!=='not-excluded-by-known-domains')return [];
    return info.unverifiedConditionTypes;
   })));
  for(const type of blockers)count(types,type);
  const shapes=[
   ...(r.invokeCount>1?['multiple-invokes']:[]),
   ...(r.conditionalORInvokes?['condition-OR']:[]),
   ...(r.preconditionORInvokes?['precondition-OR']:[]),
   ...(r.hasPreconditions?['any-preconditions']:[]),
   ...(r.emptyConditionInvokes?['empty-source-condition-invoke']:[])
  ];
  for(const key of shapes)count(priorities,key);
 }
 const byStyles=Object.fromEntries(STYLES.map(style=>{
  const statuses=new Map();
  for(const row of matched)count(statuses,row.byStyle[style.name].status);
  return [style.name,Object.fromEntries(statuses)];
 }));
 const allPaths=sum(matched.map(r=>r.paths.length));
 const recordedPaths=sum(matched.map(r=>r.paths.filter(x=>x.orIndex!==null).length));
 const allStylePathCells=sum(matched.map(r=>r.paths.length*STYLES.length));
 const styleCellsCount=Object.values(byStyles).reduce((n,v)=>n+
  Object.values(v).reduce((a,b)=>a+b,0),0);
 if(styleCellsCount!==matched.length*STYLES.length)
  throw Error('P2.15 style cells lost');
 const sorted=map=>[...map.entries()].map(([key,skills])=>({key,skills}))
  .sort((a,b)=>b.skills-a.skills||a.key.localeCompare(b.key));
 return {
  schemaVersion:1,status:'p2-15-full-source-path-necessary-gate-audit-only',
  modelScenario:'no-simulation-performed',
  denominators:{appSkills:rows.length,sourceMatched:matched.length,
   unavailable:unavailable.length,invokes:sum(matched.map(r=>r.invokeCount)),
   recordedConditionORPaths:recordedPaths,
   noConditionInvokeRows:allPaths-recordedPaths,
   reportedPathRows:allPaths,reportedStylePathCells:allStylePathCells},
  shape:{skillsWithMultipleInvokes:matched.filter(x=>x.invokeCount>1).length,
   skillsWithConditionOR:matched.filter(x=>x.conditionalORInvokes>0).length,
   skillsWithPreconditions:matched.filter(x=>x.hasPreconditions).length,
   skillsWithPreconditionOR:matched.filter(x=>x.preconditionORInvokes>0).length,
   skillsWithEmptyConditionInvoke:matched.filter(x=>x.emptyConditionInvokes>0).length},
  sourceConditionTypesOnNonExcludedPaths:sorted(types),
  typesInSourceMatchedSkills:sorted(typeSkillCounts),
  typesInPreconditions:sorted(preTypeSkillCounts),
  overlappingShapes:sorted(priorities),
  byStyles,rows,
  boundaries:[
   'Necessary gate check only: no contradiction on recognized finite domains is NOT proof an invoke triggers.',
   'Only running_style, distance_type, ground_type and ground_condition are evaluated as finite domains.',
   'Remaining predicates, preconditions, OR paths and multiple invokes retain their exact source positions.',
   'No 10m probability, P2.28 W, D=O-U, implicit style score, game-real trigger rate or card effect calculation.',
   'The structural source audit cannot infer OR/invoke activation semantics beyond the original record.',
   'Unmatched skill records remain unavailable, never generic or zero; no upstream text is republished.'
  ]
 };
}
module.exports={STYLES,DOMAINS,check,analyzePath,analyzeSkill,audit};
