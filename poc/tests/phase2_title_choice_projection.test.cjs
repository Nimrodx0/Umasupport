'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./private_local_2512_fixture.cjs');
const {project,verifyPrivate}=require('../src/phase2_title_choice_projection.cjs');
test('full-size artificial 563 / 2512 titles survive and both options are explicitly provisional',()=>{
 const f=fixture(),source=JSON.stringify(f.bundle.catalog);
 const output=project(f.bundle.catalog);
 assert.equal(output.catalog.cards.length,563);
 assert.equal(output.counts.events,2512);
 assert.equal(output.counts.titlesPreserved,2512);
 const original=f.bundle.catalog.cards[0].events[0],
  e=output.catalog.cards[0].events[0];
 assert.equal(e.name,original.name);
 assert.equal(e.id,original.id);
 assert.equal(e.choices[0].label,'選択肢1（仮）');
 assert.equal(e.choices[1].label,'選択肢2（仮）');
 assert.equal(e.choices[0].id,original.choices[0].id);
 assert.deepEqual(e.choices[0].rewards,original.choices[0].rewards);
 assert.equal(JSON.stringify(f.bundle.catalog),source);
 const checked=verifyPrivate({catalog:f.bundle.catalog,model:f.model,skillText:f.skillText},{strict:false});
 assert.equal(checked.productionRoutesVerifiedCardStates,1126);
 assert.equal(checked.existingReleaseGateBlocked,true);
 assert.equal(checked.publicEventsAdded,0);
 assert.equal(checked.allLogicStructurallyIdentical,true);
});
test('nested exclusive result labels and all numeric branches are preserved without copying dialogue',()=>{
 const f=fixture();
 const original=f.bundle.catalog.cards[0].events[0];
 original.choices[0].rewards=undefined;
 delete original.choices[0].rewards;
 original.choices[0].outcomes=[
  {id:'won',label:'これは原作の長い成功台詞で公開不可',rewards:[
   {skillId:'skill:700001',level:2,verifiedSkillName:'架空ヒント'}]},
  {id:'lost',label:'これは原作の長い失敗台詞で公開不可',rewards:[]}
 ];
 const v=project(f.bundle.catalog);
 const e=v.catalog.cards[0].events[0];
 assert.equal(e.name,original.name);
 assert.deepEqual(e.choices[0].outcomes.map(x=>x.label),
  ['結果1（仮）','結果2（仮）']);
 assert.deepEqual(e.choices[0].outcomes.map(x=>x.id),['won','lost']);
 const check=verifyPrivate({catalog:f.bundle.catalog,model:f.model,skillText:f.skillText},{strict:false});
 assert.equal(check.existingReleaseGateBlocked,true);
 assert.equal(check.allLogicStructurallyIdentical,true);
});
test('unclassified prose or narrative on any event / option / result / reward fails closed',()=>{
 const f=fixture();
 const cases=[
  [e=>{e.story='禁止したい原文';},'story'],
  [e=>{e.choices[0].dialogue='元のゲーム台詞';},'dialogue'],
  [e=>{e.choices[0].rewards[0].condition='情緒的な文言';},'自由記述条件'],
  [e=>{e.name='';},'イベント名'],
 ];
 for(const [edit,expect] of cases){
  const input=structuredClone(f.bundle.catalog);
  edit(input.cards[0].events[0]);
  assert.throws(()=>project(input),new RegExp(expect));
 }
});
