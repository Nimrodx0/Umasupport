'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const spec=require('../config/d070-azuma-json-flow-review.v1.json');
const {reviewAzuma}=require('../src/d070_azuma_json_outing_review.cjs');
const {inspectCardJson}=require('../src/official_gametora_card_json.cjs');
const core=require('../src/core.js');
function fixture(pin){
 const ids=['200512','204812','202552','202551'];
 const registry={byId:new Map(ids.map(id=>[id,{id,name:'架空辞書'+id,rarity:'normal'}])),byName:new Map(ids.map(id=>['架空辞書'+id,[{id}]]))};
 const o={cardId:pin.cardId,sourceUrl:'https://gametora.com/ja/umamusume/supports/'+pin.cardId+'-azuma',dataKind:'gametora-card-json-private-observation',
 publicationApproved:false,appEventSchemaAdoptable:false,buildId:pin.buildId,bodySha256:pin.bodySha256,numericValueBasis:'source-json-unadjusted',levelDependent:true,
 events:pin.events.map(e=>({sourceEventId:e.sourceEventId,category:e.category,categoryOrdinal:e.categoryOrdinal,titleSha256:e.titleSha256,historyCount:0,eventType:e.eventType,meaninglessChoices:e.meaninglessChoices,blockers:[],
 groups:e.groups.map((g,i)=>({ordinal:i+1,labelPresent:g.labelPresent,blockers:[],routes:[{ordinal:1,hints:structuredClone(g.hints),effects:[],dynamicEffects:[],directGrants:[],markers:g.unlock?[{kind:'outing-unlock-candidate',sourceOrdinal:g.unlockOrdinal}]:[],statusCandidates:g.conditionOrdinals.map(sourceOrdinal=>({sourceOrdinal})),unresolved:g.conditionOrdinals.map(sourceOrdinal=>({code:'se',sourceOrdinal,reason:'condition-application-semantics-unverified'})).concat(g.unmodeledScenarioOrdinals.map(sourceOrdinal=>({code:'shun_act_low',sourceOrdinal,reason:'unsupported-effect-code'})),g.unlock?[{code:'ds',sourceOrdinal:g.unlockOrdinal,reason:'outing-unlock-semantics-unverified'}]:[]).sort((a,b)=>a.sourceOrdinal-b.sourceOrdinal)}]}))}))};
 return {observation:o,registry};
}
test('ds is a candidate marker, never a global verified edge',()=>{
 const e={random:[{i:1,n:'架空',c:[{o:'',r:[{t:'ds'}]}]}]};
 const o=inspectCardJson({body:JSON.stringify({pageProps:{sourceData:{support_id:39999},eventData:{ja:JSON.stringify(e)}}}),cardId:'39999',sourceUrl:'https://gametora.com/ja/umamusume/supports/39999-example',buildId:'example'});
 a.deepEqual(o.events[0].groups[0].routes[0].markers,[{kind:'outing-unlock-candidate',sourceOrdinal:1}]);
 a.equal(o.publicationApproved,false);a.equal(o.events[0].requires,undefined);
});
test('scoped private projection preserves choices, sequence and conditional special rewards',()=>{
 for(const pin of spec.cards){
  const input=fixture(pin),before=JSON.stringify(input.observation),r=reviewAzuma(input),events=r.card.events,id=n=>'gt-json:'+pin.cardId+':'+n,by=n=>events.find(e=>e.id===id(n));
  a.equal(events.length,11);a.equal(r.summary.resultCount,14);a.equal(r.summary.hintCount,4);a.equal(r.publicationApproved,false);
  a.equal(core.reachability(by(1500),{},events).status,'blocked');
  for(const c of ['c1','c2']){
   const choices={[id(1496)]:c};
   a.equal(core.reachability(by(1502),choices,events).status,'conditional');
   a.equal(core.reachability(by(1504),choices,events).status,'blocked');
   for(const d of ['c1','c2'])a.equal(core.reachability(by(1504),{...choices,[id(1502)]:d},events).status,'conditional');
  }
  const skillRoutes=core.directRoutes({id:pin.cardId,hints:[],events},{choices:{[id(1496)]:'c2',[id(1502)]:'c1'},outcomes:{}});
  a.ok(skillRoutes.some(x=>x.skillId==='skill:202551'&&x.conditional));a.ok(skillRoutes.some(x=>x.skillId==='skill:200512'&&x.conditional));
  a.equal(JSON.stringify(input.observation),before);
 }
});
test('source pin, event identity, marker, unknown code, registry and named title drift reject',()=>{
 const pin=spec.cards[0];for(const mutate of [
  x=>x.observation.bodySha256='0'.repeat(64),
  x=>x.observation.events.reverse(),
  x=>x.observation.events.find(e=>e.sourceEventId===1496).groups[1].routes[0].markers=[],
  x=>x.observation.events.find(e=>e.sourceEventId===1504).groups[0].routes[0].hints[0].level=4,
  x=>x.observation.events[0].groups[0].routes[0].unresolved.push({code:'unknown'}),
  x=>x.registry.byId.delete('202551'),
  x=>x.titles=new Map(pin.events.map(e=>[e.sourceEventId,'別タイトル']))
 ]){const x=fixture(pin);mutate(x);a.throws(()=>reviewAzuma(x));}
});
