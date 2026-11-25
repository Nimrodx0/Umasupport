'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{pairEnvelopes,choose,screen}=require('../src/p3_rank_window_margin_screen.cjs');
const S=['Nige','Senkou','Sasi','Oikomi'];
function row(v,d){return {courseId:1,fieldSize:9,mode:'equal',all:{W:v,D:d},first15:{W:v,D:d},last15:{W:v,D:d}};}
function data(v,d=v){return Object.fromEntries(S.map((s,i)=>[s,[row(v[i],d[i])]]));}
test('lower-group order is irrelevant; W and D are independent',()=>{
 const x=pairEnvelopes(data([90,88,30,50],[10,12,40,15]));
 a.deepEqual(choose(x,5,false),{state:'targeted-window-candidate',styles:S.slice(0,2)});
 a.equal(choose(x,5,true).state,'undetermined-window');
});
test('a reversal in one half or distance branch is held',()=>{
 const x=data([90,90,20,20]);x.Nige[0].last15.W=0;
 a.equal(choose(pairEnvelopes(x),5,false).state,'undetermined-window');
 const a1={pairs:pairEnvelopes(data([90,90,20,20]))},b={pairs:pairEnvelopes(data([20,20,90,90]))};
 a.equal(screen([a1,b],5,true).state,'branch-results-differ-held');
 a.equal(screen([{pairs:null}],5,false).state,'explicit-style-not-comparable');
});
test('same raw window context identity and exact margin',()=>{
 const x=data([50,50,45,45]);a.equal(choose(pairEnvelopes(x),5,true).state,'within-window-margin-only');
 x.Sasi[0].fieldSize=12;a.throws(()=>pairEnvelopes(x));
});
