'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const pin='6e38b54af4fad397ff4491e63007a90705a4fe67';
const ch=(effects,label)=>({label,random_either:false,effects});
const event=(section,choices,id,mode)=>({
 id,name:'COPYRIGHTED_EVENT_UNEXPORTED',section,
 ...(mode?{event_type:mode}:{}),choices
});
const validChoice=ch([{type:'energy',value:'+20'},
 {type:'bond',value:'+5',char_id:9001}],'Continue outings');
const terminalChoice=ch([{type:'skill_hint',value:'+1',skill_id:200272},
 {type:'bond',value:'-5',char_id:9001},{type:'chain_end'}],
 'End this support outing chain');
function fixture(overrides={}){
 const ender=event('random',[validChoice,terminalChoice],3,'pd');
 const outing=event('dates',[ch([{type:'energy',value:'+10'},
  {type:'bond',value:'+5',char_id:9001}],'')],4);
 const events=overrides.events||[ender,outing];
 return {documents:[{kind:'support',id:30001,
  events_ja:Object.fromEntries(events.map((e,i)=>['evt'+(i+1),e]))}],
  index:{dataKind:'umasupport-whole-event-provisional-index',
   publicationApproval:false,sourcePins:{gameToraDerived:pin},
   stats:{gameToraEventRecords:events.length},
   cards:[{cardId:'30001',sourceMissing:false,
    gameToraObservedCount:events.length}]}
 };
}
test('ordinary random pd choice ends linked outing chain but not independent random events',()=>{
 const r=analyze(fixture());
 assert.equal(r.summary.sourceEvents,2);
 assert.equal(r.summary.eligibleEvents,2);
 assert.equal(r.summary.blockedEvents,0);
 assert.equal(r.summary.chainEndMentions,1);
 assert.equal(r.summary.chainEndAcceptedSourceMentions,1);
 assert.equal(r.summary.chainEndAcceptedOutingUnlockMentions,1);
 assert.equal(r.summary.chainEndRejectedSourceMentions,0);
 assert.equal(r.summary.isolatedTerminalOutcomeRecords,1);
 const ev=r.isolatedPreview.cards[0].events[0];
 assert.equal(ev.type,'choice');
 assert.equal(ev.choices.length,2);
 assert.equal(ev.choices[0].terminal,undefined);
 assert.equal(ev.choices[1].terminal,true);
 assert.deepEqual(ev.choices[0].effects.map(e=>e.delta),[20,5]);
 assert.deepEqual(ev.choices[1].effects.map(e=>e.delta),[-5]);
 const model={cards:[{id:'30001'}],cardById:{'30001':{id:'30001'}},
  skillById:{}};
 assert.equal(schema.validateCatalog(r.isolatedPreview,model).eventsWithRecords,2);
 const card={id:'30001',events:[ev]};
 assert.equal(core.directEffectRoutes(card,{choices:{},outcomes:{}}).length,0);
 assert.equal(core.directEffectRoutes(card,{choices:{[ev.id]:'choice-2'},outcomes:{}})
  .length,1);
 assert.equal(JSON.stringify(r).includes('COPYRIGHTED_EVENT_UNEXPORTED'),false);
 assert.equal(JSON.stringify(r).includes('End this support outing chain'),false);
 assert.equal(r.publicationApproved,false);
 assert.equal(r.automaticRuntimeAdoption,false);
});
test('project all 14 cards with one outing unlock and choice-local source terminal in one generic pass',()=>{
 const records=Array.from({length:14},(_,i)=>{
  const data=fixture().documents[0];
  return {...data,id:30001+i};
 });
 const r=analyze({
  documents:records,
  index:{dataKind:'umasupport-whole-event-provisional-index',
   publicationApproval:false,sourcePins:{gameToraDerived:pin},
   stats:{gameToraEventRecords:28},
   cards:records.map(d=>({cardId:String(d.id),sourceMissing:false,
    gameToraObservedCount:2}))}
 });
 assert.equal(r.summary.sourceCards,14);
 assert.equal(r.summary.eligibleEvents,28);
 assert.equal(r.summary.blockedEvents,0);
 assert.equal(r.summary.chainEndAcceptedOutingUnlockMentions,14);
 assert.equal(r.summary.chainEndAcceptedSourceMentions,14);
 assert.equal(r.summary.isolatedTerminalOutcomeRecords,14);
});
test('do not infer outing unlock on random section without full unique PD context',()=>{
 const base=fixture().documents[0].events_ja;
 const entry=structuredClone(Object.values(base)[0]);
 const outing=structuredClone(Object.values(base)[1]);
 const arrow=event('arrows',[ch([{type:'speed',value:'+1'}],'')],6);
 const second=structuredClone(entry);second.id=7;
 const variants=[
  [entry],                          // no outings to unlock
  [entry,arrow,outing],             // arrow chain is unrelated
  [entry,second,outing],           // multiple random chain enders
  [{...entry,event_type:'at'},outing], // different event role
  [{...entry,choices:[terminalChoice]},outing], // no continuing choice
  [{...entry,choices:[validChoice,
   ch([{type:'bond',value:'-5'},{type:'chain_end',value:'+1'}],'End')]},outing],
  [event('special',[validChoice,terminalChoice],3,'pd'),outing]
 ];
 for(const events of variants){
  const report=analyze(fixture({events}));
  assert.equal(report.summary.chainEndAcceptedOutingUnlockMentions,0,
   events.map(e=>e.section).join('/'));
  assert.ok(report.summary.blockedEvents>0,'keep ambiguous context quarantined');
  assert.equal(report.publicationApproved,false);
 }
});
test('do not auto-accept script guards or unflagged result alternatives in outing ender',()=>{
 const e=structuredClone(Object.values(fixture().documents[0].events_ja)[0]);
 e.choices[0]={label:'Random alternatives',random_either:false,
  outcomes:[[{'type':'energy',value:'+5'}],[{'type':'energy',value:'+10'}]]};
 const report=analyze(fixture({events:[e,Object.values(fixture().documents[0].events_ja)[1]]}));
 assert.equal(report.summary.blockedEvents,1);
 assert.equal(report.summary.isolatedPreviewEventRecords,1);
 assert.ok(report.blockedReasons.UNFLAGGED_MULTIPLE_RESULT_ROUTES>0);
});
