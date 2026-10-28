'use strict';
const crypto=require('node:crypto'),fs=require('node:fs');
const {inspectCohort}=require('../src/official_gametora_old_structural_cohorts.cjs');
const pins={
 '30030':'95d6692825af1d7774b0382245016433660509c9',
 '30041':'fda834045267a13bd06d51d39468ac7cb9367136',
 '30080':'8ce27e74dd18de7a08efa6a0bcf53d5be7a59a86'
};
function main(args){
 if(args.length!==3)throw Error('usage: support_30030.json support_30041.json support_30080.json');
 const documents=args.map((path,i)=>{
  const id=['30030','30041','30080'][i],bytes=fs.readFileSync(path);
  const digest=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(pins[id]&&digest!==pins[id])throw Error('固定旧カードのGit blobが変化: '+id);
  return JSON.parse(bytes.toString('utf8'));
 });
 const result=inspectCohort(documents);
 if(result.cards.map(x=>x.expandedResultRoutes).join(',')!=='9,8,22')
  throw Error('旧固定データの分岐数が想定から変化');
 // No source titles, prose, HTML or third-party full cards in outputs.
 console.log('OLD_GT_STRUCTURAL_COHORT='+JSON.stringify(result));
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main};
