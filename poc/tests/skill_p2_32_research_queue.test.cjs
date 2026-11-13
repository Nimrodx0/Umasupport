'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const q=require('../src/skill_p2_32_research_queue.cjs');
const blocker=require('../src/skill_source_path_blocker_impact.cjs');
const spec=require('../src/skill_condition_spec_omission.cjs');
const pred=(type,operator='==',value=1)=>({type,operator,value});
const inv=(conditions,preConditions=[],index=0)=>({index,conditions,preConditions});
const skill=(n,invokes)=>({id:'skill:'+n,name:'Synthetic '+n,
 activationProfile:{status:'source-structure',sourceNumericId:n,invokes}});
const unavailable=()=>({id:'hint:unknown',name:'unavailable',
 activationProfile:{status:'unavailable',reason:'no-numeric-source'}});
const model=(skills)=>({skills,
 skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
 cards:[{id:'card',events:[]}]});
function sourceFixture(){
 return model([
  skill('100',[inv([[pred('order_rate','<=',50),pred('phase_random')]])]),
  skill('101',[inv([[pred('running_style','==',1),pred('is_overtake'),
   pred('phase_random')]])]),
  skill('102',[inv([[pred('track_id','==',10005),pred('order_rate','<=',50)]])]),
  skill('103',[inv([[pred('motivation','>=',3),pred('order_rate','<=',50)]])]),
  skill('104',[inv([
   [pred('order_rate','<=',50),pred('random_lot')],
   [pred('running_style','==',3),pred('is_overtake')]
  ],[[pred('motivation','>=',3)],[pred('ground_type','==',2)]],6),
  inv([[pred('phase_random'),pred('is_lastspurt')]],[],9)]),
  unavailable()
 ]);
}
function audit(model){
 const b=blocker.audit(model,['100','101']);
 const s=spec.audit(model);
 return q.audit(model,{blockerReport:b,specReport:s});
}
test('source route is kept for each Invoke, source condition OR and precondition OR',()=>{
 const m=sourceFixture();const x=q.analyzeSkill(m.skills[4]);
 assert.equal(x.routeFamilies.length,5);
 assert.deepEqual(x.routeFamilies.map(r=>
  [r.invokeIndex,r.conditionOrIndex,r.preconditionOrIndex]),[
  [6,0,0],[6,0,1],[6,1,0],[6,1,1],[9,0,null]
 ]);
 assert(x.routeFamilies.every(r=>
  r.finiteCompatibleStyles.length+r.finiteIncompatibleStyles.length===4));
 const first=x.routeFamilies[0],second=x.routeFamilies[1];
 assert.deepEqual(first.unverifiedTypes,['motivation','order_rate','random_lot']);
 assert.deepEqual(second.unverifiedTypes,['order_rate','random_lot']);
 assert.equal(first.fixedStateAssumptionsRequired,true);
 assert.equal(first.missingTypesOnlyIfFixedStateAssumptionsSatisfied,2);
 assert.equal(second.fixedStateAssumptionsRequired,false);
 assert.equal(first.noCompleteSourceRouteClaim,true);
});
test('rank+window same-source branch gets first research priority, never a rating',()=>{
 const m=sourceFixture(),report=audit(m);
 const paths=report.priorityRouteCandidates;
 const first=paths.find(x=>x.sourceNumericId==='100');
 assert.equal(first.researchGroup,'rank-source-join-first');
 assert.equal(first.finiteCompatibleStyles.length,4);
 assert.deepEqual(first.unverifiedTypes,['order_rate','phase_random']);
 assert.equal(first.nextStep,'check-source-exact-rank-window-AND-at-the-same-runner-and-tick');
 const conditional=paths.find(x=>x.sourceNumericId==='103');
 assert.equal(conditional.researchGroup,'rank-source-join-first');
 assert.equal(conditional.fixedStateAssumptionsRequired,true);
 assert.deepEqual(conditional.fixedStateCandidateTypes,['motivation']);
 assert.equal(conditional.missingTypesBeforeFixedState,2);
 assert.equal(conditional.missingTypesOnlyIfFixedStateAssumptionsSatisfied,1);
 assert.equal(report.denominators.completedSourceRouteEvaluations,0);
 assert.equal(report.denominators.officialP3OrP4Ratings,0);
});
test('explicit single-style and unresolved venue remain lower-priority, not called impossible',()=>{
 const r=audit(sourceFixture()),routes=r.priorityRouteCandidates;
 const style=routes.find(x=>x.sourceNumericId==='101');
 assert.equal(style.researchGroup,'single-style-opportunity-study');
 assert.deepEqual(style.finiteCompatibleStyles,['逃げ']);
 const staticRoute=routes.find(x=>x.sourceNumericId==='102');
 assert.equal(staticRoute.researchGroup,'context-or-setup-gate-first');
 assert.deepEqual(staticRoute.contextOrSetupTypes,['track_id']);
 assert.equal(staticRoute.finiteCompatibleStyles.length,4);
 assert(staticRoute.unverifiedTypes.includes('order_rate'));
});
test('case with alternative precondition OR never borrows conditions from other branch',()=>{
 const r=audit(sourceFixture());
 const all=r.rows.find(x=>x.sourceNumericId==='104').routeFamilies;
 assert.equal(all.length,5);
 const first=all.find(x=>x.invokeIndex===6&&x.conditionOrIndex===0&&
  x.preconditionOrIndex===0);
 const second=all.find(x=>x.invokeIndex===6&&x.conditionOrIndex===0&&
  x.preconditionOrIndex===1);
 assert(first.unverifiedTypes.includes('motivation'));
 assert(!second.unverifiedTypes.includes('motivation'));
 assert(first.unverifiedTypes.includes('random_lot'));
 assert(second.unverifiedTypes.includes('random_lot'));
 assert(all.some(x=>x.invokeIndex===9&&x.preconditionOrIndex===null));
});
test('cohort identities and input immutability are checked, no empirical scores',()=>{
 const m=sourceFixture(),old=JSON.stringify(m),r=audit(m);
 assert.equal(JSON.stringify(m),old);
 assert.equal(r.denominators.sourceMatchedSkills,5);
 assert.equal(r.denominators.sourceUnavailableSkills,1);
 assert.equal(r.rows.length,6);
 assert.equal(r.denominators.originalRouteFamilies,9);
 assert.equal(r.priorityRouteCandidates.length,
  r.denominators.finiteCompatibleRouteFamilies);
 assert(r.nextTypeResearch.every(x=>x.countsArePotentialReviewScopeOnly));
 assert.equal(Object.hasOwn(r,'skillScores'),false);
 assert(r.limitations.some(x=>x.includes('heuristic')));
 const broken=spec.audit(m);
 broken.rows[0].sourceNumericId='999';
 assert.throws(()=>q.audit(m,{blockerReport:blocker.audit(m,['100','101']),
  specReport:broken}),/source identity or matching record drift/);
});
test('malformed source profile and missing reports fail closed',()=>{
 const m=sourceFixture();
 assert.throws(()=>q.audit(m),/source audits required/);
 const damaged=skill('999',[inv([['not a source predicate']])]);
 assert.throws(()=>q.analyzeSkill(damaged),/invalid original predicate/);
 const noRows=skill('200',[inv([])]);
 assert.equal(q.analyzeSkill(noRows).routeFamilies.length,0);
});

test('initial P2.15 pilot sample is bounded, source-unique and type-shape diverse',()=>{
 const r=audit(sourceFixture());
 assert(r.initialP215Pilots.length>=1);
 assert(r.initialP215Pilots.length<=7);
 assert.equal(new Set(r.initialP215Pilots.map(x=>x.sourceNumericId)).size,
  r.initialP215Pilots.length);
 assert(r.initialP215Pilots.every(x=>
  ['rank-source-join-first','event-state-pilot-next'].includes(x.researchGroup)));
 assert(r.initialP215Pilots.every(x=>
  x.noSourceRouteProven===true&&x.noFormalSuitability===true));
 assert(r.initialP215Pilots.some(x=>x.sourceNumericId==='100'));
 assert(!r.initialP215Pilots.some(x=>x.sourceNumericId==='101'));
 assert(!r.initialP215Pilots.some(x=>x.sourceNumericId==='102'));
 assert.deepEqual(r.initialPilotSelectionPolicy,{
  rankWindowSourceJoinMax:4,eventStatePilotMax:3,
  uniqueSourceSkillPerPilot:true,
  diverseUnverifiedTypeSignaturesFirst:true,
  selectFrequentDistinctSourceTypesFirst:true,
  provenSkillSuitability:false
 });
});
test('external random_lot cannot become easy rank-join merely because its AND has two types',()=>{
 const m=sourceFixture(),r=audit(m);
 const branch=r.rows.find(x=>x.sourceNumericId==='104').routeFamilies
  .find(x=>x.conditionOrIndex===0&&x.preconditionOrIndex===1);
 assert.equal(branch.researchGroup,'complex-dynamic-route-hold');
 assert.deepEqual(branch.unresolvedComplexDependencyTypes,['random_lot']);
});

test('selects common event-state mechanisms before unrelated rare one-off types',()=>{
 const make=(id,type)=>({
  researchGroup:'event-state-pilot-next',
  sourceNumericId:id,skillId:'skill:'+id,invokeIndex:0,
  invokeOffset:0,conditionOrIndex:0,preconditionOrIndex:null,
  routeKey:'[0,0,null]',unverifiedTypes:[type],
  eventStudyTypes:[type],finiteCompatibleStyles:['逃げ','先行'],
  missingTypesOnlyIfFixedStateAssumptionsSatisfied:1,
  fixedStateAssumptionsRequired:false,nextStep:'pilot'
 });
 const r=q.selectInitialP215Pilots([
  make('10','rare_one_off'),
  make('20','is_lastspurt'),
  make('21','is_lastspurt'),
  make('22','is_lastspurt'),
  make('30','change_order_onetime'),
  make('31','change_order_onetime'),
  make('40','is_overtake'),
  make('41','is_overtake')
 ]);
 assert.deepEqual(r.map(x=>x.unresolvedTypes[0]),
  ['is_lastspurt','change_order_onetime','is_overtake']);
 assert.equal(new Set(r.map(x=>x.sourceNumericId)).size,3);
});
