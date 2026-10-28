'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectSiteTopology,sourceShape}=require('../src/official_gametora_rendered_branch_topology.cjs');
const event=()=>({choices:[
 {label:'accept',random_either:true,outcomes:[
  [{type:'max_energy',value:'+4'}],[{type:'skill_points',value:'+50'}]
 ]},
 {label:'wait',effects:[{type:'stamina',value:'+10'}]},
 {label:'stop',effects:[{type:'energy',value:'-10'},{type:'chain_end'}]}
]});
const group=(text,routeCount,or=0,fragment=[])=>({
 visibleText:text,routeCandidateCount:routeCount,orSeparatorCount:or,
 ownTextFragments:fragment
});
const observed=()=>[
 group('accept: +4 OR +50',2,1),group('wait: +10',1),
 group('stop: -10',1,0,['連続イベント打ち切り'])
];
test('3 choices and 4 visible results retain one inner alternative, not a fourth choice',()=>{
 const report=inspectSiteTopology(event(),observed());
 assert.equal(report.referenceChoiceCount,3);
 assert.equal(report.observedOuterChoiceGroups,3);
 assert.deepEqual(report.referenceRouteCountsPerChoice,[2,1,1]);
 assert.deepEqual(report.observedRouteCountsPerGroup,[2,1,1]);
 assert.deepEqual(report.observedOrSeparatorsPerGroup,[1,0,0]);
 assert.equal(report.observedResultCandidates,4);
 assert.equal(report.exactChoiceAndVisibleRouteCardinality,true);
 assert.equal(report.sourceLabelsUniquelyMatchedToVisibleGroups,true);
 assert.equal(report.everyTerminalLocationIndependentlyVisible,true);
 assert.equal(report.gameRandomOutcomeMeaningVerified,false);
 assert.equal(report.appEventJsonEquivalent,false);
 assert.equal(report.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(report),/accept|wait|stop/);
});
test('a fourth outer choice never impersonates an inner result',()=>{
 const groups=[group('accept',1),group('accept extra',1),group('wait',1),group('stop',1)];
 const x=inspectSiteTopology(event(),groups);
 assert.equal(x.observedResultCandidates,4);
 assert.equal(x.exactChoiceAndVisibleRouteCardinality,false);
});
test('missing site OR must not be borrowed from historical outcome counts',()=>{
 const groups=observed();groups[0].orSeparatorCount=0;
 const x=inspectSiteTopology(event(),groups);
 assert.equal(x.exactChoiceAndVisibleRouteCardinality,false);
});
test('site topology alone cannot prove where each named choice goes',()=>{
 const groups=observed();groups.forEach(g=>{g.visibleText='unlabeled';});
 const x=inspectSiteTopology(event(),groups);
 assert.equal(x.exactChoiceAndVisibleRouteCardinality,true);
 assert.equal(x.sourceLabelsUniquelyMatchedToVisibleGroups,false);
 assert.equal(x.everyTerminalLocationIndependentlyVisible,true);
});
test('explicit terminal absence and unrelated terminal text never invent branch end',()=>{
 const absent=observed();absent[2].ownTextFragments=[];
 const a=inspectSiteTopology(event(),absent);
 assert.equal(a.everyTerminalLocationIndependentlyVisible,false);
 const wrong=observed();wrong[2].ownTextFragments=[];wrong[1].ownTextFragments=['連続イベント打ち切り'];
 const b=inspectSiteTopology(event(),wrong);
 assert.equal(b.explicitTerminalGroupsConsistentWithSingleRouteChoices,false);
 assert.equal(b.everyTerminalLocationIndependentlyVisible,false);
});
test('missing source results and unbounded source/site structure reject',()=>{
 assert.throws(()=>sourceShape({choices:[{label:'x',effects:[]},{label:'no effects'}]}),/不正/);
 const invalid=observed();invalid[0].orSeparatorCount=-1;
 assert.throws(()=>inspectSiteTopology(event(),invalid),/不正/);
});
