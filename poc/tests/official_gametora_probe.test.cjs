'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {TARGETS,pageUrl,robotsDisallows,inspectPage,visibleHtml}=require('../src/official_gametora_probe.cjs');
test('hard-limited, fixed three-card allowlist; no arbitrary card or URL',()=>{
 assert.equal(TARGETS.length,3);
 assert.equal(pageUrl(TARGETS[0]),'https://gametora.com/ja/umamusume/supports/30001-special-week');
 assert.throws(()=>pageUrl({cardId:'30002',slug:'anything'}),/登録外/);
 assert.throws(()=>pageUrl({cardId:'30322',slug:'unreviewed'}),/登録外/);
});
test('robots disallow for a route must stop acquisition, unrelated routes do not',()=>{
 const robots=['User-agent: *','Disallow: /patron-zone','Disallow: /ja/umamusume/supports/30322-','Sitemap: https://gametora.com/sitemap.xml'].join('\n');
 assert.deepEqual(robotsDisallows(robots,'/ja/umamusume/supports/30322-mayano-top-gun'),['/ja/umamusume/supports/30322-']);
 assert.deepEqual(robotsDisallows(robots,'/ja/umamusume/supports/30001-special-week'),[]);
});
test('static visible heading detection with no claims about choice/reward data',()=>{
 const html='<html><head><title>スペシャルウィーク (SSR) サポートカード | GameTora</title>'+
 '</head><body><h2>育成イベント</h2><h3>連続イベント</h3>'+
 '<button>example</button><h3>ランダムイベント</h3></body></html>';
 const r=inspectPage(html,TARGETS[0]);
 assert.equal(r.pageLikelySupport,true);
 assert.equal(r.trainingEventHeadingInInitialHtml,true);
 assert.equal(r.chainHeadingInInitialHtml,true);
 assert.equal(r.randomHeadingInInitialHtml,true);
 assert.equal(r.eventChoicesAndRewardsVerified,false);
 assert.equal(r.automaticDatabaseUpdateAllowed,false);
 assert.equal(JSON.stringify(r).includes('example'),false);
});
test('hydrated text in scripts does not masquerade as visible event content',()=>{
 const html='<title>サポートカード</title><script>window.payload={"育成イベント":"連続イベント"};</script>'+
 '<div>card only</div>';
 const r=inspectPage(html,TARGETS[1]);
 assert.equal(r.trainingEventHeadingInInitialHtml,false);
 assert.equal(r.chainHeadingInInitialHtml,false);
 assert.equal(r.eventChoicesAndRewardsVerified,false);
 assert.doesNotMatch(visibleHtml(html),/window.payload/);
});
test('empty and huge inputs are rejected before any publication path',()=>{
 assert.throws(()=>inspectPage('',TARGETS[0]),/HTML/);
 assert.throws(()=>inspectPage('x'.repeat(2*1024*1024+1),TARGETS[0]),/サイズ/);
});

test('hydration inspection only emits numeric structure counts; no original data',()=>{
 const json=JSON.stringify({props:{pageProps:{
  events:[{choices:[{effects:[{type:'skill_hint',skill_id:12345}],outcomes:[[]]}]}],
  sourceProse:'fictional text not for publication'
 }}});
 const html='<script id="__NEXT_DATA__" type="application/json">'+json+'</script>';
 const {inspectInitialJson}=require('../src/official_gametora_probe.cjs');
 const info=inspectInitialJson(html);
 assert.equal(info.found,true);
 assert.equal(info.parsed,true);
 assert.equal(info.hasPageProps,true);
 assert.equal(info.counts.eventLikeRecords,1);
 assert.equal(info.counts.choiceArrays,1);
 assert.equal(info.counts.effectArrays,1);
 assert.equal(info.counts.outcomeArrays,1);
 assert.equal(info.counts.skillIdFields,1);
 assert.equal(info.eventChoicesAndRewardsVerified,false);
 assert.equal(JSON.stringify(info).includes('fictional text'),false);
 assert.equal(inspectInitialJson('<script id="__NEXT_DATA__">broken</script>').parsed,false);
});
