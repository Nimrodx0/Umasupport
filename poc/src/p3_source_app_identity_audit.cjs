'use strict';
/*
 * P3.2: original-source numeric ID, normalized name, and full source
 * condition structure joined independently against CURRENT app catalog.
 *
 * An app skill is not an acquired support-card skill. Even a fully matched
 * identity must not lift P2.18/P3.1 W-only research into P3 scoring.
 * No source skill descriptions, source conditions, cards or events are
 * redistributed; only source identity metadata and hashes are reported.
 */
const crypto=require('node:crypto');
const bridge=require('./skill_bridge.js');
const profiles=require('./skill_condition_profiles.js');
const intake=require('./p3_research_evidence_intake.cjs');
const fixed=require('../tools/globalsim_roster32.cjs');
const ORIGINAL_REVISION='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const STATUS='P3.2-research-only-verified-original-app-skill-identity-not-acquisition';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const normalize=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const fail=(ok,detail)=>{if(!ok)throw Error('P3.2 identity audit: '+detail)};
const SOURCE_MATCH='exact-id-name-and-source-structure';
const ALL_STATUSES=[
 SOURCE_MATCH,'duplicate-app-source-id','same-id-name-mismatch',
 'same-id-condition-mismatch','same-name-other-or-unverified-id',
 'not-in-app-catalog'
];
function numericId(skill){
 if(!skill||typeof skill.id!=='string')return null;
 const fromSource=skill.activationProfile?.sourceNumericId;
 const fromRecord=skill.sourceNumericId;
 const fromId=(/^skill:(\d+)$/.exec(skill.id)||[])[1];
 for(const x of [fromSource,fromRecord,fromId])
  if(x!==undefined&&x!==null&&!/^\d+$/.test(String(x)))
   throw Error('P3.2 identity audit: malformed numeric skill identity');
 // A tagged record whose attached numeric source ID conflicts with the
 // numeric app skill ID may not be accepted as an exact match.
 if(fromSource&&fromRecord&&String(fromSource)!==String(fromRecord)||
  fromSource&&fromId&&String(fromSource)!==String(fromId)||
  fromRecord&&fromId&&String(fromRecord)!==String(fromId))
  throw Error('P3.2 identity audit: conflicting numeric identity in app skill');
 return fromSource?String(fromSource):
  fromRecord?String(fromRecord):fromId||null;
}
function indexApp(app){
 fail(app&&Array.isArray(app.skills)&&app.skillById&&
  typeof app.skillById==='object','app skill model missing');
 const byId=new Map(),byName=new Map(),keys=new Set();
 for(const skill of app.skills){
  fail(skill&&typeof skill.id==='string'&&
   typeof skill.name==='string'&&normalize(skill.name)&&
   !keys.has(skill.id)&&app.skillById[skill.id]===skill,
   'duplicate/invalid app skill key or lookup map');
  keys.add(skill.id);
  const num=numericId(skill);
  if(num){
   if(!byId.has(num))byId.set(num,[]);
   byId.get(num).push(skill);
  }
  const name=normalize(skill.name);
  if(!byName.has(name))byName.set(name,[]);
  byName.get(name).push(skill);
 }
 return {byId,byName,size:keys.size};
}
function originalIndex(records){
 fail(Array.isArray(records),'missing original registry entries');
 const byId=new Map();
 for(const x of records){
  fail(x&&typeof x.id==='string'&&/^\d+$/.test(x.id)&&
   typeof x.name==='string'&&normalize(x.name)&&
   Array.isArray(x.invokes)&&!byId.has(x.id),
   'invalid/duplicate original numeric registry record');
  byId.set(x.id,x);
 }
 return byId;
}
function reconcile(studiedConditions,sourceRecords,app){
 fail(Array.isArray(studiedConditions)&&studiedConditions.length===10,
  'P3.1 source cohort must contain exactly ten conditions');
 const original=originalIndex(sourceRecords),model=indexApp(app);
 const seen=new Set(),rows=[];
 for(const studied of studiedConditions){
  const id=studied?.originalSourceCondition?.originalSourceNumericId;
  fail(typeof id==='string'&&/^\d+$/.test(id)&&!seen.has(id),
   'duplicate or invalid studied numeric source ID');
  seen.add(id);
  const record=original.get(id);
  fail(record,'original source ID absent in pinned registry: '+id);
  const expected=profiles.project(record,'current');
  fail(expected.status==='source-structure'&&expected.sourceNumericId===id,
   'original source record cannot form a complete structure');
  const expectedName=normalize(record.name);
  const candidates=model.byId.get(id)||[];
  const names=model.byName.get(expectedName)||[];
  let status,appSkillId=null,appSkillName=null,matchedSource=null;
  if(candidates.length>1){
   status='duplicate-app-source-id';
  }else if(candidates.length===1){
   const skill=candidates[0];
   if(normalize(skill.name)!==expectedName){
    status='same-id-name-mismatch';
   }else if(
     // ID must be structurally coherent, not just attached by free text.
     skill.id!=='skill:'+id&&
     skill.id!=='hint:'+skill.name||
     skill.activationProfile?.status!=='source-structure'||
     skill.activationProfile?.sourceNumericId!==id||
     JSON.stringify(skill.activationProfile.invokes)!==
      JSON.stringify(expected.invokes)||
     JSON.stringify(skill.activationProfile.angleTags)!==
      JSON.stringify(expected.angleTags)){
    status='same-id-condition-mismatch';
   }else{
    status=SOURCE_MATCH;
    appSkillId=skill.id;
    appSkillName=skill.name;
    matchedSource=skill.activationProfile.source||null;
   }
  }else if(names.length){
   status='same-name-other-or-unverified-id';
  }else status='not-in-app-catalog';
  const reference=studied.originalSourceCondition;
  fail(reference.distanceScope==='all'&&
   ['turf','dirt'].includes(reference.groundType)&&
   typeof reference.timing==='string'&&
   typeof reference.bandId==='string',
   'research condition identity changed or unsupported');
  const originalPredicateHash=sha(JSON.stringify(expected.invokes));
  rows.push({
   originalSourceNumericId:id,
   originalSourceName:expectedName,
   originalActivationInvokesSha256:originalPredicateHash,
   sourceConditionSignature:{
    groundType:reference.groundType,
    distanceScope:reference.distanceScope,
    timing:reference.timing,bandId:reference.bandId
   },
   result:status,
   appSkillId,appSkillName,matchedSource,
   sameNameAppIds:names.map(x=>x.id).sort(),
   sourceIdAppIds:candidates.map(x=>x.id).sort(),
   verifiedSupportCardAcquisition:'not-evaluated',
   verifiedOriginalFullSkillProc:'not-measured',
   W:'source-partial-condition-research-only',
   D:'not-measured-in-this-study',
   eligibleForP3CardScoring:false,
   cardScore:null,suitabilityLabel:null
  });
 }
 fail(rows.length===10&&new Set(rows.map(x=>
  x.originalSourceNumericId)).size===10,'incomplete original source cohort');
 const summary={originalSourceConditions:10,
  appSkillRosterSize:model.size,
  ...Object.fromEntries(ALL_STATUSES.map(x=>[x,rows.filter(y=>y.result===x).length])),
  confirmedSupportCardAcquisitionRoutes:0,
  confirmedWholeSkillActivationRates:0,
  productEligibleSkillRatings:0};
 return {rows,summary};
}
function audit({manifest,p2Envelope,p3Receipt,originalSkillText,appModel}){
 fail(typeof originalSkillText==='string'&&
  sha(originalSkillText)===fixed.SOURCE_SHA,
  'pinned original UmaSim skill registry SHA mismatch');
 fail(intake.validateReceipt(p3Receipt,manifest,p2Envelope)===true,
  'P3.1 original receipt provenance or source study mismatch');
 const parsed=bridge.parseSource(originalSkillText);
 const records=JSON.parse(originalSkillText.replace(/^\uFEFF/,''));
 fail(parsed.count===records.length,
  'original registry shape or source string changed');
 const checked=reconcile(p3Receipt.sourceConditionEvidence,records,appModel);
 fail(checked.summary.originalSourceConditions===10&&
  checked.rows.every(x=>x.eligibleForP3CardScoring===false&&
   x.verifiedSupportCardAcquisition==='not-evaluated'&&
   x.cardScore===null&&x.suitabilityLabel===null),
  'source catalog match improperly promoted to skill/card suitability');
 const result={
  schemaVersion:1,status:STATUS,
  provenance:{
   originalUmaSimRevision:ORIGINAL_REVISION,
   originalSkillRegistrySha256:fixed.SOURCE_SHA,
   sourceP31ReceiptSha256:sha(JSON.stringify(p3Receipt)),
   originalP31ReceiptStatus:p3Receipt.status,
   publishedAppRoster:'reviewed-original-support-cards-and-events',
   appSourceProfileCoverage:structuredClone(
    appModel.meta?.skillConditionProfiles||null)
  },
  summary:checked.summary,
  rows:checked.rows,
  boundaries:[
   'Original numeric source ID AND normalized original skill name AND complete original activation Invoke/OR/precondition/effect structure are required for exact app identity.',
   'An app hint: name without a unique verified numeric source identity is not a source skill match.',
   'Exact identity does not establish a skill hint/event route on any support card, nor actual game acquisition.',
   'Original W rank/time partial condition is not whole skill activation, D specificity or card suitability.',
   'Absence from this app model is not absence from original UmaSim or real game.',
   'No public app cards, reviewed event rewards, inherited labels or suitability scores are changed.'
  ]
 };
 return result;
}
module.exports={STATUS,SOURCE_MATCH,ALL_STATUSES,normalize,
 numericId,indexApp,originalIndex,reconcile,audit};
