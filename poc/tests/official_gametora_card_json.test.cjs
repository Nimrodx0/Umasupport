'use strict';
const test=require('node:test'),a=require('node:assert/strict');
const {cardJsonUrl,extractBuildId,inspectCardJson,comparisonRoutes,legacyCompare}=require('../src/official_gametora_card_json.cjs');
const scope={cardId:'39999',sourceUrl:'https://gametora.com/ja/umamusume/supports/39999-example',buildId:'synthetic-build_1'};
const token=(t,v,d)=>({t,...(v===undefined?{}:{v}),...(d===undefined?{}:{d})});
const group=(o,r)=>({o,r});
const event=(i,n,c,extra={})=>({i,n,c,...extra});
const body=(doc,id=39999)=>JSON.stringify({pageProps:{sourceData:{support_id:id},eventData:{ja:JSON.stringify(doc)}}});
const inspect=doc=>inspectCardJson({...scope,body:body(doc)});
test('build coordinates are scoped to exact card and Next page identity',()=>{
 a.equal(cardJsonUrl(scope),'https://gametora.com/_next/data/synthetic-build_1/ja/umamusume/supports/39999-example.json');
 const html='<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({page:'/ja/umamusume/supports/[id]',buildId:scope.buildId,props:{pageProps:{sourceData:{support_id:39999}}}})+'</script>';
 a.equal(extractBuildId({...scope,html}),scope.buildId);
 a.throws(()=>extractBuildId({...scope,html:html+html}),/ambiguous/);
 a.throws(()=>extractBuildId({...scope,html:html.replace('39999','39998')}),/mismatch/);
 a.throws(()=>cardJsonUrl({...scope,buildId:'../bad'}),/build/);
 a.throws(()=>cardJsonUrl({...scope,sourceUrl:'https://evil.example/39999-example'}),/scope/);
 a.throws(()=>cardJsonUrl({...scope,cardId:'39998'}),/scope/);
});
test('explicit alternatives, stop markers, recipient ID and history remain distinct',()=>{
 const doc={arrows:[event(8001,'架空タイトル',[group('架空選択肢',[token('en','+8'),token('sk','+2',990001),token('bo','+4',9011),token('di'),token('en','-3'),token('ee')])],{history:[{data:{n:'旧架空原文',c:[]}}]})]};
 const x=inspect(doc),e=x.events[0],g=e.groups[0];
 a.equal(e.historyCount,1);a.equal(g.routes.length,2);
 a.deepEqual(g.routes[0].hints,[{skillId:'skill:990001',level:2,sourceOrdinal:2}]);
 a.deepEqual(g.routes[0].effects[1],{kind:'bond',delta:4,recipientCharId:9011,sourceOrdinal:3});
 a.deepEqual(g.routes[1].markers,[{kind:'explicit-chain-stop',sourceOrdinal:6}]);
 a.equal(g.routes[0].markers.length,0);
 a.doesNotMatch(JSON.stringify(x),/架空タイトル|架空選択肢|旧架空原文/);
 a.equal(x.publicationApproved,false);a.equal(x.appEventSchemaAdoptable,false);
 a.equal(Object.hasOwn(e,'requires'),false);
});
test('unsupported effects and uncertain direct grant never silently become confirmed hints',()=>{
 const x=inspect({special:[event(8002,'架空',[group('',[token('sg',null,990003),token('ds'),{t:'se',v:null,d:9,r:true},token('en','+10',{secret:'原文'}),token('sk','+0',990001)])],{type:'tf',meaningless_choices:true})]});
 const r=x.events[0].groups[0].routes[0];
 a.equal(r.hints.length,0);a.equal(r.effects.length,0);a.equal(r.directGrants.length,1);
 a.deepEqual(r.unresolved.map(x=>x.reason),['direct-grant-kind-unverified','unsupported-effect-code','condition-application-semantics-unverified','unexpected-scalar-fields','invalid-hint']);
 a.doesNotMatch(JSON.stringify(x),/原文|架空/);
 a.ok(x.events[0].blockers.includes('meaningless-choices-unverified'));
});
test('single numeric range is preserved and trial expansion copies only shared facts',()=>{
 const e=event(8003,'架空',[group('選択A',[token('en','+7/+23'),token('bo','+4',9011)]),group('選択B',[token('pt','+11')])]);
 const x=inspect({arrows:[e]}),g=x.events[0].groups[0],trial=comparisonRoutes(g);
 a.deepEqual(g.routes[0].effects[0].alternatives,[7,23]);
 a.equal(trial.rangeHypothesis,true);
 a.deepEqual(trial.routes.map(r=>r.effects.map(e=>e.delta)),[[7,4],[23,4]]);
 const multi=inspect({arrows:[event(8004,'架空',[group('',[token('en','+1/+2'),token('pt','+3/+4')])])]});
 a.equal(comparisonRoutes(multi.events[0].groups[0]).rangeBlocked,true);
 const mixed=inspect({arrows:[event(8005,'架空',[group('',[token('en','+1/+2'),token('di'),token('pt','+3')])])]});
 a.equal(comparisonRoutes(mixed.events[0].groups[0]).rangeBlocked,true);
});
test('malformed identity, scope, delimiter, category and duplicate event IDs fail closed',()=>{
 a.throws(()=>inspectCardJson({...scope,body:body({random:[]},39998)}),/identity/);
 a.throws(()=>inspect({random:[]}),/empty event/);
 a.throws(()=>inspect({unknown:[]}),/category/);
 for(const tokens of [[token('di'),token('en','+1')],[token('en','+1'),token('di')],[token('en','+1'),token('di','+1')]]){
  a.throws(()=>inspect({random:[event(8006,'架空',[group('',tokens)])]}),/result|delimiter/);
 }
 const e=event(8006,'架空',[group('',[token('en','+1')])]);
 a.throws(()=>inspect({random:[e],arrows:[e]}),/duplicate/);
});
test('legacy comparator checks same title and exact group/result facts without claiming full semantics',()=>{
 const x=inspect({arrows:[event(8007,'架空Ａ',[group('',[token('sk','+2',990001),token('en','+7'),token('di'),token('bo','+4',9011),token('ee')])])]});
 const old={cardId:scope.cardId,events:[{id:'old-1',name:'架空A',type:'auto',outcomes:[{rewards:[{skillId:'skill:990001',level:2}],effects:[{kind:'energy',delta:7}]},{rewards:[],effects:[{kind:'bond',delta:4,recipientCharId:9011}],terminal:true}]}]};
 const before=JSON.stringify(old),p=legacyCompare(x,old);
 a.equal(p.rows[0].allComparedRewardFactsMatch,true);
 a.equal(p.fullGameSemanticsVerified,false);a.equal(p.publicationApproved,false);
 a.equal(JSON.stringify(old),before);
 const wrong=structuredClone(old);wrong.events[0].outcomes[1].effects[0].recipientCharId=9012;
 a.equal(legacyCompare(x,wrong).rows[0].knownFactsMatch,false);
 const reordered=structuredClone(old);reordered.events[0].outcomes.reverse();
 a.equal(legacyCompare(x,reordered).rows[0].knownFactsMatch,false);
 const duplicate=structuredClone(old);duplicate.events.push({...duplicate.events[0],id:'old-2'});
 a.equal(legacyCompare(x,duplicate).rows[0].status,'unbound-title');
});
test('unknown effect prevents a full reward parity claim even when known facts agree',()=>{
 const x=inspect({random:[event(8010,'架空',[group('',[token('en','+7'),token('ds')])])]});
 const old={cardId:scope.cardId,events:[{id:'old-1',name:'架空',type:'auto',effects:[{kind:'energy',delta:7}],rewards:[]}]};
 const r=legacyCompare(x,old).rows[0];
 a.equal(r.knownFactsMatch,true);a.equal(r.allComparedRewardFactsMatch,false);
});

test('special codes keep all-stat bundle, random targets and full restoration distinct',()=>{
 const x=inspect({special:[event(8100,'架空特別',[group('',[token('po','+4'),token('5s','+3'),token('rs','+8',2),token('fe'),{t:'se',v:null,d:9,r:true}])])]});
 const r=x.events[0].groups[0].routes[0];
 a.equal(r.effects[0].kind,'power');
 a.deepEqual(r.effects.slice(1).map(z=>[z.kind,z.delta,z.sourceBundle]),['speed','stamina','power','guts','wisdom'].map(k=>[k,3,'all_stats']));
 a.deepEqual(r.dynamicEffects.map(z=>z.kind),['random-stats','restore-current-max-energy']);
 a.equal(r.dynamicEffects[0].statCount,2);a.equal(r.dynamicEffects[1].delta,undefined);
 a.deepEqual(r.statusCandidates,[{kind:'add-condition',conditionId:9,possible:true,sourceFlag:true,sourceOrdinal:5}]);
 a.deepEqual(r.unresolved.map(z=>z.reason),['condition-application-semantics-unverified']);
 a.equal(x.numericValueBasis,'source-json-unadjusted');a.equal(x.levelDependent,null);
 const old={cardId:scope.cardId,events:[{id:'ref',name:'架空特別',type:'auto',
 effects:r.effects.map(({sourceOrdinal,...v})=>v),dynamicEffects:r.dynamicEffects.map(({sourceOrdinal,...v})=>v),
 statusEffects:[{kind:'add-condition',conditionId:9,possible:true}],rewards:[]}]};
 const p=legacyCompare(x,old).rows[0];a.equal(p.knownFactsMatch,true);a.equal(p.allComparedRewardFactsMatch,false);
 old.events[0].dynamicEffects[0].statCount=3;
 a.equal(legacyCompare(x,old).rows[0].knownFactsMatch,false);
});
test('malformed special codes do not become scalar gains or valid states',()=>{
 const r=inspect({random:[event(8101,'架空',[group('',[token('rs','+3',6),token('5s','+2/+8'),token('fe','+10'),{t:'se',v:null,d:9,r:'yes'}])])]}).events[0].groups[0].routes[0];
 a.equal(r.effects.length+r.dynamicEffects.length+r.statusCandidates.length,0);
 a.equal(r.unresolved.length,4);
});
