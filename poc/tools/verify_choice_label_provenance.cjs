'use strict';
/*
 * Review-only, one-card choice label provenance check. Immutable old source
 * provides a fingerprint target; GameWith origin was manually verified
 * separately. Never output or publish any event / choice prose.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {selectMaleChoiceLabel}=require('../src/choice_label_gender_policy.cjs');
const ledgerPath=path.resolve(__dirname,'../review/choice-label-provenance-30001.v1.json');
const fail=s=>{throw Error('GameWith選択肢出典検証: '+s);};
const isSha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const norm=s=>String(s).normalize('NFKC').trim();
const digest=s=>crypto.createHash('sha256').update(norm(s),'utf8').digest('hex');
function reviewChoiceProvenance(ledger,reference,expectedCardId='30001'){
 if(ledger?.schemaVersion!==2||ledger.cardId!==expectedCardId||
    ledger.choiceDisplayPolicy?.gender!=='male'||
    ledger.choiceDisplayPolicy.allowFemaleFallback!==false||
    ledger.choiceDisplayPolicy.genderSelectionUi!==false||
    ledger.choiceDisplayPolicy.unknownMaleLabel!=='unresolved'||
    !Array.isArray(ledger.choices)||ledger.choices.length!==6||
    !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(ledger.gameWithCardPage)||
    ledger.automaticTextPublicationAllowed!==false||ledger.contentIncluded!==false||
    ledger.publicationApproved!==false||ledger.publishedChoiceTextCount!==0)
  fail('承認台帳のスキーマ、版、権利条件が不正');
 if(reference?.kind!=='support'||reference.id!==Number(expectedCardId)||
    !reference.events_ja||typeof reference.events_ja!=='object')
  fail('旧固定サンプルカードの構造が不正');
 const events=Object.values(reference.events_ja);
 if(events.length!==5)fail('旧固定イベントの母数が違う');
 const known=new Set();
 const report=[];
 for(const item of ledger.choices){
  if(!Number.isSafeInteger(item?.eventOrdinal)||item.eventOrdinal<1||
     item.eventOrdinal>events.length||
     !Number.isSafeInteger(item.choiceOrdinal)||item.choiceOrdinal<1||
     item.selectedGender!=='male'||item.maleLabelVerifiedInGameWithArticle!==true||
     !isSha(item.labelSha256)||
     !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(item.gameWithEventPage))
    fail('選択肢出典・イベント位置の値が不正');
  const k=item.eventOrdinal+':'+item.choiceOrdinal;
  if(known.has(k))fail('選択肢位置が重複');
  known.add(k);
  const choice=events[item.eventOrdinal-1]?.choices?.[item.choiceOrdinal-1];
  if(!choice||typeof choice.label!=='string'||!choice.label.trim())
   fail('旧固定元に有効な文言がない');
  // Hash ensures the approved editorial source reference is not silently
  // transferred to another choice in a future snapshot.
  const selected=selectMaleChoiceLabel({genderVariants:{male:choice.label}});
  if(selected.status!=='male-label-selected'||selected.gender!=='male')
   fail('選択肢の男性表示名が未確認');
  report.push({
   eventOrdinal:item.eventOrdinal,
   choiceOrdinal:item.choiceOrdinal,
   historicalLabelFingerprintMatches:digest(selected.label)===item.labelSha256,
   editorialGameWithPagePresent:true,
   originalGameToraDisplayedTextMatches:false, // 0/6 in the scoped browser audit
   explicitTextForPublicAppApproved:false
  });
 }
 const mismatch=report.filter(x=>!x.historicalLabelFingerprintMatches);
 return {
  cardId:expectedCardId,
  scopedNonemptyHistoricalChoiceLabels:events.flatMap(e=>e.choices).filter(c=>typeof c.label==='string'&&c.label.trim()).length,
  gameWithReviewedPositionCount:report.length,
  digestMatches:report.length-mismatch.length,
  digestMismatches:mismatch.length,
  eventsReviewed:new Set(report.map(x=>x.eventOrdinal)).size,
  originalSiteTextVerificationCount:0,
  selectedTrainerGender:'male',
  femaleDisplayFallbackAllowed:false,
  genderSelectionUiEnabled:false,
  maleVariantChoicePositions:report.length,
  genderVariantsExhaustive:false,
  editorialTextProvenanceOnly:true,
  choiceLabelCodeIncluded:false,
  gameWithRetrievalInThisCheck:false,
  gameToraRewardRouteValidatedByThisCheck:false,
  automaticPublicationAllowed:false
 };
}
if(require.main===module){
 try {
  if(process.argv.length!==3)fail('JSON参照サンプルを引数で指定');
  const file=path.resolve(process.argv[2]);
  const blob=fs.readFileSync(file);
  const sha=crypto.createHash('sha1').update('blob '+blob.length+'\0').update(blob).digest('hex');
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
  if(sha!==ledger.historicalSource.gitBlobSha)fail('旧固定ファイルのGit blob SHAが不一致');
  const result=reviewChoiceProvenance(ledger,JSON.parse(blob.toString('utf8')));
  if(result.digestMatches!==6||result.scopedNonemptyHistoricalChoiceLabels!==6)
   fail('選択肢フィンガープリントの照合差分');
  process.stdout.write('CHOICE_LABEL_PROVENANCE='+JSON.stringify(result)+'\n');
 }catch(e){
  process.stderr.write(String(e.message).slice(0,240)+'\n');
  process.exitCode=1;
 }
}
module.exports={digest,reviewChoiceProvenance};
