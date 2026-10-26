'use strict';
/*
 * Pinned 2026-10-26 UmaSim source-delta audit. Read the publisher's data
 * only in ephemeral CI inputs, never bundle it in GitHub Pages or an artifact.
 *
 * Distinct concepts: current UmaSim roster (566 in this pin), old source
 * roster (563), fixed GT event population (559 of old 563), and the actual
 * game collection are NOT interchangeable.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const loader=require('./live_loader.js');
const fail=x=>{throw Error('UmaSim現行サポカ母集団の差分監査: '+x);};
const POLICY=Object.freeze({
 beforeCommit:'91952973eb334ae530b8cd76541bce8a01a141cd',
 afterCommit:'910dd79f046710245e0cc88a09c5c92b1044897e',
 beforeBlob:'215b1922fd385895acc48af583db41e32b69ff58',
 afterBlob:'3a9204291615ce0c3573bf91e388e6ba48854848',
 beforeCount:563,afterCount:566,
 expectedNewIds:['10149','30322','30323']
});
const gitBlobSha=text=>{
 const bytes=Buffer.from(text,'utf8');
 return crypto.createHash('sha1').update(
  Buffer.from('blob '+bytes.length+'\0','utf8')).update(bytes).digest('hex');
};
function audit({beforeText,afterText},{strict=false}={}){
 if(typeof beforeText!=='string'||typeof afterText!=='string')
  fail('比較元データの形式が不正');
 const beforeSha=gitBlobSha(beforeText),afterSha=gitBlobSha(afterText);
 if(strict&&(beforeSha!==POLICY.beforeBlob||afterSha!==POLICY.afterBlob))
  fail('出典コミット内容のGit blob SHA-1がピンと不一致');
 const before=loader.parseSupportCards(beforeText);
 const after=loader.parseSupportCards(afterText);
 const old=before.cards,next=after.cards;
 const changed=[],removed=[],added=[];
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 for(const [id,c] of old){
  const newer=next.get(id);
  if(!newer){removed.push(id);continue;}
  if(!same(c,newer))changed.push(id);
 }
 for(const [id,c] of next)if(!old.has(id))
  added.push({id,name:c.name,rarity:c.rarity,type:c.type});
 if(removed.length||changed.length)
  fail('旧版のカード削除／名前・性能解放・通常ヒントの意図しない変更: '+
   JSON.stringify({removed,changed}));
 const ids=added.map(x=>x.id).sort();
 if(strict&&(old.size!==POLICY.beforeCount||
    next.size!==POLICY.afterCount||
    !same(ids,POLICY.expectedNewIds)))
  fail('固定2026-10-26の現行カード追加母集団が不一致');
 // Verify the exact live-loader entrypoint that GitHub Pages runs, not just
 // a bespoke TSV parser. New cards are selectable; their events are NOT
 // automatically reviewed or published.
 const live=loader.buildModel(afterText,{mode:'pinned-ci'});
 if(live.cards.length!==next.size||live.meta.verifiedIdCards!==next.size)
  fail('公開アプリのカードモデルが差分を全数取り込めない');
 for(const record of added){
  const card=live.cardById[record.id];
  if(!card||card.rarity!==record.rarity||card.type!==record.type||
     !Array.isArray(card.events)||card.events.length!==0||
     card.sourceStatus!=='verified_hints')
   fail('新カードのイベント未照合と通常ヒントを混同している: '+record.id);
 }
 if(strict&&(
    added.find(x=>x.id==='10149')?.name!=='[巫女]吾妻'||
    added.find(x=>x.id==='30322')?.name!=='[Time of Departure]マヤノトップガン'||
    added.find(x=>x.id==='30323')?.name!=='[いとどめでたき、まつりかな]吾妻'
 ))fail('2026-10-26追加カードの出典ID／名称不一致');
 return {
  dataKind:'umasim-roster-pinned-delta-private-audit',
  beforeCommit:POLICY.beforeCommit,afterCommit:POLICY.afterCommit,
  beforeBlobSha:beforeSha,afterBlobSha:afterSha,
  beforeCards:old.size,afterCards:next.size,
  oldCardStageRows:before.lines,newCardStageRows:after.lines,
  added,removedCards:removed.length,changedExistingCards:changed.length,
  publicLiveLoaderCards:live.cards.length,
  newCardsHaveReviewedEvents:false,gamePopulationVerified:false,
  sourceTextIncluded:false,sourceDataRedistributed:false,
  publicationApprovedEvents:0
 };
}
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length!==2){process.stderr.write(
  'usage: node poc/src/current_umasim_roster_delta.cjs <pinned-old.txt> <pinned-current.txt>\n');
  process.exitCode=2;
 }else try{
  const report=audit({
   beforeText:fs.readFileSync(args[0],'utf8'),
   afterText:fs.readFileSync(args[1],'utf8')
  },{strict:true});
  process.stdout.write('UMASIM_20261026_LIVE_ROSTER_DELTA='+JSON.stringify(report)+'\n');
 }catch(e){process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1;}
}
module.exports={audit,gitBlobSha,POLICY};
