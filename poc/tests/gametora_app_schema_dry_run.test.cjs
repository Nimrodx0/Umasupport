'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {transformDocument}=require('../src/gametora_whole_event_normalize.cjs');
const {crosswalk}=require('../src/gametora_event_skill_crosswalk.cjs');
const {project}=require('../src/gametora_app_schema_dry_run.cjs');
const core=require('../src/core.js');
const policy=require('../config/event-source-priority.v1.json');
function skills(){return JSON.stringify([
 {id:'200532',name:'速度維持',rarity:'normal',group:20053},
 {id:'201272',name:'金の加速',rarity:'rare',group:20127},
 ...Array.from({length:120},(_,i)=>({id:String(400000+i),name:'Other '+i,
  rarity:'normal',group:40000+i}))
]);}
function source(){
 return [
  {id:30026,kind:'support',events_ja:{
   a:{id:11,section:'random',name:'Original noncopy text',choices:[
    {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]},
   b:{id:12,section:'arrows',name:'Original stage text',choices:[
    {label:'選択を押す',outcomes:[
     [{type:'skill_hint',skill_id:201272,value:'+3'}],
     [{type:'chain_end'},{type:'energy',value:'-10'}]
    ],random_either:true},
    {label:'終わる',effects:[{type:'chain_end'}]}]},
   c:{id:13,section:'arrows',name:'Original next stage',choices:[
    {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+2'}]}]}}},
  {id:30080,kind:'support',events_ja:{
   a:{id:21,section:'arrows',name:'Missing skill',choices:[{label:'',effects:[
    {type:'skill_hint',skill_id:999999,value:'+1'}]}]},
   b:{id:22,section:'arrows',name:'Depends on omitted previous stage',choices:[
    {label:'',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]}}},
  {id:10010,kind:'support',events_ja:{
   a:{id:31,section:'random',name:'Simple selectable option',choices:[
    {label:'Option one',effects:[{type:'speed',value:'+10'}]},
    {label:'Option two',effects:[{type:'skill_hint',skill_id:200532,value:'+1'}]}]}}}
 ];
}
function model(){
 const cards=['30026','30080','10010'].map(id=>({id,hints:['hint:速度維持'],events:[]}));
 const s={id:'hint:速度維持',name:'速度維持',tier:'unknown',lowerId:null};
 return {cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),
  skills:[s],skillById:{[s.id]:s},meta:{}};
}
function input(){
 const rows=source().map(x=>transformDocument(x));
 const cards=rows.map(r=>{
  const {reviewQueue,effectTypeCounts,...rest}=r;return rest;
 });
 const totals={rosterCards:3,sourceEvents:cards.reduce((s,c)=>s+c.sourceEventCount,0),
  sourceChoices:cards.reduce((s,c)=>s+c.sourceChoiceCount,0),
  expandedRoutes:cards.reduce((s,c)=>s+c.sourceExpandedRoutes,0),
  numericHintMentions:cards.reduce((s,c)=>s+c.numericParsedHintMentions,0),
  unresolvedHintMentions:cards.reduce((s,c)=>s+c.unresolvedHintMentions,0),
  directSkillGrantMentions:cards.reduce((s,c)=>s+c.directSkillGrantMentions,0)};
 const candidate={schemaVersion:1,dataKind:'gametora-whole-event-numeric-candidate',
  sourcePins:{gameToraDerived:policy.baselineRevision},
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  cards,totals};
 const m=model(),cross=crosswalk({candidate,skillText:skills(),model:m});
 return {candidate,cross,skillText:skills(),model:m};
}
test('projection actually validates auto, selectable, branching and chained events using production schema',()=>{
 const {cross,...rest}=input();
 const result=project({...rest,crosswalk:cross});
 assert.equal(result.report.totals.sourceCards,3);
 assert.equal(result.report.totals.sourceEvents,6);
 assert.equal(result.report.totals.candidateSchemaEvents,4);
 assert.equal(result.report.totals.skippedEvents,2);
 assert.equal(result.report.totals.blockedDependentStages,1);
 assert.equal(result.report.totals.candidateSchemaCards,2);
 assert.equal(result.report.totals.candidateAutoEvents,2);
 assert.equal(result.report.totals.candidateChoiceEvents,2);
 assert.equal(result.report.totals.candidateRewardMentions,4);
 assert.equal(result.report.excludedReasons.SKILL_ID_OR_HINT_EFFECT_PENDING,1);
 assert.equal(result.report.excludedReasons.CHAIN_PREDECESSOR_NOT_PROJECTED,1);
 assert.equal(result.runtimeValidation.eventsWithRecords,4);
 const c=result.dryRunCatalog.cards.find(c=>c.cardId==='30026');
 assert.equal(c.events[0].type,'auto');
 assert.equal(c.events[1].type,'choice');
 assert.equal(c.events[1].choices[0].outcomes.length,2);
 assert.equal(c.events[1].choices[0].outcomes[1].terminal,true);
 assert.equal(c.events[1].choices[1].terminal,true);
 assert.deepEqual(c.events[2].requires,{all:[{eventId:c.events[1].id}]});
 assert.equal(core.isReachable(c.events[2],{[c.events[1].id]:'choice-01'},c.events,
  {[c.events[1].id]:'route-01'}),true);
 assert.equal(core.isReachable(c.events[2],{[c.events[1].id]:'choice-01'},c.events,
  {[c.events[1].id]:'route-02'}),false);
 assert.equal(core.isReachable(c.events[2],{[c.events[1].id]:'choice-02'},c.events),false);
 assert.equal(JSON.stringify(result.report).includes('Original'),false);
 assert.equal(result.report.publicationApproved,false);
});
test('a special prior-state marker is quarantined without dropping other sound events',()=>{
 const {cross,...rest}=input();
 const first=rest.candidate.cards[0].events[0];
 first.reviewReasons.push('PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW');
 const result=project({...rest,crosswalk:cross});
 assert.equal(result.report.totals.candidateSchemaEvents,3);
 assert.equal(result.report.excludedReasons.SOURCE_SPECIAL_CASE_REQUIRES_REVIEW,1);
 assert.equal(result.report.totals.candidateRewardMentions,3);
});
test('invalid source types and mismatch crosswalk lineage cannot enter runtime projection',()=>{
 const req=input();
 req.cross.sourcePins.gameToraDerived='0'.repeat(40);
 assert.throws(()=>project({...req,crosswalk:req.cross}),/出典/);
 const req2=input();req2.candidate.releaseApproved=true;
 assert.throws(()=>project({...req2,crosswalk:req2.cross}),/出典/);
});
