/* A deliberately small, source-reviewed gold -> white crosswalk.
 * Matching group numbers alone are NEVER approval of an additional pair.
 * This file contains only identifiers/relations and provenance URLs, not source prose.
 */
(function(g){
'use strict';
const PAIRS=Object.freeze([
  {goldId:'200591',goldName:'迅速果断',whiteId:'200592',whiteName:'位置取り押し上げ',group:20059,
   evidence:['https://gamewith.jp/uma-musume/article/show/257945','https://game8.jp/umamusume/372729']},
  {goldId:'203561',goldName:'一所懸命',whiteId:'203562',whiteName:'奮闘',group:20356,
   evidence:['https://gamewith.jp/uma-musume/article/show/561923','https://game8.jp/umamusume/785661']},
  {goldId:'203801',goldName:'解き放つ情念',whiteId:'203802',whiteName:'想い焦がれて',group:20380,
   evidence:['https://gamewith.jp/uma-musume/article/show/514488','https://gamewith.jp/uma-musume/article/show/514492']}
]);
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function stage({model,source,skills,pairs=PAIRS}){
  if(!model||!model.skillById||!Array.isArray(skills)||!source?.byId||!source?.byName||!Array.isArray(pairs))
    throw Error('上下関係の照合に必要なデータが不正');
  const created=new Map(skills.map(s=>[s.id,s])),patches=[];
  const usedGold=new Set(),usedWhite=new Set();
  for(const pair of pairs){
    if(!pair||!/^\d+$/.test(pair.goldId)||!/^\d+$/.test(pair.whiteId)||
       !norm(pair.goldName)||!norm(pair.whiteName)||!Number.isSafeInteger(pair.group))
      throw Error('レビュー済み上下関係の定義が不正');
    const goldKey='skill:'+pair.goldId;
    if(usedGold.has(goldKey)||usedWhite.has(pair.whiteId))
      throw Error('重複した上下関係の定義: '+goldKey);
    usedGold.add(goldKey);usedWhite.add(pair.whiteId);
    const gold=created.get(goldKey)||model.skillById[goldKey];
    if(!gold)continue; // Relations are attached only to skills actually in the model.
    const rare=source.byId.get(pair.goldId),normal=source.byId.get(pair.whiteId);
    if(!rare||!normal||
       rare.name!==pair.goldName||rare.rarity!=='rare'||rare.group!==pair.group||
       normal.name!==pair.whiteName||normal.rarity!=='normal'||normal.group!==pair.group||
       source.byName.get(pair.goldName)?.length!==1||
       source.byName.get(pair.whiteName)?.length!==1||
       norm(gold.name)!==pair.goldName||gold.tier!=='gold')
      throw Error('レビュー済み上下関係がUmaSim辞書と一致しません: '+goldKey);
    const hintKey='hint:'+pair.whiteName,numberKey='skill:'+pair.whiteId;
    let lowerId=has(model.skillById,hintKey)?hintKey:numberKey;
    let white=created.get(lowerId)||model.skillById[lowerId];
    if(!white){
      white={id:numberKey,name:pair.whiteName,tier:'white',lowerId:null,
        sourceNumericId:pair.whiteId,sourceStatus:'umasim-id-matched-reviewed-hierarchy'};
      created.set(numberKey,white);
    }else if(norm(white.name)!==pair.whiteName||!['white','unknown'].includes(white.tier))
      throw Error('下位白スキルが一致しません: '+lowerId);
    if(gold.lowerId!==null&&gold.lowerId!==undefined&&gold.lowerId!==lowerId)
      throw Error('既存の上下関係と矛盾: '+goldKey);
    patches.push({id:goldKey,lowerId});
  }
  return {skills:[...created.values()],patches,linkedPairs:patches.length};
}
const api={PAIRS,stage};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillHierarchy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
