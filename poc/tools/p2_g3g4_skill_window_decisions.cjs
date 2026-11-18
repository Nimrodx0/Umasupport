#!/usr/bin/env node
'use strict';
/*
 * G3/G4: join existing P2.26 per-skill source review to P2.28's source-ID
 * verified 75 short-window rank observations. NO new race/suitability model.
 * Use results only as conditional partial-rank evidence, never skill proc or
 * card scoring. Keep model-only W and D separate, and hold unsupported turf.
 */
const fs=require('node:fs');
const STATUS='P2-G3G4-per-skill-short-window-evidence-decision-not-suitability';
const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const fail=(ok,msg)=>{if(!ok)throw Error('P2 G3/G4 short-window join: '+msg)};
const validDirection=x=>x&&[
 'strict-same-direction-in-all-contexts-and-seed-halves',
 'held-tie-or-context-reversal','unresolved-data'
].includes(x.status);
const projectedDirection=x=>{
 fail(validDirection(x),'unknown source W/D direction');
 if(x.status==='strict-same-direction-in-all-contexts-and-seed-halves'){
  fail(['+','-'].includes(x.direction),'invalid strict direction');
  return {status:'model-only-same-direction',direction:x.direction};
 }
 fail(x.direction===null,'held direction must be null');
 return {status:'held-context-or-seed-inconsistent',direction:null};
};
function join(coarse,short){
 fail(coarse?.status==='P2-rough-skill-by-skill-evidence-review-not-production-rating'&&
  coarse?.schemaVersion===1&&Array.isArray(coarse.rows)&&
  coarse.rows.length===coarse.appSkillCount,
  'P2.26 skill cohort is not validated');
 fail(short?.status==='P2.28-balanced-two-axis-source-short-window-model-not-game-proc'&&
  short?.schemaVersion===1&&Array.isArray(short.items)&&
  short.summary?.directCandidates===short.items.length,
  'P2.28 short-window evidence is not validated');
 fail(short.source?.originalModelRaces===720&&
  short.source?.sourceUmaSimSHA256===
   '4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5',
  'source evidence version or scope drift');
 const byId=new Map(coarse.rows.map(x=>[x.skillId,x]));
 fail(byId.size===coarse.rows.length,'duplicate P2.26 skill IDs');
 const bySource=new Map(),bySkill=new Map();
 for(const x of short.items){
  fail(typeof x.skillId==='string'&&typeof x.sourceNumericId==='string'&&
   !bySource.has(x.sourceNumericId)&&!bySkill.has(x.skillId),
   'duplicate or invalid P2.28 identity');
  const old=byId.get(x.skillId);
  fail(old&&old.sourceNumericId===x.sourceNumericId&&
   old.skillName===x.skillName&&old.sourceStatus==='source-structure',
   'unmatched source ID/name or incomplete source identity');
  bySource.set(x.sourceNumericId,x);bySkill.set(x.skillId,x);
 }
 let matched=0,held=0,eligibleOne=0,eligibleFour=0,stableW=0,heldW=0;
 const rows=coarse.rows.map(x=>{
  const base={skillId:x.skillId,skillName:x.skillName,
   sourceNumericId:x.sourceNumericId,
   existingFourStyleEvidence:Object.fromEntries(Object.entries(x.styles)
    .map(([name,v])=>[name,v.status])),
   wholeSkillSuitability:'not-established',
   eligibleForP3CardScoring:false,cardScore:null};
  const current=bySkill.get(x.skillId);
  if(!current)return {...base,decision:'no-new-short-window-evidence',
   nextAction:'retain-existing-P2-evidence-and-prioritize-impactful-G3-G4-gaps'};
  if(current.status==='held-source-race-qualifier'){
   held++;
   fail(Array.isArray(current.heldReasons)&&current.heldReasons.length>0,
    'missing surface hold justification');
   return {...base,decision:'hold-turf-model-transfer',
    scope:{sourceWindow:current.windowKey,rankBand:current.bandId},
    heldReasons:[...current.heldReasons],
    nextAction:'do-not-use-turf-W-or-D-for-unsupported-ground'};
  }
  fail(current.status==='model-two-axis-partial-original-condition-only'&&
   Array.isArray(current.pairs)&&current.pairs.length===6&&
   Array.isArray(current.eligibleStyles)&&current.styles,
   'incomplete source-matched rank/phase review');
  matched++;
  if(current.eligibleStyles.length===1)eligibleOne++;
  else if(current.eligibleStyles.length===4)eligibleFour++;
  else fail(false,'unexpected original style cohort');
  const byStyle={};
  for(const style of STYLES){
   const x=current.styles[style];
   fail(x&&['model-contexts-only','explicit-style-ineligible']
    .includes(x.status),'style evidence missing');
   if(x.status==='explicit-style-ineligible'){
    byStyle[style]={status:'original-style-excluded-no-model-W'};
   }else{
    fail(x.contexts>0&&x.deviationDirection,
     'modeled style missing W/D contexts');
    byStyle[style]={
     status:'conditional-model-only-rank-window-evidence',
     modelContextCount:x.contexts,
     WPercentByFieldSize:Object.fromEntries([9,12].map(n=>
      [n,x.byFieldSize[n].WPercent])),
     DDeviationDirection:projectedDirection(x.deviationDirection)
    };
   }
  }
  const pairs=current.pairs.map(p=>{
   fail(STYLES.includes(p.first)&&STYLES.includes(p.second),
    'unknown original style pair');
   if(p.status==='held-explicit-ineligible-pair'){
    fail(p.WDirection===undefined&&p.DDirection===undefined,
     'excluded style used as probability zero');
    return {first:p.first,second:p.second,
     status:'not-comparable-explicit-style-eligibility'};
   }
   fail(p.status==='model-rank-component-pair-comparison-only',
    'unsupported original comparison status');
   const W=projectedDirection(p.WDirection),
    D=projectedDirection(p.DDirection);
   if(W.status==='model-only-same-direction')stableW++;
   else heldW++;
   return {first:p.first,second:p.second,
    status:'partial-original-rank-window-model-comparison',
    WDirection:W,DDirection:D};
  });
  return {...base,
   decision:'conditionally-use-short-window-rank-evidence',
   scope:{sourceWindow:current.windowKey,rankBand:current.bandId,
    sourceRaceGates:current.sourceRaceGates,
    modelCourseIds:current.modelCourses,
    scenario:'balanced-only-fixed-turf'},
   styles:byStyle,pairs,
   nextAction:'retain-W-and-D-separately; no-further-short-window-model-replay-unless-judgment-changing-counterexample'};
 });
 fail(matched===short.summary.modeled&&held===short.summary.heldRaceQualifiers&&
  eligibleOne+eligibleFour===matched&&
  stableW===short.summary.stableW&&heldW===short.summary.heldW&&
  stableW+heldW===short.summary.modeledPairs,
  'source cohort coverage or W comparisons changed');
 return {schemaVersion:1,status:STATUS,
  source:{originalModelRaces:720,sourceUmaSimSHA256:short.source.sourceUmaSimSHA256,
   p228Status:short.status,p226Status:coarse.status},
  summary:{appSkills:rows.length,sourceMatched:coarse.sourceMatchedSkills,
   shortWindowSourceCandidates:short.items.length,
   conditionalModelEvidenceSkills:matched,
   heldGroundQualifierSkills:held,
   otherSkillsWithoutNewShortWindowEvidence:rows.length-matched-held,
   oneOriginalAllowedStyleSkills:eligibleOne,
   fourOriginalAllowedStylesSkills:eligibleFour,
   modelComparableWPairs:stableW+heldW,
   stableModelWPairs:stableW,heldModelWPairs:heldW,
   productSkillSuitabilityScores:0},
  rows,
  limitations:[
   'Adoption here means conditional use of existing model rank-window W/D as partial evidence, NOT a product skill rating.',
   'Comparisons use balanced fixed turf course/seed/field contexts, not all rosters or real games.',
   'One allowed source style is an explicit gate; no cross-style numerical ranking can be inferred.',
   'W is window opportunity; D is point occupancy minus uniform rank U, never W minus U.',
   'Unverified or excluded ground and absent short-window cohort are not evidence of zero suitability.',
   'Other AND, preConditions, Invoke and full source skill activation cannot be considered verified by these observations.',
   'Do not treat gold/white shared profiles or individual model comparisons as independent game trials.'
  ]};
}
if(require.main===module){
 try{
  fail(process.argv.length===5,
   'usage: p2_g3g4_skill_window_decisions.cjs coarse.json short75.json output.json');
  const [coarse,short,out]=process.argv.slice(2);
  const x=join(JSON.parse(fs.readFileSync(coarse,'utf8')),
   JSON.parse(fs.readFileSync(short,'utf8')));
  fs.writeFileSync(out,JSON.stringify(x,null,2)+'\n');
  console.log('P2_G3G4_EXISTING_EVIDENCE_DECISIONS='+JSON.stringify(x.summary));
 }catch(e){console.error(e.stack||e);process.exitCode=1}
}
module.exports={STATUS,STYLES,projectedDirection,join};
