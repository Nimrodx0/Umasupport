'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),crypto=require('node:crypto');
const {compareDisplay,verifyDisplay,observeHtml}=require('../src/d072_display_corroboration.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const packet={events:[{sourceEventId:1,exactTitleSha256:hash('Synthetic title'),category:'random',categoryOrdinal:1,groups:[{ordinal:1,labelPresent:false,routes:[{ordinal:1,hints:[{skillId:'skill:990001',level:2,sourceOrdinal:1}],terminal:false,nonSkillCount:0}]}]}]};
const observation={htmlSha256:hash('<synthetic>'),events:[{exactTitleSha256:hash('Synthetic title'),category:'random',categoryOrdinal:1,groups:[{ordinal:1,labelPresent:false,routes:[{ordinal:1,hints:[{skillId:'skill:990001',level:2}],terminal:false,nonSkillCount:0}]}]}]};
test('independently supplied visible facts agree, but never prove topology or publication',()=>{
 const v=verifyDisplay(compareDisplay(packet,observation));
 a.equal(v.status,'matched-visible-facts');a.equal(v.topologyVerified,false);a.equal(v.publicationApproved,false);
 a.doesNotMatch(JSON.stringify(v),/Synthetic title|skill:990001|<synthetic>/);
 for(const mutate of [
  o=>o.events[0].groups[0].routes[0].hints[0].level=3,
  o=>o.events[0].groups[0].routes[0].terminal=true,
  o=>o.events[0].groups[0].routes[0].nonSkillCount=1,
  o=>o.events[0].category='arrows',
  o=>o.events[0].exactTitleSha256=hash('other')
 ]){const o=structuredClone(observation);mutate(o);a.equal(verifyDisplay(compareDisplay(packet,o)).status,'mismatch');}
 a.throws(()=>verifyDisplay({...v,publicationApproved:true}),/shape/);
 a.throws(()=>verifyDisplay({...v,rawHtml:'source prose'}),/shape/);
});
test('browser unavailable or missing event area leaves no inferred evidence',async()=>{
 const r=await observeHtml({html:'<html></html>',cardId:'39999',skillText:'',launch:async()=>{throw Error('unavailable');}});
 a.equal(verifyDisplay(compareDisplay(packet,r)).status,'unavailable');
 let closed=false,routed=false;
 const result=await observeHtml({html:'<html></html>',cardId:'39999',skillText:'',launch:async()=>({
  newContext:async options=>{a.deepEqual(options,{javaScriptEnabled:false,offline:true,serviceWorkers:'block'});return {
   route:async (pattern,handler)=>{a.equal(pattern,'**/*');await handler({abort:async()=>{routed=true;}});},
   newPage:async()=>({setContent:async()=>{},getByRole:()=>({count:async()=>0})})
  };},close:async()=>{closed=true;}
 })});
 a.equal(result.events,null);a.ok(closed&&routed);
});
