'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {registryFromSkillText,matchContextToId,summarizeHints}=
 require('../src/official_gametora_skill_id_crosswalk.cjs');
function fixture(){
 const entries=Array.from({length:100},(_,i)=>({id:String(800000+i),
  name:'合成スキル'+i,rarity:'normal',group:i}));
 entries.push(
  {id:'200512',name:'練習上手',rarity:'normal',group:21},
  {id:'200513',name:'練習上手',rarity:'rare',group:22},
  {id:'200514',name:'上り坂',rarity:'normal',group:23},
  {id:'200515',name:'坂',rarity:'normal',group:24},
  {id:'200516',name:'登山家',rarity:'rare',group:25}
 );
 return registryFromSkillText(JSON.stringify(entries));
}
test('one exact hinted skill can be matched to numeric id without outputting name',()=>{
 const reg=fixture();
 const r=matchContextToId('「登山家」のヒントLv +2',reg);
 assert.deepEqual(r,{status:'unique-verified-name',numericId:'200516',rarity:'rare'});
 assert.doesNotMatch(JSON.stringify(r),/登山家/);
 assert.equal(matchContextToId('『上り坂』のヒントLv +1',reg).numericId,'200514');
 assert.equal(matchContextToId('ステータス スピード +10',reg).status,'not-a-hint');
});
test('ambiguous same-name numeric IDs remain unresolved',()=>{
 const r=matchContextToId('「練習上手」のヒントLv +2',fixture());
 assert.equal(r.status,'ambiguous-name-or-id');
 assert.equal(r.numericId,undefined);
});
test('independent different skill names in same context remain ambiguous',()=>{
 const r=matchContextToId('登山家のヒントLv +1、上り坂のヒントLv +2',fixture());
 assert.equal(r.status,'ambiguous-name-or-id');
 assert.equal(r.numericId,undefined);
});
test('unquoted and unbounded context does not silently map a skill name',()=>{
 const s='別のテキストと登山家'.repeat(20)+'。ヒントLv +2';
 assert.equal(matchContextToId(s,fixture()).status,'name-needs-context-verification');
});
test('historical reference can only confirm aggregate ID frequency, not route or value pairing',()=>{
 const old={choices:[
  {effects:[{type:'skill_hint',skill_id:200516,value:'+2'}]},
  {outcomes:[
   [{type:'skill_hint',skill_id:200514,value:'+1'}],
   [{type:'skill_hint',skill_id:200516,value:'+3'}]
  ]}
 ]};
 const observed=[
  {status:'unique-verified-name',numericId:'200516'},
  {status:'unique-verified-name',numericId:'200514'},
  {status:'unique-verified-name',numericId:'200516'}
 ];
 const r=summarizeHints(old,observed);
 assert.equal(r.referenceHintOccurrences,3);
 assert.equal(r.referenceIdOccurrencesMatched,3);
 assert.equal(r.hintLevelPairedWithIdVerified,false);
 assert.equal(r.outcomeAndChoicePairingVerified,false);
 assert.equal(r.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(r),/登山家/);
});
