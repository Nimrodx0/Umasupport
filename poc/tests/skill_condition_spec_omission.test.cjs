'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const x=require('../src/skill_condition_spec_omission.cjs');
const p=(type,operator='==',value=1)=>({type,operator,value});
const skill=(id,invokes)=>({
 id:'skill:'+id,name:'synthetic '+id,
 activationProfile:{status:'source-structure',sourceNumericId:id,invokes}
});
const inv=(conditions,preConditions=[],index=0)=>({conditions,preConditions,index});
const app=(skills)=>({skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
 cards:[{id:'card1',events:[{id:'event1'}]}]});

test('fixed motivation is a conditional comparison candidate, not unconditional activation',()=>{
 const result=x.classify('motivation'),rule=x.SPEC_RULES.motivation;
 assert.equal(result.classification,'conditional-axis-omission-candidate');
 assert.equal(result.evidenceKind,'pinned-game-model-specification');
 assert.deepEqual(rule.comparableAxes,['style','distance','surface']);
 assert(rule.sourceReference.includes('/SkillChecker.kt#L66'));
 assert(rule.requiredAssumptions.includes('motivation-predicate-satisfied-in-all-compared-cases'));
 assert(rule.doesNotProve.includes('unconditional-activation-opportunity'));
 assert.equal(x.classify('hp_per').classification,'hold-for-spec-or-impact-review');
 assert.equal(x.classify('weather').classification,'hold-for-spec-or-impact-review');
 assert.equal(x.classify('is_overtake').classification,'hold-for-spec-or-impact-review');
});

test('explicit three-axis gates remain mandatory, other apparently static types are not guessed neutral',()=>{
 for(const type of ['running_style','distance_type','ground_type','ground_condition','track_id'])
  assert.equal(x.classify(type).classification,'retain-explicit-eligibility');
 for(const type of ['popularity','post_number','fan_count','always','phase_random'])
  assert.equal(x.classify(type).classification,'hold-for-spec-or-impact-review');
});

test('preserves every source AND/OR/precondition/invoke occurrence and origin',()=>{
 const r=skill('100',[
  inv([[p('motivation','>=',3),p('order_rate','<=',50)],
       [p('running_style','==',2)]],
      [[p('distance_type','==',3)],[p('motivation','!=',1)]],5),
  inv([[p('ground_type','==',1),p('motivation','==',4)]],[],8)
 ]);
 const result=x.analyzeSkill(r);
 assert.deepEqual(result.occurrences.map(o=>[
  o.invokeOffset,o.invokeIndex,o.sourceSide,o.orIndex,o.andIndex,o.type
 ]),[
  [0,5,'preConditions',0,0,'distance_type'],
  [0,5,'preConditions',1,0,'motivation'],
  [0,5,'conditions',0,0,'motivation'],
  [0,5,'conditions',0,1,'order_rate'],
  [0,5,'conditions',1,0,'running_style'],
  [1,8,'conditions',0,0,'ground_type'],
  [1,8,'conditions',0,1,'motivation']
 ]);
 assert.equal(result.occurrences.filter(o=>
  o.classification==='conditional-axis-omission-candidate').length,3);
 assert.equal(result.occurrences.filter(o=>
  o.classification==='retain-explicit-eligibility').length,3);
 assert.equal(result.occurrences.filter(o=>
  o.classification==='hold-for-spec-or-impact-review').length,1);
});

test('whole read-only audit distinguishes candidates, held, and unavailable without suitability',()=>{
 const a=app([
  skill('100',[inv([[p('motivation','==',5),p('phase_random','==',2)]])]),
  skill('200',[inv([[p('motivation','!=',4),p('running_style','==',3)]])]),
  skill('300',[inv([[p('ground_type','==',2)]])]),
  {id:'hint:unmatched',activationProfile:{status:'unavailable',reason:'no-source'}}
 ]);
 const before=JSON.stringify(a);
 const report=x.audit(a);
 assert.equal(JSON.stringify(a),before);
 assert.deepEqual(report.denominators,{
  appSkills:4,sourceMatchedSkills:3,sourceUnavailableSkills:1,
  originalPredicateOccurrences:5,conditionalOmissionCandidateOccurrences:2,
  conditionalOmissionCandidateSkills:2,explicitGateOccurrences:2,
  holdForReviewOccurrences:1,actualAppliedOmissions:0,
  confirmedUnconditionalSkillActivation:0,officialSkillOrCardRatings:0
 });
 assert.equal(report.status,'p2-32-game-spec-conditional-omission-triage-only');
 assert.equal(report.rows[3].status,'source-unavailable');
 assert.equal(Object.hasOwn(report,'cardScore'),false);
 assert(report.boundaries.some(s=>s.includes('not removed')));
});

test('empty OR rows remain empty: they do not certify automatic activation',()=>{
 const r=x.analyzeSkill(skill('400',[inv([]),inv([[]])]));
 assert.equal(r.occurrences.length,0);
 assert.equal(r.status,'original-source-structure-classified-not-runtime-measured');
});

test('malformed data and repeated identities fail closed',()=>{
 assert.throws(()=>x.analyzeSkill(skill('100',[inv([[p('motivation','=',1)]])])),/invalid source predicate/);
 assert.throws(()=>x.analyzeSkill(skill('100',[{conditions:[],preConditions:[null]}])),/invalid preConditions AND/);
 assert.throws(()=>x.analyzeSkill(skill('100',[{conditions:[],preConditions:undefined}])),/invalid preConditions OR/);
 assert.throws(()=>x.audit(app([skill('100',[inv([[]])]),skill('100',[inv([[]])])])),/duplicated app skill ID/);
 assert.throws(()=>x.audit(app([
  skill('100',[inv([[]])]),{...skill('100',[inv([[]])]),id:'hint:another'}
 ])),/duplicate original numeric/);
});
