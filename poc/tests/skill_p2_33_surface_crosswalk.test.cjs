'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const cross=require('../src/skill_p2_33_surface_crosswalk.cjs');
const axis=require('../src/skill_p2_15_parameterized_axis_gates.cjs');
test('all-distance fixed source shape overlap is four mechanisms, never four original skills',()=>{
 const p=cross.pairedMechanisms(manifest);
 assert.equal(p.allDistanceSourceSignatures,10);
 assert.equal(p.paired.length,4);
 assert.equal(p.held.length,2);
 assert(p.paired.every(x=>x.turfSourceNumericId!==x.dirtSourceNumericId));
 assert.deepEqual(p.paired.map(x=>x.mechanismKey),[
  'phase_laterhalf_random:0|top50',
  'phase_laterhalf_random:1|top50',
  'phase_random:1|from40',
  'phase_random:1|top50']);
 assert(p.held.every(x=>x.reason==='no-paired-other-surface-observation'));
});
test('normalized rank/time match needs identical original operators and current AND, not preconditions',()=>{
 const pred=(type,operator,value)=>({type,operator,value});
 assert.deepEqual(cross.routeSignature([
  pred('phase_random','==',1),pred('order_rate','<=',50),
  pred('ground_type','!=',3)]),{
  timing:'phase_random:1',bandId:'top50',
  originalOrderRatePredicates:1,originalRandomWindowPredicates:1});
 assert.equal(cross.routeSignature([
  pred('order_rate','<=',50),pred('phase_random','>=',1)]),null);
 assert.equal(cross.routeSignature([
  pred('phase_random','==',1),pred('order_rate','<=',49)]),null);
 assert.equal(cross.routeSignature([
  pred('phase_random','==',1),pred('phase_random','==',2),
  pred('order_rate','<=',50)]),null);
 assert.equal(cross.routeSignature([
  pred('order_rate','<=',50),pred('motivation','==',4)]),null);
});
test('same ground-state bit intersection required for turf and dirt across exact 32-panel',()=>{
 const mask=Array(32).fill(0);
 mask[axis.panelIndex(2,3,1)]=1;
 mask[axis.panelIndex(2,3,2)]=2;
 assert.deepEqual(cross.sameGroundStateStaticCompatibility(mask),[]);
 mask[axis.panelIndex(2,3,2)]=3;
 const x=cross.sameGroundStateStaticCompatibility(mask);
 assert.deepEqual(x,[{runningStyle:2,distanceType:3,
  sameGroundConditionMasks:1}]);
 assert.throws(()=>cross.sameGroundStateStaticCompatibility(
  Array(31).fill(15)),/static axis/);
});
function fixture(){
 const skills=[],routeRows=[];
 for(let i=0;i<818;i++){
  const id=String(400000+i);
  const sources=[];
  sources.push(i===0?
   [{type:'order_rate',operator:'<=',value:50},
    {type:'phase_random',operator:'==',value:1},
    {type:'random_unknown',operator:'>=',value:2}]:
   [{type:'phase',operator:'==',value:2}]);
  if(i<152)sources.push([{type:'motivation',operator:'==',value:4}]);
  const skill={id:'skill:'+id,
   activationProfile:{status:'source-structure',
    sourceNumericId:id,invokes:[{index:0,conditions:sources,
     preConditions:[]}]}};
  skills.push(skill);
  for(let j=0;j<sources.length;j++){
   const masks=Array(32).fill(0);
   if(i===0&&j===0){
    masks[axis.panelIndex(1,2,1)]=4;
    masks[axis.panelIndex(1,2,2)]=4;
   }
   routeRows.push({sourceNumericId:id,invokeOffset:0,invokeIndex:0,
    conditionOrIndex:j,preconditionOrIndex:null,
    routeKey:id+'|0|'+j+'|_',groundStateEligibilityMasks:masks});
  }
 }
 assert.equal(routeRows.length,970);
 return {model:{skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s]))},
  gates:{status:axis.STATUS,routeRows,denominators:{
   sourceMatchedSkills:818,sourceRouteFamilies:970}}};
}
test('original route audit joins a shared mechanism but never infers real same-skill W',()=>{
 const {model,gates}=fixture();
 const before=JSON.stringify(model);
 const r=cross.auditSourceRoutes(model,gates,manifest);
 assert.equal(JSON.stringify(model),before);
 assert.equal(r.denominators.originalSourceRoutes,970);
 assert.equal(r.denominators.sharedCrossSurfaceRankTimeMechanisms,4);
 assert.equal(r.denominators.sourceRoutesWithSupportedRankAndWindowShape,1);
 assert.equal(r.denominators.routeShapesFoundInPairedProxy,1);
 assert.equal(r.denominators.routesWithBothSurfacesStaticallyCompatible,1);
 assert.equal(r.denominators.fullSourceSameSkillSurfaceWMeasurements,0);
 assert.equal(r.denominators.routesWithMinimalCurrentANDForNextModelPilot,0);
 assert.equal(r.originalSourceRoutes[0].structurallyMinimalForModelPilot,false);
 assert.equal(Object.keys(r.perSharedMechanism).length,4);
 assert.equal(r.originalSourceRoutes.length,1);
 assert.deepEqual(r.originalSourceRoutes[0].otherCurrentTypes,['random_unknown']);
 assert.equal(r.originalSourceRoutes[0].sourceWholeANDOrInvokeProven,false);
 const shifted=structuredClone(gates);
 shifted.routeRows[0].groundStateEligibilityMasks[
  axis.panelIndex(1,2,2)]=8;
 const held=cross.auditSourceRoutes(model,shifted,manifest);
 assert.equal(held.denominators.routesWithBothSurfacesStaticallyCompatible,0);
 assert.equal(held.denominators.routesHeldByOriginalStaticGates,1);
});
test('only genuinely single-Invoke, single-OR, no-history source branch qualifies for next pilot',()=>{
 const {model,gates}=fixture();
 const skill=model.skills[1],id=skill.activationProfile.sourceNumericId;
 skill.activationProfile.invokes[0].conditions[0]=[
  {type:'order_rate',operator:'>=',value:40},
  {type:'phase_random',operator:'==',value:1}
 ];
 assert.equal(gates.routeRows[2].sourceNumericId,id);
 gates.routeRows[2].groundStateEligibilityMasks[
  axis.panelIndex(2,2,1)]=1;
 gates.routeRows[2].groundStateEligibilityMasks[
  axis.panelIndex(2,2,2)]=1;
 const z=cross.auditSourceRoutes(model,gates,manifest);
 assert.equal(z.denominators.routesWithBothSurfacesStaticallyCompatible,2);
 assert.equal(z.denominators.routesWithMinimalCurrentANDForNextModelPilot,0);
 // The added skill still has a second current OR alternative.
 assert.equal(z.originalSourceRoutes.find(x=>x.sourceNumericId===id)
  .currentConditionORAlternatives,2);
 skill.activationProfile.invokes[0].conditions.pop();
 const route0=gates.routeRows.findIndex(x=>x.sourceNumericId===id&&
  x.conditionOrIndex===1);
 assert(route0>=0);
 // Synthetic report is held to its fixed 970-route source denominator;
 // a non-existent source-OR row may not be silently removed from it.
 assert.throws(()=>cross.auditSourceRoutes(model,gates,manifest),/source route\/Invoke/);
});
