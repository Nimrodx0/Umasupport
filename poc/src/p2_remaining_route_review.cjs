'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const g6=require('./p2_g6_research_handoff_881.cjs');
const g4=require('./p2_g4_occurrence_disposition.cjs');
const axis=require('./skill_p2_15_parameterized_axis_gates.cjs');
const p52=require('./p2_omission_candidate_review.cjs');
const STATUS='P2.53-approved-research-scope-and-remaining-route-review';
function validateScope(s,p){
 a.equal(s.decisionId,'D-051');a.equal(s.sourceRun,45529818859);
 a.deepEqual(s.scope,{standaloneResearchExcluded:true,combinedConditionsRetained:true,predicatesRetained:true,assumeTrue:false,formalLabels:false});
 const sorted=x=>[...x].sort();
 a.equal(s.geometry.length,22);a.equal(s.cost.length,12);
 a.equal(new Set([...s.geometry,...s.cost]).size,34);
 a.deepEqual(sorted(s.geometry),sorted(p.rows.filter(x=>x.category==='仕様による省略候補').map(x=>x.type)));
 a.deepEqual(sorted(s.cost),sorted(p.rows.filter(x=>x.category==='費用対効果による省略候補').map(x=>x.type)));
 return new Set([...s.geometry,...s.cost]);
}
function stylePairExists(masks,panel=axis.PANEL){
 a.equal(masks.length,panel.length);
 for(let i=0;i<panel.length;i++)for(let j=i+1;j<panel.length;j++){
  const x=panel[i],y=panel[j];
  if(x.running_style!==y.running_style&&x.distance_type===y.distance_type&&x.ground_type===y.ground_type&&(masks[i]&masks[j]))return true;
 }
 return false;
}
function audit(raw,ledger,proposal,omission,handoff,scope){
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),g6.SOURCE_SHA);
 a.equal(ledger.status,g4.STATUS);a.equal(handoff.status,g6.STATUS);a.equal(omission.status,p52.STATUS);
 a.equal(handoff.source.fixedOriginalSkillRegistrySHA256,g6.SOURCE_SHA);
 const approved=validateScope(scope,proposal);
 const pm=new Map(proposal.rows.map(x=>[x.type,x]));
 const pending=new Set(proposal.rows.filter(x=>['限定追加研究候補','定性仮説・観測方法の確認','保留候補・前提分布不足'].includes(x.category)).map(x=>x.type));
 a.equal(pending.size,42);
 const hs=new Map(handoff.rows.map(x=>[x.appSkillId,x]));
 const rawById=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(x=>[x.id,x]));
 const counts=Object.fromEntries([...pending].map(t=>[t,{occurrences:0,skills:0,withComparableRoute:0,withoutComparableRoute:0,historySkills:0}]));
 const rows=[];let scopeOccurrences=0;
 for(const l of ledger.rows){
  const h=hs.get(l.appSkillId);a(h);a.equal(l.sourceNumericId,h.originalNumericSourceId);
  if(l.occurrences===null)continue;
  const rec=rawById.get(l.sourceNumericId);a(rec);
  const rs=h.explicitThreeAxisNecessaryOnly.sourceRoutes;
  const local=new Map();
  for(const o of l.occurrences){
   if(approved.has(o.type))scopeOccurrences++;
   if(!pending.has(o.type))continue;
   const pred=rec.invokes[o.invokeOffset]?.[o.sourceSide]?.[o.orIndex]?.[o.andIndex];
   a(pred&&pred.type===o.type);
   const routes=rs.filter(r=>r.invokeOffset===o.invokeOffset&&r.invokeIndex===o.invokeIndex&&(o.sourceSide==='conditions'?r.conditionOrIndex===o.orIndex:r.preconditionOrIndex===o.orIndex));
   a(routes.length>0);
   const comparable=routes.some(r=>stylePairExists(r.necessaryGroundStateMasks));
   const c=counts[o.type];c.occurrences++;
   const entry=local.get(o.type)||{comparable:false,history:false,occurrences:[]};
   entry.comparable||=comparable;entry.history||=o.sourceSide==='preConditions';
   // Exact source terms are read at runtime only; keep location, not source values, in the output.
   entry.occurrences.push({invokeOffset:o.invokeOffset,sourceSide:o.sourceSide,orIndex:o.orIndex,andIndex:o.andIndex,comparableNecessaryRoute:comparable});
   local.set(o.type,entry);
  }
  for(const [type,v] of local){
   const c=counts[type];c.skills++;if(v.comparable)c.withComparableRoute++;else c.withoutComparableRoute++;if(v.history)c.historySkills++;
   rows.push({appSkillId:l.appSkillId,sourceNumericId:l.sourceNumericId,type,category:pm.get(type).category,...v,
    researchPriority:v.comparable?'inspect-material-effect-and-observability':'no-same-context-style-pair-in-containing-route',
    formalLabel:null,sourcePredicateRemoved:false});
  }
 }
 a.equal(scopeOccurrences,863);
 for(const [t,c] of Object.entries(counts)){a.equal(c.skills,pm.get(t).skills);a.equal(c.occurrences,pm.get(t).occurrences);a.equal(c.withComparableRoute+c.withoutComparableRoute,c.skills);}
 a.deepEqual(omission.counts,{'not-in-34-candidate-cohort':140,'retain-mixed-condition-research':388,'geometry-and-static-only-logic-candidate':228,'context-policy-dependent-logic-candidate':42,'hold-history-or-empty-alternative':20});
 return {status:STATUS,decisionId:scope.decisionId,scopeOccurrences,counts,rows,formalLabels:0,actualOmissions:0,
  boundary:{staticPairNotMeasuredDifference:true,singleRouteNotWholeSkill:true,otherORsAndHistoryRetained:true}};
}
if(require.main===module)try{
 const x=process.argv.slice(2);a.equal(x.length,7);
 const r=audit(fs.readFileSync(x[0]),...x.slice(1,6).map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
 fs.writeFileSync(x[6],JSON.stringify(r,null,2)+'\n');
 console.log('P2_53_REMAINING_ROUTES='+JSON.stringify({scopeOccurrences:r.scopeOccurrences,counts:r.counts,formalLabels:r.formalLabels}));
}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={validateScope,stylePairExists,audit};
