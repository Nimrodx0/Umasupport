'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {attach}=require('../src/event_coverage_historical.cjs');
const make=()=>({
 index:{dataKind:'umasupport-event-coverage-index',productionApproval:false,
  sourcePins:{checker:'checker'},stats:{observedCheckerCandidates:1},
  cards:[{cardId:'30001',rarity:'SSR',observedCandidateCount:1,
   observedCandidates:[{sourceKey:'one'}]}]},
 source:{dataKind:'support-event-route-classification',forSkillGrant:false,
  sourcePins:{checkerRevision:'checker',historicalMaster:{sha256:'master'}},
  candidateInputSha256:'candidates',totals:{historicalProvisionalLinks:{'strict-unique':1,'typography-suggestion':0}},
  cards:[{cardId:'30001',rarity:'SSR',events:[
   {sourceKey:'one',status:'needs-review',historicalLink:{status:'strict-unique',provisionalStoryId:'830001001'}}]}],
  historicalPossibleGaps:[{cardId:'30001',historicalStoryId:'830001002',confirmedMissingIn2026:false,diagnostic:'no-provisional-title-link'}]},
 chains:{dataKind:'provisional-historical-chain-stage-audit',forSkillGrant:false,
  sourcePins:{candidateInputSha256:'candidates',historicalMasterSha256:'master'},
  totals:{stageGroups:1,stageEvents:1,unsequencedStrictEvents:0,stageCompleteUnique:1,
    stageIncomplete:0,stageAmbiguous:0},
  chainGroups:[{cardId:'30001',events:[{sourceKey:'one',provisionalStoryId:'830001001'}],
    chainMax:1,structuralStatus:'stage-complete-unique',reviewBand:'readyForIndependentRouteReview'}]}
});
test('pinned older ID and stage evidence enriches candidate without approving current game',()=>{
 const p=make(),result=attach(p.index,p.source,p.chains);
 assert.equal(result.cards[0].observedCandidates[0].historical2025.currentGameVerified,false);
 assert.equal(result.cards[0].historicalPotentialGaps[0].confirmedMissingIn2026,false);
 assert.equal(result.cards[0].historicalChainGroups[0].routeVerifiedIn2026,false);
 assert.equal(result.stats.historical2025.provisionalStrictLinks,1);
});
test('source changes and false current-game gaps fail closed',()=>{
 let p=make();p.source.sourcePins.checkerRevision='changed';
 assert.throws(()=>attach(p.index,p.source,p.chains),/ピン/);
 p=make();p.source.historicalPossibleGaps[0].confirmedMissingIn2026=true;
 assert.throws(()=>attach(p.index,p.source,p.chains),/確定/);
 p=make();p.chains.chainGroups[0].events[0].provisionalStoryId='invalid';
 assert.throws(()=>attach(p.index,p.source,p.chains),/矛盾/);
});
