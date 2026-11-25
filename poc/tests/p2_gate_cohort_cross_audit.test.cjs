'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const audit=require('../src/p2_gate_cohort_cross_audit.cjs');
const g1=require('../src/skill_p2_g1_source_gap_ledger.cjs');
const axis=require('../src/skill_p2_15_parameterized_axis_gates.cjs');
const g6=require('../src/p2_g6_research_handoff_881.cjs');
const p3=require('../src/p3_g6_research_intake.cjs');
const p243=require('../src/skill_p2_43_original_spurt_candidate_review.cjs');
const bridge=require('../src/skill_bridge.js');
const masks=Array(32).fill(15);
const wd='no-new-short-window-evidence';
function fixture(){
 const id='skill:1', missing='skill:2';
 const route={sourceNumericId:'1',invokeOffset:0,invokeIndex:1,conditionOrIndex:0,preconditionOrIndex:null,groundStateEligibilityMasks:[...masks],unknownDynamicTypes:['order'],runtimeSourceConditionsVerified:false};
 const v={status:'static-necessary-gates-only',potentialGroundStateMasks:[...masks],sourceRoutes:[{invokeOffset:0,invokeIndex:1,conditionOrIndex:0,preconditionOrIndex:null,necessaryGroundStateMasks:[...masks],unresolvedPredicateTypes:['order'],runtimeFullOriginalANDProven:false}],knownExplicitContrast:{style:false,distance:false,surface:false},dynamicConditionsProven:false,fullSkillTriggerProven:false};
 const outcome={eligibleForP3CardScoring:false,cardScore:null,suitabilityLabel:null,originalGameActivationRate:null};
 const l={status:g1.STATUS,source:{revision:p243.PIN,sha256:g6.SOURCE_SHA,pinnedSha256:bridge.PINNED_SHA256},denominators:{sourceStructureMatched:1,sourceUnavailable:1},rows:[
 {appSkillId:id,sourceNumericId:'1',disposition:'matched-current-or-pinned',sourceStructureAvailable:true,eligibleForP3CardScoring:false,cardScore:null,originalFullSkillANDProven:false},
 {appSkillId:missing,sourceNumericId:'2',disposition:'numeric-id-absent-from-both-dictionaries',sourceStructureAvailable:false,eligibleForP3CardScoring:false,cardScore:null,originalFullSkillANDProven:false}]};
 const a={status:axis.STATUS,source:{skillRegistrySha256:g6.SOURCE_SHA},panelDefinition:{contexts:axis.PANEL},denominators:{sourceMatchedSkills:1},routeRows:[route],sourceRows:[
 {skillId:id,sourceNumericId:'1',status:v.status,potentialGroundStateMasks:[...masks],hasKnownStyleGateContrast:false,hasKnownDistanceGateContrast:false,hasKnownSurfaceGateContrast:false},
 {skillId:missing,sourceNumericId:null,status:'unmatched-source-no-gate-inference'}]};
 const h={status:g6.STATUS,source:{fixedOriginalSkillRegistrySHA256:g6.SOURCE_SHA},denominators:{sourceMatchedSkills:1},rows:[
 {appSkillId:id,originalNumericSourceId:'1',originalSourceRef:{},explicitThreeAxisNecessaryOnly:v,partialModelWD:{decision:wd,originalWholeSkillANDNotEstablished:true},evaluationOutcome:{...outcome}},
 {appSkillId:missing,originalNumericSourceId:null,originalSourceRef:null,explicitThreeAxisNecessaryOnly:{status:'source-unavailable',potentialGroundStateMasks:null},partialModelWD:{decision:wd,originalWholeSkillANDNotEstablished:true},evaluationOutcome:{...outcome}}]};
 const p={status:p3.STATUS,provenance:{sourceUmaSimRegistrySHA256:g6.SOURCE_SHA,independentlyVerifiedAgainstFourP2Inputs:true},population:{sourceMatchedSkills:1,sourceUnavailableSkills:1},sourceAppResearchIndex:h.rows.map(x=>({appSkillId:x.appSkillId,originalNumericSourceId:x.originalNumericSourceId,explicitThreeAxisSourceNecessaryStatus:x.explicitThreeAxisNecessaryOnly.status,partialWDStudyDecision:wd,eligibleForP3CardScoring:false,cardScore:null}))};
 return [l,a,h,p];
}
function run(f){f[3].provenance.sourceP2G6DigestSHA256=crypto.createHash('sha256').update(JSON.stringify(f[2])).digest('hex');return audit.audit(...f);}
test('independent exact route and source ledger audit retains unresolved numeric ID separately',()=>{
 const x=run(fixture());assert.equal(x.counts.knownMaskCells,32);assert.equal(x.counts.unknownMaskCells,32);assert.equal(x.counts.routeRefs,1);
 assert.equal(x.rows[1].requestedSourceNumericId,'2');assert.equal(x.rows[1].matchedSourceNumericId,null);assert.equal(x.rows[1].unresolvedRoutePredicateTypes,null);
});
test('reject fabricated source mapping, mask, route, OR union, source score and duplicate IDs',()=>{
 for(const change of [
 f=>f[0].rows[0].sourceNumericId='9',
 f=>f[2].rows[1].explicitThreeAxisNecessaryOnly.potentialGroundStateMasks=[...masks],
 f=>f[2].rows[0].explicitThreeAxisNecessaryOnly.sourceRoutes[0].conditionOrIndex=1,
 f=>f[1].sourceRows[0].potentialGroundStateMasks[0]=0,
 f=>f[2].rows[0].evaluationOutcome.suitabilityLabel='general',
 f=>f[0].rows[1].appSkillId='skill:1'
 ]){const f=fixture();change(f);assert.throws(()=>run(f));}
});
