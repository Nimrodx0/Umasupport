'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sourceRoutes,compareRenderedGroups}=require('../src/official_gametora_route_group_probe.cjs');
const u=(id,level)=>({status:'unique-verified-name',numericId:id,level});
test('independent groups match choices and outcome routes only when signatures unique',()=>{
 const event={choices:[
  {effects:[{type:'speed',value:'+10'},{type:'skill_hint',skill_id:200512,value:'+1'},{type:'bond',value:'+5'}]},
  {outcomes:[
   [{type:'energy',value:'-10'},{type:'power',value:'+5'}],
   [{type:'energy',value:'+20'},{type:'power',value:'+10'}]
  ]}
 ]};
 const actual=[
  {effectTexts:['スピード +10','ヒントLv +1'],hintLinks:[u('200512',1)]},
  {effectTexts:['体力 -10','パワー +5'],hintLinks:[]},
  {effectTexts:['体力 +20','パワー +10'],hintLinks:[]}
 ];
 const r=compareRenderedGroups(event,actual);
 assert.equal(r.sourceRoutes,3);
 assert.equal(r.renderedGroupCandidates,3);
 assert.equal(r.uniqueRouteGroupAssignment,true);
 assert.equal(r.choiceAndOutcomeLabelsVerified,false);
 assert.equal(r.publicationApproved,false);
});
test('same numeric effects in multiple branches cannot claim unique route binding',()=>{
 const event={choices:[
 {effects:[{type:'speed',value:'+10'}]},
 {effects:[{type:'speed',value:'+10'}]}
 ]};
 const group={effectTexts:['スピード +10'],hintLinks:[]};
 const r=compareRenderedGroups(event,[group,group]);
 assert.equal(r.sourceGroupsWithMatchingFactAndHintSignature,2);
 assert.equal(r.uniqueRouteGroupAssignment,false);
 assert.equal(r.ambiguousSourceRoutes,2);
});
test('the normalized level and independently looked-up numeric ID must travel together',()=>{
 const event={choices:[{effects:[{type:'skill_hint',skill_id:300001,value:'+2'}]}]};
 const r=compareRenderedGroups(event,[{effectTexts:['ヒントLv +2'],hintLinks:[u('300002',2)]}]);
 assert.equal(r.sourceRoutes,1);
 assert.equal(r.unmatchedSourceRoutes,1);
 assert.equal(r.uniqueRouteGroupAssignment,false);
});
test('a partially missing visual group never becomes a route fact',()=>{
 const event={choices:[{effects:[{type:'speed',value:'+5'}]}]};
 const r=compareRenderedGroups(event,[]);
 assert.equal(r.unmatchedSourceRoutes,1);
 assert.equal(r.publicationApproved,false);
 assert.throws(()=>compareRenderedGroups(event,[{effectTexts:'bad',hintLinks:[]}]),/不正/);
});
