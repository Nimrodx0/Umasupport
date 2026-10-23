'use strict';
/* GitHub Pages opt-in sample, not an event publication or review signature.
 * Uses the production core to calculate selected hint candidates.
 */
(async function(){
 const status=document.querySelector('#bootstrap');
 const tabs=document.querySelector('#card-tabs');
 const root=document.querySelector('#selected-card');
 const chosen=new Map();
 const EFFECT_NAMES={mood:'やる気',energy:'体力',max_energy:'最大体力',
  speed:'スピード',stamina:'スタミナ',power:'パワー',guts:'根性',
  wisdom:'賢さ',skill_points:'スキルPt',bond:'絆'};
 const make=(tag,content='',cls='')=>{
  const el=document.createElement(tag);el.textContent=content;
  if(cls)el.className=cls;
  return el;
 };
 function validate(data){
  if(!data||data.schemaVersion!==1||
     data.dataKind!=='phase2-eight-standalone-browser-preview'||
     data.previewOnly!==true||data.formallyApproved!==false||
     data.sourceNarrativeOrChoiceProseIncluded!==false||
     !Array.isArray(data.cards)||data.cards.length!==4)
    throw Error('開発用データの状態が不正です');
  let events=0,choiceCount=0,hintCount=0;
  for(const [i,card] of data.cards.entries()){
   if(card.cardId!==String(30318+i)||typeof card.name!=='string'||
      !Array.isArray(card.events)||card.events.length!==2)
    throw Error('カード一覧が想定と違います');
   for(const [j,ev] of card.events.entries()){
    if(ev.id!=='usl:'+card.cardId+':random:'+(j+4)||
       ev.ordinal!==j+4||typeof ev.title!=='string'||!ev.title||
       !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(ev.sourceUrl)||
       !Array.isArray(ev.choices)||ev.choices.length!==2)
     throw Error('イベントの対応が不正です');
    events++;
    for(const [k,c] of ev.choices.entries()){
     if(c.id!=='option'+(k+1)||!Array.isArray(c.effects)||!Array.isArray(c.hints))
      throw Error('選択位置の対応が不正です');
     for(const e of c.effects){
      if(!Array.isArray(e)||e.length!==2||!Object.hasOwn(EFFECT_NAMES,e[0])||
         !Number.isInteger(e[1]))throw Error('効果数値が不正です');
     }
     for(const h of c.hints){
      if(!Array.isArray(h)||h.length!==3||
         !/^skill:\d+$/.test(h[0])||!Number.isInteger(h[1])||h[1]<1||
         typeof h[2]!=='string'||!h[2])throw Error('ヒントが不正です');
      hintCount++;
     }
     choiceCount++;
    }
   }
  }
  if(events!==8||choiceCount!==16||hintCount!==4)throw Error('データ件数が一致しません');
 }
 function runtimeCard(card){
  return {id:card.cardId,hints:[],events:card.events.map(ev=>({
   id:ev.id,name:ev.title,type:'choice',choices:ev.choices.map((c,i)=>({
    id:c.id,label:i===0?'上の選択肢':'下の選択肢',
    rewards:c.hints.map(h=>({skillId:h[0],level:h[1]}))
   }))
  }))};
 }
 function currentRoutes(card){
  const selection={};
  for(const e of card.events)if(chosen.has(e.id))selection[e.id]=chosen.get(e.id);
  return window.UmaCore.directRoutes(runtimeCard(card),
   {stage:4,choices:selection,outcomes:{}}).filter(r=>r.source==='event');
 }
 function effectSummary(choice){
  const fx=choice.effects.map(([kind,n])=>EFFECT_NAMES[kind]+(n>=0?'+':'')+n);
  const hx=choice.hints.map(([id,lv,name])=>name+' ヒントLv'+lv);
  return [...fx,...hx];
 }
 function render(card){
  const routes=currentRoutes(card);
  root.replaceChildren();
  const heading=make('div','','card-header');
  const headTitle=make('h2',card.name+'  /  ID '+card.cardId);
  heading.append(headTitle,make('p','選択したイベントのスキル候補 '+routes.length+'件'));
  root.append(heading);
  const grid=make('div','','events');
  for(const [i,ev] of card.events.entries()){
   const article=make('article','','event');
   article.dataset.event=String(ev.ordinal);
   article.dataset.eventId=ev.id;
   article.append(make('h3',ev.title));
   article.append(make('p','通常イベント '+(i+1)+' ・ 選択肢2件','source-label'));
   const buttonList=make('div','','choices');
   const unset=make('button','選択しない','choice clear');
   unset.type='button';unset.dataset.choice='';
   unset.setAttribute('aria-pressed',String(!chosen.has(ev.id)));
   unset.addEventListener('click',()=>{chosen.delete(ev.id);render(card);});
   buttonList.append(unset);
   for(const [j,choice] of ev.choices.entries()){
    const btn=make('button','','choice');
    btn.type='button';btn.dataset.choice=choice.id;
    btn.setAttribute('aria-pressed',String(chosen.get(ev.id)===choice.id));
    btn.append(make('span',j===0?'上の選択肢':'下の選択肢','choice-title'));
    const chips=make('span','','effects');
    for(const [k,value] of choice.effects){
     chips.append(make('span',EFFECT_NAMES[k]+(value>=0?'+':'')+value,'effect'));
    }
    for(const [id,level,name] of choice.hints)
     chips.append(make('span',name+' ヒントLv'+level,'effect hint'));
    btn.append(chips);
    btn.addEventListener('click',()=>{chosen.set(ev.id,choice.id);render(card);});
    buttonList.append(btn);
   }
   article.append(buttonList);
   const selected=chosen.get(ev.id);
   const eventRoutes=routes.filter(r=>r.eventId===ev.id);
   const output=make('output','','result');
   output.dataset.hintCount=String(eventRoutes.length);
   if(!selected)output.textContent='未選択：このイベントからはスキル候補を計上しません';
   else if(!eventRoutes.length)
    output.textContent='この選択肢にはスキルヒントの記載がありません';
   else{
    const choice=ev.choices.find(c=>c.id===selected);
    const matched=eventRoutes.map(r=>{
     const item=choice.hints.find(h=>h[0]===r.skillId&&h[1]===r.level);
     return (item?item[2]:r.skillId)+' ヒントLv'+r.level;
    });
    output.append(make('b','スキル候補：'),document.createTextNode(matched.join(' / ')));
   }
   article.append(output);
   const link=make('a','出典記事で照合する ↗','source');
   link.href=ev.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
   article.append(link);
   grid.append(article);
  }
  root.append(grid);
  for(const button of tabs.querySelectorAll('button[data-card-id]')){
   button.setAttribute('aria-selected',String(button.dataset.cardId===card.cardId));
  }
 }
 try{
  if(typeof window.UmaCore?.directRoutes!=='function')
   throw Error('本番集計エンジンが読み込めません');
  const r=await fetch('./preview/phase2-eight-events.v1.json',{cache:'no-store'});
  if(!r.ok)throw Error('試用データのHTTP '+r.status);
  const data=await r.json();
  validate(data);
  data.cards.forEach(card=>{
   const tab=make('button',card.name,'tab');
   tab.type='button';tab.dataset.cardId=card.cardId;
   tab.setAttribute('aria-selected','false');
   tab.addEventListener('click',()=>render(card));
   tabs.append(tab);
  });
  status.textContent='4カード・通常8イベント・16選択位置・スキルヒント4件。開発用の試用データです。';
  render(data.cards[0]);
  document.documentElement.dataset.ready='true';
 }catch(e){
  status.textContent='試用画面を表示できません：'+String(e.message||e);
  status.classList.add('error');
  document.documentElement.dataset.ready='error';
 }
})();
