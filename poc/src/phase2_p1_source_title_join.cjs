'use strict';
/*
 * Bounded, text-minimal join for four UNPAIRED P1 Checker source positions.
 * Matching a pinned title-derived Checker key to one known GT event proves
 * an editorial SOURCE HEADING correspondence, NOT outcome equivalence.
 * Does not mutate whole-index source counts or release/gameplay data.
 */
const crypto=require('node:crypto');
const fail=s=>{throw Error('P1出典見出し照合: '+s);};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const norm=s=>String(s).normalize('NFKC').replace(/\\s+/g,' ').trim();
const gtRev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const checkerRev='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const TARGETS=Object.freeze([
 {cardId:'30067',checkerOrdinal:10,gtOrdinal:10,gtLocalId:1492,gtSection:'special',
  gtName:'鍛えよ共に',choices:3,gameWithUrl:'https://gamewith.jp/uma-musume/article/show/352660'},
 {cardId:'30081',checkerOrdinal:12,gtOrdinal:16,gtLocalId:1478,gtSection:'special',
  gtName:'おかわりトレーニング',choices:3,gameWithUrl:'https://gamewith.jp/uma-musume/article/show/324511'},
 {cardId:'30137',checkerOrdinal:10,gtOrdinal:10,gtLocalId:1510,gtSection:'special',
  gtName:'三女神の気分転換トレーニング',choices:3,
  gameWithUrl:'https://gamewith.jp/uma-musume/article/show/392647'},
 {cardId:'30160',checkerOrdinal:10,gtOrdinal:2,gtLocalId:1411,gtSection:'special',
  gtName:'お疲れ様！！',choices:1,gameWithUrl:'https://gamewith.jp/uma-musume/article/show/413773'}
]);
function titleCandidates(base){
 return [...new Set([base,base+'(温かなメッセージ)',base+'（温かなメッセージ）'])];
}
function sourceKey(cardId,ordinal,title){
 if(!/^\\d{5}$/.test(cardId)||!Number.isInteger(ordinal)||ordinal<1||!norm(title))
  fail('照合用キーのカード／元位置／短見出し不正');
 return 'checker:'+cardId+':'+sha(cardId+'\\0'+norm(title)+'\\0'+String(ordinal-1)).slice(0,20);
}
function compare({index,checker,gtDocuments},{strict=false}={}){
 if(index?.dataKind!=='umasupport-whole-event-provisional-index'||
    index.publicationApproval!==false||index.gameVerified!==false||
    index.sourcePins?.checker!==checkerRev||
    index.sourcePins?.gameToraDerived!==gtRev||
    !Array.isArray(index.cards)||
    checker?.dataKind!=='support-event-hint-candidates'||
    checker.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||
    checker.forSkillGrant!==false||checker.sourcePins?.checker?.revision!==checkerRev||
    !Array.isArray(checker.cards)||!Array.isArray(gtDocuments))
  fail('全件ソース版・未承認区分の前提条件に違反');
 if(strict&&(index.cards.length!==563||
    index.stats?.checkerEventRecords!==2109||
    index.stats?.gameToraEventRecords!==2488))
  fail('固定版563枚／2109／2488件の全件母数不一致');
 if(gtDocuments.length!==4||new Set(gtDocuments.map(c=>c.id)).size!==4)
  fail('GTの指定4カードが欠損または重複');
 const rows=[];
 for(const t of TARGETS){
  const c=index.cards.find(c=>c.cardId===t.cardId);
  const excluded=c?.checkerOnly?.filter(e=>e.checkerOrdinal===t.checkerOrdinal);
  const cc=checker.cards.find(c=>c.cardId===t.cardId);
  const src=cc?.events?.[t.checkerOrdinal-1];
  const doc=gtDocuments.find(d=>d.id===Number(t.cardId));
  const raw=Object.values(doc?.events_ja||{})[t.gtOrdinal-1];
  if(excluded?.length!==1||!src||!raw||
     excluded[0].sourceKey!==src.sourceKey||
     src.ordinal!==t.checkerOrdinal||
     !/^sha256:[0-9a-f]{64}$/.test(src.sourceDigest)||
     !Array.isArray(src.choices)||src.choices.length!==t.choices||
     src.choices.filter(x=>x.needsManualResultReview).length!==t.choices||
     src.choices.some(x=>x.observedHints.length!==0||x.unparsedHintSyntax)||
     raw.id!==t.gtLocalId||raw.name!==t.gtName||
     raw.section!==t.gtSection||raw.choices?.length!==t.choices||
     raw.choices.some(x=>x.random_either!==false||
      !Array.isArray(x.effects)||
      x.effects.some(e=>e.type==='skill_hint'||e.type==='chain_end')))
   fail('Checker固定P1元位置とGTイベントID・スキルなし形状が不一致: '+t.cardId);
  const matches=titleCandidates(t.gtName).filter(n=>
   sourceKey(t.cardId,t.checkerOrdinal,n)===src.sourceKey);
  if(matches.length>1)fail('複数の短見出し候補が同一ハッシュへ一致');
  rows.push({cardId:t.cardId,checkerOrdinal:t.checkerOrdinal,
   sourceKey:src.sourceKey,sourceDigest:src.sourceDigest,
   gameToraSourceOrdinal:t.gtOrdinal,gameToraLocalId:t.gtLocalId,
   gameToraChoiceRows:t.choices,checkerConditionalRows:t.choices,
   titleKeyMatchesKnownGameWithHeading:matches.length===1,
   titleVariantClass:matches.length===0?'NOT_MATCHED':
    matches[0]===t.gtName?'BASE_TITLE':'GAMEWITH_CONTEXT_SUFFIX',
   sourceHeadingCorrespondence:matches.length===1?
    'PINNED_CHECKER_TITLE_KEY_EQUALS_NAMED_GT_EVENT_WITH_GAMEWITH_CONTEXT':
    'CHECKER_TITLE_KEY_NOT_RESOLVED',
   outcomeSemanticsProvenEquivalent:false,
   gameplayVerified:false,publicationApproved:false,
   gameWithSourceUrl:t.gameWithUrl});
 }
 if(rows.length!==4||new Set(rows.map(r=>r.sourceKey)).size!==4)
  fail('P1ソース位置が重複');
 return {dataKind:'phase2-p1-scoped-title-key-join',publicationApproved:false,
  originalCrossSourceQueueUnchanged:true,skillGrantsAdded:0,chainFlagsChanged:0,
  sourcePins:{gameToraDerived:gtRev,checker:checkerRev},
  summary:{targetPositions:4,headingKeyMatches:rows.filter(r=>
   r.titleKeyMatchesKnownGameWithHeading).length,
   headingKeyStillUnmatched:rows.filter(r=>
   !r.titleKeyMatchesKnownGameWithHeading).length,
   resultPathsCertified:0,publicEventsAdded:0},rows};
}
module.exports={TARGETS,sourceKey,compare};
