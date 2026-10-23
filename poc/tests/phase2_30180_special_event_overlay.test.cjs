'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const core=require('../src/core.js');
const {apply}=require('../src/phase2_30180_special_event_overlay.cjs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function fixture(){
 const catalog={schemaVersion:1,cards:[{cardId:'30180',coverageStatus:'partial',
  events:[{id:'gt-30180-event-001',name:'既収録イベント',type:'auto',rewards:[]}]}]};
 const integrated={
  dataKind:'phase2-2511-nonpublishing-gt-and-curated-chain-runtime',
  publicationApproved:false,reviewedEventsPublished:0,
  noAutomaticRuntimeAdoption:true,catalog,
  summary:{catalogSha256:hash(catalog),rosterCards:1,totalCandidateEvents:1}
 };
 const priorities={
  dataKind:'phase2-16-remaining-checker-skill-priority',
  publicationApproved:false,checkerCandidatesNotForSkillGrant:true,
  sourcePins:{
   checkerIndex:'8cf9fcb3cc7239041161be75c84daf9f8f22d29f',
   gameToraDerived:'6e38b54af4fad397ff4491e63007a90705a4fe67'
  },
  summary:{openCheckerPositions:16,P0:1,absentNumericSkillIdPositions:1},
  rows:[{cardId:'30180',checkerOrdinal:7,priority:'P0',
   candidateSkillIdsAbsentFromGTEventCatalog:['200332'],
   unresolvedNameOnlyHintMentions:0,
   manualResultReviewChoices:0,unparsedHintChoices:0}]
 };
 return {integrated,priorities};
}
test('adjudicated 30180 event adds one skill route without reclassifying any old GT event',()=>{
 const f=fixture(),old=structuredClone(f),r=apply(f);
 assert.equal(r.dataKind,'phase2-2512-private-30180-special-hint-runtime');
 assert.equal(r.publicationApproved,false);
 assert.equal(r.noAutomaticRuntimeAdoption,true);
 assert.equal(r.summary.unchangedSourceEvents,1);
 assert.equal(r.summary.totalCandidateEvents,2);
 assert.equal(r.summary.appendedSpecialEvents,1);
 assert.equal(r.summary.appendedSkillHints,1);
 assert.equal(r.summary.appendedChoiceRows,0);
 assert.equal(r.summary.gameSpawnProbabilityModeled,false);
 const c=r.catalog.cards[0];
 assert.deepEqual(c.events[0],f.integrated.catalog.cards[0].events[0]);
 const event=c.events[1];
 assert.equal(event.id,'usl:30180:special:checker-007');
 assert.equal(event.name,'あなたを想って');
 assert.equal(event.type,'auto');
 assert.equal(event.availabilityKind,'special-trigger');
 assert.deepEqual(event.rewards,[{
  skillId:'skill:200332',level:1,verifiedSkillName:'コーナー巧者○'
 }]);
 const paths=core.directRoutes({id:'30180',hints:[],events:c.events},
  {stage:4,choices:{},outcomes:{}}).filter(x=>x.eventId===event.id);
 assert.deepEqual(paths.map(x=>[x.skillId,x.level]),[['skill:200332',1]]);
 assert.deepEqual(f,old,'caller catalog and Checker audit are not mutated');
 assert.deepEqual(require('../data/reviewed_events.v1.json'),{schemaVersion:1,cards:[]});
 assert.deepEqual(require('../config/event-release-approvals.v1.json'),{schemaVersion:1,entries:[]});
});
test('wrong Checker skill, hinted outcome, duplicate event and approval must fail closed',()=>{
 for(const edit of [
  f=>{f.priorities.rows[0].candidateSkillIdsAbsentFromGTEventCatalog[0]='200331'},
  f=>{f.priorities.rows[0].cardId='30181'},
  f=>{f.priorities.rows[0].checkerOrdinal=8},
  f=>{f.priorities.rows[0].manualResultReviewChoices=1},
  f=>{f.integrated.catalog.cards[0].events.push({
   id:'usl:30180:special:checker-007',name:'duplicated',type:'auto',rewards:[]})},
  f=>{f.integrated.publicationApproved=true},
  f=>{f.priorities.publicationApproved=true},
  f=>{f.priorities.sourcePins.checkerIndex='bad'},
  f=>{f.integrated.summary.catalogSha256='0'.repeat(64)},
  f=>{f.integrated.catalog.cards[0].events[0].rewards=[
   {skillId:'skill:200332',level:1}];
   f.integrated.summary.catalogSha256=hash(f.integrated.catalog);}
 ]){
  const f=fixture();edit(f);
  assert.throws(()=>apply(f));
 }
});
test('a tiny fixture cannot impersonate the 563/2512 population',()=>{
 assert.throws(()=>apply(fixture(),{strict:true}),/全563サポカ2,512イベント/);
});
