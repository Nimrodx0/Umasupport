'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {auditCards,sortSchemaProbe}=require('../tools/audit_independent_card_hints.cjs');
const cards=new Map([['30242',{name:'[A]B',rarity:'SSR',stages:{'0':['ヒント1'],'4':['ヒント1','ヒント2']}}]]);
const skills={byId:new Map([['1',{name:'ヒント1'}],['2',{name:'ヒント2'}]])};
function single(changes={}){return [{id:30242,name:'[A]B',rarity:'SSR',hintSkillIds:[1,2],...changes}]}
test('normal matched numeric hints for 4-star stage',()=>{
 const r=auditCards(cards,skills,single());
 assert.equal(r.classification.exact4,1);
 assert.equal(r.comparison,undefined);
 assert.equal(r.totalIndependentHintLinks,2);
 assert.equal(r.mismatches.length,0);
});
test('missing numeric skill and changed hint flagged, never guessed',()=>{
 const r=auditCards(cards,skills,single({hintSkillIds:[1,999]}));
 assert.equal(r.classification.neither,1);
 assert.deepEqual(r.missingSkillIds,[999]);
 assert.equal(r.mismatches[0].onlyUmaSimStage4,1);
 assert.deepEqual(r.mismatches[0].unresolvedIds,[999]);
});
test('no card silently introduced and conflicting rarity is fatal',()=>{
 let r=auditCards(cards,skills,[{id:39999,name:'C',rarity:'SSR',hintSkillIds:[]}]);
 assert.deepEqual(r.missingCardIds,[39999]);
 assert.throws(()=>auditCards(cards,skills,single({rarity:'R'})),/identity changed/);
 assert.throws(()=>auditCards(cards,skills,[...single(),...single()]),/duplicate independent card/);
});
test('sort discovery does not silently infer game order',()=>{
 const schema=sortSchemaProbe([{id:2,name:'x',sortKey:3},{id:1,name:'y',sortKey:2}]);
 assert.equal(schema.records,2);
 assert.equal(schema.possibleOrder[0].key,'sortKey');
 assert.throws(()=>sortSchemaProbe([]),/empty/);
});
