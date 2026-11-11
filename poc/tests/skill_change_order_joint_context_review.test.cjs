'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/skill_change_order_joint_context_review.cjs');
const stage=require('../tools/globalsim_change_order_skill_tick.cjs');
const c=(type,operator,value)=>({type,operator,value});
const gate=(sameAndStatic=[],preconditionAlternatives=[],unmeasuredSameAndTypes=[])=>({
 sameAndStatic,preconditionAlternatives,unmeasuredSameAndTypes,
 scope:'exact-source-static-style-distance-and-signed-rank-only'
});
const ctx=(courseId,style,inspected,up,down)=>({
 courseId,fieldSize:9,scenario:'balanced',mode:'equal',style,
 inspectedPreSkillTicks:inspected,preSkillRankRiseTicks:up,
 preSkillRankFallTicks:down});
const report=()=>({
 schemaVersion:1,
 status:'P2-direct-retail-pre-skill-conditions-model-only-no-skill-proc',
 globalSimRevision:stage.PIN,sourceUmaSimSHA256:stage.U_SHA,
 design:{races:32,originalSkillList:'no-skills'},
 validation:{allPhysicalValuesEqual:true,
  priorityCallRankStateMismatches:0,
  prePriorityDisagreesWithPreviousPostRankCache:0},
 styleContexts:[ctx(10502,'Nige',100,10,20),
  ctx(10502,'Senkou',80,6,12),
  ctx(10504,'Senkou',40,8,3),
  ctx(10504,'Sasi',60,1,9)],
 partialConditionOpportunity:{evaluablePreSkillRunnerTicks:280,
  preSkillRankUpRunnerTicks:25,preSkillRankDownRunnerTicks:44}
});
const sourcePath=(id,signs,context,extra={})=>({
 sourceNumericId:String(id),invokeOffset:0,side:'conditions',orIndex:0,
 conditions:signs,fixedContextGate:context,
 sameAndOtherTypes:context.unmeasuredSameAndTypes,
 orCount:1,invokeCount:1,fullSkillEvaluated:false,
 ...extra
});
const cohort=(entries=[])=>{
 const paths=Array.from({length:30},(_,i)=>entries[i]||
  sourcePath(200000+i,[{operator:'<',value:0}],gate()));
 return {schemaVersion:1,
  status:'P2-source-change-order-path-structure-not-complete-proc',
  matchedSkillDenominator:818,
  source:{sha256:stage.U_SHA},
  summary:{sourceSkills:30,sourceAndPaths:30},paths};
};
test('only rank signs constant across all magnitudes may be read from the original stage report',()=>{
 assert.deepEqual(m.classifySignOnly([{operator:'<',value:0}]),{
  rise:true,zero:false,fall:false});
 assert.deepEqual(m.classifySignOnly([{operator:'>=',value:1}]),{
  rise:false,zero:false,fall:true});
 assert.deepEqual(m.classifySignOnly([{operator:'!=',value:0}]),{
  rise:true,zero:false,fall:true});
 assert.deepEqual(m.classifySignOnly([{operator:'==',value:0}]),{
  rise:false,zero:true,fall:false});
 assert.equal(m.classifySignOnly([{operator:'<=',value:-2}]),null);
 assert.equal(m.classifySignOnly([{operator:'==',value:2}]),null);
 assert.deepEqual(m.classifySignOnly([
  {operator:'>',value:0},{operator:'<',value:0}]),{
  rise:false,zero:false,fall:false});
 assert.equal(m.classifySignOnly([{operator:'unknown',value:0}]),null);
});
test('source exact style/distance same-AND and alternative preconditions are checked independently',()=>{
 const g=gate([c('running_style','==',1),c('distance_type','==',2)]);
 assert.equal(m.sourceGateAllows(g,1,2),true);
 assert.equal(m.sourceGateAllows(g,2,2),false);
 assert.equal(m.sourceGateAllows(g,1,3),false);
 const alternatives=gate([c('distance_type','==',2)],[
  {static:[c('running_style','==',1)],unmeasuredTypes:['phase']},
  {static:[c('running_style','==',3)],unmeasuredTypes:['distance_rate']}
 ]);
 assert.equal(m.sourceGateAllows(alternatives,1,2),true);
 assert.equal(m.sourceGateAllows(alternatives,3,2),true);
 assert.equal(m.sourceGateAllows(alternatives,2,2),false);
 assert.equal(m.sourceGateAllows(alternatives,3,3),false);
 assert.equal(m.sourceGateAllows(g,1,5),false);
});
test('exact same-runner static context and signed rank intersection is not a marginal product',()=>{
 const src=cohort([
  sourcePath(200000,[{operator:'<',value:0}],
   gate([c('running_style','==',1),c('distance_type','==',2)],[],
    ['phase_random'])),
  sourcePath(200001,[{operator:'>',value:0}],
   gate([c('running_style','==',2),c('distance_type','==',3)])),
  sourcePath(200002,[{operator:'==',value:2}],
   gate([c('distance_type','==',2)]))
 ]);
 const before=JSON.stringify({src,model:report()});
 const out=m.inspect(report(),src);
 assert.equal(JSON.stringify({src,model:report()}),before);
 assert.equal(out.denominator.originalReferenceRunnerTicks,280);
 assert.equal(out.denominator.sourceAndPaths,30);
 assert.equal(out.rows[0].byStyle.Nige.observedReferenceRunnerTicks,100);
 assert.equal(out.rows[0].byStyle.Nige.signedRankMatchedRunnerTicks,10);
 assert.equal(out.rows[0].byStyle.Senkou.signedRankMatchedRunnerTicks,0);
 assert.equal(out.rows[1].byStyle.Senkou.observedReferenceRunnerTicks,40);
 assert.equal(out.rows[1].byStyle.Senkou.signedRankMatchedRunnerTicks,3);
 assert.equal(out.rows[2].byStyle.Nige.signedRankMatchedRunnerTicks,null,
  'Magnitude-sensitive original predicate must not be approximated using only signs');
 assert.equal(out.rows[0].anyOtherConditionUnverified,true);
 assert.deepEqual(out.rows[0].unmeasuredRequiredPredicateTypes,['phase_random']);
 assert.equal(out.rows[0].researchStatus,'source-model-partial-necessary-gate-only');
 assert.equal(out.design.modelSkillList,'none');
 assert.equal(Object.hasOwn(out,'skillProcPercent'),false);
});
test('source finite gate mismatch yields a no-observation context, not a claim about actual game',()=>{
 const src=cohort([
  sourcePath(200000,[{operator:'<',value:0}],
   gate([c('running_style','==',4),c('distance_type','==',4)])),
  sourcePath(200001,[{operator:'<=',value:-2}],gate())
 ]);
 const out=m.inspect(report(),src);
 assert.equal(out.rows[0].byStyle.Oikomi.observedReferenceRunnerTicks,0);
 assert.equal(out.rows[0].byStyle.Oikomi.signedRankMatchedRunnerTicks,0);
 assert.equal(out.rows[1].byStyle.Nige.signedRankMatchedRunnerTicks,null);
 assert.equal(out.totals.heldNonSignOnlyPaths,1);
});
test('reject modified stage physics, unknown course/style, missing data and duplicate source path',()=>{
 const x=report();x.validation.allPhysicalValuesEqual=false;
 assert.throws(()=>m.contextValidation(x),/Unverified/);
 const y=report();y.styleContexts[0].courseId=100000;
 assert.throws(()=>m.contextValidation(y),/Unknown/);
 const z=report();z.styleContexts[0].preSkillRankRiseTicks=200;
 assert.throws(()=>m.contextValidation(z),/contradicts/);
 const t=report();t.partialConditionOpportunity.evaluablePreSkillRunnerTicks++;
 assert.throws(()=>m.contextValidation(t),/reconcile/);
 const a=cohort();
 a.paths[1]={...a.paths[0]};
 assert.throws(()=>m.inspect(report(),a),/Duplicate/);
 const q=cohort();
 q.paths[0].fixedContextGate.sameAndStatic.push(c('not_instrumented','==',1));
 assert.throws(()=>m.inspect(report(),q),/Unknown source gate/);
});
