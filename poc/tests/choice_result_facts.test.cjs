'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build,validateStored}=require('../src/choice_result_facts.cjs');
const FACT=require('../src/checker_choice_fact_preview.js');
const CATALOG=require('../src/public_event_catalog.js');
const CORE=require('../src/core.js');
const db=require('../data/candidates/checker_event_hints.v1.json');
const copy=x=>structuredClone(x);
test('all 417 cards / 2109 events preserve choice identity and every numeric or unresolved hint',()=>{
 const facts=build(db),s=facts.stats;
 assert.equal(s.cards,417);
 assert.equal(s.events,2109);
 assert.equal(s.choicePositions,3458);
 assert.equal(s.hintMentionsNumeric,1406);
 assert.equal(s.hintMentionsUnresolved,98);
 assert.equal(s.eventsReadyForChoiceCandidate,879);
 assert.equal(s.eventsNeedingFurtherParsing,232);
 assert.equal(s.eventsWithoutObservedHints,998);
 assert.equal(s.choicesWithUnspecifiedOutcomes,3458);
 assert.equal(facts.productionApproval,false);
 assert.equal(facts.semantics.gameTriggerOrTerminationRequired,false);
 assert.equal(validateStored(db,facts).events,2109);
 assert.ok(facts.cards.every(c=>c.events.every(e=>
  e.choices.every(x=>x.resultCandidates.length===1&&
    x.resultCandidates[0].resultKind==='unspecified'&&
    x.resultCandidates[0].outcomeCoverage==='unknown'))));
 const text=JSON.stringify(facts);
 for(const forbidden of ['"Effect":','"Choice":','"Title":','"originalEventText":',
  '"gameRewardVerified":true','"productionApproval":true'])
  assert.equal(text.includes(forbidden),false);
});
test('unresolved and conditional values cannot be promoted to unconditional facts',()=>{
 const facts=build(db);
 const entry=facts.cards.flatMap(c=>c.events).find(e=>e.candidateStatus==='needs-choice-or-result-review');
 assert.ok(entry);
 assert.equal(entry.gameEventIdVerified,false);
 const copyOutput=copy(facts);
 copyOutput.cards[0].events[0].choices[0].resultCandidates[0].resultKind='success';
 assert.throws(()=>validateStored(db,copyOutput),/不一致/);
 const altered=copy(facts);
 altered.productionApproval=true;
 assert.throws(()=>validateStored(db,altered),/不一致/);
});
function fakeRegistry(facts){
 const ids=[...new Set(facts.cards.flatMap(c=>c.events.flatMap(e=>
  e.choices.flatMap(ch=>ch.resultCandidates.flatMap(o=>o.skillHints.map(h=>h.skillId))))))];
 const rows=ids.map((id,i)=>({id,name:'数値スキル'+id,rarity:'normal',group:20000+i}));
 while(rows.length<120)rows.push({id:String(900000+rows.length),
  name:'テストスキル'+rows.length,rarity:'normal',group:900000+rows.length});
 return JSON.stringify(rows);
}
function fakeModel(facts){
 const cards=facts.cards.map(c=>({id:c.cardId,events:[],hints:[]}));
 return {cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),skills:[],
  skillById:{},meta:{reviewedEventRecords:0,reviewedEventCards:0,
   runtimeSources:{events:{mode:'reviewed'}}}};
}
test('opt-in preview offers 879 explicit-choice events on 398 cards, never falsely auto-awarded',()=>{
 const facts=build(db),text=fakeRegistry(facts),model=fakeModel(facts);
 const p=FACT.fromSource(facts,model,text);
 assert.equal(p.summary.events,879);
 assert.equal(p.summary.cards,398);
 assert.equal(p.summary.choicePositions,1494);
 assert.equal(p.summary.matchedHints,1077);
 assert.deepEqual(p.summary.omitted,{
  noObservedHint:998,needsFurtherParsing:232,skillNotInCurrentRegistry:0});
 const first=p.catalog.cards[0].events.find(e=>e.choices.some(c=>c.rewards.length));
 assert.ok(first);
 assert.equal(first.type,'choice');
 assert.equal(first.requires,undefined);
 assert.ok(first.choices.every(c=>c.rewards.every(r=>
  r.condition===FACT.EXPLICIT_CONDITION)));
 assert.ok(first.choices.every(c=>c.label.startsWith('候補位置 ')));
 const summary=CATALOG.attach(model,p.catalog,{skillText:text,fullRegistry:false});
 assert.equal(summary.eventsWithRecords,879);
 const card=model.cardById[p.catalog.cards[0].cardId];
 assert.deepEqual(CORE.directRoutes(card,{stage:4,choices:{}}).filter(x=>x.source==='event'),[]);
 const selections={};
 for(const e of card.events)selections[e.id]='option1';
 const routes=CORE.directRoutes(card,{stage:4,choices:selections}).filter(x=>x.source==='event');
 assert.ok(routes.length>0);
 assert.ok(routes.every(x=>x.conditional&&x.condition.includes('結果未区分')));
});
test('absent numeric skill in current registry excludes an entire event, never partial reward',()=>{
 const facts=build(db),full=JSON.parse(fakeRegistry(facts));
 const target=facts.cards.flatMap(c=>c.events).find(e=>e.candidateStatus==='numeric-choice-candidate');
 const id=target.choices.flatMap(c=>c.resultCandidates.flatMap(o=>o.skillHints))[0].skillId;
 const limited=JSON.stringify(full.filter(x=>x.id!==id));
 const preview=FACT.fromSource(facts,fakeModel(facts),limited);
 assert.ok(preview.summary.omitted.skillNotInCurrentRegistry>0);
 assert.equal(preview.summary.events+preview.summary.omitted.skillNotInCurrentRegistry,879);
});
