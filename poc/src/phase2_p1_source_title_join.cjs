'use strict';
/*
 * Bounded, text-minimal join for four UNPAIRED P1 Checker source positions.
 * Four P1 Checker headings are NOT the GT event titles. They represent
 * three shared warm-message rows and one separate overseas training event.
 * Exact source heading check NEVER implies GT event identity or outcome parity.
 * Does not mutate whole-index source counts or release/gameplay data.
 */
const crypto=require('node:crypto');
const fail=s=>{throw Error('P1出典見出し照合: '+s);};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
const gtRev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const checkerRev='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const TARGETS=Object.freeze([
 {cardId:'30067',checkerOrdinal:10,gtOrdinal:10,gtLocalId:1492,gtSection:'special',
  gtName:'鍛えよ共に',checkerTitle:'温かなメッセージ',relationship:'COMMON_GROUP_CONTEXT',choices:3,gameWithUrl:'https://gamewith.jp/uma-musume/article/show/352660'},
 {cardId:'30081',checkerOrdinal:12,gtOrdinal:16,gtLocalId:1478,gtSection:'special',
  gtName:'おかわりトレーニング',checkerTitle:'温かなメッセージ',relationship:'COMMON_GROUP_CONTEXT',choices:3,gameWithUrl:'https://gamewith.jp/uma-musume/article/show/324511'},
 {cardId:'30137',checkerOrdinal:10,gtOrdinal:10,gtLocalId:1510,gtSection:'special',
  gtName:'三女神の気分転換トレーニング',checkerTitle:'温かなメッセージ',relationship:'COMMON_GROUP_CONTEXT',choices:3,
  gameWithUrl:'https://gamewith.jp/uma-musume/article/show/392647'},
 {cardId:'30160',checkerOrdinal:10,gtOrdinal:2,gtLocalId:1411,gtSection:'special',
  gtName:'お疲れ様！！',checkerTitle:'労いのエール',relationship:'OVERSEAS_SEPARATE_EVENT',choices:1,gameWithUrl:'https://gamewith.jp/uma-musume/article/show/413773'}
]);
function sourceKey(cardId,ordinal,title){
 if(!/^\d{5}$/.test(cardId)||!Number.isInteger(ordinal)||ordinal<1||!norm(title))
  fail('照合用キーのカード／元位置／短見出し不正');
 return 'checker:'+cardId+':'+sha(cardId+'\0'+norm(title)+'\0'+String(ordinal-1)).slice(0,20);
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
  // The checker source is a shared generic heading on three group cards.
  // The fourth is a distinct overseas-only event, NOT GT's domestic event.
  // This is a checker-title check, never a Checker-to-GT identity pairing.
  const categoryTitleMatches=sourceKey(t.cardId,t.checkerOrdinal,t.checkerTitle)===
   src.sourceKey;
  rows.push({cardId:t.cardId,checkerOrdinal:t.checkerOrdinal,
   sourceKey:src.sourceKey,sourceDigest:src.sourceDigest,
   gameToraSourceOrdinal:t.gtOrdinal,gameToraLocalId:t.gtLocalId,
   gameToraChoiceRows:t.choices,checkerConditionalRows:t.choices,
   checkerSourceHeadingMatchesKnownCategory:categoryTitleMatches,
   checkerTitleCategory:categoryTitleMatches?t.relationship:'UNRESOLVED_CHECKER_TITLE',
   sourceHeadingCorrespondence:categoryTitleMatches?
    'PINNED_CHECKER_CATEGORY_TITLE_KEY_VERIFIED':
    'CHECKER_CATEGORY_TITLE_KEY_NOT_RESOLVED',
   individualGTEventIdentityPaired:false,
   outcomeSemanticsProvenEquivalent:false,
   gameplayVerified:false,publicationApproved:false,
   gameWithSourceUrl:t.gameWithUrl});
 }
 if(rows.length!==4||new Set(rows.map(r=>r.sourceKey)).size!==4)
  fail('P1ソース位置が重複');
 return {dataKind:'phase2-p1-scoped-title-key-join',publicationApproved:false,
  originalCrossSourceQueueUnchanged:true,skillGrantsAdded:0,chainFlagsChanged:0,
  sourcePins:{gameToraDerived:gtRev,checker:checkerRev},
  summary:{targetPositions:4,checkerCategoryTitlesVerified:rows.filter(r=>
   r.checkerSourceHeadingMatchesKnownCategory).length,
   checkerCategoryTitlesStillUnverified:rows.filter(r=>
   !r.checkerSourceHeadingMatchesKnownCategory).length,
   sharedContextRowsVerified:rows.filter(r=>
    r.checkerSourceHeadingMatchesKnownCategory&&
    r.checkerTitleCategory==='COMMON_GROUP_CONTEXT').length,
   separateOverseasEventRowsVerified:rows.filter(r=>
    r.checkerSourceHeadingMatchesKnownCategory&&
    r.checkerTitleCategory==='OVERSEAS_SEPARATE_EVENT').length,
   GTEventIdentityPairsAdded:0,resultPathsCertified:0,publicEventsAdded:0},rows};
}
module.exports={TARGETS,sourceKey,compare};
