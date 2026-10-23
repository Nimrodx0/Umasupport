'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const core=require('../src/core.js');
const {assemble}=require('../src/phase2_2511_chain_runtime.cjs');
const {accept}=require('../src/phase2_2511_chain_loader.cjs');
const hints=require('../data/curation/phase2_chain_skill_display_names.v1.json');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const ids=['30318','30319','30320','30321','30221'];
function fixture(){
 const cards=ids.map(id=>({cardId:id,coverageStatus:'partial',
  events:[4,5].map(k=>({
   id:'usl:'+id+':random:'+k,name:'元通常イベント'+k,
   type:'auto',rewards:[]
  }))}));
 const catalog={schemaVersion:1,cards};
 const modelCards=ids.map(id=>({id,hints:[],events:[]}));
 const skillRecords=[...hints.records.map(s=>({id:s.numericId,name:s.name,
  rarity:s.numericId==='203801'?'rare':'normal',
  group:s.numericId==='203801'?20380:Number(s.numericId)})),
  // The loader checks a review-anchored gold/white relationship. A fake
  // isolated gold skill would contradict that independently reviewed pair.
  {id:'203802',name:'想い焦がれて',rarity:'normal',group:20380},
  {id:'201351',name:'食いしん坊',rarity:'normal',group:201351},
  ...Array.from({length:110},(_,i)=>({
   id:String(950000+i),name:'フェイク'+i,rarity:'normal',group:950000+i
  }))];
 return {
  assembled:{dataKind:'phase2-nonpublishing-2496-event-assembled-runtime',
   publicationApproved:false,reviewedEventsPublished:0,
   noAutomaticRuntimeAdoption:true,sourceNarrativeOrChoiceProseIncluded:false,
   catalog,summary:{
    rosterCards:5,totalCandidateEvents:10,catalogSha256:hash(catalog)}},
  model:{cards:modelCards,cardById:Object.fromEntries(modelCards.map(c=>[c.id,c])),
   skills:[],skillById:{},meta:{}},
  skillText:JSON.stringify(skillRecords)
 };
}
test('five source-audited chains append fifteen real events with exact prior-flag gates',()=>{
 const f=fixture(),unaltered=structuredClone(f),a=assemble(f.assembled);
 assert.equal(a.dataKind,'phase2-2511-nonpublishing-gt-and-curated-chain-runtime');
 assert.equal(a.publicationApproved,false);
 assert.equal(a.reviewedEventsPublished,0);
 assert.equal(a.noAutomaticRuntimeAdoption,true);
 assert.equal(a.summary.rosterCards,5);
 assert.equal(a.summary.unchangedSourceEvents,10);
 assert.equal(a.summary.totalCandidateEvents,25);
 assert.equal(a.summary.appendedChainStages,15);
 assert.equal(a.summary.appendedChoiceStages,7);
 assert.equal(a.summary.appendedAutoStages,8);
 assert.equal(a.summary.appendedAlternatives,22);
 assert.equal(a.summary.appendedSkillHints,9);
 assert.equal(a.summary.enabledChainFlags,17);
 for(const c of a.catalog.cards){
  assert.equal(c.events.length,5);
  assert.deepEqual(c.events.slice(0,2),f.assembled.catalog.cards.find(x=>x.cardId===c.cardId).events);
  const chain=c.events.slice(-3);
  assert.equal(chain[0].requires,undefined);
  assert.deepEqual(chain[1].requires,{all:[{eventId:chain[0].id}]});
  assert.deepEqual(chain[2].requires,{all:[{eventId:chain[1].id}]});
  assert.ok(chain.every((e,i)=>e.id==='usl:'+c.cardId+':chain:'+(i+1)));
 }
 const rice=a.catalog.cards.find(x=>x.cardId==='30318').events.slice(-3);
 assert.equal(core.reachability(rice[1],{},rice).status,'blocked');
 assert.equal(core.reachability(rice[1],{[rice[0].id]:'option1'},rice).status,'reachable');
 assert.equal(core.reachability(rice[2],{[rice[0].id]:'option1'},rice).status,'blocked');
 assert.equal(core.reachability(rice[2],{[rice[0].id]:'option1',[rice[1].id]:'option2'},rice).status,'reachable');
 assert.deepEqual(f,unaltered,'do not change source or real card model');
 assert.deepEqual(require('../data/reviewed_events.v1.json'),{schemaVersion:1,cards:[]});
 assert.deepEqual(require('../config/event-release-approvals.v1.json'),{schemaVersion:1,entries:[]});
});
test('full actual production loader resolves nine names and hints without publishing anything',()=>{
 const f=fixture(),a=assemble(f.assembled),before=structuredClone(f);
 const result=accept({assembled:a,model:f.model,skillText:f.skillText});
 assert.equal(result.status,'NONPUBLIC_2511_PRODUCTION_LOADER_ACCEPTED');
 assert.equal(result.publicationApproved,false);
 assert.equal(result.modelMutated,false);
 assert.equal(result.actualEventOccurrenceModeled,false);
 assert.equal(result.summary.cards,5);
 assert.equal(result.summary.events,25);
 assert.equal(result.summary.appendedChainStages,15);
 assert.equal(result.summary.appendedAlternativeRows,22);
 assert.equal(result.summary.appendedSkillHints,9);
 assert.equal(result.summary.continuationFlagsVerified,17);
 assert.deepEqual(f,before);
});
test('explicit terminal stops downstream and independent no-choice stages progress without options',()=>{
 const a=assemble(fixture().assembled),c=a.catalog.cards.find(x=>x.cardId==='30319');
 const events=c.events.slice(-3);
 const options={[events[0].id]:'option1',[events[1].id]:'option1'};
 assert.equal(core.reachability(events[2],options,events).status,'reachable');
 events[1].choices[0].terminal=true;
 assert.equal(core.reachability(events[2],options,events).status,'blocked');
 const satono=a.catalog.cards.find(x=>x.cardId==='30221');
 const s=satono.events.slice(-3);
 assert.equal(s.every(x=>x.type==='auto'),true);
 const skill=core.directRoutes({events:s,hints:[]},{stage:4,choices:{},outcomes:{}})
  .filter(x=>x.eventId===s[2].id);
 assert.deepEqual(skill.map(x=>x.skillId),['skill:201351']);
});
test('source checksum/approval tampering cannot promote chain candidate',()=>{
 for(const mutation of [
  a=>a.publicationApproved=true,
  a=>a.noAutomaticRuntimeAdoption=false,
  a=>a.summary.catalogSha256='a'.repeat(64),
  a=>{a.catalog.cards[0].events[0].name='changed'},
  a=>{a.catalog.cards[0].events.push({id:'usl:30318:chain:2'})},
  a=>{a.catalog.cards[0].cardId='30221'}
 ]){
  const f=fixture();mutation(f.assembled);
  assert.throws(()=>assemble(f.assembled));
 }
 for(const mutation of [
  a=>a.publicationApproved=true,
  a=>a.summary.catalogSha256='0'.repeat(64),
  a=>{a.catalog.cards[0].events.at(-1).choices=[]}
 ]){
  const f=fixture(),a=assemble(f.assembled);mutation(a);
  assert.throws(()=>accept({assembled:a,model:f.model,skillText:f.skillText}));
 }
});
test('fixed full coverage cannot be claimed from a small synthetic fixture',()=>{
 const f=fixture();
 assert.throws(()=>assemble(f.assembled,{strict:true}),/563カード・2,511イベント/);
 const a=assemble(f.assembled);
 assert.throws(()=>accept({assembled:a,model:f.model,skillText:f.skillText},{strict:true}),
  /563枚・2,511件/);
});
