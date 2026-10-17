'use strict';
/* 2026-10 published external card catalogue.
 * Skills is a combined hint + event list: never infer "normal hint only".
 * Compare against UmaSim normal hints only as a presence/superset cross-check.
 * Third-party source bytes do not enter the application or repository.
 */
const fs=require('node:fs'),crypto=require('node:crypto');
const {parseSupportCards}=require('../src/live_loader.js');
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
function displayName(row){
 let title=norm(row.Title),name=norm(row.CharacterName);
 if(title.startsWith('[')&&title.endsWith(']'))title=title.slice(1,-1);
 return '['+title+']'+name;
}
function audit(support,external){
 const source=parseSupportCards(support);
 if(!Array.isArray(external)||external.length<100)throw Error('External card list missing or too short');
 const byName=new Map(),byChar=new Map();
 for(const [id,card] of source.cards){
  const key=norm(card.name);
  if(byName.has(key))throw Error('Ambiguous source card name');
  byName.set(key,{id,...card});
  const chr=key.slice(key.lastIndexOf(']')+1);
  const bucket=byChar.get(chr)||[];bucket.push({id,...card});byChar.set(chr,bucket);
 }
 const used=new Set(),unmatched=[],mismatched=[],suspicious=[],byRarity={},matched=[],seenKeys=new Set();
 for(const x of external){
  if(!x||!['R','SR','SSR'].includes(x.Rarity)||typeof x.Title!=='string'||
   typeof x.CharacterName!=='string'||!Array.isArray(x.Skills)||
   x.Skills.some(z=>typeof z!=='string'))throw Error('Malformed external card entry');
  const name=displayName(x),key=norm(name);
  if(seenKeys.has(key))throw Error('Repeated external card name '+key);
  seenKeys.add(key);
  const record=byName.get(key);
  if(!record){
   const candidates=(byChar.get(norm(x.CharacterName))||[])
    .filter(c=>c.rarity===x.Rarity).map(c=>c.id);
   unmatched.push({name,rarity:x.Rarity,candidateIds:candidates});
   continue;
  }
  if(used.has(record.id))throw Error('Duplicate source card mapped');
  used.add(record.id);
  if(record.rarity!==x.Rarity)throw Error('Rarity mismatch for '+record.id);
  const hints=new Set(record.stages['4'].map(norm));
  const independent=new Set(x.Skills.map(norm).filter(Boolean));
  const missing=[...hints].filter(z=>!independent.has(z));
  const externalOnly=[...independent].filter(z=>!hints.has(z));
  const entry={id:Number(record.id),rarity:record.rarity,
   hintCount:hints.size,combinedSourceSkills:independent.size,
   missingHintNames:missing,extraCombinedSkillCount:externalOnly.length,
   missingCount:missing.length};
  if(missing.length)mismatched.push(entry);
  if(hints.size===0&&independent.size!==0)suspicious.push({id:entry.id,externalOnly:externalOnly.length});
  matched.push(entry);
  byRarity[record.rarity]=(byRarity[record.rarity]||0)+1;
 }
 const totalHintLinks=matched.reduce((a,b)=>a+b.hintCount,0);
 const noHintMatch=matched.reduce((a,b)=>a+b.missingCount,0);
 return {umesimCards:source.cards.size,externalCards:external.length,
  matchedCards:matched.length,matchedByRarity:byRarity,
  externalUnmatchedCount:unmatched.length,externalUnmatched:unmatched.slice(0,35),
  umaSimOutsideExternal:source.cards.size-matched.length,
  checkedNormalHintLinks:totalHintLinks,matchedNormalHintLinks:totalHintLinks-noHintMatch,
  missingNormalHintLinks:noHintMatch,allNormalHintsIncludedCards:matched.length-mismatched.length,
  cardsWithMissingNormalHints:mismatched.length,
  combinedSkillExtraLinks:matched.reduce((a,b)=>a+b.extraCombinedSkillCount,0),
  missingNamesByCard:mismatched.map(x=>({id:x.id,missingNames:x.missingHintNames})),
  noNormalHintButCombinedSkills:suspicious,
  caveat:'External Skills includes normal hints and event skills. Exact set equality NOT meaningful.'};
}
function main(){
 const a=fs.readFileSync(process.argv[2]),b=fs.readFileSync(process.argv[3]);
 const report=audit(a.toString('utf8'),JSON.parse(b.toString('utf8')));
 console.log(JSON.stringify({sources:{
  umasimRevision:'cf9366f6a487bd8f197b53d8a11981207beb9f6c',
  release:'dareuma/umamusume-deck-build-tool/releases/download/updata/cards.json',
  umaSimSha256:crypto.createHash('sha256').update(a).digest('hex'),
  releaseSha256:crypto.createHash('sha256').update(b).digest('hex')
 },report},null,2));
}
if(require.main===module)main();
module.exports={audit,displayName};
