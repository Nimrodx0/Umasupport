'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {audit,displayName}=require('../tools/audit_deckbuilder_cards.cjs');
function fake(){
 const cards=[];
 for(let j=1;j<=501;j++)for(let stage=0;stage<5;stage++){
  const f=Array(62).fill('0');f[0]=String(30000+j);f[1]='[Title '+j+']ホース'+j;
  f[3]='3';f[4]=String(stage);f[6]='スピード';f[59]='ヒントA,ヒントB';
  cards.push(f.join('\t'));
 }
 return cards.join('\n');
}
test('unbracketed and already bracketed external titles use the same normalized key',()=>{
 assert.equal(displayName({Title:'Title',CharacterName:'ウマ'}),'[Title]ウマ');
 assert.equal(displayName({Title:'［トレセン学園］',CharacterName:'ウマ'}),'[トレセン学園]ウマ');
});
test('combined event list extras are not reported as a hint conflict',()=>{
 const source=fake(), external=[];
 for(let i=1;i<=101;i++)external.push({Title:'Title '+i,CharacterName:'ホース'+i,Rarity:'SSR',Skills:['ヒントA','ヒントB','イベント報酬']});
 const r=audit(source,external);
 assert.equal(r.matchedCards,101);
 assert.equal(r.missingNormalHintLinks,0);
 assert.equal(r.combinedSkillExtraLinks,101);
 assert.equal(r.allNormalHintsIncludedCards,101);
});
test('missing usual hint classified instead of silently ignoring it',()=>{
 const source=fake(), external=[];
 for(let i=1;i<=101;i++)external.push({Title:'Title '+i,CharacterName:'ホース'+i,Rarity:'SSR',Skills:i===1?['ヒントA']:['ヒントA','ヒントB']});
 const r=audit(source,external);
 assert.equal(r.missingNormalHintLinks,1);
 assert.equal(r.cardsWithMissingNormalHints,1);
 assert.equal(r.missingNamesByCard[0].missingNames[0],'ヒントB');
});
test('duplication and low-quality input fail safely',()=>{
 const source=fake(), external=Array.from({length:101},(_,i)=>({Title:'Title '+(i+1),CharacterName:'ホース'+(i+1),Rarity:'SSR',Skills:['ヒントA','ヒントB']}));
 external[1]={...external[0]};
 assert.throws(()=>audit(source,external),/Repeated external/);
});

test('seven aliases are explicit; unrelated character name never silently matched',()=>{
 const names=[
  '[”最強”なる眷属]ドゥラメンテ',
  '[ずーっと一緒、だぞー!]ブラストワンピース',
  '[その執念は怒涛が如く]メイショウドトウ',
  '[ゆるり、ゆこま旅館]]保科健子',
  '[わたしときみの交換こ]ハルウララ',
  '[永遠の誓い、永遠の輝き]サトノダイヤモンド',
  '[鈴凜なるビスクドール]アドマイヤグルーヴ'
 ];
 assert.equal(new Set(names).size,7);
 assert.notEqual(displayName({Title:'Title One',CharacterName:'ホース'}),names[0]);
});

test('reviewed source-name alias is accepted only for exact recorded card identity',()=>{
 const canonical='[“最強”なる眷属]ドゥラメンテ';
 const support=fake().replaceAll('[Title 321]ホース321',canonical);
 const ext=[{Title:'”最強”なる眷属',CharacterName:'ドゥラメンテ',
   Rarity:'SSR',Category:'パワー',Skills:['ヒントA','ヒントB']}];
 for(let i=1;i<=100;i++)ext.push({Title:'Title '+i,CharacterName:'ホース'+i,
  Rarity:'SSR',Skills:['ヒントA','ヒントB']});
 const got=audit(support,ext);
 assert.equal(got.reviewedAliases.length,1);
 assert.equal(got.reviewedAliases[0].id,30321);
 assert.equal(got.matchedCards,101);
 assert.throws(()=>audit(support,ext.map((x,i)=>i===0?{...x,Category:'賢さ'}:x)),
  /Reviewed alias identity changed/);
 const changed=support.replaceAll(canonical,'[未知の同名カード]ドゥラメンテ');
 assert.throws(()=>audit(changed,ext),/Reviewed alias identity changed/);
});
