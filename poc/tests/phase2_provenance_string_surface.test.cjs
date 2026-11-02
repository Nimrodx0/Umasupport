'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {project}=require('../src/phase2_title_choice_projection.cjs');
const {inspect}=require('../src/phase2_provenance_string_surface.cjs');
const fixture=()=>{
 const raw={schemaVersion:1,cards:[{cardId:'30080',coverageStatus:'partial',
 events:[
  {id:'gt-30080-event-006',name:'見出し',type:'choice',
   choices:[{id:'choice-01',label:'本文の架空の表現',
    outcomes:[{id:'result-01',label:'成功の本文',
      rewards:[{skillId:'skill:910001',verifiedSkillName:'架空スキル',level:2}],
      effects:[{kind:'bond',delta:5,sourceEffectOrdinal:1}]}]}]},
  {id:'usl:30080:chain:1',name:'架空の追加イベント',type:'auto',
   requires:{all:[{eventId:'gt-30080-event-006',choiceId:'choice-01'}]},
   rewards:[],effects:[{kind:'speed',delta:10,sourceComponent:'event-result'}]}
 ]}]};
 return project(raw).catalog;
};
test('classifies every string leaf and never returns source names, IDs or prose',()=>{
 const c=fixture(),before=JSON.stringify(c),r=inspect({catalog:c});
 assert.equal(r.counts.titles,2);
 assert.equal(r.counts.sourceOrdinalEventIds,1);
 assert.equal(r.counts.curatedEventIds,1);
 assert.equal(r.counts.generatedChoiceLabels,1);
 assert.equal(r.counts.generatedOutcomeLabels,1);
 assert.equal(r.counts.verifiedSkillNames,1);
 assert.equal(r.counts.referenceIdTokens,2);
 assert.equal(r.counts.unknownStringLeaves,0);
 assert.equal(r.contract.publicationApproved,false);
 const out=JSON.stringify(r);
 for(const source of ['見出し','架空スキル','gt-30080','choice-01','本文の架空の表現'])
  assert.equal(out.includes(source),false);
 assert.equal(JSON.stringify(c),before);
});
test('rejects unclassified narrative text rather than calling it a fact',()=>{
 const c=fixture();c.cards[0].events[0].rewards=[{skillId:'skill:12',condition:'解説文章'}];
 assert.throws(()=>inspect({catalog:c}),/想定外の文字列フィールド/);
});
test('rejects dialogue that reaches a selected choice or outcome',()=>{
 const c=fixture();c.cards[0].events[0].choices[0].label='元サイトの説明文';
 assert.throws(()=>inspect({catalog:c}),/選択肢の元の文章/);
 const d=fixture();d.cards[0].events[0].choices[0].outcomes[0].label='結果を説明した文章';
 assert.throws(()=>inspect({catalog:d}),/結果の元の文章/);
});
test('retains but flags markup/newlines in event titles; does not infer legality from length',()=>{
 const c=fixture();c.cards[0].events[0].name='小さな<title>\n改行';
 const r=inspect({catalog:c});
 assert.equal(r.counts.titlesWithMarkupOrNewlines,1);
 assert.equal(r.contract.upstreamTermsOrRightsResolved,false);
 assert.equal(JSON.stringify(r).includes('<title>'),false);
});
test('rejects foreign fields and hostile value locations',()=>{
 const c=fixture();c.cards[0].events[0].choices[0].annotation='説明';
 assert.throws(()=>inspect({catalog:c}),/想定外の文字列フィールド/);
 const d=fixture();d.cards[0].events[0].effects=[{kind:'原作の台詞',delta:5}];
 assert.throws(()=>inspect({catalog:d}),/想定外の文字列フィールド/);
 const e=fixture();e.cards[0].events[0].id='something-else';
 assert.throws(()=>inspect({catalog:e}),/未知のイベントID系列/);
});
test('strict audit will not mistake synthetic 2-event sample for complete real 2512 catalog',()=>{
 assert.throws(()=>inspect({catalog:fixture()},{strict:true}),/固定2512件/);
});
