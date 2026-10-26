'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const source=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {classifyGuard,analyze}=require('../src/phase2_gt_conditional_segment_review.cjs');
const pin='6e38b54af4fad397ff4491e63007a90705a4fe67';
function fixture(events){
 const documents=[{kind:'support',id:10109,events_ja:Object.fromEntries(
  events.map((x,i)=>['source-'+i,x]))}];
 const index={dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:pin,checker:'pinned'},
  stats:{gameToraEventRecords:events.length},
  cards:[{cardId:'10109',sourceMissing:false,gameToraObservedCount:events.length}]};
 return {documents,index,inventory:source.analyze({documents,index})};
}
const effect=(type,value)=>({type,value});
const event=(segments)=>({id:9,name:'MUST_NOT_REPUBLISH_SOURCE_NAME',section:'special',
 choices:[{label:'MUST_NOT_REPUBLISH_CHOICE',segments}]});
const seg=(when,effects)=>({when,effects,random_either:false});
test('opaque scripted class 1/2/3 is kept as unresolved contextual rewards, never a random choice',()=>{
 const args=fixture([event([
  seg([{kind:'scripted',value:['class',1]}],[effect('bond','+5')]),
  seg([{kind:'scripted',value:['class',2]}],[effect('speed','+10'),effect('mood','+1')]),
  seg([{kind:'scripted',value:['class',3]}],[effect('guts','+10')])
 ])]);
 assert.equal(args.inventory.summary.blockedEvents,1);
 const out=analyze(args);
 assert.equal(out.summary.sourceSegmentEvents,1);
 assert.equal(out.summary.sourceSegments,3);
 assert.equal(out.summary.segmentRoutes,3);
 assert.equal(out.summary.guardedRoutes,3);
 assert.equal(out.summary.opaqueScriptedClassGuards,3);
 assert.deepEqual(out.rows.map(x=>x.guardDescriptors[0].classOrdinal),[1,2,3]);
 assert.deepEqual(out.rows.map(x=>x.routeOrdinal),[1,2,3]);
 assert.ok(out.rows.every(x=>!x.automaticOutcomeSelectionAllowed&&!x.guardContextVerified));
 assert.equal(out.publicationApproved,false);
 assert.ok(!JSON.stringify(out).includes('MUST_NOT_REPUBLISH_'));
 assert.ok(!JSON.stringify(out).includes('speed'));
 assert.ok(!JSON.stringify(out).includes('+10'));
});
test('guarded result alternatives retain flattened route order but never get added to skill/stat catalog',()=>{
 const args=fixture([event([
  {when:[{kind:'mood_min',value:4}],random_either:true,
   outcomes:[[effect('guts','+2')],[effect('guts','+5')]]},
  seg([{kind:'otherwise'}],[effect('energy','+10')])
 ])]);
 const out=analyze(args);
 assert.deepEqual(out.rows.map(x=>x.routeOrdinal),[1,2,3]);
 assert.deepEqual(out.rows.map(x=>x.segmentOrdinal),[1,1,2]);
 assert.equal(out.summary.sourceSegments,2);
 assert.equal(out.summary.guardedRoutes,3);
 assert.equal(out.summary.moodGuards,1);
 assert.equal(out.summary.fallbackGuards,1);
 assert.ok(out.rows.every(x=>x.quarantineReasons.includes('CONDITIONAL_SEGMENTS_NOT_MODELED')));
});
test('source effect value prose and arbitrary scripted descriptions are never copied into review metadata',()=>{
 const args=fixture([event([seg([{kind:'scripted',value:['private-internal-script',8]}],
  [effect('bond','+100')])])]);
 const out=analyze(args);
 assert.equal(out.rows[0].guardDescriptors[0].reviewClass,'opaque-scripted-other');
 assert.equal(out.summary.unsupportedGuards,1);
 assert.ok(!JSON.stringify(out).includes('private-internal-script'));
 assert.ok(!JSON.stringify(out).includes('+100'));
});
test('reject missing source outcome identities and any unilateral upgrade of a quarantined branch',()=>{
 const args=fixture([event([seg([{kind:'scripted',value:['class',1]}],
  [effect('speed','+5')])])]);
 const forged=structuredClone(args);
 forged.inventory.rows[0].supportedProjectionEligible=true;
 assert.throws(()=>analyze(forged),/ガードが未解決/);
 const missing=structuredClone(args);missing.inventory.rows.length=0;
 assert.throws(()=>analyze(missing),/元条件付き分岐の結果ID/);
 const unpinned=structuredClone(args);unpinned.inventory.sourcePins.gameToraDerived='dead';
 assert.throws(()=>analyze(unpinned),/固定版/);
 const published=structuredClone(args);published.inventory.publicationApproved=true;
 assert.throws(()=>analyze(published),/固定版/);
});
test('reject malformed guard syntax without guessing control semantics',()=>{
 assert.throws(()=>classifyGuard(null),/不正/);
 assert.throws(()=>classifyGuard({kind:'scripted<script>'}),/不正/);
 assert.deepEqual(classifyGuard({kind:'scripted',value:['class',2]}),
  {kind:'scripted',reviewClass:'opaque-scripted-class',classOrdinal:2,runtimeResolvable:false});
});
