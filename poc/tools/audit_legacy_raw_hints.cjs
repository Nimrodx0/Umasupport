'use strict';
// Read-only comparison against a 2025 Japanese editorial card-and-hint listing.
// Explicitly distinguish a missing editorial field from a zero-hint card.
const fs=require('node:fs'),crypto=require('node:crypto');
const {parseSupportCards}=require('../src/live_loader.js');
const {audit:compareNew}=require('./audit_deckbuilder_cards.cjs');
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const hint=s=>norm(norm(s).replace(/<[^<>]+>/g,''));

function parseLegacy(raw){
 if(typeof raw!=='string')throw Error('legacy text required');
 const markers=[...raw.matchAll(/(?:^|\n)[^\n\t]*_icon\.(?:jpg|png|jpeg)\t/g)];
 const rows=[],errors=[];
 for(let i=0;i<markers.length;i++){
  const m=markers[i],start=m.index+(m[0][0]==='\n'?1:0);
  const next=markers[i+1]?.index??raw.length;
  const f=raw.slice(start,next).split('\t');
  if(![7,8].includes(f.length)){errors.push({name:norm(f[1]??''),columns:f.length});continue;}
  const skills=new Set(String(f[4]||'').split(/\r?\n/).map(hint)
    .filter(s=>s&&s!=='なし'&&s!=='―'));
  const name=norm(f[1]||'');
  if(!name||!['R','SR','SSR'].includes(f[2]))throw Error('Unexpected legacy card identity');
  rows.push({name,rarity:f[2],type:f[3],skillNames:skills});
 }
 return {totalMarkers:markers.length,rows,parsingExceptions:errors};
}
function auditLegacy(support,raw,release){
 const sim=parseSupportCards(support),legacy=parseLegacy(raw),byName=new Map();
 for(const [id,card] of sim.cards){const name=norm(card.name);if(byName.has(name))throw Error('Duplicate source card name');byName.set(name,{id,...card})}
 const seen=new Set(),byCard=new Map(),unmatched=[],unpublished=[],mismatches=[];
 let exact=0,totalLinks=0,confirmedLinks=0;
 for(const item of legacy.rows){
  if(seen.has(item.name))throw Error('Duplicate historical source card');
  seen.add(item.name);
  const card=byName.get(item.name);
  if(!card){unmatched.push({name:item.name,rarity:item.rarity});continue;}
  if(card.rarity!==item.rarity)throw Error('Historical rarity conflict');
  if(!item.skillNames.size){unpublished.push(card.id);continue;}
  const stage=new Set(card.stages['4'].map(norm));
  const oldOnly=[...item.skillNames].filter(s=>!stage.has(s));
  const simOnly=[...stage].filter(s=>!item.skillNames.has(s));
  const line={id:Number(card.id),hintNames:item.skillNames};
  byCard.set(Number(card.id),line);
  totalLinks+=item.skillNames.size;
  confirmedLinks+=item.skillNames.size-oldOnly.length;
  if(!oldOnly.length&&!simOnly.length)exact++;
  else mismatches.push({id:Number(card.id),legacyOnly:oldOnly,umaSimOnly:simOnly});
 }
 const newer=compareNew(support,release),triage=[];
 for(const diff of newer.missingNamesByCard){
  const ref=byCard.get(diff.id);
  triage.push({id:diff.id,
   missingNamesIn2026CombinedCatalog:diff.missingNames,
   historicalEvidence:ref?diff.missingNames.map(s=>({skill:s,
    listedAsNormalHintIn2025:ref.hintNames.has(s)})):null});
 }
 return {legacyRecords:legacy.totalMarkers,validLegacyRows:legacy.rows.length,
  sourceFormatExceptions:legacy.parsingExceptions.length,exceptions:legacy.parsingExceptions,
  historicalExactNameMatches:byCard.size+unpublished.length,
  noDocumentedNormalHints:unpublished.length,unmatchedLegacyNames:unmatched,
  historicalCardsWithNormalHints:byCard.size,allNormalHintsSameCards:exact,
  mismatchedCardCount:mismatches.length,
  historicalHintLinks:totalLinks,identicalNameLinks:confirmedLinks,
  historicalDiffs:mismatches,triage,
  interpretation:'2025 old editorial listing: missing fields and old names cannot refute 2026 game data'};
}
function main(){
 const [a,b,c]=process.argv.slice(2).map(p=>fs.readFileSync(p));
 const summary=auditLegacy(a.toString('utf8'),b.toString('utf8'),JSON.parse(c.toString('utf8')));
 console.log(JSON.stringify({hashes:{
   umaSim:crypto.createHash('sha256').update(a).digest('hex'),
   legacy:crypto.createHash('sha256').update(b).digest('hex'),
   release:crypto.createHash('sha256').update(c).digest('hex')
 },summary},null,2));
}
if(require.main===module)main();
module.exports={parseLegacy,auditLegacy};
