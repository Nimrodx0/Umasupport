/* Curated GameWith-first event intake: offline completeness and integrity.
 * Does NOT scrape GameWith, grant reuse permission or release any draft.
 * The machine checks structure; source interpretation remains an editorial task.
 */
'use strict';
const schema=require('./event_schema.js');
const bridge=require('./skill_bridge.js');
const names=require('./curated_skill_resolution.cjs');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const ARTICLE=/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/[1-9]\d+$/;
const DRAFT=/^poc\/data\/(?:curation\/drafts|preview)\/[A-Za-z0-9_.-]+\.json$/;
function fail(message){throw Error('独自イベント収録監査: '+message);}
function validateIndex(index){
 if(!obj(index)||index.schemaVersion!==1||!Array.isArray(index.cards))
  fail('出典索引の版・構造が不正');
 const ids=new Set(),paths=new Set();
 for(const e of index.cards){
  if(!obj(e)||typeof e.cardId!=='string'||!/^\d{5}$/.test(e.cardId)||
    ids.has(e.cardId))fail('サポカIDが不正・重複');
  if(typeof e.primaryArticle!=='string'||!ARTICLE.test(e.primaryArticle))
    fail(e.cardId+': GameWith個別記事URLが不正');
  if(typeof e.articleCheckedAt!=='string'||!DAY.test(e.articleCheckedAt)||
     !Number.isFinite(Date.parse(e.articleCheckedAt+'T00:00:00Z'))||
     new Date(e.articleCheckedAt+'T00:00:00Z').toISOString().slice(0,10)!==e.articleCheckedAt)
    fail(e.cardId+': 記事確認日が不正');
  if(e.recordStatus!=='draft'||e.coverageStatus!=='partial')
    fail(e.cardId+': 独立確認なしに完成・公開扱いにできません');
  if(typeof e.draftFile!=='string'||!DRAFT.test(e.draftFile)||
    paths.has(e.draftFile))fail(e.cardId+': 草稿ファイルが不正・重複');
  ids.add(e.cardId);paths.add(e.draftFile);
 }
 return index.cards;
}
function audit({index,model,draftCatalogs,publicCatalog,skillText,supplementalSkills}){
 const sourceCards=validateIndex(index);
 if(!obj(model)||!Array.isArray(model.cards)||!obj(model.cardById)||
    !obj(model.skillById)||!Array.isArray(model.skills))
  fail('採用済みカード母集団の形式が不正');
 if(!obj(draftCatalogs)||!obj(publicCatalog)||publicCatalog.schemaVersion!==1||
    !Array.isArray(publicCatalog.cards))fail('草稿または公開カタログが不正');
 const ids=new Set(model.cards.map(c=>c.id));
 if(ids.size!==model.cards.length||ids.size!==Object.keys(model.cardById).length)
  fail('カード母集団IDが不正・重複');
 const stats={rosterCards:ids.size,sourceIndexedCards:sourceCards.length,
  draftCards:0,draftEventRecords:0,untrackedCards:ids.size-sourceCards.length,
  releasedCards:publicCatalog.cards.length,
  releasedEventRecords:publicCatalog.cards.reduce((n,c)=>n+(Array.isArray(c.events)?c.events.length:0),0),
  indexedByRarity:{R:0,SR:0,SSR:0},rosterByRarity:{R:0,SR:0,SSR:0},
  normalHintRewardIdsMatched:0,draftNamedUnresolvedRows:0,
  namedRewardsMatchedFromFullRegistry:0,namedRewardsMatchedFromSupplement:0,
  supplementalSkillIdsAdded:0,stillPendingSkillRows:0,
  stillPendingSkillEvents:0,pendingSkillDetails:[]};
 for(const card of model.cards){
  if(!own(stats.rosterByRarity,card.rarity))fail('カードレアリティが不正: '+card.id);
  stats.rosterByRarity[card.rarity]++;
 }
 const seenReleased=new Set();
 for(const c of publicCatalog.cards){
  if(!obj(c)||!ids.has(c.cardId)||!Array.isArray(c.events)||seenReleased.has(c.cardId))
   fail('公開カタログのカードIDまたは構造が不正');
  seenReleased.add(c.cardId);
 }
 for(const row of sourceCards){
  if(!ids.has(row.cardId))fail('出典索引に存在するカードが母集団にありません: '+row.cardId);
  if(!own(draftCatalogs,row.draftFile))
   fail('草稿ファイルが見つかりません: '+row.draftFile);
  const doc=draftCatalogs[row.draftFile];
  if(!obj(doc)||doc.schemaVersion!==1||!Array.isArray(doc.cards)||
    doc.cards.length!==1||doc.cards[0]?.cardId!==row.cardId||
    doc.cards[0]?.coverageStatus!=='partial'||
    !Array.isArray(doc.cards[0]?.events)||doc.cards[0].events.length<1)
   fail(row.cardId+': 草稿のカード識別・収録範囲が不正');
  for(const e of doc.cards[0].events){
   const escaped=row.cardId;
   if(typeof e.id!=='string'||!(
      new RegExp('^evt_'+escaped+'_[0-9]{9}$').test(e.id)||
      new RegExp('^draft_'+escaped+'_[a-z0-9_]+$').test(e.id)))
    fail(row.cardId+': イベントIDが対象カードと一致しません');
  }
  // Event schema and numeric-skill ID/name bridge are the *same* as live app.
  // No draft is attached to model and no publication flag is set here.
  let prepared,unresolved;
  try{
    // Draft-only transformation validates ALL names against skill_data.txt.
    // It never attaches to the real model or overwrites the editorial draft.
    unresolved=names.prepareDraft(doc,skillText,{supplemental:supplementalSkills});
    prepared=bridge.prepare(model,unresolved.catalog,unresolved.mergedSkillText,{fullRegistry:false});
  }catch(e){fail(row.cardId+': スキル照合失敗 '+e.message);}
  stats.normalHintRewardIdsMatched+=unresolved.matchedHintRewards;
  stats.draftNamedUnresolvedRows+=unresolved.resolvedNames.length+unresolved.pending.length;
  stats.namedRewardsMatchedFromFullRegistry+=unresolved.resolvedNames.filter(x=>x.source==='umasim').length;
  stats.namedRewardsMatchedFromSupplement+=unresolved.resolvedNames.filter(x=>x.source==='supplemental').length;
  stats.supplementalSkillIdsAdded=Math.max(stats.supplementalSkillIdsAdded,unresolved.supplementalAdded);
  stats.stillPendingSkillRows+=unresolved.pending.length;
  const uniquePending=new Set(unresolved.pending.map(x=>x.location.split('/').slice(0,2).join('/')));
  stats.stillPendingSkillEvents+=uniquePending.size;
  stats.pendingSkillDetails.push(...unresolved.pending);
  const candidateSkills={...model.skillById,
   ...Object.fromEntries(prepared.skills.map(s=>[s.id,s]))};
  let coverage;
  try{coverage=schema.validateCatalog(prepared.catalog,
    {...model,skillById:candidateSkills});}
  catch(e){fail(row.cardId+': 草稿イベントが不正 '+e.message);}
  stats.indexedByRarity[model.cardById[row.cardId].rarity]++;
  stats.draftCards++;
  stats.draftEventRecords+=coverage.eventsWithRecords;
 }
 if(stats.untrackedCards<0)fail('出典登録数が母集団を超えています');
 if([...seenReleased].some(id=>!sourceCards.some(c=>c.cardId===id)))
  fail('公開DBのカードが独自出典索引にありません');
 return stats;
}
module.exports={validateIndex,audit};
