#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {build}=require('../src/phase2_independent_roster_coverage.cjs');
function main(args){
 if(args.length!==5)
  throw Error('usage: <union-index> <chain-topology> <GT-numeric-candidate> <source-exceptions> <temporary-output>');
 const [index,topology,numeric,exceptions,out]=args.map(x=>path.resolve(x));
 const publicDir=path.resolve(__dirname,'../data');
 if(out===publicDir||out.startsWith(publicDir+path.sep)||
    [index,topology,numeric,exceptions].includes(out))
  throw Error('非公開網羅性監査を公開用データや入力元には書き出せません');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const result=build(read(index),read(topology),read(numeric),read(exceptions));
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('PHASE2_ALL_563_INDEPENDENT_COVERAGE='+JSON.stringify(result.summary));
 console.log('PHASE2_CHAIN_REVIEW_FIRST='+JSON.stringify(result.cards.filter(c=>
  c.reviewPriority<=1).map(x=>({
   cardId:x.cardId,rarity:x.rarity,reviewerStatus:x.reviewerStatus,
   gtChainStageCount:x.gtChainStageCount,gtObservedEventCount:x.gtObservedEventCount,
   checkerObservedEventCount:x.checkerObservedEventCount
  }))));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={main};
