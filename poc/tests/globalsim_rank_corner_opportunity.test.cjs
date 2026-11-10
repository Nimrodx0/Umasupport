'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_rank_corner_opportunity.cjs');
const roster=require('../tools/globalsim_roster32.cjs');
const c=(type,op,val)=>({type,operator:op,value:val});
const base={sourceNumericId:'200712',invokeOffset:0,side:'conditions',
 orIndex:0,candidate:'absolute-order',
 feasibility:'source-absolute-rank-phase-random-subcondition-candidate',
 rankPredicates:[c('order','<=',3)],
 timingPredicates:[c('phase_random','==',1)],
 sourceCornerIndex:[],explicitPredicates:[c('distance_type','==',3)],
 otherAndTypes:[],siblingORCount:1,preconditionsGroups:0,invokeCount:1,
 fullyModeledSkill:false};
const corner={...base,candidate:'corner-with-rank-rate',
 feasibility:'source-corner-rank-subcondition-candidate',
 rankPredicates:[c('order_rate','<=',50)],
 timingPredicates:[],sourceCornerIndex:[c('corner_random','==',3)],
 explicitPredicates:[c('ground_type','==',1)]};
const course={id:10502,surface:'turf',distance:1600,distanceType:2};
const meta={distance:1600,surface:1,distanceType:2,raceTrackId:10005,
 turn:1,corners:[{start:100,length:200},{start:500,length:200}]};
test('source literal 1-index order and 9/12 order_rate thresholds never mix',()=>{
 assert.deepEqual(m.exactAllowed(base,9).allowed,[1,2,3]);
 assert.deepEqual(m.exactAllowed(base,12).allowed,[1,2,3]);
 assert.deepEqual(m.exactAllowed(corner,9).allowed,[1,2,3,4,5]);
 assert.deepEqual(m.exactAllowed(corner,12).allowed,[1,2,3,4,5,6]);
 const joint={...base,rankPredicates:[
  c('order','>=',2),c('order_rate','<=',50)]};
 assert.deepEqual(m.exactAllowed(joint,9).allowed,[2,3,4,5]);
});
test('corner_random==3 uses last-four left-null padding, never third array index',()=>{
 m.courseMeta(course,meta);
 const z=m.supportedWindow(corner,course,meta);
 assert.equal(z.status,'model-zone-only');
 assert.equal(z.start,100);
 assert.equal(z.end,300);
 assert.equal(z.cornerNumber,3);
 assert.equal(m.supportedWindow({...corner,sourceCornerIndex:[
  c('corner_random','==',1)]},course,meta).status,
  'held-selected-corner-absent');
});
test('fixed source race restrictions are respected, unlike style-neutral inference',()=>{
 assert.equal(m.explicitMatch(base,course,meta,'Nige'),
  'not-in-source-race-scope');
 assert.equal(m.explicitMatch(corner,course,meta,'Senkou'),
  'eligible-in-source-race-scope');
 assert.equal(m.explicitMatch({...corner,explicitPredicates:[
  c('running_style','==',4)]},course,meta,'Senkou'),
  'not-in-source-race-scope');
 assert.equal(m.explicitMatch({...corner,explicitPredicates:[
  c('future_race_setting','==',1)]},course,meta,'Senkou'),
  'held-unverified-explicit-scope');
});
test('source phase random boundaries preserve exact fractional values',()=>{
 const z=m.supportedWindow(base,{...course,distance:1800},meta);
 assert.equal(z.kind,'phase_random-10m');
 assert(Math.abs(z.start-300)<1e-8);
 assert(Math.abs(z.end-1200)<1e-8);
 const later={...base,timingPredicates:[
  c('phase_laterhalf_random','==',1)]};
 const w=m.supportedWindow(later,{...course,distance:1800},meta);
 assert.equal(w.start,750);
 assert.equal(w.end,1200);
});
test('rejected model metadata must not become a result of zero probability',()=>{
 assert.throws(()=>m.courseMeta(course,{...meta,surface:2}),/differs/);
 assert.throws(()=>m.verifyCandidates({schemaVersion:1}),/Untrusted/);
});
