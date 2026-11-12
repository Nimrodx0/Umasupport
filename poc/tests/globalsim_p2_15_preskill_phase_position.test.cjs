'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tool=require('../tools/globalsim_p2_15_preskill_phase_position.cjs');
const phase=require('../src/skill_phase_random_source_window_audit.cjs');
function cohort(){
 const rows=[];
 for(let id=0;id<102;id++){
  const name=String(300000+id);
  for(let j=0;j<(id<9?4:3);j++){
   const phasePredicates=[{side:'conditions',predicateIndex:0,
    operator:'==',phaseId:0,phaseNumberSupportedByResearch:true}];
   const sourcePath=k=>({
    invokeOffset:0,conditionOrIndex:k,preconditionOrIndex:null,
    phasePredicates,finitePredicates:[{side:'conditions',predicateIndex:1,
     type:'running_style',operator:'==',value:j+1}],
    state:'original-window-shape-verified-not-same-tick-evaluated'
   });
   const r={sourceNumericId:name,
    style:['逃げ','先行','差し','追込'][j],researchPaths:[sourcePath(0)]};
   if(rows.length<56)r.researchPaths.push(sourcePath(1));
   rows.push(r);
  }
 }
 assert.equal(rows.length,315);
 assert.equal(rows.reduce((a,r)=>a+r.researchPaths.length,0),371);
 return {status:phase.STATUS,summary:{
  phaseRandomSingletonCandidateSkills:102,
  phaseRandomSingletonCandidateStyleCells:315,
  exactPhaseWindowSourcePaths:371},rows};
}
function fixtures(){
 const course={id:10502,distance:1600,distanceType:2,surface:'turf'};
 const plans=[{course,fieldSize:1,strategies:['Nige']}];
 const physical=(pos)=>[pos,15,100,0.5,0,-1];
 const orig=[{frames:[
  {t:0,horses:[physical(138)]},
  {t:1,horses:[physical(150)]},
  {t:2,horses:[physical(155)]}
 ]}];
 const probe=structuredClone(orig);
 probe[0].frames[1].horses[0][4]=138;
 probe[0].frames[1].horses[0][5]=138;
 probe[0].frames[2].horses[0][4]=150;
 probe[0].frames[2].horses[0][5]=150;
 return {plans,orig,probe};
}
test('pin the original phase geometry with 2m terminal start and inclusive 10m window',()=>{
 assert.deepEqual(tool.phaseBounds(1600,1),[1600/6,1600*2/3]);
 const mid=tool.sourceShapedWindow(1600,0,.5);
 assert.equal(mid.start,1600/12);
 assert.equal(mid.end,1600/12+10);
 const late=tool.sourceShapedWindow(1600,0,.99);
 assert(Math.abs(late.start-(1600/6-2))<1e-9);
 assert(Math.abs(late.end-(1600/6))<1e-9);
 assert.throws(()=>tool.sourceShapedWindow(1600,0,1),/Counterfactual/);
 assert.throws(()=>tool.phaseBounds(1600,4),/Invalid phase/);
});
test('a pinned source route only matches proven fixed context; unknown ground/precondition stays held',()=>{
 const p=fixtures().plans[0];
 const pred=(type,value,side='conditions')=>({type,operator:'==',
  value,side,predicateIndex:0});
 assert.equal(tool.staticContextMatch([
  pred('running_style',1),pred('distance_type',2),pred('ground_type',1)
 ],p,'Nige'),'static-context-matches');
 assert.equal(tool.staticContextMatch([pred('running_style',3)],p,'Nige'),
  'context-excluded');
 assert.equal(tool.staticContextMatch([pred('ground_condition',1)],p,'Nige'),
  'held-unknown-context-or-historical-precondition');
 assert.equal(tool.staticContextMatch([pred('distance_type',2,'preConditions')],p,'Nige'),
  'held-unknown-context-or-historical-precondition');
});
test('observed priority-call positions equal previous frame while geometric path hits remain hypothetical',()=>{
 const {orig,probe,plans}=fixtures();
 const report=tool.analyze(orig,probe,plans,cohort());
 assert.equal(report.status,tool.STATUS);
 assert.equal(report.totals.framePairs,3);
 assert.equal(report.totals.noSkillRunnerTicks,2);
 assert.equal(report.totals.prePriority1MatchesPriority0,2);
 assert.equal(report.totals.prePriorityMatchesPreviousPost,2);
 assert.equal(report.totals.identicalPhysicalColumns,12);
 assert.equal(report.provenance.sourcePaths,371);
 assert.equal(report.rows.length,371);
 assert.equal(report.gates.originalRandomWindowSampled,false);
 assert.equal(report.gates.sourceSkillEquipped,false);
 assert(report.totals.sourceShapedHalfwayPathWeightedWindowHits>0);
 assert(report.rows.every(r=>r.fullSourceSkillTriggers===0));
 const altered=structuredClone(probe);
 altered[0].frames[1].horses[0][5]=139;
 assert.throws(()=>tool.analyze(orig,altered,plans,cohort()),
  /Priority1\/priority0/);
 const shifted=structuredClone(probe);
 shifted[0].frames[1].horses[0][4]=137;
 shifted[0].frames[1].horses[0][5]=137;
 assert.throws(()=>tool.analyze(orig,shifted,plans,cohort()),
  /previous-frame model position/);
 const speed=structuredClone(probe);
 speed[0].frames[1].horses[0][1]+=1;
 assert.throws(()=>tool.analyze(orig,speed,plans,cohort()),
  /changed race physics/);
});
test('reject missing source path, unsupported operators and path denominator forgery',()=>{
 const {plans,orig,probe}=fixtures();
 const wrong=cohort();wrong.rows[0].researchPaths[0].phasePredicates[0].operator='!=';
 assert.throws(()=>tool.analyze(orig,probe,plans,wrong),
  /not verified for counterfactual/);
 const missing=cohort();missing.rows.pop();
 assert.throws(()=>tool.analyze(orig,probe,plans,missing),
  /not pinned to 102\/315\/371/);
 const duplicated=cohort();
 duplicated.rows[0].researchPaths[1].conditionOrIndex=0;
 assert.throws(()=>tool.analyze(orig,probe,plans,duplicated),
  /Duplicate exact original route/);
});
test('frozen source patch is additive, verifies all exact anchors and rejects repeat or moved source',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p215-pos-'));
 try{
  for(const [name,steps] of Object.entries(tool.replacement)){
   const file=path.join(dir,name);
   fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,steps.map(s=>s[0]).join('\n// detail\n').replace(/\n/g,'\r\n'));
  }
  const done=tool.patch(dir);
  assert.equal(done.revision,tool.PIN);
  assert.equal(Object.keys(done.changed).length,3);
  assert(fs.readFileSync(path.join(dir,'src/lib.rs'),'utf8').includes('p2_priority_pos'));
  assert(fs.readFileSync(path.join(dir,'src/race_field_retail.rs'),'utf8').includes('p2_positions[i].0'));
  assert.throws(()=>tool.patch(dir),/pinned GlobalSim source moved/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
