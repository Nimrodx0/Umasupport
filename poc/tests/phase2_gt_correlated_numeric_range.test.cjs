'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {candidates,numeric}=require('../src/phase2_gt_correlated_numeric_range.cjs');
const pin='6e38b54af4fad397ff4491e63007a90705a4fe67';
function fixture(events){
 return {documents:[{kind:'support',id:30001,
  events_ja:Object.fromEntries(events.map((x,i)=>['k'+i,x]))}],
 index:{dataKind:'umasupport-whole-event-provisional-index',
 publicationApproval:false,sourcePins:{gameToraDerived:pin},
 cards:[{cardId:'30001',sourceMissing:false,gameToraObservedCount:events.length}]}
 };
}
const evt=choices=>({name:'THIRD_PARTY_NAME_MUST_NOT_BE_EMITTED',section:'random',choices});
const choice=effects=>({label:'THIRD_PARTY_CHOICE_TEXT',effects,random_either:false});
const e=(type,value,other={})=>({type,value,...other});
test('one shared draw chooses low or high for EVERY range, never 2x2 combinations',()=>{
 const r=candidates(fixture([evt([choice([
  e('speed','+5/+10'),e('energy','-2/-4'),e('skill_hint','+1/+3',{skill_id:123}),
  e('power','+7')])])]));
 assert.deepEqual(r.summary,{sourceRangeEvents:1,sourceRangeCards:1,
  sourceRangeChoices:1,rangedValueMentions:3,rangeEffectComponents:2,
  rangeOutcomeCandidates:1,uncertainChoices:0});
 assert.equal(r.rows.length,1);
 assert.deepEqual(r.rows[0].numericTiers,[
  [{kind:'speed',delta:5,sourceEffectOrdinal:1},
   {kind:'energy',delta:-2,sourceEffectOrdinal:2},
   {kind:'power',delta:7,sourceEffectOrdinal:4}],
  [{kind:'speed',delta:10,sourceEffectOrdinal:1},
   {kind:'energy',delta:-4,sourceEffectOrdinal:2},
   {kind:'power',delta:7,sourceEffectOrdinal:4}]
 ]);
 assert.equal(r.rows[0].sourceIsRandomEither,false);
 assert.equal(r.automaticRuntimeAdoption,false);
 assert.ok(!JSON.stringify(r).includes('THIRD_PARTY'));
});
test('all_stats creates five synchronized stat effects at each tier',()=>{
 const r=candidates(fixture([evt([choice([e('all_stats','+1/+3')])])]));
 assert.equal(r.summary.rangeEffectComponents,5);
 assert.deepEqual(r.rows[0].numericTiers[0].map(x=>x.delta),[1,1,1,1,1]);
 assert.deepEqual(r.rows[0].numericTiers[1].map(x=>x.delta),[3,3,3,3,3]);
});
test('already-random, conditional and unsupported extras do not enter runtime projection',()=>{
 const ev=evt([
  {...choice([e('speed','+1/+2')]),random_either:true,
   outcomes:[[e('power','+3')],[e('power','+9')]]},
  {label:'',segments:[
   {when:[{kind:'mood_min',value:3}],effects:[e('guts','+3/+6')]},
   {when:[{kind:'otherwise'}],effects:[e('guts','+4')]}]},
  choice([e('energy','+1/+2'),e('sga','+3')])
 ]);
 const r=candidates(fixture([ev]));
 assert.equal(r.summary.sourceRangeChoices,3);
 assert.equal(r.summary.uncertainChoices,3);
 assert.ok(r.rows.every(x=>!x.canProjectNumericTiers&&
   !x.numericTiers.length&&x.blockers.length));
});
test('malformed ranges and provenance cannot be silently normalized',()=>{
 for(const value of ['+1/+2/+3','+1/+x','100000000000000000000/+2','1 / 3','foo']){
  assert.equal(numeric(value),null);
 }
 assert.deepEqual(numeric('-10/-20'),[-10,-20]);
 assert.deepEqual(numeric('+3'),[3,3]);
 assert.deepEqual(numeric(5),[5,5]);
 const x=fixture([evt([choice([e('energy','+1/+2')])])]);
 x.index.publicationApproval=true;
 assert.throws(()=>candidates(x),/固定版/);
});
