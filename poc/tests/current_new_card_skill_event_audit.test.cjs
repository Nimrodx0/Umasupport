'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit,CARD_IDS,SKILL_PIN,compareRegistry}=require('../src/current_new_card_skill_event_audit.cjs');
const hints=['京都レース場○','直線巧者','地固め','端緒','比類なき','活路を拓く！',
 '心惹かれて','気持ちを乗せて','巨歩','存在感','如才なし',
 '直感力','主導権','死力を尽くして'];
function source(){
 const result=[];
 for(let i=0;i<563;i++){
  const id=String(10000+i);
  for(let stage=0;stage<5;stage++)result.push(line(id,stage,'[架空]旧カード',''));
 }
 for(const [id,name,h] of [
  ['10149','[巫女]吾妻',[]],
  ['30322','[Time of Departure]マヤノトップガン',hints],
  ['30323','[いとどめでたき、まつりかな]吾妻',[]]
 ])for(let stage=0;stage<5;stage++)result.push(line(id,stage,name,h.join(', ')));
 return result.join('\n')+'\n';
}
function line(id,stage,name,hints){
 const x=Array(62).fill('0');
 x[0]=id;x[1]=name;x[2]='character';x[3]=id==='10149'?'1':'3';
 x[4]=String(stage);x[6]=id==='10149'||id==='30323'?'友人':'パワー';
 x[23]='1';x[24]='10';x[49]='0';x[50]='0';x[59]=hints;
 return x.join('\t');
}
const registry=()=>[
 ...Array.from({length:100},(_,i)=>({id:String(880000+i),
  name:'無関係な合成スキル'+i,rarity:'normal',group:10000+i})),
 ...hints.map((name,i)=>({id:String(990000+i),name,rarity:'normal',group:99000+i}))
];
const fixture=()=>({
 rosterText:source(),
 previousSkillText:JSON.stringify(registry()),
 currentSkillText:JSON.stringify([...registry(),{
  id:'999999',name:'追加登録',rarity:'normal',group:9999
 }])
});
test('3 new cards, all 5 stages, exact numeric skill IDs and event gaps remain separate',()=>{
 const r=audit(fixture());
 assert.equal(r.currentSourceCards,566);
 assert.equal(r.checkedAddedCards,3);
 assert.deepEqual(r.cards.map(x=>x.cardId),CARD_IDS);
 assert.deepEqual(r.cards.map(x=>x.uniqueStage4Hints),[0,14,0]);
 assert.deepEqual(r.cards.map(x=>x.allStagesIdentical),[true,true,true]);
 assert.deepEqual(r.cards.map(x=>x.skillIdResolution.uniquelyMatchedHints),[0,14,0]);
 assert.deepEqual(r.cards[1].hints.map(x=>x.numericId),hints.map((_,i)=>String(990000+i)));
 assert.deepEqual(r.cards.map(x=>x.eventSourceCoverage.productionEventRecords),[0,0,0]);
 assert.equal(r.pendingEventCards,3);
 assert.equal(r.eventRoutesAdopted,0);
 assert.equal(r.publicApprovedEvents,0);
 assert.equal(r.sourceRawDataBundled,false);
 assert.equal(r.fixedGt2512LegacySkillEventsNotPromoted,true);
 assert.equal(r.skillRegistryDiff.currentSkillIds,115);
 assert.deepEqual(r.skillRegistryDiff.newlyDefinedIds,['999999']);
 assert.deepEqual(r.skillRegistryDiff.changedExistingIds,[]);
 assert.deepEqual(r.skillRegistryDiff.removedExistingIds,[]);
 const raw=JSON.stringify(r);
 assert.equal(raw.includes('無関係な合成スキル'),false);
 assert.equal(raw.includes('[架空]旧カード'),false);
});
test('ambiguous same-name IDs, absent names and incompatible rare IDs never become numeric IDs',()=>{
 const f=fixture();
 const parsed=JSON.parse(f.currentSkillText);
 parsed.push({id:'777777',name:'京都レース場○',rarity:'normal',group:777});
 parsed.push({id:'777778',name:'直線巧者',rarity:'rare',group:778});
 const filtered=parsed.filter(x=>x.name!=='端緒');
 filtered.find(x=>x.name==='地固め').rarity='rare';
 f.currentSkillText=JSON.stringify(filtered);
 const r=audit(f);
 const card=r.cards.find(x=>x.cardId==='30322');
 assert.equal(card.skillIdResolution.ambiguousHints,3);
 assert.equal(card.skillIdResolution.absentHints,1);
 assert.equal(card.skillIdResolution.uniquelyMatchedHints,10);
 for(const name of ['京都レース場○','直線巧者','端緒','地固め'])
  assert.equal(card.hints.find(x=>x.name===name).numericId,null);
 assert.equal(r.eventRoutesAdopted,0);
});
test('mutating old same-ID skill semantics is explicitly detected; duplicate IDs and invalid source fail',()=>{
 const f=fixture();const altered=JSON.parse(f.currentSkillText);
 altered.find(x=>x.id==='990000').name='変更後の別名';
 f.currentSkillText=JSON.stringify(altered);
 const r=audit(f);
 assert.deepEqual(r.skillRegistryDiff.changedExistingIds,['990000']);
 assert.equal(r.cards[1].hints.find(x=>x.name==='京都レース場○').status,
  'missing-in-current-skill-source');
 const f2=fixture();const dupe=JSON.parse(f2.currentSkillText);
 dupe.push(dupe[0]);f2.currentSkillText=JSON.stringify(dupe);
 assert.throws(()=>audit(f2),/数値ID重複/);
 assert.throws(()=>audit({...fixture(),rosterText:'hello'}),/短すぎます/);
});
test('strict source pin and new-card public event gate are fail closed',()=>{
 assert.equal(SKILL_PIN.currentBlob.length,40);
 const f=fixture();
 assert.throws(()=>audit(f,{strict:true}),/Git blob識別値が不一致/);
 const faulty=fixture();
 faulty.rosterText=faulty.rosterText.replace(
  '30323\t[いとどめでたき、まつりかな]吾妻',
  '30323\t[破損した新カード]吾妻');
 const report=audit(faulty);
 assert.equal(report.cards[2].eventSourceCoverage.productionEventRecords,0);
 assert.equal(report.publicApprovedEvents,0);
});
