'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const candidate=require('../src/skill_default_coarse_preview.cjs');
const term=(type,operator,value)=>({type,operator,value});
const gate=(style)=>term('running_style','==',style);
const rank=(op,val,p=1)=>[term('order_rate',op,val),
 term('phase_random','==',p)];
function skill(id,name,rows,{pre=[],more=[]}={}){
 return {id,name,activationProfile:{status:'source-structure',
  sourceNumericId:id.replace('skill:',''),
  invokes:[{index:0,conditions:rows,preConditions:pre},
   ...more.map((conditions,i)=>({
    index:i+1,conditions,preConditions:[]}))]}};
}
const samples=()=>[
 skill('skill:1001','中盤前方',[rank('<=',50)]),
 skill('hint:中盤に立つ','中盤に立つ',[[...rank('>=',40),
  term('order_rate','<=',80)]]),
 skill('skill:1003','複雑な追い越し',[[...rank('<=',50),
  term('is_overtake','==',1)]]),
 skill('skill:1004','先行限定',[[gate(2)]]),
 skill('skill:1005','分岐が違う',[rank('<=',50),rank('>',50)]),
 skill('skill:1006','未知',[rank('<=',50)])
];
const model=(skills=samples())=>({skills,
 skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
 meta:{reviewedEventRecords:1}});
const card=(hints,events=[])=>({
 id:'30101',name:'架空のカード',sourceStatus:'verified_hints',
 hints, hintsByStage:{0:hints.slice(0,1),4:hints},
 events,eventCoverage:'partial'
});
test('one raw original source rank + time supports a broad style clue but not invented probability',()=>{
 const r=candidate.skillSummary(samples()[0]);
 const s=r.styles;
 assert(['relative-favorable','broad-favorable','relative-mixed']
  .includes(s['先行'].signal));
 assert(['relative-unfavorable','broad-unfavorable','relative-mixed']
  .includes(s['追込'].signal));
 assert.equal(r.researchOnly,true);
 assert.equal(JSON.stringify(r).includes('probability'),false);
});
test('source verified middle order AND has four-style comparison, not wrong front/rear fallback',()=>{
 const r=candidate.skillSummary(samples()[1]);
 assert.equal(r.styles['差し'].signal,'relative-favorable');
 assert.equal(r.styles['逃げ'].signal,'relative-unfavorable');
 assert.equal(r.styles['先行'].basis,
  'pinned-balanced-four-style-partial-order');
});
test('explicit style ineligibility takes priority, while permission alone is not proof of suitability',()=>{
 const r=candidate.skillSummary(samples()[3]);
 assert.equal(r.styles['逃げ'].signal,'explicit-ineligible');
 assert.equal(r.styles['差し'].signal,'explicit-ineligible');
 assert.equal(r.styles['先行'].signal,'explicit-targeted');
});
test('unsupported extra AND and different OR rows are not upgraded to full skill evidence',()=>{
 const a=candidate.skillSummary(samples()[2]);
 const b=candidate.skillSummary(samples()[4]);
 assert(a.styles&&b.styles);
 for(const name of candidate.STYLES){
  assert(!a.styles[name].signal.endsWith('favorable'));
  assert(!b.styles[name].signal.endsWith('favorable'));
 }
 const unknown={id:'hint:missing',name:'未同定',
  activationProfile:{status:'unavailable'}};
 assert.equal(candidate.skillSummary(unknown).styles['先行'].signal,'unresolved');
});
test('no-event/no-hint approvals are not mistaken for zero potential reward',()=>{
 const m=model(),c=card(['skill:1001','skill:1003']);
 c.sourceStatus='unverified';
 m.meta.reviewedEventRecords=0;
 const x=candidate.previewCard(c,m);
 assert.equal(x.skills.length,0);
 assert.equal(x.coverage.verifiedNormalHints,false);
 assert.equal(x.coverage.reviewedEventData,false);
 for(const s of candidate.STYLES){
  assert.equal(x.styles[s].label,'unresolved');
  assert.equal(x.styles[s].labelJa,'材料不足');
 }
});
test('normal hints are limited to the selected support-card limit break',()=>{
 const c=card(['skill:1001','skill:1003','skill:1004']);
 const a=candidate.previewCard(c,model(),{stage:0});
 const b=candidate.previewCard(c,model(),{stage:4});
 assert.equal(a.coverage.uniqueSkillCandidates,1);
 assert.equal(b.coverage.uniqueSkillCandidates,3);
 assert.deepEqual(a.skills.map(s=>s.skillId),['skill:1001']);
 assert.equal(a.stage,0); assert.equal(b.stage,4);
});
test('same skill from a normal hint and a reviewed event is counted only once',()=>{
 const c=card(['skill:1001','skill:1004'],
  [{id:'evt-1',name:'選択不要',type:'auto',
    rewards:[{skillId:'skill:1001',kind:'hint',level:2}]}]);
 const r=candidate.previewCard(c,model());
 assert.equal(r.coverage.uniqueSkillCandidates,2);
 assert.equal(r.coverage.routes,3);
 assert.equal(r.skills.find(x=>x.skillId==='skill:1001').routeCount,2);
 assert.deepEqual(r.skills.find(x=>x.skillId==='skill:1001').sources,
  ['event','hint']);
});
test('unselected event choice is never counted as a granted skill, selection is still conditional',()=>{
 const c=card(['skill:1001'],[{
  id:'evt-choice',name:'イベント',type:'choice',rewards:[],
  choices:[{id:'pick-a',label:'先行寄り',rewards:[
   {skillId:'skill:1004',kind:'hint',level:1}]},
   {id:'pick-b',label:'別の道',rewards:[
    {skillId:'skill:1003',kind:'hint',level:1}]}]
 }]);
 const m=model();
 const none=candidate.previewCard(c,m);
 assert.deepEqual(none.skills.map(x=>x.skillId),['skill:1001']);
 const chosen=candidate.previewCard(c,m,{choices:{'evt-choice':'pick-a'}});
 assert(chosen.skills.some(x=>x.skillId==='skill:1004'));
 assert(!chosen.skills.some(x=>x.skillId==='skill:1003'));
 assert.equal(chosen.coverage.uniqueSkillCandidates,2);
});
test('same-name gold and lower skills with separate numeric identities remain separate rows',()=>{
 const m=model([skill('skill:1001','金スキル',[rank('<=',50)]),
  skill('skill:1002','白スキル',[rank('<=',50)])]);
 const x=candidate.previewCard(card(['skill:1001','skill:1002']),m);
 assert.equal(x.coverage.uniqueSkillCandidates,2);
 assert.deepEqual(x.skills.map(s=>s.skillId),['skill:1001','skill:1002']);
});

test('a sole explicit-targeted skill yields a clear direction without pretending activation probability',()=>{
 const x=candidate.previewCard(card(['skill:1004']),model());
 assert.deepEqual(x.coarseDirection,{
  status:'non-dominated-evidence-candidates-not-card-score',
  styles:['先行']
 });
 assert.equal(x.styles['先行'].label,'favorable');
 assert.equal(x.styles['逃げ'].label,'unfavorable');
 assert.equal(x.styles['先行'].explicitTargeted,1);
});
test('mixed-card skill evidence still gives a Pareto-front direction instead of four equally mixed headlines',()=>{
 const skills=[
  skill('skill:1001','前の位置取り',[rank('<=',50)]),
  skill('skill:2001','後方スキル1',[rank('>',50)]),
  skill('skill:2002','後方スキル2',[rank('>',50)]),
  skill('skill:2003','後方スキル3',[rank('>',50)])
 ];
 const c=card(skills.map(s=>s.id));
 const x=candidate.previewCard(c,model(skills));
 assert.equal(x.styles['逃げ'].label,'mixed');
 assert.equal(x.styles['差し'].label,'mixed');
 assert.deepEqual(x.coarseDirection.styles,['差し','追込']);
});
test('conditional-only event rewards remain visible but never create a default favorable headline',()=>{
 const x=candidate.previewCard(
  card([], [{id:'auto1',type:'auto',name:'条件付',rewards:[
   {skillId:'skill:1004',kind:'hint',condition:'未成立の前提'}
  ]}]),model());
 assert.equal(x.coverage.uniqueSkillCandidates,1);
 assert.equal(x.skills[0].availability,'route-conditional-only');
 assert.equal(x.styles['先行'].conditionalFavorable,1);
 assert.equal(x.styles['先行'].headlineFavorable,0);
 assert.equal(x.styles['先行'].label,'unresolved');
 assert.equal(x.coarseDirection.status,'not-distinguishable-with-current-evidence');
 assert.deepEqual(x.coarseDirection.styles,[]);
});
test('equal evidence favoring all four styles is non-discriminating, not a forced recommendation',()=>{
 const p=card(['skill:1001','skill:1005']);
 const x=candidate.previewCard(p,model());
 assert.equal(x.coarseDirection.status,'not-distinguishable-with-current-evidence');
 assert.deepEqual(x.coarseDirection.styles,[]);
});

test('missing skill source is unknown, never a low grade or omitted from coverage',()=>{
 const m=model();
 m.skillById['hint:未照合']={id:'hint:未照合',name:'未照合'};
 const r=candidate.previewCard(card(['hint:未照合','skill:1003']),m);
 assert.equal(r.coverage.uniqueSkillCandidates,2);
 assert.equal(r.coverage.unmatchedSkills,1);
 for(const name of candidate.STYLES){
  assert.equal(r.styles[name].label,'unresolved');
  assert(r.styles[name].unknown>0);
 }
});
