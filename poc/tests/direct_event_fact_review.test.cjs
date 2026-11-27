'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {headingFingerprint,routeFingerprint,reviewCard}=require('../src/direct_event_fact_review.cjs');
const id='30001',sourceUrl='https://gametora.com/ja/umamusume/supports/30001-fiction';
const skill={id:'123456',name:'架空ヒント',rarity:'normal'};
const registry={byId:new Map([[skill.id,skill]]),byName:new Map([[skill.name,[skill]]])};
const r1={effects:[{kind:'power',delta:10,sourceEffectOrdinal:1}]},r2={rewards:[{skillId:'skill:123456',kind:'hint',level:2}]};
function fixture(){
 const structure=[{ordinal:1,category:'連続イベント',titleSha256:headingFingerprint('架空一').sha256,chainStage:1,ambiguous:false},{ordinal:2,category:'連続イベント',titleSha256:headingFingerprint('架空二').sha256,chainStage:2,ambiguous:false}];
 const choice=(id,record)=>({id,label:'選択肢',...record});
 const perEvent=[{siteEventOrdinal:1,status:'private-schema-shaped',publicationApproved:false,blockers:[],flowMarkers:0,directSkills:0,previewEvent:{choices:[choice('group-1',r1)]}},{siteEventOrdinal:2,status:'private-schema-shaped',publicationApproved:false,blockers:[],flowMarkers:0,directSkills:0,previewEvent:{choices:[choice('group-1',{outcomes:[{id:'result-1',label:'結果',...r2},{id:'result-2',label:'結果',...r1}]}),choice('group-2',r1)]}}];
 const record=structuredClone({cardId:id,sourceUrl,layout:'visible-sections',structure,publicationApproved:false,projected:{publicationApproved:false,appEventSchemaAdoptable:false,sourceSiteTextCopied:false,perEvent}});
 const spec={cardId:id,sourceUrl,adjudicatorUrl:'https://gamewith.jp/uma-musume/article/show/1',events:[{...structure[0],selection:'auto',previousOrdinal:null,groups:[[routeFingerprint(r1,registry)]]},{...structure[1],selection:'choice',previousOrdinal:1,groups:[[routeFingerprint(r2,registry),routeFingerprint(r1,registry)],[routeFingerprint(r1,registry)]]}]};
 return {record,spec};
}
test('heading removes stage markers but fingerprints exact title',()=>{
 assert.equal(headingFingerprint('(❯❯) 架空二').stage,2);
 assert.equal(headingFingerprint('(❯❯) 架空二').sha256,headingFingerprint('架空二').sha256);
 assert.notEqual(headingFingerprint('架空一').sha256,headingFingerprint('架空二').sha256);
});
test('exact reviewed routes generate only private candidate with ordinary chain and explicit results',()=>{
 const {record,spec}=fixture(),before=JSON.stringify(record);
 const result=reviewCard(record,spec,registry);
 assert.equal(result.summary.routeCount,4);assert.equal(result.summary.hintCount,1);
 assert.equal(result.summary.releaseGateBlocked,true);assert.equal(result.summary.publicationApproved,false);
 assert.equal(result.candidate.events[0].type,'auto');
 assert.equal(result.candidate.events[1].choices[0].outcomes.length,2);
 assert.deepEqual(result.candidate.events[1].requires,{all:[{eventId:'gt-site:30001:1'}]});
 assert.equal(JSON.stringify(record),before);
});
test('swapped outcomes, changed Lv, wrong title and unresolved route each fail closed',()=>{
 for(const mutate of [
  r=>r.projected.perEvent[1].previewEvent.choices[0].outcomes.reverse(),
  r=>r.projected.perEvent[1].previewEvent.choices[0].outcomes[0].rewards[0].level++,
  r=>r.structure[0].titleSha256='0'.repeat(64),
  r=>r.projected.perEvent[0].blockers.push('numeric-facts-unresolved'),
  r=>r.projected.perEvent[0].flowMarkers=1
 ]){const {record,spec}=fixture();mutate(record);assert.throws(()=>reviewCard(record,spec,registry),/Direct event review/);}
});
test('actual manifest covers exactly three reviewed cards, 12 events and 26 routes',()=>{
 const m=require('../config/direct-event-fact-review.v1.json');
 assert.equal(m.publicationApproved,false);
 assert.deepEqual(m.cards.map(c=>c.cardId),['20102','30322','30324']);
 assert.equal(m.cards.reduce((a,c)=>a+c.events.length,0),12);
 assert.equal(m.cards.flatMap(c=>c.events).flatMap(e=>e.groups).flat().length,26);
});

test('exact digest-bound candidate can enter append staging but not publication',()=>{
 const {verifyObservedDigest,toUnapprovedIntakeCandidate}=require('../src/direct_event_fact_review.cjs');
 const {discoverNewCards,stageNewCardEvents}=require('../src/new_card_event_incremental.cjs');
 const {record,spec}=fixture(),checked=reviewCard(record,spec,registry);
 const evidence={schemaVersion:1,publicationApproved:false,cards:[checked.summary]};
 assert.equal(verifyObservedDigest(checked.summary,evidence),true);
 const c=toUnapprovedIntakeCandidate(checked,evidence);
 assert.equal(c.convertedEventCount,2);assert.equal(c.publicationApproved,false);
 const stage=stageNewCardEvents({discovery:discoverNewCards({previousRosterIds:['30002'],currentRosterIds:['30002',id]}),existingCatalog:{schemaVersion:1,cards:[]},candidates:[c]});
 assert.equal(stage.ready.length,1);assert.equal(stage.publicationApproved,false);
 const tamper=structuredClone(checked);tamper.candidate.events[0].effects[0].delta++;
 assert.throws(()=>toUnapprovedIntakeCandidate(tamper,evidence),/changed after fact review/);
 const changed=structuredClone(checked.summary);changed.hintCount++;
 assert.throws(()=>verifyObservedDigest(changed,evidence),/digest drift/);
});
test('real evidence ledger is metadata-only and exactly 12 content hashes',()=>{
 const e=require('../config/direct-event-fact-review-evidence.v1.json'),m=require('../config/direct-event-fact-review.v1.json');
 assert.deepEqual(e.cards.map(c=>c.cardId),m.cards.map(c=>c.cardId));
 assert.equal(e.publicationApproved,false);
 const hashes=e.cards.flatMap(c=>c.eventDigests);
 assert.equal(hashes.length,12);assert.equal(new Set(hashes.map(h=>h.eventId)).size,12);
 assert.ok(hashes.every(h=>/^[a-f0-9]{64}$/.test(h.sha256)));
});

test('production candidate preserves exact reviewed title and adds required runtime skill name without changing original fact hash',()=>{
 const {prepareNamedCandidate}=require('../src/direct_event_fact_review.cjs');
 const {record,spec}=fixture(),checked=reviewCard(record,spec,registry);
 const evidence={schemaVersion:1,publicationApproved:false,cards:[checked.summary]};
 const before=JSON.stringify(checked);
 const n=prepareNamedCandidate(checked,spec,registry,['(❯) 架空一','(❯❯) 架空二'],evidence);
 assert.equal(n.candidate.events[0].name,'架空一');
 assert.equal(n.candidate.events[1].choices[0].outcomes[0].rewards[0].verifiedSkillName,skill.name);
 assert.notEqual(n.summary.eventDigests[0].sha256,checked.summary.eventDigests[0].sha256);
 assert.equal(n.candidate.publicationApproved,false);assert.equal(JSON.stringify(checked),before);
 assert.throws(()=>prepareNamedCandidate(checked,spec,registry,['架空二','架空一'],evidence),/title mismatch/);
});

test('named candidate preserves fullwidth punctuation, normalizing only its identity hash',()=>{
 const {prepareNamedCandidate}=require('../src/direct_event_fact_review.cjs');
 const {record,spec}=fixture();record.structure[0].titleSha256=headingFingerprint('架空一!').sha256;
 spec.events[0].titleSha256=record.structure[0].titleSha256;
 const checked=reviewCard(record,spec,registry),evidence={schemaVersion:1,publicationApproved:false,cards:[checked.summary]};
 const n=prepareNamedCandidate(checked,spec,registry,['(❯) 架空一！','(❯❯) 架空二'],evidence);
 assert.equal(n.candidate.events[0].name,'架空一！');
});
