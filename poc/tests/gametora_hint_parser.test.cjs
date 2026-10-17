'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {extractHints}=require('../tools/probe_gametora_hint_page.cjs');
const sample='\nサポート効果\nヒントLvアップ\n20%\nサポートヒント\n\n'+
 '育成中でヒントが発生するとランダムでもらえるスキル\n'+
 '詳細\n直線巧者\n直線で速度上昇\n詳細\n先行直線○\n先行向け\n'+
 'イベントで貰えるスキル\n詳細\n金スキルA\nイベント報酬\n';
test('hint parser only includes GameTora support hints, not event skills',()=>{
 const r=extractHints(sample);
 assert.equal(r.status,'ok');
 assert.deepEqual(r.names,['直線巧者','先行直線○']);
});
test('missing boundaries and duplicated names fail closed',()=>{
 assert.equal(extractHints('直線巧者').status,'missing-support-hints-heading');
 assert.equal(extractHints(sample.replace('イベントで貰えるスキル','対象外')).status,'missing-next-section-boundary');
 assert.equal(extractHints(sample.replace('先行直線○','直線巧者')).status,'invalid-or-duplicate-skill');
});
test('event-skill section can be omitted when training events follow instead',()=>{
 const t=sample.replace('イベントで貰えるスキル','育成イベント');
 assert.deepEqual(extractHints(t).names,['直線巧者','先行直線○']);
});
