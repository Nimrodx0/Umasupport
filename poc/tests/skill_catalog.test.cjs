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

test('exact scope groups reconstruct every eligible cell without Cartesian expansion',()=>{
 const fit=require('../src/skill_suitability.js');
 const m=Array(32).fill(0);m[0]=1;m[11]=2;m[20]=5;
 const v=fit.explicitScope({explicitNecessaryMasks:m});
 a.match(v.text,/組合せ条件あり/);a.equal(v.correlated,true);
 a.deepEqual(v.groups,[{pairs:['逃げ・短距離'],surfaces:['芝（良）']},{pairs:['先行・マイル'],surfaces:['ダート（稍重）']},{pairs:['差し・中距離'],surfaces:['芝（良・重）']}]);
 a.equal(cat.scopeSummary(m),v.text);
 a.equal(fit.explicitScope(null).text,'適用範囲未確認');
 a.equal(fit.explicitScope({explicitNecessaryMasks:Array(32).fill(0)}).text,'明示条件の対象外');
 a.equal(fit.explicitScope({explicitNecessaryMasks:Array(32).fill(15)}).correlated,false);
});

test('approved bundle allowlist is version bound and natural-spurt assumption stays internal',()=>{
 a.deepEqual(Object.values(cat.APPROVED_BUNDLES).map(x=>[x.decisionId,x.count]),[['D-052',300],['D-056',324],['D-059',404]]);
 const row={label:{state:'general',styles:[],scope:{kind:'source-logic',contexts:[{distance_type:3,ground_type:1,ground_condition:1}],assumption:'adequate-stamina-standard-build'}}};
 a.deepEqual(cat.evidence(row,{distance_type:3}),{state:'general',styles:[],text:'汎用'});
 a.equal(cat.evidence(row,{distance_type:4}).state,'undetermined');
});

test('hierarchical browse classification separates scope, explicit restriction, preference and unknown',()=>{
 const r=(mask,label)=>({skill:{id:'x',name:'X'},explicitNecessaryMasks:mask,label});
 const full=Array(32).fill(15),single=Array(32).fill(0);single.fill(15,8,16);
 const targeted={state:'targeted',styles:[3],scope:{kind:'rank-window-fixed-model',branches:[{courseIds:[10502]}]}};
 const ctx={running_style:2,distance_type:2,ground_type:1,ground_condition:1};
 a.equal(cat.assessment(r(single),ctx).category,'explicitOnly');
 a.equal(cat.assessment(r(single),{...ctx,running_style:1}).category,'outside');
 a.equal(cat.assessment(r(null),ctx).category,'scopeUnknown');
 a.equal(cat.assessment(r(full,targeted),ctx).category,'otherTargeted');
 a.equal(cat.assessment(r(full,targeted),{...ctx,running_style:3}).category,'targeted');
 a.equal(cat.assessment(r(full,targeted),{...ctx,ground_type:2}).category,'undetermined');
 a.equal(cat.filter([r(single)],{context:ctx,suitability:'supported'}).length,1);
 a.equal(cat.filter([r(null)],{context:ctx,suitability:'undetermined'}).length,0);
 a.equal(cat.filter([r(full,targeted)],{context:ctx,suitability:'otherTargeted'}).length,1);
 a.equal(cat.filter([r(null)],{suitability:'undetermined'}).length,1);
});
