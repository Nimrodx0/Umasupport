'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),cat=require('../src/skill_catalog.js');
const p=(type,value,operator='==')=>({type,value,operator});
const profile=(conditions,preConditions=[])=>({status:'source-structure',invokes:[{conditions,preConditions}]});
test('AND/OR and preconditions retain correlated scope; unknown is not outside',()=>{
 const m=cat.masks(profile([[p('running_style',1),p('distance_type',2)],[p('running_style',3),p('distance_type',3)]],[[p('ground_type',1)]]));
 a.equal(m[2],15);a.equal(m[3],0);a.equal(m[20],15);a.equal(m[18],0);
 a.match(cat.scopeSummary(m),/組合せ条件あり/);
 const skills=[{id:'a',name:'A',tier:'white',activationProfile:profile([[p('running_style',1)]])},{id:'b',name:'B'}];
 const rows=cat.index({skills});
 a.deepEqual(cat.filter(rows,{context:{running_style:2}}).map(x=>x.skill.id),['b']);
 a.equal(cat.filter(rows,{context:{running_style:2},scope:'confirmed'}).length,0);
 a.deepEqual(cat.filter(rows,{scope:'all'}).map(x=>x.skill.id),['a','b']);
 const impossible={skill:{id:'c',name:'C'},explicitNecessaryMasks:Array(32).fill(0)};
 a.equal(cat.filter([impossible]).length,1,'no axes selected: all catalogue skills');
 a.equal(cat.filter([impossible],{context:{running_style:1}}).length,0);
});
test('catalogue labels respect evidence scope without requiring speculative roster input',()=>{
 const r={skill:{id:'x',name:'X'},explicitNecessaryMasks:Array(32).fill(15),label:{state:'targeted',styles:[3,4],scope:{kind:'rank-window-fixed-model',branches:[{courseIds:[10502]}]}}};
 a.equal(cat.evidence(r,{distance_type:2,ground_type:1}).state,'targeted');
 a.equal(cat.evidence(r,{distance_type:3}).state,'undetermined');
 a.equal(cat.evidence(r,{ground_type:2}).state,'undetermined');
 a.equal(cat.filter([r],{context:{running_style:1},suitability:'targeted'}).length,0);
 a.equal(cat.filter([r],{context:{running_style:3},suitability:'targeted'}).length,1);
 a.match(cat.evidence(r,{}).text,/限定/);
});
test('invalid imported data fails closed without a fetch',async()=>{
 const bytes=new TextEncoder().encode('{}').buffer;
 await a.rejects(cat.loadLabels(bytes,{skillById:{}},{fetcher:()=>{throw Error('must not fetch')}}),/一致しません/);
});
