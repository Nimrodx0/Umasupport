/* Validate settings against the current development data schema. No legacy ID migration. */
(function (g) {
  'use strict';
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function parse(raw,data) {
    const s=typeof raw==='string'?JSON.parse(raw):raw;
    if(!obj(s)||s.version!==1||!obj(s.decks)||!Array.isArray(s.goalSets)||s.goalSets.length===0)
      throw new Error('設定データの構造またはバージョンに対応していません');
    if(!obj(data)||!obj(data.cardById)||!obj(data.skillById))
      throw new Error('参照データが不正です');
    for(const k of ['main','inherit']) {
      const d=s.decks[k];
      if(!obj(d)||!Array.isArray(d.slots)||d.slots.length!==6||typeof d.name!=='string')
        throw new Error('デッキの構造が不正です');
      for(const slot of d.slots) {
        if(!obj(slot)||!(slot.cardId===null||typeof slot.cardId==='string')||!Number.isInteger(slot.stage)||slot.stage<0||slot.stage>4||!obj(slot.choices))
          throw new Error('デッキのスロットが不正です');
        if(slot.cardId!==null&&!own(data.cardById,slot.cardId))
          throw new Error('現行データに存在しないサポカID: '+slot.cardId);
      }
    }
    for(const gs of s.goalSets) {
      if(!obj(gs)||typeof gs.id!=='string'||typeof gs.name!=='string'||!Array.isArray(gs.goals))
        throw new Error('目標セットの構造が不正です');
      for(const goal of gs.goals) {
        if(!obj(goal)||typeof goal.skillId!=='string'||!['main','inherit','both','either'].includes(goal.scope))
          throw new Error('目標スキルが不正です');
        if(!own(data.skillById,goal.skillId))
          throw new Error('現行データに存在しないスキルID: '+goal.skillId);
      }
    }
    if(typeof s.currentGoalSet!=='string'||!s.goalSets.some(gs=>gs.id===s.currentGoalSet))
      throw new Error('選択中の目標セットが見つかりません');
    if(!['integrated','split'].includes(s.view)||!['compact','detailed'].includes(s.density))
      throw new Error('表示設定が不正です');
    return s;
  }
  const api={parse};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  g.UmaSettings=api;
})(typeof globalThis!=='undefined'?globalThis:this);
