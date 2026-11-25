'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const g6=require('./p2_g6_research_handoff_881.cjs');
const scope=require('./p2_remaining_route_review.cjs');
const STATUS='P2.54-exact-limited-study-screen-not-formal-adoption';
const GROUP='計算状態・限定実験候補';
function classifyRoute(inv,route,type,approvedTypes){
 const cond=inv.conditions[route.conditionOrIndex],pre=route.preconditionOrIndex===null?[]:inv.preConditions[route.preconditionOrIndex];
 a(Array.isArray(cond)&&Array.isArray(pre));
 const terms=[...cond,...pre];a(terms.some(p=>p.type===type));
 const staticSet=new Set(['running_style','distance_type','ground_type','ground_condition']);
 const rest=terms.filter(p=>p.type!==type&&!staticSet.has(p.type)&&!(p.type==='always'&&p.operator==='=='&&p.value===1));
 const otherDynamic=rest.filter(p=>!approvedTypes.has(p.type));
 const timeOnlyLowerBound=type==='accumulatetime'&&terms.filter(p=>p.type===type).every(p=>['>','>='].includes(p.operator))&&rest.length===0&&!pre.length;
 return {otherDynamicTypes:[...new Set(otherDynamic.map(p=>p.type))].sort(),
  approvedContextOrGeometryTypes:[...new Set(rest.filter(p=>approvedTypes.has(p.type)).map(p=>p.type))].sort(),
  hasPrecondition:pre.length>0,timeOnlyLowerBound,
  disposition:pre.length?'history-first':otherDynamic.length?'needs-other-state-before-study':timeOnlyLowerBound?'time-lower-bound-logic-candidate':'bounded-source-state-and-window-candidate'};
}
function audit(raw,routeReview,handoff,scopeData,proposal){
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),g6.SOURCE_SHA);
 a.equal(routeReview.status,'P2.53-approved-research-scope-and-remaining-route-review');
 a.equal(handoff.status,g6.STATUS);
 a.equal(handoff.source.fixedOriginalSkillRegistrySHA256,g6.SOURCE_SHA);
 a.equal(proposal.status,'P2.54-remaining-type-decision-proposal');
 const ps=new Map(proposal.rows.map(x=>[x.type,x]));a.equal(ps.size,42);a.equal(proposal.rows.length,42);
 for(const [type,c] of Object.entries(routeReview.counts)){
  const p=ps.get(type);a(p);for(const [key,v] of Object.entries(c))a.equal(p[key],v,type+' '+key);
  a.equal(p.group==='同一経路の比較不要候補',c.withComparableRoute===0);
 }
 const approvedTypes=new Set([...scopeData.geometry,...scopeData.cost]);
 const recs=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(x=>[x.id,x]));
 const hs=new Map(handoff.rows.map(x=>[x.appSkillId,x]));
 const output=[],seen=new Set(),totals={};
 for(const row of routeReview.rows){
  if(!row.comparable||ps.get(row.type).group!==GROUP)continue;
  const h=hs.get(row.appSkillId),rec=recs.get(row.sourceNumericId);a(h&&rec);
  a.equal(h.originalNumericSourceId,row.sourceNumericId);
  for(const r of h.explicitThreeAxisNecessaryOnly.sourceRoutes){
   if(!scope.stylePairExists(r.necessaryGroundStateMasks))continue;
   const inv=rec.invokes[r.invokeOffset];
   if(!row.occurrences.some(o=>o.invokeOffset===r.invokeOffset&&(o.sourceSide==='conditions'?o.orIndex===r.conditionOrIndex:o.orIndex===r.preconditionOrIndex)))continue;
   const key=JSON.stringify([row.sourceNumericId,row.type,r.invokeOffset,r.conditionOrIndex,r.preconditionOrIndex]);
   a(!seen.has(key));seen.add(key);
   const item=classifyRoute(inv,r,row.type,approvedTypes);
   const d=totals[row.type]??={};d[item.disposition]=(d[item.disposition]||0)+1;
   output.push({appSkillId:row.appSkillId,sourceNumericId:row.sourceNumericId,type:row.type,route:{invokeOffset:r.invokeOffset,conditionOrIndex:r.conditionOrIndex,preconditionOrIndex:r.preconditionOrIndex},...item,otherAlternativesPresent:rec.invokes.length>1||inv.conditions.length>1||(inv.preConditions??[]).length>1,formalLabel:null});
  }
 }
 for(const p of proposal.rows.filter(x=>x.group===GROUP)){
  a.equal(new Set(output.filter(x=>x.type===p.type).map(x=>x.appSkillId)).size,p.withComparableRoute);
 }
 return {status:STATUS,totals,rows:output,formalLabels:0,actualOmissions:0,boundary:{sourceTypeDecisionsAreProposals:true,timeLowerBoundNotGuaranteedReachable:true,approvedScopeDoesNotProveConjunction:true}};
}
if(require.main===module)try{
 const x=process.argv.slice(2);a.equal(x.length,6);
 const r=audit(fs.readFileSync(x[0]),...x.slice(1,5).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(x[5],JSON.stringify(r,null,2)+'\n');
 console.log('P2_54_LIMITED_STUDY_SCREEN='+JSON.stringify({totals:r.totals,routeRows:r.rows.length,formalLabels:r.formalLabels}));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={classifyRoute,audit};
