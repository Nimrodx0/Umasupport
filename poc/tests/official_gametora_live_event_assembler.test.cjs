'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {registryFromSkillText}=
 require('../src/official_gametora_skill_id_crosswalk.cjs');
const {assembleLiveEvent,summarizeLiveEvent}=
 require('../src/official_gametora_live_event_assembler.cjs');
const reg=()=>registryFromSkillText(JSON.stringify([
 ...Array.from({length:101},(_,i)=>({
  id:String(900000+i),name:'合成スキル'+i,rarity:'normal',group:i
 })),
 {id:'200516',name:'登山家',rarity:'normal',group:501},
 {id:'200517',name:'星空',rarity:'rare',group:502}
]));
function route(choiceOrdinal,outcomeOrdinal,opts={}){
 const hint='「登山家」のヒントLv +1';
 const texts=opts.texts||['体力 +15',hint];
 return {
  choiceOrdinal,outcomeOrdinal,
  numericEffectTexts:texts,
  numericEffectContexts:texts.map(t=>[t]),
  groupOwnTextFragments:opts.groupOwnTextFragments||['体力 +15',hint],
  hints:opts.hints??texts.filter(t=>t.includes('ヒント')).map(t=>({
   text:t,contexts:[t]
  })),
  directOwnTexts:opts.directOwnTexts||[],
  flowOwnTexts:opts.flowOwnTexts||[],
  unresolvedOr:opts.unresolvedOr||false
 };
}
const sample=()=>[
 route(1,1,{texts:['体力 +15','「登山家」のヒントLv +1'],
  directOwnTexts:['「星空」を獲得'],
  groupOwnTextFragments:['体力 +15','「登山家」のヒントLv +1']}),
 route(1,2,{texts:['スピード +10'],
  hints:[],flowOwnTexts:['連続イベント打ち切り'],
  groupOwnTextFragments:['体力 +15','「登山家」のヒントLv +1']}),
 route(2,1,{texts:['スキルPt +75'],
  hints:[],flowOwnTexts:['お出かけができるようになる'],
  groupOwnTextFragments:['スキルPt +75']})
];
const run=(items=sample())=>assembleLiveEvent({
 cardId:'30322',siteEventOrdinal:4,routePieces:items,registry:reg()
});
test('assemble four separate sources by original observed route positions',()=>{
 const a=run(),v=summarizeLiveEvent(a);
 assert.equal(v.status,'unified-unapproved');
 assert.equal(v.groups,2);
 assert.equal(v.routes,3);
 assert.equal(v.numericEffects,3);
 assert.equal(v.skillHints,1);
 assert.equal(v.directSkillCandidates,1);
 assert.equal(v.visibleFlowMarkers,2);
 assert.deepEqual(v.routeSummary[0],{
  group:1,result:1,numericalFacts:1,hints:1,
  directCandidates:1,flowMarkers:[],unlocatedFlowMarkers:[]
 });
 assert.deepEqual(v.routeSummary[1].flowMarkers,['explicit-chain-stop']);
 assert.deepEqual(v.routeSummary[2].flowMarkers,['explicit-outing-unlock']);
 assert.equal(a.joined.publicationApproved,false);
 assert.equal(a.joined.continuationRequiresVerified,false);
 assert.ok(!Object.hasOwn(a.joined.routes[0],'rewards'));
 assert.ok(!Object.hasOwn(a.joined.routes[0],'requires'));
 assert.doesNotMatch(JSON.stringify(v),/登山家|星空|スキルPt|体力/);
});
test('empty or unresolved OR layout is explicit skip not a false zero-reward event',()=>{
 const a=run([]);
 assert.equal(a.status,'no-visible-result-groups');
 assert.equal(summarizeLiveEvent(a).routeCount,0);
 assert.equal(a.appEventSchemaAdoptable,false);
 const b=sample();
 b[1].unresolvedOr=true;
 assert.equal(run(b).status,'unresolved-or-layout');
});
test('group coordinate gaps, duplicate outcome and result order drift fail closed',()=>{
 const a=sample();a[1].outcomeOrdinal=3;
 assert.throws(()=>run(a),/route-position-gap/);
 const b=sample();b[2].choiceOrdinal=1;b[2].outcomeOrdinal=2;
 assert.throws(()=>run(b),/route-position-gap/);
 const c=sample();c[1].groupOwnTextFragments=['different grouped result'];
 assert.throws(()=>run(c),/same-group-provenance/);
});
test('site-local reference hint must agree in exact ID+Lv+result',()=>{
 const a=sample();a[0].hints=[{
  text:'「星空」のヒントLv +1',contexts:['「星空」のヒントLv +1']
 }];
 assert.throws(()=>run(a),/site-local-hint-id-level-route-drift/);
 const b=sample();b[1].hints=[{text:'「登山家」のヒントLv +1',
  contexts:['「登山家」のヒントLv +1']}];
 assert.throws(()=>run(b),/site-local-hint-id-level-route-drift/);
});
test('unsupported/missing registry and unexpected source fragments fail closed',()=>{
 assert.throws(()=>assembleLiveEvent({
  cardId:'30322',siteEventOrdinal:4,routePieces:sample(),registry:null
 }),/scope-or-registry/);
 const a=sample();a[0].numericEffectContexts=[];
 assert.throws(()=>run(a),/invalid-route-shape/);
 const b=sample();b[1].numericEffectTexts=['体力 +15','元テキスト +5'];
 b[1].numericEffectContexts=[['体力 +15'],['元テキスト +5']];
 // Ambiguous numerical kinds must remain unresolved, never become rewards.
 const draft=run(b);
 assert.equal(draft.joined.routes[1].allAwardsExhaustive,false);
 assert.equal(draft.joined.routes[1].numericEffects.length,1);
});
test('do not present raw source prose or any public event schema output',()=>{
 const a=run(),v=summarizeLiveEvent(a);
 assert.equal(v.publicationApproved,false);
 assert.equal(v.allSkillAwardsVerified,false);
 assert.equal(v.continuationRequiresVerified,false);
 assert.throws(()=>summarizeLiveEvent({...a,publicationApproved:true}),/only-unapproved/);
 assert.ok(!Object.hasOwn(a.joined.routes[1],'terminal'));
});
