'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verify}=require('../src/phase2_p1_scenario_event_ledger.cjs');
const {TARGETS}=require('../src/phase2_p1_source_title_join.cjs');
const data=require('../data/curation/adjudicated/phase2_p1_scenario_event_facts.v1.json');
function fixture(){
 const gtDocuments=[];
 for(const id of ['10094','30067','30081','30137','30160']){
  const target=TARGETS.find(t=>t.cardId===id);
  const entries=id==='10094'?12:id==='30160'?12:target.gtOrdinal;
  const events=Array.from({length:entries},(_,i)=>({
   id:80000+i,name:'unrelated',section:'random',choices:[{
    label:'',random_either:false,effects:[]}]}));
  if(target){
   events[target.gtOrdinal-1]={id:target.gtLocalId,
    name:target.gtName,section:'special',choices:
     Array.from({length:target.choices},()=>({
      label:'',random_either:false,effects:[{type:'bond',value:'+5'}]}))};
  }
  if(id==='10094')events[1]={id:1411,name:'お疲れ様！！',
   section:'special',choices:[{label:'',random_either:false,effects:[]}]};
  gtDocuments.push({id:Number(id),events_ja:Object.fromEntries(
   events.map((x,i)=>['entry_'+i,x]))});
 }
 const comparison={dataKind:'phase2-p1-scoped-title-key-join',
  publicationApproved:false,originalCrossSourceQueueUnchanged:true,
  skillGrantsAdded:0,chainFlagsChanged:0,
  sourcePins:{gameToraDerived:data.sourcePins.gameToraDerived,
   checker:data.sourcePins.checker},
  summary:{targetPositions:4,checkerCategoryTitlesVerified:4,
   sharedContextRowsVerified:3,separateOverseasEventRowsVerified:1,
   GTEventIdentityPairsAdded:0,resultPathsCertified:0,publicEventsAdded:0},
  rows:TARGETS.map(t=>({cardId:t.cardId,checkerOrdinal:t.checkerOrdinal,
   gameToraSourceOrdinal:t.gtOrdinal,gameToraLocalId:t.gtLocalId,
   checkerSourceHeadingMatchesKnownCategory:true,
   checkerTitleCategory:t.relationship,
   individualGTEventIdentityPaired:false,
   outcomeSemanticsProvenEquivalent:false}))};
 return {comparison,gtDocuments,ledger:structuredClone(data)};
}
test('three contextual replacements and a separate R/SSR overseas event preserve private runtime',()=>{
 const f=fixture(),original=structuredClone(f),r=verify(f);
 assert.deepEqual(r.summary,{sourceCategoryPositionsVerified:4,
  replacementContextCards:3,duplicateGroupEventsAdded:0,
  overseasDistinctEventFamilies:1,overseasApplicableCardIds:['10094','30160'],
  overseasResultKinds:2,overseasSkillHints:0,
  stagedReviewOnlyEventCardScopes:2,privateRuntimeEventCountUnchanged:2512,
  publishedEventCountUnchanged:0});
 assert.equal(r.technicalRuntimeEventAdditions,0);
 assert.equal(r.skillGrantsAdded,0);
 assert.equal(r.outcomeEquivalenceVerified,false);
 assert.equal(r.publicationApproved,false);
 assert.deepEqual(f,original);
 assert.deepEqual(require('../data/reviewed_events.v1.json'),{schemaVersion:1,cards:[]});
 assert.deepEqual(require('../config/event-release-approvals.v1.json'),{schemaVersion:1,entries:[]});
});
test('R and SSR Mei have separately scoped foreign event facts without copying domestic ID',()=>{
 const f=fixture(),row=f.ledger.overseasSeparate;
 assert.deepEqual(row.results.GREAT_SUCCESS,{guts:3,mood:1,bond:5});
 assert.deepEqual(row.results.SUCCESS,{guts:3,mood:0,bond:5});
 assert.deepEqual(row.projectLarcAdditionalEffects,{
  skillPoints:3,aptitudePoints:50,bond:2});
 assert.deepEqual(row.cardIds,['10094','30160']);
 assert.equal(row.runtimeRepresentation,'STAGED_METADATA_ONLY_NOT_AN_EMPTY_REWARD_EVENT');
 assert.equal(verify(f).summary.overseasDistinctEventFamilies,1);
});
test('fail closed on unsupported replacement, claimed additive rewards, GT IDs, and new skills',()=>{
 const mutators=[
  f=>{f.ledger.publicationApproved=true;},
  f=>{f.ledger.runtimeCatalogAdoption=true;},
  f=>{f.ledger.baselinePrivateEventCount=2513;},
  f=>{f.ledger.commonReplacements[0].behavior='ADD_ON_TOP_OF_GT';},
  f=>{f.ledger.commonReplacements[1].noAdditionalEvent=false;},
  f=>{f.ledger.commonReplacements[2].noAdditionalSkillGrant=false;},
  f=>{f.comparison.summary.checkerCategoryTitlesVerified=3;},
  f=>{f.comparison.rows[0].individualGTEventIdentityPaired=true;},
  f=>{f.comparison.rows[3].checkerTitleCategory='COMMON_GROUP_CONTEXT';},
  f=>{f.gtDocuments.find(d=>d.id===10094).events_ja.entry_1.id=1410;},
  f=>{f.gtDocuments.find(d=>d.id===30160).events_ja.entry_1.name='労いのエール';},
  f=>{f.gtDocuments.find(d=>d.id===30081).events_ja.entry_15.choices.pop();},
  f=>{f.ledger.overseasSeparate.results.SUCCESS.bond=6;},
  f=>{f.ledger.overseasSeparate.results.GREAT_SUCCESS.mood=0;},
  f=>{f.ledger.overseasSeparate.projectLarcAdditionalEffects.aptitudePoints=0;},
  f=>{f.ledger.overseasSeparate.skillHints=[{skillId:'200332'}];},
  f=>{f.ledger.overseasSeparate.chainEnd=true;},
  f=>{f.ledger.overseasSeparate.cardIds=['30160'];},
  f=>{f.ledger.overseasSeparate.runtimeRepresentation='PUBLISHED_EMPTY_EVENT';},
  f=>{f.ledger.overseasSeparate.publicationApproved=true;},
  f=>{f.ledger.sourcePins.checker='a'.repeat(40);}
 ];
 for(const mutator of mutators){
  const f=fixture();mutator(f);
  assert.throws(()=>verify(f),/シナリオ別イベント台帳/,mutator.toString());
 }
});
test('no fake 2513 runtime event from either metadata review or scenario wrapper',()=>{
 const f=fixture();f.ledger.overseasSeparate.eventFamilyId=
  'usl:30160:runtime:auto:always-available';
 assert.throws(()=>verify(f));
 assert.equal(verify(fixture()).summary.privateRuntimeEventCountUnchanged,2512);
});
