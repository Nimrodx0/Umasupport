'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit}=require('../src/phase2_gt_fixed_source_provenance.cjs');
const source=()=>({
  documents:[{id:30080,kind:'support',url:'https://gametora.com/umamusume/supports/30080-fiction',
   events_ja:{
    '原サイトの見出しA':{name:'元タイトルA',section:'arrows',choices:[
     {label:'ゲーム内の元セリフ',effects:[{type:'skill_hint',value:2}]},
     {label:'',outcomes:[{label:'成功結果',effects:[]},{label:'',effects:[]}]}
    ]},
    '原サイトの見出しB':{name:'元タイトルB',section:'random',choices:[{label:'',effects:[]}]}
   }}],
  projectedCatalog:{schemaVersion:1,cards:[{
   cardId:'30080',events:[
    {id:'gt-30080-event-001',name:'元タイトルA',choices:[]},
    {id:'gt-30080-event-002',name:'元タイトルB',choices:[]}
   ]
  }]}
});
test('matches pinned source positions and headings without leaking any values',()=>{
 const x=source(),before=JSON.stringify(x),a=audit(x);
 assert.equal(a.counts.sourceFiles,1);
 assert.equal(a.counts.sourceEvents,2);
 assert.equal(a.counts.matchedProjectedGtEvents,2);
 assert.equal(a.counts.sourceChoicePositions,3);
 assert.equal(a.counts.sourceChoiceLabelNonempty,1);
 assert.equal(a.counts.sourceChoiceLabelEmpty,2);
 assert.equal(a.counts.sourceChoiceOutcomeNodes,2);
 assert.equal(a.counts.sourceOutcomeLabelNonempty,1);
 assert.equal(a.counts.sourceSectionDistinctValues,2);
 assert.equal(a.findings.sourceAccessAndReuseRightsVerified,false);
 for(const secret of ['元タイトルA','ゲーム内の元セリフ','成功結果','30080-fiction','arrows'])
  assert.equal(JSON.stringify(a).includes(secret),false);
 assert.equal(JSON.stringify(x),before);
});
test('mismatched reused title is identified, strict mode does not silently accept sample',()=>{
 const x=source();
 x.projectedCatalog.cards[0].events[1].name='別の見出し';
 const r=audit(x);
 assert.equal(r.counts.sourceTitleMismatch,1);
 assert.throws(()=>audit(x,{strict:true}),/固定559\/2488/);
});
test('rejects source file duplication or invented missing event IDs',()=>{
 const x=source();x.documents.push(x.documents[0]);
 assert.throws(()=>audit(x),/カード同定/);
 const y=source();y.projectedCatalog.cards[0].events[1].id='custom-1';
 assert.throws(()=>audit(y),/収録数と候補|位置対応/);
});
test('fallback names and incorrect source pages are counted without assuming legal approval',()=>{
 const x=source();
 delete x.documents[0].events_ja;
 x.documents[0].events={
  '元タイトルA':{choices:[{label:'',effects:[]}]},
  '元タイトルB':{choices:[{label:'',effects:[]}]}
 };
 x.documents[0].url='https://example.com/invalid';
 const r=audit(x);
 assert.equal(r.counts.sourceFallbackEventCollections,1);
 assert.equal(r.counts.malformedOrMissingPageUrls,1);
 assert.equal(r.counts.sourceTitleFromKeyFallback,2);
 assert.equal(r.findings.pageUrlIsProvenanceNotProofOfDirectWebAccess,true);
});
