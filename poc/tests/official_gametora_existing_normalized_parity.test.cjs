'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {transformDocument}=require('../src/gametora_whole_event_normalize.cjs');
const {compareConvertedToSiteEvent,compareConvertedCardToSite}=
 require('../src/official_gametora_existing_normalized_parity.cjs');
const entry=(name,section,choices)=>({name,section,choices});
const synthetic=()=>({kind:'support',id:30001,events_ja:{
 '甲':entry('甲','random',[
  {label:'男性用選択肢',effects:[{type:'speed',value:'+10'},{type:'skill_hint',skill_id:123456,value:'+2'}]},
  {label:'',effects:[{type:'energy',value:'-10'}]}
 ]),
 '乙':entry('乙','random',[{label:'',effects:[{type:'stamina',value:'+5'}]}]),
 '丙':entry('丙','arrows',[{label:'',effects:[{type:'guts',value:'+5'}]}]),
 '丁':entry('丁','arrows',[{label:'',effects:[{type:'wisdom',value:'+7'},{type:'chain_end'}]}]),
 '戊':entry('戊','arrows',[{label:'',random_either:true,outcomes:[
   [{type:'power',value:'+5'}],[{type:'power',value:'+10'}]
 ]}])
}});
const observed=[
 [{effectTexts:['スピード +10','ヒントLv +2'],
   hintLinks:[{status:'unique-verified-name',numericId:'123456',level:2}]},
  {effectTexts:['体力 -10'],hintLinks:[]}],
 [{effectTexts:['スタミナ +5'],hintLinks:[]}],
 [{effectTexts:['根性 +5'],hintLinks:[]}],
 [{effectTexts:['賢さ +7'],hintLinks:[]}],
 [{effectTexts:['パワー +5'],hintLinks:[]},{effectTexts:['パワー +10'],hintLinks:[]}]
];
const joins=()=>Array.from({length:5},(_,i)=>({
 historicalEventOrdinal:i+1,renderedEventPosition:i+1,
 sourceCategory:i<2?'random':'arrows'
}));
test('same existing converter reproduces five source events and seven route signatures from site-like observations',()=>{
 const old=synthetic(),converted=transformDocument(old);
 const v=compareConvertedCardToSite(converted,joins(),observed);
 assert.equal(v.eventsCompared,5);
 assert.equal(v.sourceRouteCount,7);
 assert.equal(v.matchedUniqueRoutes,7);
 assert.equal(v.parityEvents,5);
 assert.equal(v.allFiveEventNumericProjectionsMatch,true);
 assert.equal(v.events[3].sourceChainTerminals,1);
 assert.equal(v.fullAppEventJsonReproductionVerified,false);
 assert.equal(v.approvedForRelease,false);
 assert.equal(v.noSourceProseIncluded,true);
 const all=JSON.stringify(v);
 assert.doesNotMatch(all,/男性用選択肢|スピード|ヒントLv|甲/);
});
test('numeric skill ID and level have to match, not merely effect name and hint occurrence count',()=>{
 const converted=transformDocument(synthetic());
 const changed=structuredClone(observed[0]);
 changed[0].hintLinks[0].numericId='123457';
 const r=compareConvertedToSiteEvent(converted.events[0],changed);
 assert.equal(r.visibleNumericProjectionParity,false);
 assert.equal(r.missingNormalizedRoutes,1);
 assert.equal(r.routeLinks.length,0);
 const changedLv=structuredClone(observed[0]);
 changedLv[0].hintLinks[0].level=3;
 assert.equal(compareConvertedToSiteEvent(converted.events[0],changedLv).visibleNumericProjectionParity,false);
});
test('different OR alternatives cannot merge into one branch',()=>{
 const c=transformDocument(synthetic());
 const r=compareConvertedToSiteEvent(c.events[4],[observed[4][0]]);
 assert.equal(r.existingConverterRouteCount,2);
 assert.equal(r.renderedRouteCount,1);
 assert.equal(r.visibleNumericProjectionParity,false);
});
test('duplicated effect signatures do not imply a unique branch assignment',()=>{
 const original=synthetic();
 original.events_ja['甲'].choices[1].effects=[
  {type:'speed',value:'+10'},{type:'skill_hint',skill_id:123456,value:'+2'}
 ];
 const c=transformDocument(original);
 const duplicate=[observed[0][0],observed[0][0]];
 const r=compareConvertedToSiteEvent(c.events[0],duplicate);
 assert.equal(r.visibleNumericProjectionParity,false);
 assert.equal(r.ambiguousNormalizedRoutes,2);
});
test('unknown source effect or site numeric marks partial comparison, not data completeness',()=>{
 const original=synthetic();
 original.events_ja['乙'].choices[0].effects.push({type:'unknown-scenario-token',value:'+10'});
 const c=transformDocument(original);
 const r=compareConvertedToSiteEvent(c.events[1],observed[1]);
 assert.equal(r.visibleNumericProjectionParity,false);
 assert.equal(r.convertedSourceUnmappedKinds,1);
 assert.equal(r.ignoredOrUnparsedEffectKinds,undefined);
 const site=[{effectTexts:['スタミナ +5','謎 +3'],hintLinks:[]}];
 const r2=compareConvertedToSiteEvent(transformDocument(synthetic()).events[1],site);
 assert.equal(r2.visibleNumericProjectionParity,false);
 assert.equal(r2.renderedUnclassifiedNumeric,1);
});
test('missing/duplicated title join or wrong source category blocks a false five-event pass',()=>{
 const normalized=transformDocument(synthetic());
 const mismatch=joins();mismatch[1].renderedEventPosition=1;
 assert.throws(()=>compareConvertedCardToSite(normalized,mismatch,observed),/曖昧/);
 const bad=joins();bad[3].sourceCategory='random';
 assert.throws(()=>compareConvertedCardToSite(normalized,bad,observed),/カテゴリ/);
 assert.throws(()=>compareConvertedCardToSite(normalized,joins(),observed.slice(0,4)),/一致しない/);
});
