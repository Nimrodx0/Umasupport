'use strict';
/*
 * P2 G1: explain the fixed application's source-identity gaps per skill.
 * Source availability, a verified activation structure, eligibility and
 * activation probability are DIFFERENT facts. This read-only ledger is not
 * a suitability calculation and is never loaded by the public UI.
 */
const profiles=require('./skill_condition_profiles.js');
const STATUS='P2-G1-app-source-identity-and-gap-reasons-only';
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const fail=(ok,message)=>{if(!ok)throw Error('P2 G1 source ledger: '+message)};
function validateIndex(index,label){
 fail(index&&index.byId instanceof Map&&index.byName instanceof Map,
  label+' original parsed skill dictionary required');
}
function reasonFor(skill,current,pinned){
 const id=String(skill.sourceNumericId||(/^skill:(\d+)$/.exec(skill.id)||[])[1]||'');
 if(id){
  fail(/^\d+$/.test(id),'invalid source numeric ID');
  const live=current.byId.get(id),old=pinned.byId.get(id);
  if(live||old){
   fail(live?.name!==norm(skill.name)&&old?.name!==norm(skill.name),
    'ID/name already resolves to source');
   return {reason:'numeric-id-present-but-name-conflicts',
    sourceNumericId:id,liveIdPresent:!!live,pinnedIdPresent:!!old};
  }
  return {reason:'numeric-id-absent-from-both-dictionaries',
   sourceNumericId:id,liveIdPresent:false,pinnedIdPresent:false};
 }
 if(skill.id.startsWith('hint:')){
  const matches=current.byName.get(norm(skill.name))||[];
  fail(matches.length!==1,'unique current hint name should have matched');
  return {reason:matches.length>1?'hint-name-ambiguous-in-current':
   'hint-name-absent-from-current',
   sourceNumericId:null,liveNameMatchCount:matches.length};
 }
 return {reason:'no-supported-numeric-or-hint-source-key',
  sourceNumericId:null};
}
function audit(model,current,pinned){
 validateIndex(current,'current');validateIndex(pinned,'pinned');
 fail(model&&Array.isArray(model.skills)&&model.skillById&&
  typeof model.skillById==='object','app model required');
 const before=JSON.stringify(model),seen=new Set(),rows=[],byReason={};
 let sourceMatched=0,noActivationRecord=0,unavailable=0;
 for(const skill of model.skills){
  fail(skill&&typeof skill.id==='string'&&
   model.skillById[skill.id]===skill&&!seen.has(skill.id),
   'duplicate or unmatched app skill object');
  seen.add(skill.id);
  const profile=skill.activationProfile;
  fail(profile&&typeof profile.status==='string','P1 profile must be attached');
  const picked=profiles.sourceFor(skill,
   {index:current,byId:current.byId},{index:pinned,byId:pinned.byId});
  let disposition,extra={};
  if(profile.status==='source-structure'||profile.status==='no-activation-record'){
   fail(!!picked&&profile.source===picked.source&&
    profile.sourceNumericId===picked.record.id,
    'P1/source ID or provenance drift for '+skill.id);
   disposition=profile.status==='source-structure'?'matched-current-or-pinned':
    'matched-without-activation-record';
   if(profile.status==='source-structure')sourceMatched++;
   else noActivationRecord++;
   extra={sourceNumericId:profile.sourceNumericId,matchedSource:profile.source};
  }else{
   fail(profile.status==='unavailable'&&!picked&&
    profile.reason==='skill-dictionary-id-name-unmatched',
    'P1 unavailable classification contradicts source match');
   unavailable++;
   extra=reasonFor(skill,current,pinned);
   disposition=extra.reason;
  }
  byReason[disposition]=(byReason[disposition]||0)+1;
  rows.push({appSkillId:skill.id,disposition,...extra,
   sourceStructureAvailable:profile.status==='source-structure',
   originalFullSkillANDProven:false,
   eligibleForP3CardScoring:false,cardScore:null});
 }
 fail(JSON.stringify(model)===before,'model or public catalog modified');
 fail(rows.length===seen.size&&
  sourceMatched+noActivationRecord+unavailable===rows.length,
  'denominator partition incomplete');
 return {schemaVersion:1,status:STATUS,
  denominators:{appSkills:rows.length,sourceStructureMatched:sourceMatched,
   matchedWithoutActivationRecord:noActivationRecord,
   sourceUnavailable:unavailable},
  byReason,rows,
  boundary:{sourceIdentityIsNotAcquisition:true,
   sourceIdentityIsNotSkillActivation:true,
   eligibleForP3CardScoring:false,publicSuitabilityScores:0},
  limitations:[
   'Reason codes describe current and pinned UmaSim registry identity only; an absent entry is not proof of absence from the game.',
   'A numeric ID present with a different name is held, not silently reconciled.',
   'Unmatched hint names are not mapped by guessing a numeric ID or collapsing multiple same-name records.',
   'This fixed-source classification is not proof of skill acquisition, entire AND/OR activation, a four-style W/D value or a card score.'
  ]};
}
module.exports={STATUS,reasonFor,audit};
