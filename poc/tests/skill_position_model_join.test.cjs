'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const j=require('../src/skill_position_model_join.cjs');

const cond=(type,operator,value)=>({type,operator,value});
const item=(id,name,conditions,operator='<=',value=50,timing='phase_random',phase=1)=>({
 id:'skill:'+id,sourceNumericId:id,name,tendency:operator==='<='?
  '逃げ・先行寄り':'差し・追込寄り',
 paths:[{rank:{operatorValues:[{operator,value}],excluded:[],empty:false},
  periods:[{code:timing,operator:'==',value:phase,randomWindow:true}],
  sourceConditions:conditions}]
});
const makeAudit=skills=>({auditVersion:7,
 source:{revision:j.SKILL_REVISION,sha256:j.SKILL_SHA},
 p2StyleReview:{total:skills.length,groups:[{skills}]}});
const model=(courses=[10501,10504,10506])=>({
 schemaVersion:1,status:'GlobalSim-seed-sensitivity-not-game-skill-activation-rate',
 sourceRevision:j.SIM_REVISION,raceCount:360,seedCount:15,totalCells:courses.length*4,
 rows:courses.flatMap(courseId=>j.STYLES.map((style,idx)=>({
  courseId,fieldSize:9,scenario:'balanced',mode:'equal',style,windowId:'middle-full',
  status:'estimate',topHalfPercent:[100,85,25,5][idx],
  runnerObservations:[30,30,45,30][idx],racesWithStyle:15,
  bootstrap95:{status:'descriptive-race-block-bootstrap-interval',
   lowerPercent:[98,80,18,0][idx],upperPercent:[100,90,32,10][idx]}
 })))
});
test('matched skill with no distance predicate exposes four style measurements per course',()=>{
 const s=item('200722','テンポアップ',[cond('phase_random','==',1),
  cond('order_rate','<=',50)]);
 const out=j.compare(makeAudit([s]),model());
 assert.equal(out.counts.compared,1);
 assert.equal(out.cases[0].status,'model-conditional-comparison');
 assert.equal(out.cases[0].totalStrata,3);
 const values=out.cases[0].strata[0].styles;
 assert.equal(values['逃げ'].positionPercent,100);
 assert.equal(values['先行'].positionPercent,85);
 assert.equal(values['差し'].positionPercent,25);
 assert.equal(values['追込'].positionPercent,5);
 assert.equal(values['先行'].runners,30);
 assert.deepEqual(values['先行'].descriptiveIntervalPercent,[80,90]);
 assert.match(out.status,/not-skill-activation/);
});
test('mile-specific Gear Shift and Updraft must not use short/middle/long model',()=>{
 const gear=item('201052','ギアシフト',[
  cond('distance_type','==',2),cond('phase_random','==',1),
  cond('order_rate','<=',50)]);
 const updraft=item('200702','上昇気流',[
  cond('distance_type','==',2),cond('phase_random','==',2),
  cond('order_rate','>',50)],'>',50,'phase_random',2);
 const out=j.compare(makeAudit([gear,updraft]),model());
 assert.equal(out.counts.missingCourse,2);
 assert(out.cases.every(c=>c.status==='no-matching-course'&&c.strata.length===0));
 assert.deepEqual(out.cases.map(c=>c.match?.distanceType),[2,2]);
});
test('back-half inverts percentages and descriptive intervals without calling it activation',()=>{
 const s=item('200702','後方条件',[
  cond('phase_random','==',1),cond('order_rate','>',50)],'>');
 const out=j.compare(makeAudit([s]),model([10504]));
 assert.equal(out.cases[0].status,'model-conditional-comparison');
 const value=out.cases[0].strata[0].styles['差し'];
 assert.equal(value.positionPercent,75);
 assert.deepEqual(value.descriptiveIntervalPercent,[68,82]);
});
test('unknown additional AND, coarse ranks, non-random windows and OR remain separate',()=>{
 const blocked=item('202092','闘争心',[
  cond('phase_random','==',1),cond('order_rate','<=',50),
  cond('blocked_side_continuetime','>=',2)]);
 const narrower=item('narrow','上位40%',[
  cond('phase_random','==',1),cond('order_rate','<=',40)],'<=',40);
 const nonRandom=item('phase','中盤にいる',[
  cond('phase','==',1),cond('order_rate','<=',50)],'<=',50,'phase',1);
 const explicit=item('explicit','逃げ制限',[
  cond('running_style','==',1),cond('phase_random','==',1),
  cond('order_rate','<=',50)]);
 const or=item('or','OR',[
  cond('phase_random','==',1),cond('order_rate','<=',50)]);
 or.paths.push({...or.paths[0]});
 const x=j.compare(makeAudit([blocked,narrower,nonRandom,explicit,or]),model());
 assert.equal(x.counts.notEvaluated,5);
 assert.deepEqual(x.cases.map(c=>c.sourceStatus),[
  'unmodelled-additional-conditions','unsupported-rank',
  'unsupported-timing','unmodelled-additional-conditions',
  'multiple-condition-paths']);
 assert(x.cases.every(c=>c.strata.length===0));
});
test('source and model identities, duplicates and malformed estimates fail closed',()=>{
 const s=item('200722','example',[
  cond('phase_random','==',1),cond('order_rate','<=',50)]);
 const a=makeAudit([s]),m=model();
 assert.throws(()=>j.compare({...a,source:{...a.source,sha256:'changed'}},m),
  /exact, vetted/);
 assert.throws(()=>j.compare(a,{...m,sourceRevision:'tip'}),/pinned GlobalSim/);
 assert.throws(()=>j.compare(a,{...m,rows:[m.rows[0],...m.rows]}),
  /rows\.length|Expected pinned/);
 const duplicate=model();duplicate.rows[1]={...duplicate.rows[0]};
 assert.throws(()=>j.compare(a,duplicate),/Repeated model cell/);
 const bad=model();bad.rows[0].topHalfPercent=150;
 assert.throws(()=>j.compare(a,bad),/Invalid model percentage/);
 const dupAudit=makeAudit([s,{...s}]);
 assert.throws(()=>j.compare(dupAudit,model()),/repeated skill/);
});
test('missing running style is not converted into 0%',()=>{
 const s=item('200722','middle',[cond('phase_random','==',1),
  cond('order_rate','<=',50)]);
 const m=model([10501]);
 m.rows[3].status='no-style-runner-observations';
 m.rows[3].topHalfPercent=null;
 m.rows[3].runnerObservations=0;
 m.rows[3].racesWithStyle=0;
 const x=j.compare(makeAudit([s]),m);
 assert.equal(x.counts.partial,1);
 assert.equal(x.cases[0].strata[0].styles['追込'].status,
  'no-style-runner-observations');
 assert.equal(x.cases[0].strata[0].styles['追込'].positionPercent,undefined);
});
