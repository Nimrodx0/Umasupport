'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {audit,displayName}=require('../tools/audit_deckbuilder_cards.cjs');
function source(){
 const rows=[];
 for(const [id,name,rarity,hint]of [
  ['30001','[Title One]ホース','3','ヒントA,ヒントB'],
  ['20002','[トレセン学園]ポニー','2','ヒントA'],
  ['10003','[トレセン学園]ミニ','1','']]){
  for(let stage=0;stage<5;stage++){
   const f=Array(62).fill('0');f[0]=id;f[1]=name;f[3]=rarity;f[4]=String(stage);f[6]='スピード';
   f[23]='0';f[24]='0';f[49]='0';f[50]='0';f[59]=hint;rows.push(f.join('\t'));
  }
 }
 return rows.join('\n').repeat(10); // Deliberately wrong if source parser sees repeated IDs.
}
function fake(){
 const cards=[];
 for(let j=1;j<=101;j++)for(let stage=0;stage<5;stage++){
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
