'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const STATUS='P2.61-D052-approved-research-scope-received';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function audit(s,prior,p,remaining){
 a.equal(s.status,'P2.58-D051-interim-research-receipt-no-formal-label');
 a.equal(prior.status,'P3-G6-D051-interim-research-received-not-approved-labels');
 a.equal(prior.sourceSHA256,digest(s));a.deepEqual(prior.totals,s.totals);
 a.equal(p.decisionId,'D-052');a.equal(p.marginPoints,10);a.equal(p.absoluteOpportunityFloor,null);
 a.equal(p.unknownNotZero,true);a.equal(p.cardScoringApproved,false);a.equal(p.publicationApproved,false);
 const types=new Map(p.remainingTypes.map(x=>[x.type,x])),old=new Map(remaining.rows.map(x=>[x.type,x]));
 a.equal(types.size,42);a.equal(p.remainingTypes.length,42);a.equal(old.size,42);
 const groupCounts={};for(const [t,d] of types){
  const o=old.get(t);a(o);for(const k of ['skills','occurrences','withComparableRoute'])a.equal(d[k],o[k],t+' '+k);
  a(typeof d.reason==='string'&&d.reason.length>0);a.equal(d.disposition==='route-local-comparison-excluded',d.withComparableRoute===0);
  groupCounts[d.disposition]=(groupCounts[d.disposition]||0)+1;
 }
 a.deepEqual(groupCounts,{'hold-limited-evidence-or-definition':7,'limited-model-evidence':13,'route-local-comparison-excluded':7,'hold-population-assumptions':15});
 const priorById=new Map(prior.rows.map(x=>[x.appSkillId,x]));a.equal(priorById.size,881);
 const observed=new Map(),scopeCounts={},rows=[];let matched=0,missing=0,count=0;
 for(const r of s.rows){
  const v=priorById.get(r.appSkillId);a(v);a.equal(v.sourceNumericId,r.sourceNumericId);a.equal(v.formalLabel,null);
  if(r.occurrences===null){missing++;a.equal(r.sourceNumericId,null);rows.push({...r,researchDecision:'source-missing'});continue;}
  matched++;const local=new Set(),occurrences=r.occurrences.map(o=>{
   count++;a.equal(o.sourcePredicateRetained,true);a.equal(o.assumeTrue,false);a.equal(o.wholeANDVerified,false);
   let disposition=o.researchScope;
   if(disposition==='pending-G4-review'){
    const d=types.get(o.type);a(d&&o.remainingReview);a.equal(o.remainingReview.proposalOnly,true);
    disposition=d.disposition;if(disposition==='route-local-comparison-excluded')a.equal(o.remainingReview.comparableNecessaryRoute,false);
    if(!observed.has(o.type))observed.set(o.type,{skills:0,occurrences:0});
    observed.get(o.type).occurrences++;local.add(o.type);
   }
   scopeCounts[disposition]=(scopeCounts[disposition]||0)+1;
   return {...o,approvedResearchDisposition:disposition,decisionId:types.has(o.type)?'D-052':null,
    actualPredicateOmitted:false,assumeTrue:false};
  });
  for(const t of local)observed.get(t).skills++;
  rows.push({...r,occurrences,researchDecision:'approved-scope-with-unresolved-predicates-retained'});
 }
 for(const [t,d] of types)a.deepEqual(observed.get(t),{skills:d.skills,occurrences:d.occurrences},t);
 a.equal(matched,818);a.equal(missing,63);a.equal(rows.length,881);a.equal(count,2421);
 a.equal(Object.values(scopeCounts).reduce((x,y)=>x+y,0),2421);
 return {status:STATUS,decisionId:p.decisionId,sourceSHA256:digest(s),policySHA256:digest(p),groupCounts,scopeCounts,matched,missing,occurrences:count,rows,
  boundary:{researchScopeAccepted:true,sourcePredicateOmissions:0,unknownNotTrue:true,formalLabels:0,cardScores:0}};
}
function accept(result,...inputs){const x=audit(...inputs);a.deepEqual(x,result);return {status:'P3-G6-D052-research-accepted',sourceSHA256:digest(x),policySHA256:x.policySHA256,rows:x.rows.map(r=>({appSkillId:r.appSkillId,sourceNumericId:r.sourceNumericId,sourceNecessaryMasks:r.sourceNecessaryMasks??null,researchDecision:r.researchDecision})),boundary:{formalLabels:0,cardScores:0}};}
if(require.main===module)try{const x=process.argv.slice(2);a.equal(x.length,6);const inputs=x.slice(0,4).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));const v=audit(...inputs);fs.writeFileSync(x[4],JSON.stringify(v,null,2)+'\n');const q=accept(JSON.parse(fs.readFileSync(x[4],'utf8')),...inputs);fs.writeFileSync(x[5],JSON.stringify(q,null,2)+'\n');console.log('P2_61_ACCEPT='+JSON.stringify({matched:v.matched,missing:v.missing,occurrences:v.occurrences,scopeCounts:v.scopeCounts,groupCounts:v.groupCounts}));}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={audit,accept};
