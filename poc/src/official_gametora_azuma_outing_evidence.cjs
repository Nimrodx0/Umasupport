'use strict';
/*
 * One-card editorial outing title/intake audit.
 * A name hash connects a GameTora-rendered event to a GameWith heading,
 * NOT to its gameplay progression. Full site prose never leaves memory.
 */
const crypto=require('node:crypto');
const fail=s=>{throw Error('吾妻お出かけイベント出典照合: '+s);};
const normalize=s=>String(s??'').normalize('NFKC').replace(/\s+/gu,'').replace(/[ーｰ‐‑‒–—―−]/gu,'-');
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const isSha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
function textContainsFingerprint(rendered,reference){
 if(typeof rendered!=='string'||rendered.length>2000||
    !Number.isSafeInteger(reference?.length)||reference.length<=0||reference.length>100||
    !isSha(reference.sha256))
  fail('見出しの照合入力が不正');
 const chars=Array.from(normalize(rendered));
 let hit=false;
 for(let k=0;k+reference.length<=chars.length;k++){
  if(sha(chars.slice(k,k+reference.length).join(''))===reference.sha256){hit=true;break;}
 }
 return hit;
}
function validateLedger(ledger){
 if(ledger?.schemaVersion!==1||ledger.cardId!=='30323'||
    ledger.canonicalGender!=='male'||
    ledger.site!=='https://gametora.com/ja/umamusume/supports/30323-azuma'||
    ledger.exceptionReference!=='https://gamewith.jp/uma-musume/article/show/584254'||
    ledger.includeEventNamesOrChoiceProse!==false||
    ledger.automaticPublicationAllowed!==false||
    ledger.realGameSequenceIndependentlyVerified!==false||
    ledger.editorialOrderIsConfirmedPlayableStageDependency!==false||
    !Array.isArray(ledger.titles)||ledger.titles.length!==6||
    ledger.titles.some((t,i)=>t?.editorialOrder!==i+1||
     t.kind!==(i===0?'outing-unlock-event':'outing-stage-candidate')||
     !isSha(t.sha256)||!Number.isSafeInteger(t.length)||t.length<=0||t.length>100||
     !Number.isSafeInteger(t.editorialChoiceCount)||t.editorialChoiceCount<1||t.editorialChoiceCount>4)||
    new Set(ledger.titles.map(t=>t.sha256)).size!==6||
    JSON.stringify(ledger.gameWithExplicitOutingUnlockChoiceOrdinals)!=='[1,2]'||
    ledger.titles[0].editorialChoiceCount!==2)
  fail('固定参照台帳の構造に不正');
 return ledger;
}
function evaluateOutingEvidence(ledger,rendered){
 validateLedger(ledger);
 if(!Array.isArray(rendered)||rendered.length>20||
  rendered.some(o=>!o||typeof o.title!=='string'||o.title.length>2000||
   !Number.isSafeInteger(o.choiceGroups)||o.choiceGroups<0||o.choiceGroups>30||
   !Number.isSafeInteger(o.siteExplicitUnlockChoiceGroups)||o.siteExplicitUnlockChoiceGroups<0||
   o.siteExplicitUnlockChoiceGroups>o.choiceGroups||
   !Number.isSafeInteger(o.siteExplicitTerminalChoiceGroups)||o.siteExplicitTerminalChoiceGroups<0||
   o.siteExplicitTerminalChoiceGroups>o.choiceGroups))
  fail('元サイトのイベント構造に不正');
 const matches=ledger.titles.map(x=>{
  const locations=rendered.flatMap((o,i)=>textContainsFingerprint(o.title,x)?[i+1]:[]);
  const unique=locations.length===1;
  const location=unique?locations[0]:null;
  const observed=unique?rendered[location-1]:null;
  return {
   editorialOutingOrdinal:x.editorialOrder,
   matchedSiteEventOrdinal:location,
   siteTitleMatchCount:locations.length,
   uniqueSiteTitleMatch:unique,
   observedChoiceGroups:observed?.choiceGroups??null,
   editorChoiceCountCorroborated:unique&&observed.choiceGroups===x.editorialChoiceCount,
   explicitSiteUnlockGroups:observed?.siteExplicitUnlockChoiceGroups??null,
   explicitSiteTerminalGroups:observed?.siteExplicitTerminalChoiceGroups??null
  };
 });
 const intro=matches[0];
 const unlockAdoptable=intro.uniqueSiteTitleMatch&&intro.editorChoiceCountCorroborated;
 const allSixLocated=matches.every(x=>x.uniqueSiteTitleMatch);
 const distinctLocations=new Set(matches.map(x=>x.matchedSiteEventOrdinal).filter(Number.isInteger));
 const sitesDistinct=distinctLocations.size===matches.filter(x=>x.uniqueSiteTitleMatch).length;
 return {
  cardId:'30323',
  editorialSource:'GameWith',
  fixedDisplayGender:'male',
  editorialOutingEntries:ledger.titles.length,
  siteMatchingEventHeadings:matches.filter(x=>x.uniqueSiteTitleMatch).length,
  siteMatchingHeadingsUniqueAndDistinct:allSixLocated&&sitesDistinct,
  editorialChoiceCountCorroborated:matches.filter(x=>x.editorChoiceCountCorroborated).length,
  outgoingEventCandidateCount:matches.length-1,
  firstEventBothChoicesExplicitlyEnableOutingsInGameWith:true,
  editorialUnlockFactAdoptableForPrivateCandidate:unlockAdoptable,
  officialSiteExplicitUnlockOnFirstEvent:intro.explicitSiteUnlockGroups,
  headingMatches:matches,
  // Even editorial order does not prove game turn-by-turn reachability,
  // outing 5 completion, or a random early termination rule.
  playSequenceAndOutingReachabilityVerified:false,
  outingEndStateVerified:false,
  siteEffectTypeIndependentlyCorroborated:false,
  genderOtherThanMaleAllowed:false,
  publicationApproved:false,
  noSourceProseIncluded:true
 };
}
module.exports={normalize,sha,textContainsFingerprint,validateLedger,evaluateOutingEvidence};
