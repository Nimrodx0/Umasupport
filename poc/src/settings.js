/* Strict current settings with validated v1/v2 migration and owned card registry. */
(function(g){
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const KEYS=['main','inherit'];
const MAX_DECKS=50;
const MAX_GOAL_SETS=100;
const MAX_NAME_LENGTH=60;

function activeDeck(s,key){
 if(!KEYS.includes(key)||!obj(s)||!obj(s.decks)||!obj(s.activeDecks)||!Array.isArray(s.decks[key]))throw new Error('デッキ選択の状態が不正です');
 const found=s.decks[key].find(d=>d.id===s.activeDecks[key]);
 if(!found)throw new Error('選択中のデッキが見つかりません');
 return found;
}
function migrateV1(s){
 if(!obj(s.decks)||!obj(s.decks.main)||!obj(s.decks.inherit))throw new Error('旧デッキの形式が不正です');
 return {...s,version:2,decks:{
  main:[{...s.decks.main,id:'main-default'}],
  inherit:[{...s.decks.inherit,id:'inherit-default'}]
 },activeDecks:{main:'main-default',inherit:'inherit-default'},nextDeckId:1};
}
function parse(raw,data){
 let s=typeof raw==='string'?JSON.parse(raw):raw;
 if(!obj(s)||![1,2,3].includes(s.version)||!obj(s.decks)||!Array.isArray(s.goalSets)||!s.goalSets.length||s.goalSets.length>MAX_GOAL_SETS)
  throw new Error('設定データの構造またはバージョンに対応していません');
 if(!obj(data)||!obj(data.cardById)||!obj(data.skillById))
  throw new Error('参照データが不正です');
 if(s.version===1)s=migrateV1(s);
 if(s.version===2)s={...s,version:3,ownedCards:{}};
 if(!obj(s.ownedCards))throw new Error('所持サポカ情報の構造が不正です');
 for(const [cid,rec] of Object.entries(s.ownedCards)){
  if(!own(data.cardById,cid)||!obj(rec)||
     !['owned','unowned'].includes(rec.status)||
     (rec.status==='owned'
      ? !Number.isInteger(rec.stage)||rec.stage<0||rec.stage>4||Object.keys(rec).some(k=>!['status','stage'].includes(k))
      : own(rec,'stage')||Object.keys(rec).some(k=>k!=='status')))
   throw new Error('所持サポカのID・状態・凸段階が不正です: '+cid);
 }
 if(!obj(s.activeDecks)||!Number.isSafeInteger(s.nextDeckId)||s.nextDeckId<1)
  throw new Error('デッキの管理情報が不正です');
 const ids=new Set();
 for(const k of KEYS){
  const lib=s.decks[k];
  if(!Array.isArray(lib)||!lib.length||lib.length>MAX_DECKS)
   throw new Error('デッキの保存数が不正です');
  for(const d of lib){
   if(!obj(d)||typeof d.id!=='string'||!d.id.trim()||d.id.length>80||ids.has(d.id)||
     typeof d.name!=='string'||!d.name.trim()||d.name.length>MAX_NAME_LENGTH||
     !Array.isArray(d.slots)||d.slots.length!==6)
     throw new Error('デッキの構造・ID・名前が不正です');
   ids.add(d.id);
   for(const slot of d.slots){
    if(!obj(slot)||!(slot.cardId===null||typeof slot.cardId==='string')||
      !Number.isInteger(slot.stage)||slot.stage<0||slot.stage>4||!obj(slot.choices)||
      Object.values(slot.choices).some(x=>typeof x!=='string'))
      throw new Error('デッキのスロットが不正です');
    if(slot.cardId!==null&&!own(data.cardById,slot.cardId))
      throw new Error('現行データに存在しないサポカID: '+slot.cardId);
   }
  }
  activeDeck(s,k);
 }
 const goalIds=new Set();
 for(const gs of s.goalSets){
  if(!obj(gs)||typeof gs.id!=='string'||!gs.id.trim()||goalIds.has(gs.id)||
    typeof gs.name!=='string'||!gs.name.trim()||gs.name.length>MAX_NAME_LENGTH||!Array.isArray(gs.goals))
    throw new Error('目標セットの構造が不正です');
  goalIds.add(gs.id);
  for(const goal of gs.goals){
   if(!obj(goal)||typeof goal.skillId!=='string'||!['main','inherit','both','either'].includes(goal.scope))
    throw new Error('目標スキルが不正です');
   if(!own(data.skillById,goal.skillId))throw new Error('現行データに存在しないスキルID: '+goal.skillId);
  }
 }
 if(typeof s.currentGoalSet!=='string'||!goalIds.has(s.currentGoalSet))
  throw new Error('選択中の目標セットが見つかりません');
 if(!['integrated','split'].includes(s.view)||!['compact','detailed'].includes(s.density))
  throw new Error('表示設定が不正です');
 return s;
}
function ownedStatus(s,cardId){
 const rec=s.ownedCards[cardId];
 return rec ? rec.status : 'unregistered';
}
function setOwnedCard(s,data,cardId,status,stage=0){
 if(!obj(s)||!obj(s.ownedCards)||!obj(data)||!obj(data.cardById)||
    typeof cardId!=='string'||!own(data.cardById,cardId)||
    !['owned','unowned','unregistered'].includes(status))
   throw new Error('所持サポカのID・状態が不正です');
 if(status==='owned'&&(!Number.isInteger(stage)||stage<0||stage>4))
   throw new Error('所持サポカの凸段階が不正です');
 if(status==='unregistered'){delete s.ownedCards[cardId];return;}
 s.ownedCards[cardId]=status==='owned'?{status,stage}:{status};
}
function setOwnedBulk(s,data,cardIds,status){
 if(!Array.isArray(cardIds)||new Set(cardIds).size!==cardIds.length||
    cardIds.some(id=>typeof id!=='string'||!own(data.cardById,id)))
   throw new Error('一括操作のカードIDが不正です');
 if(!['owned','unowned','unregistered'].includes(status))
   throw new Error('一括操作の所持状態が不正です');
 for(const cid of cardIds){
  const old=s.ownedCards[cid];
  setOwnedCard(s,data,cid,status,status==='owned'&&old?.status==='owned'?old.stage:0);
 }
 return cardIds.length;
}
function selectDeck(s,key,id){
 if(!KEYS.includes(key)||!s.decks[key].some(d=>d.id===id))throw new Error('切り替えるデッキが見つかりません');
 s.activeDecks[key]=id;
 return activeDeck(s,key);
}
function addDeck(s,key,copy=false){
 if(!KEYS.includes(key)||!Array.isArray(s.decks[key]))throw new Error('デッキ種別が不正です');
 if(s.decks[key].length>=MAX_DECKS)throw new Error('デッキは各種類50件までです');
 if(!Number.isSafeInteger(s.nextDeckId)||s.nextDeckId<1)throw new Error('デッキ管理番号が不正です');
 const current=activeDeck(s,key);
 const baseName=copy?current.name+'（複製）':(key==='main'?'新しい本育成デッキ':'新しい継承育成デッキ');
 const allIds=new Set([...s.decks.main,...s.decks.inherit].map(d=>d.id));
 let id;
 do {
  id='deck-'+s.nextDeckId++;
  if(!Number.isSafeInteger(s.nextDeckId))throw new Error('デッキ管理番号の上限に達しました');
 }while(allIds.has(id));
 const slots=copy?JSON.parse(JSON.stringify(current.slots)):
  Array.from({length:6},()=>({cardId:null,stage:4,choices:{}}));
 const created={id,name:baseName.slice(0,MAX_NAME_LENGTH),slots};
 s.decks[key].push(created);s.activeDecks[key]=id;
 return created;
}
function renameDeck(s,key,name){
 if(typeof name!=='string'||!name.trim()||name.trim().length>MAX_NAME_LENGTH)
  throw new Error('デッキ名は1～60文字で入力してください');
 const d=activeDeck(s,key);d.name=name.trim();return d;
}
function deleteDeck(s,key){
 if(!KEYS.includes(key)||s.decks[key].length<=1)throw new Error('最後のデッキは削除できません');
 const id=s.activeDecks[key],index=s.decks[key].findIndex(d=>d.id===id);
 if(index<0)throw new Error('選択中のデッキが見つかりません');
 s.decks[key].splice(index,1);s.activeDecks[key]=s.decks[key][Math.max(0,index-1)].id;
 return activeDeck(s,key);
}
function uniqueGoalId(existing){
 const ids=new Set(existing.map(g=>g.id));
 let seq=1,id;
 do {id='goals-'+seq++;} while(ids.has(id));
 return id;
}
function addGoalSet(s,copy=false){
 if(!obj(s)||!Array.isArray(s.goalSets)||s.goalSets.length>=MAX_GOAL_SETS)
  throw new Error('目標セットは100件までです');
 const current=s.goalSets.find(g=>g.id===s.currentGoalSet);
 if(!current)throw new Error('選択中の目標セットが見つかりません');
 const next={id:uniqueGoalId(s.goalSets),name:(copy?current.name+'（複製）':'新しい目標セット').slice(0,MAX_NAME_LENGTH),
  goals:copy?JSON.parse(JSON.stringify(current.goals)):[]};
 s.goalSets.push(next);s.currentGoalSet=next.id;return next;
}
function renameGoalSet(s,name){
 if(typeof name!=='string'||!name.trim()||name.trim().length>MAX_NAME_LENGTH)
  throw new Error('目標セット名は1～60文字で入力してください');
 const current=s.goalSets.find(g=>g.id===s.currentGoalSet);
 if(!current)throw new Error('選択中の目標セットが見つかりません');
 current.name=name.trim();return current;
}
function deleteGoalSet(s){
 if(!Array.isArray(s.goalSets)||s.goalSets.length<=1)throw new Error('最後の目標セットは削除できません');
 const index=s.goalSets.findIndex(g=>g.id===s.currentGoalSet);
 if(index<0)throw new Error('選択中の目標セットが見つかりません');
 s.goalSets.splice(index,1);
 s.currentGoalSet=s.goalSets[Math.max(0,index-1)].id;
 return s.goalSets.find(g=>g.id===s.currentGoalSet);
}
function merge(currentRaw,importedRaw,data){
 // Parsed clones only: failure cannot partially modify in-memory state or localStorage.
 const current=parse(JSON.parse(JSON.stringify(currentRaw)),data);
 const incoming=parse(JSON.parse(JSON.stringify(importedRaw)),data);
 const next=JSON.parse(JSON.stringify(current));
 for(const k of KEYS){
  if(next.decks[k].length+incoming.decks[k].length>MAX_DECKS)
   throw new Error(k+'のデッキ数が50件を超えるため統合できません');
 }
 if(next.goalSets.length+incoming.goalSets.length>MAX_GOAL_SETS)
  throw new Error('目標セットが100件を超えるため統合できません');
 const existingIds=new Set([...next.decks.main,...next.decks.inherit].map(d=>d.id));
 let nextId=next.nextDeckId,deckCount=0;
 const genId=()=>{
  let id;
  do{
   if(!Number.isSafeInteger(nextId)||nextId<1)throw new Error('デッキIDの割当て上限です');
   id='deck-'+nextId++;
  }while(existingIds.has(id));
  existingIds.add(id);return id;
 };
 for(const k of KEYS){
  for(const imported of incoming.decks[k]){
   const added=JSON.parse(JSON.stringify(imported));
   added.id=genId();
   // Keep names visible; IDs isolate structurally independent settings.
   next.decks[k].push(added);deckCount++;
  }
 }
 next.nextDeckId=nextId;
 const goalsBefore=next.goalSets.length;
 for(const imported of incoming.goalSets){
  const added=JSON.parse(JSON.stringify(imported));
  added.id=uniqueGoalId(next.goalSets);
  next.goalSets.push(added);
 }
 let ownedAdded=0,ownedConflicts=0;
 for(const [cid,record] of Object.entries(incoming.ownedCards)){
  if(own(next.ownedCards,cid)){if(JSON.stringify(next.ownedCards[cid])!==JSON.stringify(record))ownedConflicts++;continue;}
  next.ownedCards[cid]=JSON.parse(JSON.stringify(record));ownedAdded++;
 }
 // Current selections, ownership conflicts, display preferences always win.
 const result=parse(next,data);
 return {settings:result,report:{
  decksAdded:deckCount,goalSetsAdded:next.goalSets.length-goalsBefore,
  ownershipAdded:ownedAdded,ownershipConflictsKept:ownedConflicts,
  activeSelectionsPreserved:true,displayPreferencesPreserved:true
 }};
}
const api={parse,activeDeck,selectDeck,addDeck,renameDeck,deleteDeck,addGoalSet,renameGoalSet,deleteGoalSet,merge,ownedStatus,setOwnedCard,setOwnedBulk,MAX_DECKS,MAX_GOAL_SETS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSettings=api;
})(typeof globalThis!=='undefined'?globalThis:this);
