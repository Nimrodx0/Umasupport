'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {flattenRoutes,analyzeDocument,audit}=require('../tools/audit_gametora_branches.cjs');

function card(id,events){
  return {kind:'support',id,events_ja:Object.fromEntries(events.map((ev,i)=>
    ['event-'+i,{section:'arrows',choices:ev}])),events:{ignored:{section:'random',choices:[]}}};
}
const end={type:'chain_end'};
const hint=(id,level)=>({type:'skill_hint',skill_id:id,value:'+'+level});
const docs=[
  card(30001,[[{effects:[hint(201342,2)]},{effects:[end]}]]),
  card(30026,[[{outcomes:[[hint(201342,2)],[end]],random_either:true},{effects:[end]}]]),
  card(30103,[[{effects:[
    {type:'both_previous_chain_good'},hint(200461,3),
    {type:'one_previous_chain_good'},hint(200461,2),
    {type:'both_previous_chain_bad'},hint(200461,1)]}]])
];
const index={dataKind:'umasupport-event-coverage-index',productionApproval:false,
  cards:[{cardId:'30001'},{cardId:'30026'},{cardId:'30103'},{cardId:'30311'}]};
const queue={dataKind:'umasupport-result-review-queue',forSkillGrant:false,rows:[
  {cardId:'30001',priority:'P0'}, {cardId:'30026',priority:'P0'},
  {cardId:'30103',priority:'P0'},{cardId:'30311',priority:'P1'}]};
const sha='6e38b54af4fad397ff4491e63007a90705a4fe67';
test('analyze document: event-level and outcome-level stopping are distinct',()=>{
  const a=analyzeDocument(docs[1],30026);
  assert.equal(a.chainEvents,1);
  assert.equal(a.chainChoices,2);
  assert.equal(a.expandedOutcomeRoutes,3);
  assert.equal(a.terminalRoutes,2);
  assert.equal(a.choicesWithTerminal,2);
  assert.equal(a.eventsWithTerminal,1);
  assert.deepEqual(a.reviewCandidates,[{chainOrdinal:1,sourceLocalEventId:null,
    terminalOutcomes:[{choiceOrdinal:1,outcomeOrdinal:2},{choiceOrdinal:2,outcomeOrdinal:1}],priorMarkers:[]}]);
});
test('cumulative prior-success conditions are detected but NOT interpreted as three ready-made routes',()=>{
  const a=analyzeDocument(docs[2],30103);
  assert.equal(a.previousConditionMarkers,3);
  assert.equal(a.eventsWithPriorDependence,1);
  assert.equal(a.expandedOutcomeRoutes,1);
  assert.equal(a.skillHintMentions,3);
  assert.deepEqual(a.reviewCandidates[0].priorMarkers,
    ['both_previous_chain_bad','both_previous_chain_good','one_previous_chain_good']);
});
test('conditional segments count guards and separate terminal branches',()=>{
 const choices=[{segments:[
    {when:[{kind:'result_good'}],effects:[hint(2,2)]},
    {when:[{kind:'result_bad'}],effects:[end]}
  ]}];
 const a=analyzeDocument(card(30001,[choices]),30001);
 assert.equal(a.terminalRoutes,1);
 assert.equal(a.conditionalSegments,2);
 assert.equal(a.previousConditionMarkers,2);
 assert.equal(flattenRoutes(choices[0]).length,2);
});
test('audit joins by card ID only; reports missing/extra; never marks game or event crosswalk verified',()=>{
  const out=audit({index,queue,documents:[...docs,card(30312,[])],sourceRevision:sha});
  assert.deepEqual(out.missingCardIds,['30311']);
  assert.deepEqual(out.extraCardIds,['30312']);
  assert.equal(out.totals.presentRosterCards,3);
  assert.equal(out.totals.p0EventsOnPresentCards,3);
  assert.equal(out.totals.p0EventsOnMissingCards,0);
  assert.equal(out.totals.terminalRoutes,3);
  assert.equal(out.reviewCandidates.length,3);
  assert.deepEqual(out.reviewCandidates.map(x=>x.cardId),['30001','30026','30103']);
  const q2={...queue,rows:queue.rows.map((r,i)=>({...r,
    reasonCodes:i===0?['OBSERVED_CHAIN_TERMINATION']:i===2?
      ['PRIOR_RESULT_CONTEXT_UNVERIFIED']:[]}))};
  const overlap=audit({index,queue:q2,documents:docs,sourceRevision:sha});
  assert.equal(overlap.totals.checkerStopCards,1);
  assert.equal(overlap.totals.checkerAndSourceStopCardOverlap,1);
  assert.equal(overlap.totals.sourceOnlyStopCards,1);
  assert.equal(overlap.totals.checkerAndSourcePriorCardOverlap,1);
  assert.deepEqual(overlap.discrepancies.checkerOnlyStop,[]);
  assert.deepEqual(overlap.discrepancies.sourceOnlyStop,['30026']);
  assert.deepEqual(overlap.discrepancies.checkerOnlyPrior,[]);
  assert.equal(out.eventToCheckerCrosswalkVerified,false);
  assert.equal(out.releaseApproved,false);
  assert.equal(out.rawThirdPartyContentIncluded,false);
  assert.equal(JSON.stringify(out).includes('label'),false);
});
test('identity or structure mismatch fails closed',()=>{
 assert.throws(()=>analyzeDocument({kind:'support',id:30002,events:{}},30001));
 assert.throws(()=>analyzeDocument(card(30001,[[{outcomes:[null]}]]),30001));
 assert.throws(()=>audit({index,queue,documents:[...docs,docs[0]],sourceRevision:sha}),/duplicate/);
 assert.throws(()=>audit({index,queue,documents:docs,sourceRevision:'main'}),/invalid/);
 assert.throws(()=>audit({index:{...index,productionApproval:true},queue,documents:docs,sourceRevision:sha}),/invalid/);
});
