'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {join,query}=require('../src/phase2_event_review_lookup.cjs');
const q={dataKind:'umasupport-result-review-queue',forSkillGrant:false,
 sourcePins:{checkerRevision:'pin'},stats:{eventCandidates:2,priorityTotals:{P0:1,P1:0,P2:1}},
 rows:[{sourceKey:'x',cardId:'30001',priority:'P0',productionApproval:false},
       {sourceKey:'y',cardId:'30001',priority:'P2',productionApproval:false}]};
const index={dataKind:'umasupport-event-coverage-index',productionApproval:false,
 sourcePins:{checker:'pin'},cards:[{cardId:'30001',rarity:'SSR',expectedEventListStatus:'unknown',
 gaps:[],observedCandidates:[
 {sourceKey:'x',historical2025:{status:'strict-unique',provisionalStoryId:'830001001'}},
 {sourceKey:'y',historical2025:{status:'no-match'}}]},
 {cardId:'10001',rarity:'R',expectedEventListStatus:'unknown',gaps:['R_SOURCE_NOT_INCLUDED'],observedCandidates:[]}]};
test('all review events join to 2025-only provisional ID without current verification',()=>{
 const joined=join({queue:q,index});
 a.equal(joined.stats.events,2);
 a.equal(joined.stats.priority.P0.strict2025,1);
 const x=query(joined,{cardId:'30001',priority:'P0'});
 a.equal(x.rows[0].historicalLink.provisionalStoryId,'830001001');
 a.equal(x.rows[0].historicalLink.currentGameIdVerified,false);
 a.equal(x.rows[0].expectedEventListVerified,false);
});
test('R without Checker event candidates is missing evidence, not zero real events',()=>{
 const joined=join({queue:q,index});
 const x=query(joined,{cardId:'10001'});
 a.equal(x.matched,0);
 a.deepEqual(x.sourceGapReasons,['R_SOURCE_NOT_INCLUDED']);
 a.equal(x.expectedEventListStatus,'unknown');
});
test('orphan/duplicated candidate, source pin mismatch, priority drift fail closed',()=>{
 a.throws(()=>join({queue:{...q,sourcePins:{checkerRevision:'bad'}},index}),/不一致/);
 a.throws(()=>join({queue:{...q,rows:[q.rows[0],q.rows[0]]},index}),/不正/);
 a.throws(()=>join({queue:{...q,stats:{...q.stats,priorityTotals:{P0:2,P1:0,P2:0}}},index}),/総数/);
});
