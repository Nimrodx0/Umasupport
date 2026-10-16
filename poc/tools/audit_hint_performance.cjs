'use strict';
// Publisher-input-only audit; prints aggregates, never the proprietary/raw card data.
const fs=require('node:fs');
const crypto=require('node:crypto');
const loader=require('../src/live_loader.js');
const raw=fs.readFileSync(0,'utf8');
const sha256=crypto.createHash('sha256').update(raw).digest('hex');
const parsed=loader.parseSupportCards(raw);
const metrics=['levelBase','levelUnique','frequencyBase','frequencyUnique'];
const ranges=Object.fromEntries(metrics.map(k=>[k,{min:Infinity,max:-Infinity,nonzero:0}]));
const perStage=Array.from({length:5},(_,stage)=>({stage,cardCount:0,nonZeroHintLevel:0,nonZeroHintFrequency:0}));
const rarityCounts={},examplesByStage={};
let changedLevels=0,changedFrequency=0,maxPossibleBaseHintLevel=0;
for(const card of parsed.cards.values()){
 rarityCounts[card.rarity]=(rarityCounts[card.rarity]||0)+1;
 const stages=Object.values(card.hintPerformanceStages);
 if(stages.length!==5)throw Error('Missing 5 performance stages');
 if(stages[0].levelBase+stages[0].levelUnique!==stages[4].levelBase+stages[4].levelUnique)changedLevels++;
 if(stages[0].frequencyBase!==stages[4].frequencyBase||stages[0].frequencyUnique!==stages[4].frequencyUnique)changedFrequency++;
 for(let stage=0;stage<5;stage++){
  const row=card.hintPerformanceStages[String(stage)],group=perStage[stage];
  group.cardCount++;
  if(row.levelBase+row.levelUnique>0)group.nonZeroHintLevel++;
  if(row.frequencyBase!==0||row.frequencyUnique!==0)group.nonZeroHintFrequency++;
  for(const key of metrics){
   const m=ranges[key];m.min=Math.min(m.min,row[key]);m.max=Math.max(m.max,row[key]);
   if(row[key]!==0)m.nonzero++;
  }
  maxPossibleBaseHintLevel=Math.max(maxPossibleBaseHintLevel,1+row.levelBase+row.levelUnique);
 }
}
const result={source:'mee1080/umasim/data/support_card.txt',sha256,
 cards:parsed.cards.size,sourceRows:parsed.lines,rarityCounts,perStage,
 changedHintLevelBetween0And4:changedLevels,
 changedHintFrequencyBetween0And4:changedFrequency,
 modifiers:ranges,maxSimpleHintLevel:maxPossibleBaseHintLevel};
if(parsed.lines!==parsed.cards.size*5)throw Error('Source rows are not five per card');
if(parsed.cards.size<500)throw Error('Unexpectedly short source');
console.log(JSON.stringify(result,null,2));
