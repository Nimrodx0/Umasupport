'use strict';
/* Independent manual-stage preview: NEVER infer a chain edge. A hint appears
 * only if this stage was explicitly confirmed and any choice was selected.
 * Core is the same evaluator as the real application; not the release path.
 */
(async function(){
 const ready=document.querySelector('#bootstrap');
 const tabs=document.querySelector('#card-tabs');
 const panel=document.querySelector('#selected-card');
 const observed=new Map(),selected=new Map();
 const names={mood:'やる気',energy:'体力',max_energy:'最大体力',
  speed:'スピード',stamina:'スタミナ',power:'パワー',
  guts:'根性',wisdom:'賢さ',skill_points:'スキルPt',bond:'絆'};
 const make=(tag,text='',className='')=>{
  const el=document.createElement(tag);el.textContent=text;
  if(className)el.className=className;
  return el;
 };
 function verify(data){
  if(data?.schemaVersion!==1||
     data.dataKind!=='phase2-twelve-manual-chain-stage-browser-review'||
     data.previewOnly!==true||data.formallyApproved!==false||
     data.gameplayReproductionClaimed!==false||
     data.sourceNarrativeOrChoiceProseIncluded!==false||
     data.inferredChainTransitions!==0||
     data.unresolvedPossibleTransitions!==17||
     data.explicitStageAssertionRequired!==true||
     !Array.isArray(data.cards)||data.cards.length!==5)
   throw Error('連続イベントの未承認・未確定条件が不正です');
  let stages=0,alts=0,hints=0,pending=0;
  for(const [i,card] of data.cards.entries()){
   if(card.cardId!==['30318','30319','30320','30321','30221'][i]||
      typeof card.name!=='string'||!card.name||
      !Array.isArray(card.events)||card.events.length!==3)
    throw Error('カードの3段階が不正');
   for(const [j,e] of card.events.entries()){
    stages++;
    if(e.id!=='usl:'+card.cardId+':chain:'+(j+1)||
       e.ordinal!==j+1||typeof e.title!=='string'||
       !e.title.trim()||e.title.length>80||
       e.manualReachedRequired!==true||
       e.priorStageDependenceVerified!==false||
       e.nextStageTransitionStatus!==(j<2?'UNKNOWN':'NOT_MODELED')||
       !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(e.sourceUrl)||
       ![0,2].includes(e.choiceCount)||
       !Array.isArray(e.alternatives)||
       e.alternatives.length!==(e.choiceCount||1))
     throw Error('段階の到達・選択数が不正');
    if(j<2)pending+=e.alternatives.length;
    for(const [k,option] of e.alternatives.entries()){
     alts++;
     if(option.id!=='option'+(k+1)||
        !Array.isArray(option.effects)||!Array.isArray(option.hints))
      throw Error('イベント内の結果行が不正');
     for(const item of option.effects){
      if(!Array.isArray(item)||item.length!==2||
         !Object.hasOwn(names,item[0])||!Number.isSafeInteger(item[1]))
       throw Error('数値効果が不正');
     }
     for(const hint of option.hints){
      hints++;
      if(!Array.isArray(hint)||hint.length!==3||
         !/^skill:\d+$/.test(hint[0])||
         !Number.isSafeInteger(hint[1])||hint[1]<1||
         typeof hint[2]!=='string'||!hint[2].trim()||
         /^スキルID\s*\d+/.test(hint[2])||/^\d+$/.test(hint[2]))
       throw Error('スキル数値事実が不正');
     }
    }
   }
  }
  if(stages!==15||alts!==22||hints!==9||pending!==17)
   throw Error('固定15段階・22結果行・9ヒント・17経路と不一致');
 }
 function runtimeEvents(card){
  return card.events.filter(e=>observed.get(e.id)===true).map(e=>{
   const base={id:e.id,name:'連続イベント第'+e.ordinal+'段階'};
   const makeRewards=a=>a.hints.map(h=>({skillId:h[0],level:h[1]}));
   if(e.choiceCount===0)return {...base,type:'auto',rewards:makeRewards(e.alternatives[0])};
   return {...base,type:'choice',
    choices:e.alternatives.map((alt,i)=>({
     id:alt.id,label:i===0?'上の選択肢':'下の選択肢',
     rewards:makeRewards(alt)
    }))};
  });
 }
 function calculate(card){
  const selections={};
  for(const ev of card.events)
   if(observed.get(ev.id)===true&&selected.has(ev.id))
    selections[ev.id]=selected.get(ev.id);
  return window.UmaCore.directRoutes({
   id:card.cardId,hints:[],events:runtimeEvents(card)
  },{stage:4,choices:selections,outcomes:{}})
   .filter(r=>r.source==='event');
 }
 function effects(container,alternative){
  const chips=make('span','','effects');
  for(const [kind,num] of alternative.effects)
   chips.append(make('span',names[kind]+(num>=0?'+':'')+num,'effect'));
  for(const [id,level,name] of alternative.hints)
   chips.append(make('span',name+' ヒントLv'+level,'effect skill'));
  container.append(chips);
 }
 function render(card){
  panel.replaceChildren();
  const routes=calculate(card);
  const heading=make('div','','card-header');
  heading.append(make('h2',card.name+' / ID '+card.cardId),
   make('p','手動到達 '+card.events.filter(x=>observed.get(x.id)===true).length+
    '段階・現在のヒント候補 '+routes.length+'経路'));
  panel.append(heading);
  const grid=make('div','','events');
  for(const ev of card.events){
   const section=make('article','','event');
   section.dataset.event=String(ev.ordinal);
   section.dataset.eventId=ev.id;
   const isObserved=observed.get(ev.id)===true;
   section.dataset.observed=String(isObserved);
   section.append(make('h3',ev.title));
   section.append(make('p','連続イベント・第'+ev.ordinal+'段階','hint'));
   section.append(make('p',ev.choiceCount===0?'選択肢なし：到達を手動指定':
    'プレイヤー選択肢2件：到達を手動指定','hint'));
   const arrive=make('button',isObserved?'到達した ✓ （解除する）':'この段階に到達した','arrived');
   arrive.type='button';arrive.dataset.stage=String(ev.ordinal);
   arrive.setAttribute('aria-pressed',String(isObserved));
   arrive.addEventListener('click',()=>{
    if(isObserved){observed.delete(ev.id);selected.delete(ev.id);}
    else observed.set(ev.id,true);
    render(card);
   });
   section.append(arrive);
   const choices=make('div','','choices');
   if(ev.choiceCount===0){
    const info=make('div','出典に記載された数値報酬','choice');
    effects(info,ev.alternatives[0]);
    choices.append(info);
   }else{
    const clear=make('button','選択しない','choice');
    clear.type='button';clear.dataset.choice='';
    clear.disabled=!isObserved;
    clear.setAttribute('aria-pressed',String(isObserved&&!selected.has(ev.id)));
    clear.addEventListener('click',()=>{selected.delete(ev.id);render(card);});
    choices.append(clear);
    for(const [index,a] of ev.alternatives.entries()){
     const option=make('button','','choice');
     option.type='button';option.dataset.choice=a.id;option.disabled=!isObserved;
     option.setAttribute('aria-pressed',String(isObserved&&selected.get(ev.id)===a.id));
     option.append(make('span',index===0?'上の選択肢':'下の選択肢','choice-title'));
     effects(option,a);
     option.addEventListener('click',()=>{selected.set(ev.id,a.id);render(card);});
     choices.append(option);
    }
   }
   section.append(choices);
   const eventRoutes=routes.filter(r=>r.eventId===ev.id);
   const output=make('output','','result');
   output.dataset.hintCount=String(eventRoutes.length);
   if(!isObserved)output.textContent='到達未指定：報酬は集計しません';
   else if(ev.choiceCount>0&&!selected.has(ev.id))
    output.textContent='到達済み。上・下の選択肢を指定してください';
   else if(eventRoutes.length===0)
    output.textContent='出典にこの段階・選択のスキルヒント記載はありません';
   else{
    const alt=ev.choiceCount===0?ev.alternatives[0]:
     ev.alternatives.find(x=>x.id===selected.get(ev.id));
    const result=eventRoutes.map(r=>{
     const h=alt.hints.find(h=>h[0]===r.skillId&&h[1]===r.level);
     if(!h)throw Error('スキル名称の照合に失敗しました');
     return h[2]+' ヒントLv'+r.level;
    });
    output.append(make('b','到達を指定した段階の候補：'),
     document.createTextNode(result.join(' / ')));
   }
   section.append(output);
   const warning=make('p','この画面は段階の独立検証用です。通常ルートでは打ち切りがない限り次段階のフラグON','warning');
   section.append(warning);
   const link=make('a','GameWith出典を見る ↗','source');
   link.href=ev.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
   section.append(link);
   grid.append(section);
  }
  panel.append(grid);
  for(const b of tabs.querySelectorAll('button[data-card-id]'))
   b.setAttribute('aria-selected',String(b.dataset.cardId===card.cardId));
 }
 try{
  if(typeof window.UmaCore?.directRoutes!=='function')
   throw Error('集計エンジンが見つかりません');
  const response=await fetch('./preview/phase2-chain-stages.v1.json',{cache:'no-store'});
  if(!response.ok)throw Error('静的試用データHTTP '+response.status);
  const data=await response.json();
  verify(data);
  for(const card of data.cards){
   const tab=make('button',card.name,'tab');
   tab.type='button';tab.dataset.cardId=card.cardId;
   tab.setAttribute('aria-selected','false');
   tab.addEventListener('click',()=>render(card));
   tabs.append(tab);
  }
  ready.textContent='5カード・連続15段階・結果行22・ヒント9件。段階別の検査用画面です。';
  render(data.cards[0]);
  document.documentElement.dataset.ready='true';
 }catch(error){
  ready.textContent='連続段階の試用ができません：'+String(error.message||error);
  ready.classList.add('error');
  document.documentElement.dataset.ready='error';
 }
})();
