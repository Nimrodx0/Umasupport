'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const tag=require('../src/skill_condition_tags.js');
const profile=require('../src/skill_condition_profiles.js');
const c=(type,operator,value)=>({type,operator,value});
const invoke=(preConditions,conditions,effects=[{type:'targetSpeed',value:1000}],index=0)=>
 ({preConditions,conditions,effects,index});
function registry(rows=[]){
 const others=Array.from({length:110},(_,i)=>({id:String(810000+i),
  name:'架空の検証専用'+i,rarity:'normal',group:810000+i,
  invokes:[invoke([],[[c('phase','==',1)]])] }));
 return JSON.stringify([...rows,...others]);
}
const skill=(id,name,sourceNumericId)=>({id,name,...(sourceNumericId?{sourceNumericId}:{})});
function model(skills){
 return {skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
  cards:[{id:'301',events:[{id:'evt',rewards:[{skillId:'skill:100'}]}]}],
  meta:{}};
}
test('P1 keeps per-invoke OR-of-AND groups and preconditions separate from activation',()=>{
 const rows=[{id:'100',name:'実験の前方スキル',rarity:'normal',group:100,
  info:['レース中盤に速度が上がる＜作戦・先行＞'],
  invokes:[invoke([[c('running_style','==',2),c('phase','==',1)],
    [c('running_style','==',3)]],
    [[c('distance_type','!=',4),c('ground_type','==',1)],
     [c('ground_type','==',2)]])]}];
 const m=model([skill('skill:100','実験の前方スキル','100'),
  skill('hint:出典未収録','出典未収録')]);
 const previousEvent=JSON.stringify(m.cards);
 const report=profile.attach(m,{skillText:registry(rows)});
 assert.equal(report.matched,1);
 assert.equal(report.unavailable,1);
 assert.equal(report.explicitPredicates,5);
 assert.equal(m.skillById['hint:出典未収録'].activationProfile.status,'unavailable');
 const p=m.skillById['skill:100'].activationProfile;
 assert.equal(p.status,'source-structure');
 assert.equal(p.source,'current');
 assert.deepEqual(p.angleTags,[{text:'作戦・先行',dimensions:{style:['先行'],distance:[],surface:[]},
   infoIndex:0,origin:'publisher-info-angle'}]);
 assert.equal(p.invokes.length,1);
 assert.equal(p.invokes[0].preConditions.length,2);
 assert.equal(p.invokes[0].preConditions[0].length,2);
 assert.equal(p.invokes[0].conditions.length,2);
 assert.equal(p.invokes[0].conditions[0][0].operator,'!=');
 assert.equal(p.invokes[0].conditions[0][0].valueLabel,'長距離');
 assert.equal(p.invokes[0].conditions[1][0].valueLabel,'ダート');
 assert.equal(p.invokes[0].preConditions[0][0].axis,'style');
 assert.equal(p.invokes[0].preConditions[0][1].axis,undefined);
 assert.equal(JSON.stringify(m.cards),previousEvent,
  'Approved event data must remain untouched');
});
test('multiple invokes and conditional effects are not conflated into one universally valid tag',()=>{
 const src={id:'102',name:'分岐検証',rarity:'rare',group:102,
  info:['効果検証'],
  invokes:[invoke([],[[c('running_style','==',1)]],[{type:'targetSpeed'}],0),
   invoke([],[[c('distance_type','==',2)]],[{type:'targetSpeed'},{type:'targetAccel'}],1)]};
 const m=model([skill('skill:102','分岐検証','102')]);
 profile.attach(m,{skillText:registry([src])});
 const inv=m.skills[0].activationProfile.invokes;
 assert.equal(inv.length,2);
 assert.equal(inv[0].conditions[0][0].valueLabel,'逃げ');
 assert.equal(inv[1].conditions[0][0].valueLabel,'マイル');
 assert.deepEqual(inv[1].effectTypes,['targetSpeed','targetAccel']);
 assert.equal(m.skills[0].activationProfile.angleTags.length,0);
});
test('pinned source numeric identity is not overridden by moving dictionary name reuse',()=>{
 const m=model([skill('skill:111','固定された名前','111')]);
 const live=registry([{id:'111',name:'別名',rarity:'normal',group:111,
  invokes:[invoke([],[[c('running_style','==',4)]])]}]);
 const pinned=registry([{id:'111',name:'固定された名前',rarity:'normal',group:111,
  invokes:[invoke([],[[c('ground_type','==',1)]])]}]);
 const report=profile.attach(m,{skillText:live,pinnedSkillText:pinned});
 assert.equal(report.pinned,1);
 assert.equal(m.skills[0].activationProfile.invokes[0].conditions[0][0].valueLabel,'芝');
});
test('name-only hints require unique exact dictionary match',()=>{
 const m=model([skill('hint:同名','同名')]);
 const text=registry([{id:'101',name:'同名',rarity:'normal',group:101,invokes:[invoke([],[])]},
  {id:'102',name:'同名',rarity:'rare',group:102,invokes:[invoke([],[])]}]);
 const report=profile.attach(m,{skillText:text});
 assert.equal(report.unavailable,1);
 assert.equal(m.skills[0].activationProfile.status,'unavailable');
});
test('missing source is unknown, not free of restrictions or general-purpose',()=>{
 const m=model([skill('skill:200801','先行駆け引き','200801')]);
 assert.equal(profile.attach(m,{}).unavailable,1);
 assert.deepEqual(m.skills[0].activationProfile,
  {status:'unavailable',reason:'skill-dictionary-id-name-unmatched',
   angleTags:[],invokes:[]});
});
test('invalid predicate syntax rejects every staged attachment atomically',()=>{
 const m=model([skill('skill:102','分岐検証','102'),skill('skill:103','別のスキル','103')]);
 const text=registry([
  {id:'102',name:'分岐検証',rarity:'normal',group:102,invokes:[invoke([],[])]},
  {id:'103',name:'別のスキル',rarity:'normal',group:103,
   invokes:[invoke([],[[c('distance_type','??',2)]])]}
 ]);
 assert.throws(()=>profile.attach(m,{skillText:text}),/Invalid conditions predicate/);
 assert.equal(m.skills[0].activationProfile,undefined);
 assert.equal(m.meta.skillConditionProfiles,undefined);
});
test('P1 tag grammar supports combined and slash categories but not numeric comparisons',()=>{
 assert.deepEqual(tag.recognized(['＜作戦・逃げ＞','＜マイル/中距離＞',
  '必要な比較: order_rate<=30&distance_type==2','<芝>','<50、順位>'])
   .map(x=>({text:x.text,dimensions:x.dimensions})),[
  {text:'作戦・逃げ',dimensions:{style:['逃げ'],distance:[],surface:[]}},
  {text:'マイル/中距離',dimensions:{style:[],distance:['マイル','中距離'],surface:[]}},
  {text:'芝',dimensions:{style:[],distance:[],surface:['芝']}}
 ]);
});
