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

test('picker counts each direct ID once, distinguish explicit-only and other-targeted, retain unknown',()=>{
 const {c,data,labels}=fixture();const p=(type,value)=>({type,operator:'==',value});
 for(const s of data.skills)s.activationProfile.invokes=[{conditions:[[p('always',1)]],preConditions:[]}];
 data.skillById.h.activationProfile.invokes=[{conditions:[[p('running_style',2)]],preConditions:[]}];
 const context={running_style:2,distance_type:2,ground_type:1};
 const x=view.browseCard(c,{stage:4,choices:{ev:'a'}},data,labels,context);
 a.deepEqual(x.potential.counts,{total:4,explicitOnly:1,general:1,targeted:1,otherTargeted:0,undetermined:1,outside:0,scopeUnknown:0,scopePending:0});
 a.equal(x.potential.matching,3);a.equal(x.current.counts.total,3);a.equal(x.cardScore,null);
 const y=view.browseCard(c,{stage:4,choices:{}},data,labels,{...context,running_style:1});
 a.equal(y.potential.counts.otherTargeted,1);a.equal(y.potential.counts.outside,1);a.equal(y.potential.matching,1);
 const z=view.browseCard(c,{stage:4,choices:{}},data,new Map(),context);a.equal(z.potential.matching,1);a.equal(z.potential.counts.undetermined,3);
 delete data.skillById.missing.activationProfile;
 a.equal(view.browseCard(c,{stage:4},data,labels,context).potential.counts.scopeUnknown,1);
});

test('matching tier counts are unweighted and sum to the unique candidate count',()=>{
 const {c,data,labels}=fixture(),p=(type,value)=>({type,operator:'==',value});
 for(const sk of data.skills)sk.activationProfile.invokes=[{conditions:[[p('always',1)]],preConditions:[]}];
 data.skillById.h.tier='gold';data.skillById.e.tier='white';data.skillById.other.tier='white';
 const x=view.browseSummary(['h','h','e','other','missing'],data,labels,{running_style:2,distance_type:2,ground_type:1});
 a.deepEqual(x.matchingByTier,{gold:1,white:2,other:0});a.equal(x.matching,3);
});

test('read-only candidate list uses stage-specific verified hints and reviewed event IDs once',()=>{
 const {c,data,labels}=fixture();
 for(const s of data.skills)s.activationProfile.invokes=[{conditions:[[{type:'always',operator:'==',value:1}]],preConditions:[]}];
 data.skillById.h.activationProfile.invokes=[{conditions:[[{type:'running_style',operator:'==',value:2}]],preConditions:[]}];
 const original=JSON.stringify({c,data});
 const rows=view.candidateList(c,{stage:0,choices:{ev:'a'}},data,labels,{});
 a.deepEqual(rows.map(r=>r.skill.id),['h','e','other']);
 a.equal(rows[0].category,'explicitOnly');a.equal(rows[0].hint,true);a.equal(rows[1].event,true);
 a.equal(rows[1].current.length,1);a.equal(rows[2].current.length,0);
 a.equal(view.candidateList(c,{stage:4},data,labels,{}).length,4);
 a.equal(JSON.stringify({c,data}),original);
});

test('scope-pending skills do not count as matches, even with positive evidence or an explicit style',()=>{
 const {c,data,labels}=fixture(),p=(type,value)=>({type,operator:'==',value});
 for(const s of data.skills)s.activationProfile.invokes=[{conditions:[[p('always',1)]],preConditions:[]}];
 data.skillById.h.activationProfile.invokes=[{conditions:[[p('running_style',2),p('distance_type',2)]],preConditions:[]}];
 data.skillById.e.activationProfile.invokes=[{conditions:[[p('ground_type',1)]],preConditions:[]}];
 data.skillById.other.activationProfile.invokes=[{conditions:[[p('ground_condition',1)]],preConditions:[]}];
 data.skillById.h.tier='gold';data.skillById.e.tier='white';data.skillById.other.tier='white';
 const x=view.browseCard(c,{stage:0},data,labels,{running_style:2}).potential;
 a.equal(x.counts.scopePending,3);a.equal(x.matching,0);a.deepEqual(x.matchingByTier,{gold:0,white:0,other:0});
 const y=view.browseCard(c,{stage:0},data,labels,{running_style:2,distance_type:2,ground_type:1,ground_condition:1}).potential;
 a.equal(y.counts.scopePending,0);a.equal(y.matching,3);a.deepEqual(y.matchingByTier,{gold:1,white:2,other:0});
 const rows=view.candidateList(c,{stage:0},data,labels,{running_style:2});a(rows.every(r=>r.scopePending&&!r.matching));
});
