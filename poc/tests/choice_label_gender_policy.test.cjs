'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {MALE_CHOICE_GENDER,selectMaleChoiceLabel,selectMaleChoices}
 =require('../src/choice_label_gender_policy.cjs');
test('a gender-dependent dialogue always selects male, not female or arbitrary fallback',()=>{
 const result=selectMaleChoiceLabel({genderVariants:{
  male:'ここで全力を出さない方がいいぞ',
  female:'ここで全力を出さない方がいいよ'
 }});
 assert.equal(MALE_CHOICE_GENDER,'male');
 assert.equal(result.gender,'male');
 assert.equal(result.label,'ここで全力を出さない方がいいぞ');
 assert.equal(result.publicationApproved,false);
});
test('unavailable male label remains unresolved even when female label exists',()=>{
 const result=selectMaleChoiceLabel({genderVariants:{
  male:null,female:'女性向けの台詞'
 }});
 assert.equal(result.status,'male-label-missing');
 assert.equal(result.label,null);
 assert.equal(JSON.stringify(result).includes('女性向け'),false);
});
test('male-only, gender-independent source has the same fixed display gender',()=>{
 const result=selectMaleChoiceLabel({genderVariants:{male:'共通のセリフ'}});
 assert.equal(result.label,'共通のセリフ');
 assert.equal(result.gender,'male');
});
test('event choice order and ids do not depend on trainer gender',()=>{
 const v=selectMaleChoices({cardId:'30001',eventId:'e1',
  choices:[
   {genderVariants:{male:'上の選択肢',female:'女子の上の選択肢'},id:'a'},
   {genderVariants:{male:'下の選択肢',female:'女子の下の選択肢'},id:'b'}
  ]});
 assert.equal(v.choices.length,2);
 assert.deepEqual(v.choices.map(x=>x.ordinal),[1,2]);
 assert.deepEqual(v.choices.map(x=>x.label),['上の選択肢','下の選択肢']);
 assert.equal(v.automaticPublicationAllowed,false);
});
test('malformed variants are rejected, never silently relabeled',()=>{
 assert.throws(()=>selectMaleChoiceLabel({genderVariants:{male:'a',other:'b'}}),/未定義/);
 assert.throws(()=>selectMaleChoiceLabel({genderVariants:{male:'a',female:1}}),/不正/);
 assert.throws(()=>selectMaleChoiceLabel({genderVariants:'male'}),/未指定/);
});
