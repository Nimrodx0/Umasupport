const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseSkillData,audit}=require('../src/skill_candidate_id_audit.cjs');
const facts=require('../config/missing-ssr-event-facts.v1.json');
const {validate}=require('../src/missing_ssr_fact_review.cjs');
const ids=['30240','30269','30295','30302','30320'];
const clone=v=>JSON.parse(JSON.stringify(v));
const baseline=Array.from({length:105},(_,i)=>({id:String(510000+i),name:'架空技'+i,rarity:'normal',group:i+1}));
function db(overrides=[]){return parseSkillData(JSON.stringify([...baseline,...overrides]));}
test('game-data names map to unique numeric IDs without inferring skill tiers',()=>{
 const master=db([{id:'202422',name:'がむしゃら',rarity:'normal',group:20242},
  {id:'203241',name:'連鎖反応',rarity:'rare',group:20324}]);
 const result=audit(facts,master);
 const gam=result.rows.find(x=>x.name==='がむしゃら');
 assert.deepEqual(gam.candidates,[{id:'202422',rarity:'normal',group:20242}]);
 assert.equal(gam.status,'unique');
 assert.equal(gam.placement,'event-option-or-auto');
 assert.equal(result.hintOccurrences,14);
 assert.equal(result.source,'UmaSim data/skill_data.txt');
 assert.equal(result.status,'RESEARCH_CANDIDATES_NOT_PUBLISHABLE');
 const chain=result.rows.find(x=>x.name==='連鎖反応');
 assert.deepEqual(chain.candidates,[{id:'203241',rarity:'rare',group:20324}]);
});
test('ambiguity or missing names never silently map to invented IDs',()=>{
 const x=db([{id:'80001',name:'ワンチャンス',rarity:'normal',group:1},
  {id:'80002',name:'ワンチャンス',rarity:'rare',group:1}]);
 const r=audit(facts,x);
 assert.equal(r.rows.find(x=>x.name==='ワンチャンス').status,'ambiguous');
 assert.equal(r.rows.find(x=>x.name==='一往直前').status,'not-in-source');
});
test('unknown Jungle Pocket event placement is preserved',()=>{
 const v=clone(facts);
 assert.equal(validate(v,ids).structuralOnly,1);
 assert.deepEqual(v.cards[0].cardLevelSkillCandidates,['がむしゃら','迅速果断']);
 assert.ok(v.cards[0].chain.every(e=>e.mode==='unknown'&&!e.hints.length));
 v.cards[0].cardLevelSkillCandidates.push('がむしゃら');
 assert.throws(()=>validate(v,ids),/カードレベルのヒント候補/);
});
test('card-level skills are never treated as concrete event hint rows',()=>{
 const r=audit(facts,db());
 assert.equal(r.hintOccurrences,14);
 const pocket=r.rows.find(x=>x.name==='迅速果断');
 assert.deepEqual(pocket.fromCards,['30240']);
 assert.equal(pocket.occurrences,0);
 assert.equal(pocket.placement,'card-level-only');
});
test('bad source data or duplicate numeric IDs fails closed',()=>{
 assert.throws(()=>parseSkillData('{}'),/suspiciously short/);
 assert.throws(()=>parseSkillData(JSON.stringify([...baseline,baseline[0]])),/Duplicate/);
 assert.throws(()=>parseSkillData(JSON.stringify([...baseline,{id:11,name:'bad',rarity:'normal',group:1}])),/Invalid skill item/);
});
