'use strict';
(async function(){
 const app=document.querySelector('#review-root');
 const state=new Map();
 const KEYS=Object.freeze({mood:'やる気',energy:'体力',
  max_energy:'最大体力',speed:'スピード',stamina:'スタミナ',
  power:'パワー',guts:'根性',wisdom:'賢さ',skill_points:'スキルPt',
  bond:'絆'});
 const el=(tag,text='',cls='')=>{
  const e=document.createElement(tag);e.textContent=text;
  if(cls)e.className=cls;
  return e;
 };
 try{
  const resp=await fetch('/data.json',{cache:'no-store'});
  if(!resp.ok)throw Error('HTTP '+resp.status);
  const data=await resp.json();
  if(!data.nonpublic||data.summary.events!==8||data.summary.approvedEvents!==0||
     typeof window.UmaCore?.directRoutes!=='function')throw Error('非公開プレビューの入力不正');
  const cards=data.cards;
  function refreshOutput(card,ev,panel){
   const chosen=state.get(ev.id)||null;
   const pseudo={
    id:ev.id,name:ev.eventTitle,
    type:'choice',
    choices:ev.choices.map(ch=>({id:ch.id,label:'選択'+ch.ordinal,
     rewards:ch.hints.map(x=>({skillId:x.skillId,level:x.level}))}))
   };
   const current=chosen?{[ev.id]:chosen}:{};
   const routes=window.UmaCore.directRoutes(
    {id:card.cardId,hints:[],events:[pseudo]},
    {stage:4,choices:current,outcomes:{}})
    .filter(x=>x.source==='event');
   panel.textContent=chosen?(routes.length?
    'スキル候補: '+routes.map(x=>{
     const ref=ev.choices.flatMap(c=>c.hints)
       .find(h=>h.skillId===x.skillId);
     return (ref?.displayName||x.skillId)+' ヒントLv'+x.level;
    }).join('、'):
    'この選択位置のスキルヒント候補は記載なし'):
    '未選択：イベントのスキル候補は集計しません';
   panel.dataset.hintCount=String(routes.length);
   for(const button of panel.parentElement.querySelectorAll('button[data-choice]')){
    button.setAttribute('aria-pressed',
     String(button.dataset.choice===(chosen||'')));
   }
  }
  for(const card of cards){
   const group=el('section','', 'card');group.dataset.cardId=card.cardId;
   group.append(el('h2',card.displayName+'（ID '+card.cardId+'）'));
   for(const ev of card.events){
    const block=el('article','', 'event');block.dataset.event=String(ev.editorialOrdinal);
    block.append(el('h3','通常'+(ev.editorialOrdinal-3)+'：'+ev.eventTitle));
    block.append(el('p','GameWith掲載のイベント名。選択肢は出典採用済みの数値効果による表示です。','sub'));
    const options=el('div','', 'option-list');
    const clear=el('button','未選択', 'unselect');
    clear.type='button';clear.dataset.choice='';
    clear.addEventListener('click',()=>{state.delete(ev.id);refreshOutput(card,ev,output);});
    options.append(clear);
    for(const choice of ev.choices){
     const fx=choice.effects.map(x=>(KEYS[x.kind]||x.kind)+(x.value>=0?'+':'')+x.value);
     const hint=choice.hints.map(h=>h.displayName+'Lv'+h.level);
     const button=el('button','位置'+choice.ordinal+' | '+[...fx,...hint].join(' / '));
     button.type='button';button.dataset.choice=choice.id;
     button.addEventListener('click',()=>{
      state.set(ev.id,choice.id);refreshOutput(card,ev,output);
     });
     options.append(button);
    }
    block.append(options);
    const output=el('output','', 'route-result');
    output.dataset.hintCount='0';block.append(output);
    const src=el('a','GameWith記事で照合');
    src.href=ev.sourceUrl;src.target='_blank';src.rel='noopener noreferrer';
    block.append(src);
    group.append(block);refreshOutput(card,ev,output);
   }
   app.append(group);
  }
  document.querySelector('#bootstrap').textContent=
   '4カード・通常8イベント・16選択位置を非公開で検証中（承認済み0）';
  document.documentElement.dataset.ready='true';
 }catch(error){
  document.querySelector('#bootstrap').textContent=
   '非公開レビューを表示できません: '+String(error);
  document.documentElement.dataset.ready='error';
 }
})();
