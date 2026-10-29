'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseCardScope,compareIndependentCensus}=
 require('../tools/probe_official_gametora_structural_sample.cjs');

const raw=(groups,ors,signed)=>({
 bodyFound:true,panelHasText:true,
 bodyGroupCount:groups,orLeafCount:ors,signedOwnTextCount:signed
});
const piece=(g,r,texts)=>({
 choiceOrdinal:g,outcomeOrdinal:r,numericEffectTexts:texts
});
test('only the bounded predeclared structural cohorts can be visited',()=>{
 assert.deepEqual(parseCardScope('30030,30041'),['30030','30041']);
 assert.deepEqual(parseCardScope('30080'),['30080']);
 for(const x of ['30322','30030,30322','30030,30030',
  '30030,30041,30080','','30030,','https://gametora.com/ja/umamusume/supports'])
  assert.throws(()=>parseCardScope(x),/対象/);
});
test('independently counted leaves and alternatives exactly match extracted positions',()=>{
 const x=compareIndependentCensus(raw(2,1,3),[
  piece(1,1,['体力 +5']),piece(1,2,['体力 +15']),piece(2,1,['やる気 +1'])
 ]);
 assert.equal(x.parsedRoutes,3);
 assert.deepEqual(x.discrepancies,[]);
});
test('fail-open-shaped omissions are exposed instead of counting as validated',()=>{
 assert.deepEqual(compareIndependentCensus(raw(2,1,3),[
  piece(1,1,['体力 +5']),piece(2,1,['やる気 +1'])
 ]).discrepancies,['site-or-to-extractor-count-diff','site-signed-leaf-to-extractor-count-diff']);
 assert.deepEqual(compareIndependentCensus(raw(3,0,1),[
  piece(1,1,['体力 +5'])
 ]).discrepancies,['site-group-to-extractor-count-diff']);
 const absent=compareIndependentCensus({
  bodyFound:false,panelHasText:true,bodyGroupCount:0,
  orLeafCount:0,signedOwnTextCount:0
 },[]);
 assert.deepEqual(absent.discrepancies,['nonempty-panel-without-recognized-body']);
});
