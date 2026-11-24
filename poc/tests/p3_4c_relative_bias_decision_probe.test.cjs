'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const probe=require('../src/p3_4c_relative_bias_decision_probe.cjs');
const {STYLES}=probe;
const scopeId='synthetic-same-race-conditions';
function panel(fn){
 return {basis:'synthetic-illustration-not-game-source',scopeId,
  eligibleStyles:[...STYLES],
  pairs:STYLES.flatMap((a,i)=>STYLES.slice(i+1).map(b=>{
   const [lower,upper]=fn(a,b);
   return {first:a,second:b,scopeId,
    lowerDifferencePoints:lower,upperDifferencePoints:upper};
  }))};
}
function allEqual(range=1){
 return panel(()=>[-range,range]);
}
function twoTop(){
 return panel((a,b)=>{
  const top=new Set(['Nige','Senkou']);
  if(top.has(a)===top.has(b))return [-1,1];
  return top.has(a)?[12,14]:[-14,-12];
 });
}
test('general depends only on a substantiated relative equivalence envelope, not absolute W',()=>{
 const low=allEqual(),high=allEqual();
 low.hypotheticalAbsoluteOpportunity=0.1;
 high.hypotheticalAbsoluteOpportunity=95;
 const a=probe.illustrativeClassification(low,5);
 const b=probe.illustrativeClassification(high,5);
 assert.equal(a.classification,'general');
 assert.equal(b.classification,'general');
 assert.deepEqual(a.styleTargets,[]);
 assert.equal(a.approvedForP3OrP4,false);
 assert.equal(a.realSkillLabel,null);
 assert.equal(a.wholeSkillActivationProbability,null);
 assert.equal(a.reason.includes('absolute opportunity is irrelevant'),true);
});
test('two equally top styles may both be targeted, never compressed to one',()=>{
 const a=probe.illustrativeClassification(twoTop(),5);
 assert.equal(a.classification,'targeted');
 assert.deepEqual(a.styleTargets,['Nige','Senkou']);
 assert.equal(a.realSkillLabel,null);
 assert.equal(a.approvedForP3OrP4,false);
});
test('single winner from fully resolved synthetic pair relations',()=>{
 const a=panel((x,y)=>{
  if(x==='Nige')return [12,13];
  return [-1,1];
 });
 const r=probe.illustrativeClassification(a,3);
 assert.equal(r.classification,'targeted');
 assert.deepEqual(r.styleTargets,['Nige']);
});
test('absence of statistical detection is not equivalence; wide bounds remain unknown',()=>{
 const p=allEqual();
 p.pairs[0].lowerDifferencePoints=-20;
 p.pairs[0].upperDifferencePoints=20;
 const r=probe.illustrativeClassification(p,5);
 assert.equal(r.classification,'undetermined');
 assert.deepEqual(r.styleTargets,[]);
 assert.equal(r.reason.includes('cross'),true);
});
test('same illustrative evidence changes by requested margin, without choosing official threshold',()=>{
 const a=twoTop();
 const sweep=probe.illustrativeSweep(a,[0,3,5,13]);
 assert.deepEqual(sweep.map(x=>x.classification),
  ['undetermined','targeted','targeted','undetermined']);
 assert(sweep.every(x=>x.approvedForP3OrP4===false));
 assert.throws(()=>probe.illustrativeClassification(a,undefined),
  /illustrative point margin/);
 assert.throws(()=>probe.illustrativeSweep(a,[3,3]),/distinct small/);
});
test('nontransitive or cyclic artificial comparisons cannot produce misleading target or general',()=>{
 const odd=panel((a,b)=>{
  if(a==='Nige'&&b==='Senkou')return [-1,1];
  if(a==='Nige'&&b==='Sasi')return [-1,1];
  if(a==='Senkou'&&b==='Sasi')return [12,13];
  if(b==='Oikomi')return [12,13];
  return [-1,1];
 });
 assert.equal(probe.illustrativeClassification(odd,5).classification,'undetermined');
 const cycle=panel((a,b)=>{
  if(a==='Nige'&&b==='Senkou')return [12,13];
  if(a==='Nige'&&b==='Sasi')return [-13,-12];
  if(a==='Senkou'&&b==='Sasi')return [12,13];
  if(b==='Oikomi')return [12,13];
  return [-1,1];
 });
 assert.equal(probe.illustrativeClassification(cycle,5).classification,'undetermined');
});
test('missing, mismatched, duplicate, mixed-context or invalid comparisons cannot certify general',()=>{
 const p=allEqual();
 p.pairs.pop();
 assert.throws(()=>probe.illustrativeClassification(p,5),/incomplete/);
 const dup=allEqual();dup.pairs[1]=dup.pairs[0];
 assert.throws(()=>probe.illustrativeClassification(dup,5),/duplicate/);
 const invalid=allEqual();invalid.pairs[0].scopeId='different-course';
 assert.throws(()=>probe.illustrativeClassification(invalid,5),/context scope/);
 const missing=allEqual();missing.eligibleStyles.pop();
 assert.throws(()=>probe.illustrativeClassification(missing,5),
  /all four styles/);
 const outside=allEqual();outside.pairs[0].lowerDifferencePoints=30;
 outside.pairs[0].upperDifferencePoints=-30;
 assert.throws(()=>probe.illustrativeClassification(outside,5),
  /invalid hypothetical/);
 const real=allEqual();real.basis='source-original-game-skills';
 assert.throws(()=>probe.illustrativeClassification(real,5),
  /only explicitly synthetic/);
 const invalidMargin=allEqual();
 assert.throws(()=>probe.illustrativeClassification(invalidMargin,-1),
  /nonnegative finite/);
});
function realResearchFixture(){
 const status=[
  ...Array(81).fill('partial-source-window-research-only'),
  ...Array(6).fill('held-source-ground-not-covered-by-model'),
  ...Array(794).fill('no-additional-short-window-study')];
 return {status:'P3.4a-uncertainty-interpreted-source-research-only-no-scoring-policy',
  provenance:{officialPolicyApproved:false,
   sourceOriginalRegistrySHA256:'synthetic-registry-sha'},
  denominators:{appSkills:881,sourceMatchedSkills:818,
   sourceUnavailableSkills:63,officialSkillOrCardScores:0},
  rows:status.map((bucket,i)=>({
   appSkillId:'S'+i,sourceNumericId:i<818?''+i:null,
   staticSourceApplicability:{sourceMatch:i<818?'matched':'unmatched'},
   modelPartialWD:{status:bucket},
   unresolvedReasons:['full-original-AND-OR-Invoke-unverified'],
   officialGameProcRate:null,wholeSkillSuitability:null,
   suitabilityLabel:null,cardScore:null,eligibleForP3CardScoring:false
  }))};
}
test('real research cohort is entirely quarantined despite stable model directions',()=>{
 const source=realResearchFixture();
 const report=probe.inspectP34aRealResearch(source);
 assert.equal(report.summary.appSkills,881);
 assert.equal(report.summary.modelPartialWDSourceSkills,81);
 assert.equal(report.summary.modelGroundHeld,6);
 assert.equal(report.summary.noAdditionalShortWindow,794);
 assert.equal(report.summary.originalMatched,818);
 assert.equal(report.summary.sourceUnmatched,63);
 assert.equal(report.summary.generalSkillLabelsApproved,0);
 assert.equal(report.summary.targetedSkillLabelsApproved,0);
 assert.equal(report.rows.length,881);
 assert(report.rows.every(x=>x.officialStyleSuitability===null&&
  x.internalStylePreview===null&&x.eligibleForCardScoring===false));
});
test('research real-source gate rejects scoring leakage or invented approval',()=>{
 const x=realResearchFixture();
 x.rows[0].suitabilityLabel='Nige向け';
 assert.throws(()=>probe.inspectP34aRealResearch(x),
  /may not be treated as whole skill suitability/);
 x.rows[0].suitabilityLabel=null;
 x.provenance.officialPolicyApproved=true;
 assert.throws(()=>probe.inspectP34aRealResearch(x),
  /unexpected or approved source research intake/);
});
