'use strict';
/* P3 read-only research report inspector. No network, storage, scoring, or app edits. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.P3CoarseReview=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  const STYLES=Object.freeze(['逃げ','先行','差し','追込']);
  const LABELS=Object.freeze({
    favorable:'向きの傾向',unfavorable:'向きにくい傾向',
    mixed:'傾向が割れる',unresolved:'材料不足'
  });
  const SIGNALS=Object.freeze({
    'relative-favorable':['4脚質比較で有利','model'],
    'relative-unfavorable':['4脚質比較で不利','model'],
    'relative-mixed':['4脚質比較で保留・混在','held'],
    'broad-favorable':['旧2群モデルで前向きの参考','weak'],
    'broad-unfavorable':['旧2群モデルで後ろ向きの参考','weak'],
    'explicit-targeted':['明示脚質の対象','explicit'],
    'explicit-ineligible':['明示条件で発動対象外','explicit'],
    'explicit-eligible-unmeasured':['明示的に可能・適合度未測定','held'],
    'race-gate-only':['発動条件は照合・脚質差なし','held'],
    unresolved:['条件の根拠不足','unknown']
  });
  function validateReport(value){
    if(!value||typeof value!=='object'||Array.isArray(value))
      throw Error('レポートはJSONオブジェクトである必要があります。');
    if(value.schemaVersion!==1||
       value.status!=='p3-default-style-research-preview-only-not-product-deck-score'||
       value.version!=='p3-coarse-default-preview-v0')
      throw Error('P3の承認済み研究レポート形式ではありません。');
    if(!Array.isArray(value.examples)||value.examples.length===0||
       value.examples.length>1000)throw Error('カード例の配列が不正です。');
    const seen=new Set();
    for(const card of value.examples){
      if(!card||typeof card.cardId!=='string'||!card.cardId||
         typeof card.cardName!=='string'||!card.cardName||
         !card.styles||!Array.isArray(card.sourceHints)||
         !card.coarseDirection||!card.coverage)
        throw Error('カード例に必要な項目がありません。');
      if(seen.has(card.cardId))throw Error('カードIDが重複しています。');
      seen.add(card.cardId);
      for(const style of STYLES){
        const data=card.styles[style];
        if(!data||!(data.label in LABELS)||
           !Number.isSafeInteger(data.evidenceCount)||data.evidenceCount<0)
          throw Error('脚質別の研究ラベルまたは件数が不正です。');
      }
      if(!Array.isArray(card.coarseDirection.styles)||
         card.coarseDirection.styles.some(x=>!STYLES.includes(x))||
         card.sourceHints.length>400)
        throw Error('脚質候補やスキル行が不正です。');
      for(const skill of card.sourceHints){
        if(!skill||typeof skill.id!=='string'||
           typeof skill.name!=='string'||
           !skill.researchSignals||!Array.isArray(skill.sourceRouteTypes)||
           !['route-eligible-unconditional','route-conditional-only'].includes(skill.availability))
          throw Error('根拠スキルの内容が不正です。');
      }
    }
    return value;
  }
  function matches(card,{query='',style='all',filter='all'}={}){
    const q=String(query).trim().toLocaleLowerCase('ja');
    if(q&&!String(card.cardName+' '+card.cardId).toLocaleLowerCase('ja').includes(q))return false;
    if(style!=='all'&&!STYLES.includes(style))return false;
    const cells=style==='all'?STYLES.map(x=>card.styles[x]):[card.styles[style]];
    if(filter==='all')return true;
    if(filter==='direction')return card.coarseDirection.styles.length>0;
    if(filter==='ambiguous')return card.coarseDirection.styles.length===0;
    if(filter==='mixed')return cells.some(x=>x.label==='mixed');
    if(filter==='insufficient')return cells.some(x=>x.label==='unresolved');
    if(filter==='weak-only')return cells.some(x=>x.onlyBroadReference);
    return false;
  }
  function filterCards(report,options={}){
    return report.examples.filter(x=>matches(x,options));
  }
  function signalInfo(code){
    const entry=SIGNALS[code];
    return entry?{label:entry[0],kind:entry[1]}:
      {label:'根拠の分類未確認',kind:'unknown'};
  }
  function cardDirection(card){
    if(card.coarseDirection.status!==
       'non-dominated-evidence-candidates-not-card-score'||
       !card.coarseDirection.styles.length)return '単独の方向は判断保留';
    return '非劣位の候補：'+card.coarseDirection.styles.join('・');
  }
  function counts(card,style){
    const s=card.styles[style];
    return {positive:s.headlineFavorable??0,negative:s.headlineUnfavorable??0,
      conditional:s.conditionalFavorable??0,unknown:s.unknown??0};
  }
  return Object.freeze({STYLES,LABELS,validateReport,filterCards,matches,
    signalInfo,cardDirection,counts});
});
