'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/rank_band_app_identity_audit.cjs');
const c=(type,operator,value)=>({type,operator,value});
const skill=(id,name,rows)=>({id,name,invokes:[{conditions:rows,preConditions:[]}]});
const eligible=(id,name)=>skill(id,name,[[
 c('order_rate','>=',40),c('phase_random','==',1)
]]);
const fixtures=()=>[
 eligible('1001','位置取り'),
 eligible('1002','中盤強者'),
 skill('1003','部分条件',[
  [c('order_rate','>=',40),c('phase_random','==',1)],
  [c('is_overtake','==',1)] ]),
 skill('1004','条件交差',[[
  c('order_rate','>=',40),c('order_rate','<=',80),
  c('phase_random','==',1) ]]),
 eligible('1005','前方支配')
];
const model=items=>({
 skills:items,
 skillById:Object.fromEntries(items.map(x=>[x.id,x])),
 cards:[{id:'30001',events:[]}],
 meta:{skillConditionProfiles:{matched:items.filter(x=>
  x.activationProfile?.status==='source-structure').length}}
});
const app=(id,name,num,ok=true)=>({
 id,name,activationProfile:ok?{status:'source-structure',
  sourceNumericId:num,source:'current'}:{
  status:'unavailable',reason:'unmatched-source'}
});
test('source candidates demand four confirmed statuses and band proof, no partial OR promotion',()=>{
 const rows=m.candidates(fixtures());
 assert.deepEqual(rows.map(x=>x.sourceNumericId),['1001','1002','1005']);
 assert(rows.every(x=>x.evidenceWindows.some(w=>w.includes('|from40'))));
 assert.deepEqual(rows[0].styles,{逃げ:'low',先行:'low',差し:'high',追込:'high'});
});
test('numeric ID and NFKC name both required, and unidentified hint is not a legitimate join',()=>{
 const list=m.candidates(fixtures());
 const appRows=[
  app('skill:1001','位置取り','1001'),
  app('hint:中盤強者','中盤強者','9999'),
  app('skill:9005','前方支配','9005'),
  app('skill:1005','別名','1005')
 ];
 const out=m.reconcile(list,model(appRows));
 assert.equal(out.candidates,3);
 assert.deepEqual(out.summary,{
  exactIdName:1,duplicateAppIdentity:0,
  idNameOrSourceMismatch:1,nameOnlyOrOtherId:1,
  notInAppCatalog:0});
 assert.equal(out.items[0].status,'exact-id-name');
 assert.equal(out.items[0].appSkills[0].id,'skill:1001');
 assert.equal(out.items[1].status,'name-only-or-other-id');
 assert.equal(out.items[2].status,'id-name-or-source-mismatch');
 assert.deepEqual(out.items[2].conflictingAppIds,['skill:1005']);
});
test('verified named hint can join only if its attached numeric source identity agrees',()=>{
 const source=m.candidates([eligible('1001','位置取り')]);
 const out=m.reconcile(source,model([
  app('hint:位置取り','位置取り','1001')
 ]));
 assert.equal(out.summary.exactIdName,1);
 assert.equal(out.items[0].appSkills[0].activationSource,'current');
});
test('unknown, duplicated and ID-conflicting skills never count as exact',()=>{
 const source=m.candidates([eligible('1001','位置取り'),eligible('1002','中盤強者')]);
 const x=m.reconcile(source,model([
  app('hint:位置取り','位置取り','1001',false),
  app('skill:1001','位置取り','1001'),
  app('skill:another','位置取り','1001'),
  app('skill:1002','別名','1002')
 ]));
 assert.equal(x.summary.duplicateAppIdentity,1);
 assert.equal(x.summary.idNameOrSourceMismatch,1);
 assert.equal(x.summary.exactIdName,0);
 assert.equal(x.summary.notInAppCatalog,0);
 const n=m.reconcile(source,model([]));
 assert.equal(n.summary.notInAppCatalog,2);
});
test('bad source IDs, duplicate source candidates and malformed app model fail closed',()=>{
 const rows=m.candidates([eligible('1001','位置取り')]);
 assert.throws(()=>m.reconcile([...rows,rows[0]],model([])),/duplicate candidate/);
 assert.throws(()=>m.reconcile([{sourceNumericId:'abc',sourceName:'x'}],model([])),
  /Invalid or duplicate candidate/);
 assert.throws(()=>m.candidates([eligible('1001','x'),eligible('1001','x')]),
  /Duplicate source skill candidate/);
 assert.throws(()=>m.reconcile(rows,{}),/Missing audited source/);
});
