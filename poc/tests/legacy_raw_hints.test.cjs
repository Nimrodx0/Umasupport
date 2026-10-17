'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseLegacy}=require('../tools/audit_legacy_raw_hints.cjs');
test('historical raw parse splits jpg and png card records',()=>{
 const raw='ヘッダー\n画像\t名前\tレアリティ\nキャラ1\n'+
  '［Title］キャラ1_icon.jpg\t［Title］キャラ1\tSSR\tスピード\t直線巧者<中>\nウマ好み\tイベント獲得\t2025.01.01\t編集\n'+
  'キャラ2\n［トレセン学園］キャラ2_icon.png\t［トレセン学園］キャラ2\tR\t根性\tなし\t\t2025.01.02\t編集';
 const res=parseLegacy(raw);
 assert.equal(res.totalMarkers,2);
 assert.equal(res.rows.length,2);
 assert.deepEqual([...res.rows[0].skillNames],['直線巧者','ウマ好み']);
 assert.equal(res.rows[1].skillNames.size,0);
});
test('unusable malformed source blocks are quarantined',()=>{
 const raw='［Title］キャラ1_icon.jpg\t［Title］キャラ1\tSSR\tスピード\tx\ty\t2025.01.01\t編集\textra';
 const res=parseLegacy(raw);
 assert.equal(res.rows.length,0);
 assert.equal(res.parsingExceptions.length,1);
});
