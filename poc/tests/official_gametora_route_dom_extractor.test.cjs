'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extractRoutePieces}=require('../src/official_gametora_route_dom_extractor.cjs');
const txt=t=>({nodeType:3,textContent:t});
function el(children=[],own='',tagName='DIV'){
 const o={
  tagName,children,childNodes:own?[txt(own)]:[],
  get firstElementChild(){return this.children[0]||null;},
  get innerText(){return [
   ...this.childNodes.map(x=>x.textContent),
   ...this.children.map(x=>x.innerText)
  ].filter(Boolean).join(' ').trim();},
  querySelectorAll(selector){
   if(selector!=='*')throw Error('unexpected selector');
   return this.children.flatMap(x=>[x,...x.querySelectorAll('*')]);
  },
  contains(target){return this===target||this.children.some(c=>c.contains(target));}
 };
 for(const child of children)child.parentElement=o;
 return o;
}
function button(groups){
 const body=el(groups);
 // The source website has four nested event-content wrappers plus the
 // second child of its final wrapper. No external website required.
 const panel=el([el([el([el([el([el(),body])])])])]);
 const parent=el([panel]);
 return {parentElement:parent};
}
test('real extractor logic splits an explicit OR into two independent route roots',()=>{
 const grouped=el([el([el([],'体力 +15'),el([],'OR'),
  el([],'体力 +5')])]);
 const result=extractRoutePieces(button([grouped]));
 assert.equal(result.length,2);
 assert.deepEqual(result.map(x=>[x.choiceOrdinal,x.outcomeOrdinal]),
  [[1,1],[1,2]]);
 assert.equal(result[0].unresolvedOr,false);
 assert.deepEqual(result[0].numericEffectTexts,['体力 +15']);
 assert.deepEqual(result[1].numericEffectTexts,['体力 +5']);
 assert.equal(result[0].directOwnTexts.length,0);
});
test('second visible group never inherits previous OR result',()=>{
 const first=el([el([el([],'スタミナ +15'),el([],'OR'),
  el([],'スタミナ +5')])]);
 const second=el([el([],'スキルPt +30')]);
 const result=extractRoutePieces(button([first,second]));
 assert.deepEqual(result.map(x=>[x.choiceOrdinal,x.outcomeOrdinal]),
  [[1,1],[1,2],[2,1]]);
 assert.deepEqual(result[2].numericEffectTexts,['スキルPt +30']);
});
test('missing event body means no visible evidence, not a zero-reward event',()=>{
 const noBody={parentElement:el([])};
 assert.deepEqual(extractRoutePieces(noBody),[]);
});
test('more than 20 site groups fail rather than silently truncating',()=>{
 const groups=Array.from({length:21},()=>el([el([],'体力 +5')]));
 assert.throws(()=>extractRoutePieces(button(groups)),/上限超過/);
});
test('over 80 numeric leaves reject instead of treating partial page as complete',()=>{
 const leaves=Array.from({length:81},()=>el([],'体力 +5'));
 const big=el([el(leaves)]);
 assert.throws(()=>extractRoutePieces(button([big])),/上限超過/);
});
