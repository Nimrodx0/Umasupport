'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze:inventory}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {analyze:cohorts,classify}=require('../src/phase2_gt_blocker_cohorts.cjs');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const eff=(type,value)=>({type,value});
const event=(effects,i,opts={})=>({
 id:i,name:'COPYRIGHTED_SOURCE_EVENT_IGNORE',section:'arrows',
 choices:[{label:'COPYRIGHTED_CHOICE_IGNORE',random_either:false,
   effects,...opts}]
});
function fixture(){
 const events=[
  event([eff('energy','+4'),eff('power','+2')],1),
  event([eff('sga','+1'),eff('guts','+3')],2),
  event([eff('speed','+1/+4')],3),
  event([eff('chain_end','+1'),eff('guts','+4')],4),
  {id:5,name:'PROPRIETARY',section:'random',choices:[{label:'COPYRIGHTED',
   segments:[{when:[{kind:'scripted',value:['class',1]}],
    effects:[eff('power','+1')]}]}]}
 ];
 const documents=[{id:30100,kind:'support',
  events_ja:Object.fromEntries(events.map((e,i)=>['event'+(i+1),e]))}];
 const index={dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:rev},
  stats:{gameToraEventRecords:events.length},
  cards:[{cardId:'30100',sourceMissing:false,gameToraObservedCount:events.length},
    {cardId:'30101',sourceMissing:true,gameToraObservedCount:0}]};
 const result=inventory({documents,index});
 return {documents,index,inventory:result};
}
test('assign every blocked EVENT once to a reusable primary cohort, retaining overlap reasons',()=>{
 const f=fixture(),r=cohorts(f);
 assert.equal(r.sourceEvents,5);
 assert.equal(r.blockedEvents,4);
 assert.equal(r.eligibleEvents,1);
 assert.equal(r.rows.length,4);
 assert.deepEqual(r.cohorts,{
  CHAIN_CONTROL_OR_TERMINAL_CONTEXT:1,
  INTERNAL_SEGMENT_GUARD:1,
  NUMERIC_RANGE_OR_SHAPE:1,
  UNSUPPORTED_EFFECT_SEMANTICS:1
 });
 assert.deepEqual(r.rows.map(x=>x.sourceOrdinal),[2,3,4,5]);
 assert.deepEqual(r.rows[0].reasonCodes,['UNSUPPORTED_EFFECT_TYPE']);
 assert.deepEqual(r.rows[2].reasonCodes,['CHAIN_END_SOURCE_CONTEXT_UNSUPPORTED',
  'CONTROL_MARKERS_REQUIRE_BRANCH_ADJUDICATION']);
 assert.deepEqual(r.rows[3].reasonCodes,[
  'CONDITIONAL_SEGMENTS_NOT_MODELED','SOURCE_ROUTE_GUARD_UNMODELED']);
 assert.equal(r.publicationApproved,false);
 assert.equal(r.automaticRuntimeAdoption,false);
 assert.equal(r.sourceNarrativeIncluded,false);
 for(const term of ['COPYRIGHTED','PROPRIETARY','+1','+4']){
  assert.equal(JSON.stringify(r).includes(term),false,'source prose/effect values leak');
 }
});
test('cohort classification is deterministic and does not treat unresolved outcomes as certain',()=>{
 assert.equal(classify(['UNSUPPORTED_EFFECT_TYPE','NONSCALAR_OR_INVALID_NUMERIC_VALUE']),
  'NUMERIC_RANGE_OR_SHAPE');
 assert.equal(classify(['UNFLAGGED_MULTIPLE_RESULT_ROUTES']),
  'RESULT_SHAPE_DISCREPANCY');
 assert.equal(classify(['CONDITIONAL_SEGMENTS_NOT_MODELED','UNSUPPORTED_EFFECT_TYPE']),
  'INTERNAL_SEGMENT_GUARD');
 assert.equal(classify(['CONTROL_MARKERS_REQUIRE_BRANCH_ADJUDICATION']),
  'CHAIN_CONTROL_OR_TERMINAL_CONTEXT');
});
test('source IDs, route topology, blocker count, and fixed revision cannot be silently changed',()=>{
 const mutate=[
  x=>x.index.sourcePins.gameToraDerived='another',
  x=>x.inventory.rows[0].cardId='39999',
  x=>x.inventory.rows[0].sourceOrdinal=999,
  x=>x.inventory.rows.push(structuredClone(x.inventory.rows[0])),
  x=>x.inventory.rows[1].issueCodes=['UNAUTHORIZED NEW FLAG'],
  x=>x.inventory.summary.blockedEvents+=1,
  x=>x.inventory.summary.blockedRoutes+=1,
  x=>x.index.cards[0].gameToraObservedCount=99,
  x=>x.documents[0].events_ja.event3.choices=[]
 ];
 for(const m of mutate){
  const f=fixture();m(f);
  assert.throws(()=>cohorts(f),/GT全件保留グループ監査/,m.toString());
 }
 assert.throws(()=>cohorts(fixture(),{strict:true}),/GT全件保留グループ監査/);
});
