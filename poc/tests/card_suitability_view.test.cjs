'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fit=require('../src/skill_suitability.js'),view=require('../src/card_suitability_view.js');
const ctx={running_style:2,distance_type:2,ground_type:1,ground_condition:1,courseId:10502,fieldSize:9,scenario:'balanced'};
function fixture(){
 const sk=['h','e','other','lower','missing'].map((id,i)=>({id,lowerId:id==='e'?'lower':null,activationProfile:{status:'source-structure',sourceNumericId:String(i+1)}}));
 const label=state=>({state,styles:[],scope:{kind:'source-logic',contexts:[{distance_type:2,ground_type:1,ground_condition:1}]}});
 const rows=sk.filter(s=>s.id!=='missing').map(s=>({appSkillId:s.id,sourceNumericId:s.activationProfile.sourceNumericId,explicitNecessaryMasks:Array(32).fill(15),label:label('general')}));
 rows.find(x=>x.appSkillId==='e').label={state:'targeted',styles:[2],scope:{kind:'rank-window-fixed-model',branches:[{distanceType:2,courseIds:[10502]}]}};
 const c={id:'card',sourceStatus:'verified_hints',hintsByStage:{0:['h'],1:['h'],2:['h'],3:['h'],4:['h','missing']},events:[{id:'ev',name:'event',type:'choice',choices:[{id:'a',label:'a',rewards:[{skillId:'e'}]},{id:'b',label:'b',rewards:[{skillId:'other'}]}]}]};
 const data={cards:[c],cardById:{card:c},skills:sk,skillById:Object.fromEntries(sk.map(s=>[s.id,s])),meta:{eventStatus:'reviewed-partial',reviewedEventRecords:1}};
 return {c,data,labels:view.index(rows)};
}
test('visibility does not change label state or explicit scope',()=>{
 const {labels}=fixture(),r=labels.get('e');const on=fit.present(r,ctx,true),off=fit.present(r,ctx,false);
 a.equal(on.labelText,'先行向け');a.equal(off.labelText,null);a.deepEqual({...on,labelText:null},off);
 a.equal(fit.resolve(r).state,'undetermined');a.equal(fit.resolve(r,{...ctx,ground_type:2}).state,'undetermined');
 a.equal(fit.matches(null,{mode:'possible',context:ctx}),true);a.equal(fit.matches(null,{mode:'confirmed',context:ctx}),false);
 a.equal(fit.matches({...r,explicitNecessaryMasks:Array(32).fill(0)},{mode:'possible',context:ctx}),false);
 a.equal(fit.matches(r,{mode:'possible',context:{...ctx,running_style:1}}),true);
 a.equal(fit.matches(r,{mode:'targeted',context:{...ctx,running_style:1}}),false);
});
test('stage, mutually exclusive alternatives and missing labels remain distinct',()=>{
 const {c,data,labels}=fixture(),before=JSON.stringify(data);
 const v=view.cardView(c,{stage:0,choices:{ev:'a'}},data,labels,ctx);
 a.deepEqual(v.current.rows.map(x=>x.appSkillId),['h','e']);a.deepEqual(v.unselectedOrUnreachableCandidates,['other']);
 a.equal(v.current.counts.targeted,1);a.equal(v.potential.counts.total,3);a.equal(v.cardScore,null);
 const w=view.cardView(c,{stage:4,choices:{ev:'b'}},data,labels,ctx);
 a.deepEqual(w.current.rows.map(x=>x.appSkillId),['h','missing','other']);a.equal(w.current.counts.undetermined,1);
 a.equal(JSON.stringify(data),before);
 const deck=view.deckView({slots:[{cardId:'card',stage:0,choices:{ev:'a'}},{cardId:'card',stage:0,choices:{ev:'a'}}]},data,labels,ctx);
 a.equal(deck.providerCounts.e,1);a.equal(deck.indirect.counts.total,1);a.equal(deck.indirect.rows[0].appSkillId,'lower');
});
test('stale source identity and no-record cards are not assigned positive labels',()=>{
 const {c,data,labels}=fixture();data.skillById.h.activationProfile.sourceNumericId='changed';
 a.equal(view.trustedRow('h',data,labels),null);
 const empty={id:'empty',sourceStatus:'verified_hints',hintsByStage:{4:[]},events:[]};
 a.equal(view.matchesCard(empty,{stage:4},data,labels,{context:ctx,mode:'possible'}),true);
 a.equal(view.matchesCard(empty,{stage:4},data,labels,{context:ctx,mode:'confirmed'}),false);
});
