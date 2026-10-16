/* User settings are kept separate from third-party game data. */
(function (g) {
  'use strict';
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function parse(raw,data) {
    const input=typeof raw==='string'?JSON.parse(raw):raw;
    if(!obj(input)||input.version!==1||!obj(input.decks)||!Array.isArray(input.goalSets)||input.goalSets.length===0)throw new Error('設定データの構造またはバージョンに対応していません');
    for(const k of ['main','inherit']) {
      const d=input.decks[k];
      if(!obj(d)||!Array.isArray(d.slots)||d.slots.length!==6||typeof d.name!=='string')throw new Error('デッキの構造が不正です');
      for(const sl of d.slots)if(!obj(sl)||!(sl.cardId===null||typeof sl.cardId==='string')||!Number.isInteger(sl.stage)||sl.stage<0||sl.stage>4||!obj(sl.choices))throw new Error('デッキのスロットが不正です');
    }
    for(const gs of input.goalSets) {
      if(!obj(gs)||typeof gs.id!=='string'||typeof gs.name!=='string'||!Array.isArray(gs.goals))throw new Error('目標セットの構造が不正です');
      for(const goal of gs.goals)if(!obj(goal)||typeof goal.skillId!=='string'||!['main','inherit','both','either'].includes(goal.scope))throw new Error('目標スキルが不正です');
    }
    if(typeof input.currentGoalSet!=='string'||!input.goalSets.some(gs=>gs.id===input.currentGoalSet))throw new Error('選択中の目標セットが見つかりません');
    if(!['integrated','split'].includes(input.view)||!['compact','detailed'].includes(input.density))throw new Error('表示設定が不正です');
    if(!obj(data)||!obj(data.cardById)||!obj(data.skillById))throw new Error('参照データが不正です');
    const state=JSON.parse(JSON.stringify(input));
    const cardAliases=data.meta?.aliasCardIds||{},skillAliases=data.meta?.aliasSkillIds||{};
    const missingCards=new Set(),missingSkills=new Set();
    const mapped=(id,known,aliases)=>{
      if(own(known,id))return id;
      const target=own(aliases,id)?aliases[id]:null;
      return typeof target==='string'&&own(known,target)?target:id;
    };
    for(const k of ['main','inherit'])for(const sl of state.decks[k].slots)if(sl.cardId) {
      sl.cardId=mapped(sl.cardId,data.cardById,cardAliases);
      if(!own(data.cardById,sl.cardId))missingCards.add(sl.cardId);
    }
    for(const gs of state.goalSets)for(const goal of gs.goals) {
      goal.skillId=mapped(goal.skillId,data.skillById,skillAliases);
      if(!own(data.skillById,goal.skillId))missingSkills.add(goal.skillId);
    }
    return {state,missing:{cards:[...missingCards].sort(),skills:[...missingSkills].sort()}};
  }
  const api={parse};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  g.UmaSettings=api;
})(typeof globalThis!=='undefined'?globalThis:this);
