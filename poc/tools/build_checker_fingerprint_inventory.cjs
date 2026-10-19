#!/usr/bin/env node
'use strict';
/* Strictly temporary title fingerprints. Never write third-party titles. */
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../src/live_loader.js');
const checker=require('../src/checker_candidate_pipeline.cjs');
function main(){
 if(process.argv.length!==5)throw Error('Usage: node poc/tools/build_checker_fingerprint_inventory.cjs <support_card.txt> <checker.json> <output.json>');
 const [support,sourceFile,out]=process.argv.slice(2);
 const model=loader.buildModel(fs.readFileSync(support,'utf8'),{mode:'audit'});
 const source=JSON.parse(fs.readFileSync(sourceFile,'utf8').replace(/^\uFEFF/,''));
 const prior=checker.inventory({source,model,aliases:{}});
 const matched=new Set(prior.cards.map(c=>c.cardId));
 const aliases=JSON.parse(fs.readFileSync(path.join(__dirname,'../config/checker-name-aliases.json'),'utf8'));
 const clean={};
 const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
 for(const [id,name] of Object.entries(aliases)){
  if(matched.has(id))continue;
  const card=model.cardById[id];
  if(!card)throw Error('Unknown alias '+id);
  const sourceRows=Object.keys(source.Skills[card.rarity]||{}).filter(s=>norm(s)===norm(name));
  if(sourceRows.length===1)clean[id]=name;
  else if(sourceRows.length>1)throw Error('Ambiguous alias '+id);
 }
 const inv=checker.inventory({source,model,aliases:clean});
 if(inv.stats.matchedCards!==417||inv.stats.eventCount!==2109)
  throw Error('Unexpected pinned fingerprint candidate coverage '+JSON.stringify(inv.stats));
 // inv consists of card keys, title fingerprints, numeric ordinals and source SHA only.
 fs.writeFileSync(out,JSON.stringify(inv)+'\n',{flag:'wx',encoding:'utf8',mode:0o600});
 console.log('Provisional historical-join inventory:',inv.stats.matchedCards,
  'cards;',inv.stats.eventCount,'events; unapproved');
}
try{main();}catch(e){console.error('Fingerprint inventory failed:',e.message);process.exitCode=1;}
