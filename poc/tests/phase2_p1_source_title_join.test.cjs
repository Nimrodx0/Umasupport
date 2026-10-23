'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {TARGETS,sourceKey,compare}=require('../src/phase2_p1_source_title_join.cjs');
const checkRev='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const gtRev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const digest='sha256:'+'a'.repeat(64);
function fixture(){
 const cards=[],checkerCards=[],gtDocuments=[];
 for(const t of TARGETS){
  const name=t.checkerTitle;
  const source=sourceKey(t.cardId,t.checkerOrdinal,name);
  cards.push({cardId:t.cardId,checkerOnly:[
   {checkerOrdinal:t.checkerOrdinal,sourceKey:source}]});
  const events=Array.from({length:t.checkerOrdinal},(_,i)=>({
   ordinal:i+1,sourceKey:'placeholder:'+i,sourceDigest:digest,choices:[]}));
  events[t.checkerOrdinal-1]={ordinal:t.checkerOrdinal,sourceKey:source,
   sourceDigest:digest,choices:Array.from({length:t.choices},(_,i)=>({
    ordinal:i+1,needsManualResultReview:true,observedHints:[]}))};
  checkerCards.push({cardId:t.cardId,events});
  const gt=Array.from({length:t.gtOrdinal},(_,i)=>({
   id:90000+i,name:'placeholder '+i,section:'random',
   choices:[{random_either:false,effects:[]}]}));
  gt[t.gtOrdinal-1]={id:t.gtLocalId,name:t.gtName,section:t.gtSection,
   choices:Array.from({length:t.choices},()=>({
    random_either:false,effects:[{type:'skill_points',value:'+4'}]}))};
  gtDocuments.push({id:Number(t.cardId),events_ja:Object.fromEntries(
   gt.map((ev,i)=>['event'+i,ev]))});
 }
 return {index:{dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,gameVerified:false,
  sourcePins:{checker:checkRev,gameToraDerived:gtRev},
  stats:{checkerEventRecords:2109,gameToraEventRecords:2488},
  cards},checker:{dataKind:'support-event-hint-candidates',
  approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',forSkillGrant:false,
  sourcePins:{checker:{revision:checkRev}},cards:checkerCards},gtDocuments};
}
test('exact pinned Checker sourceKey generation uses original card/title/index NUL hash',()=>{
 assert.match(sourceKey('30067',10,'鍛えよ共に'),/^checker:30067:[0-9a-f]{20}$/);
 assert.notEqual(sourceKey('30067',10,'鍛えよ共に'),
  sourceKey('30067',10,'鍛えよ共に(温かなメッセージ)'));
 assert.equal(sourceKey('30067',10,'  鍛えよ共に　'),
  sourceKey('30067',10,'鍛えよ共に'));
});
test('four scoped title hints correspond to pinned GT local positions, not results',()=>{
 const f=fixture(),before=structuredClone(f);
 const x=compare(f);
 assert.deepEqual(x.summary,{targetPositions:4,checkerCategoryTitlesVerified:4,
  checkerCategoryTitlesStillUnverified:0,sharedContextRowsVerified:3,
  separateOverseasEventRowsVerified:1,GTEventIdentityPairsAdded:0,
  resultPathsCertified:0,publicEventsAdded:0});
 assert.ok(x.rows.every(row=>row.checkerSourceHeadingMatchesKnownCategory&&
  row.individualGTEventIdentityPaired===false&&
  row.outcomeSemanticsProvenEquivalent===false&&row.publicationApproved===false));
 assert.deepEqual(x.rows.map(row=>row.checkerTitleCategory),[
  'COMMON_GROUP_CONTEXT','COMMON_GROUP_CONTEXT','COMMON_GROUP_CONTEXT',
  'OVERSEAS_SEPARATE_EVENT']);
 assert.equal(x.originalCrossSourceQueueUnchanged,true);
 assert.equal(x.skillGrantsAdded,0);
 assert.equal(x.chainFlagsChanged,0);
 assert.deepEqual(f,before,'source and current event model must not be mutated');
});
test('unknown Checker title stays unpaired, not invented as a matched event',()=>{
 const f=fixture(),row=f.checker.cards[0].events[TARGETS[0].checkerOrdinal-1];
 row.sourceKey=sourceKey(TARGETS[0].cardId,TARGETS[0].checkerOrdinal,'未同定の別見出し');
 f.index.cards[0].checkerOnly[0].sourceKey=row.sourceKey;
 const r=compare(f);
 assert.equal(r.summary.checkerCategoryTitlesVerified,3);
 assert.equal(r.summary.checkerCategoryTitlesStillUnverified,1);
 assert.equal(r.rows[0].sourceHeadingCorrespondence,'CHECKER_CATEGORY_TITLE_KEY_NOT_RESOLVED');
 assert.equal(r.summary.publicEventsAdded,0);
});
test('different source ordinal, source hash, GT event, GT rewards or gate fails closed',()=>{
 const modifications=[
  f=>{f.index.sourcePins.checker='wrong';},
  f=>{f.checker.approvalState='APPROVED';},
  f=>{f.index.cards[0].checkerOnly[0].checkerOrdinal=3;},
  f=>{f.checker.cards[0].events[9].sourceDigest='bad';},
  f=>{f.checker.cards[0].events[9].choices[0].observedHints.push({skillId:'1',level:1});},
  f=>{f.checker.cards[0].events[9].choices[0].needsManualResultReview=false;},
  f=>{f.gtDocuments[0].events_ja.event9.id=12345;},
  f=>{f.gtDocuments[0].events_ja.event9.name='a different event';},
  f=>{f.gtDocuments[0].events_ja.event9.choices[0].effects.push({type:'skill_hint',skill_id:12,value:'+1'});},
  f=>{f.gtDocuments[0].events_ja.event9.choices[0].effects.push({type:'chain_end'});},
  f=>{f.gtDocuments.pop();}
 ];
 for(const mutate of modifications){
  const f=fixture();mutate(f);assert.throws(()=>compare(f),/P1出典見出し照合/);
 }
});
test('artificial four-card fixture is not mistaken for a real 563-card B gate',()=>{
 assert.throws(()=>compare(fixture(),{strict:true}),/固定版563枚/);
});
