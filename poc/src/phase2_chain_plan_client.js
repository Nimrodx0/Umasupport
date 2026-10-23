'use strict';
/* Choice-stage flags: an option without explicit terminal state unlocks
 * the next stage. Event appearance RNG is intentionally out of scope.
 * No stage-by-stage "arrived" inputs, no claims of actual skill ownership.
 */
(async()=>{
 const ready=document.getElementById('bootstrap');
 const tabs=document.getElementById('card-tabs');
 const mount=document.getElementById('selected-card');
 const selected=new Map();
 const effects={mood:'やる気',energy:'体力',max_energy:'最大体力',
  speed:'スピード',stamina:'スタミナ',power:'パワー',
  guts:'根性',wisdom:'賢さ',skill_points:'スキルPt',bond:'絆'};
 const node=(tag,label='',className='')=>{
  const el=document.createElement(tag);el.textContent=label;if(className)el.className=className;return el;
 };
 function validate(data){
  if(data?.schemaVersion!==1||
     data.dataKind!=='phase2-five-chain-ordinary-default-planning-preview'||
     data.previewOnly!==true||data.publicationApproved!==false||
     data.planUsesOrdinaryContinuationDefault!==true||
     data.enabledContinuationFlags!==17||
     data.flagSetUnlessTerminated!==true||
     data.explicitTerminalBranchesInSelectedEvidence!==0||
     data.sourceNarrativeOrChoiceProseIncluded!==false||
     data.manualStageArrivalRequired!==false||
     data.status!=='CHOICE_DEPENDENT_CHAIN_FLAGS'||
     !Array.isArray(data.cards)||data.cards.length!==5)
    throw Error('未承認・通常継続候補の検証フラグが不正');
  let evs=0,alts=0,hints=0,edges=0;
  for(const [i,c] of data.cards.entries()){
   if(c.cardId!==['30318','30319','30320','30321','30221'][i]||
      typeof c.name!=='string'||!c.name||
      !Array.isArray(c.events)||c.events.length!==3)
    throw Error('対象5枚のカードが不正');
   for(const [j,e] of c.events.entries()){
    evs++;alts+=e.alternatives?.length||0;
    if(e.id!=='usl:'+c.cardId+':chain:'+(j+1)||
       e.ordinal!==j+1||typeof e.title!=='string'||!e.title.trim()||
       ![0,2].includes(e.choiceCount)||
       !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(e.sourceUrl)||
       !Array.isArray(e.alternatives)||e.alternatives.length!==(e.choiceCount||1)||
       !Array.isArray(e.nextStageEdges)||
       e.nextStageEdges.length!==(j===2?0:e.alternatives.length))
     throw Error('段階の出典・選択・次段階条件が不正');
    for(const [k,alt] of e.alternatives.entries()){
     if(alt.id!=='option'+(k+1)||
        !Array.isArray(alt.effects)||!Array.isArray(alt.hints))
      throw Error('結果行の選択位置が不正');
     for(const item of alt.effects){
      if(!Array.isArray(item)||item.length!==2||
         !Object.hasOwn(effects,item[0])||!Number.isSafeInteger(item[1]))
       throw Error('報酬効果の数値が不正');
     }
     for(const hint of alt.hints){
      hints++;
      if(!Array.isArray(hint)||hint.length!==3||
         !/^skill:\d+$/.test(hint[0])||
         !Number.isInteger(hint[1])||hint[1]<1||
         typeof hint[2]!=='string'||!hint[2].trim()||
         /^スキルID\s*\d+/.test(hint[2])||/^\d+$/.test(hint[2]))
       throw Error('スキルの日本語表示名が不正');
     }
    }
    for(const [k,edge] of e.nextStageEdges.entries()){
     edges++;
     if(edge.choiceId!==e.alternatives[k].id||
        edge.nextStageId!==c.events[j+1].id||
        edge.continuation!=='ORDINARY_DEFAULT_NO_EXPLICIT_CUTOFF'||
        edge.setsNextStageFlag!==true||
        edge.terminal!==false||
        edge.rule!=='NO_EXPLICIT_CHAIN_END')
      throw Error('通常継続のフラグ判定が不正');
    }
   }
  }
  if(evs!==15||alts!==22||hints!==9||edges!==17)
   throw Error('15段階・22結果・9スキルヒント・17通常継続候補が不一致');
 }
 function path(card){
  let eligible=true;
  const choiceSettings={};
  const row=card.events.map((e,i)=>{
   const visible=eligible;
   const choice=e.choiceCount===0?'option1':selected.get(e.id);
   const selectedIsValid=e.alternatives.some(a=>a.id===choice);
   const resolved=visible&&selectedIsValid;
   if(resolved&&e.choiceCount>0)choiceSettings[e.id]=choice;
   const edge=i<2&&resolved?e.nextStageEdges.find(x=>x.choiceId===choice):null;
   eligible=!!edge&&edge.setsNextStageFlag===true&&edge.terminal===false;
   return {event:e,eligible:visible,resolved,choice};
  });
  // Use the production core's event prerequisites for flag propagation.
  // The complete chain is present; its stage 2 and 3 rewards are blocked by
  // the previous stage until the previous player's choice is selected.
  const runtimeEvents=row.map((r,index)=>{
   const e=r.event;const reward=a=>a.hints.map(h=>({skillId:h[0],level:h[1]}));
   const previous=index===0?{}:{
    requires:{all:[{eventId:row[index-1].event.id}]}
   };
   if(e.choiceCount===0)return {
    id:e.id,name:e.title,type:'auto',...previous,
    rewards:reward(e.alternatives[0])};
   return {id:e.id,name:e.title,type:'choice',...previous,
    choices:e.alternatives.map((a,k)=>({
     id:a.id,label:k===0?'上の選択肢':'下の選択肢',rewards:reward(a)
    }))
   };
  });
  const routes=window.UmaCore.directRoutes({
   id:card.cardId,hints:[],events:runtimeEvents
  },{stage:4,choices:choiceSettings,outcomes:{}})
   .filter(r=>r.source==='event');
  return {row,routes};
 }
 function chips(parent,alt){
  const container=node('span','','effects');
  for(const [kind,n] of alt.effects)
   container.append(node('span',effects[kind]+(n>=0?'+':'')+n,'effect'));
  for(const h of alt.hints)
   container.append(node('span',h[2]+' ヒントLv'+h[1],'effect skill'));
  parent.append(container);
 }
 function render(card){
  mount.replaceChildren();
  const {row,routes}=path(card);
  const banner=node('div','','card-header');
  banner.append(node('h2',card.name),
   node('p','現在の獲得可能スキル '+routes.length+'経路'));
  mount.append(banner);
  const reset=node('button','このカードの選択を解除','reset');
  reset.type='button';reset.addEventListener('click',()=>{
   for(const e of card.events)selected.delete(e.id);
   render(card);
  });
  mount.append(reset);
  mount.append(node('p','上から選択肢を指定してください。打ち切りのない選択肢では次段階のフラグが立ちます。','subnote'));
  const grid=node('div','','events');
  for(const info of row){
   const e=info.event;
   const article=node('article','','event');
   article.dataset.event=String(e.ordinal);
   article.dataset.eligible=String(info.eligible);
   article.dataset.resolved=String(info.resolved);
   article.append(node('h3',e.title),node('p','連続イベント 第'+e.ordinal+'段階','stage'));
   article.append(node('p',!info.eligible?'前段の選択を指定すると候補が開きます':
    e.choiceCount===0?'選択肢なし：次段階へ継続':
    info.resolved?'選択位置を指定済み':'選択位置を指定してください','state'));
   const list=node('div','','choices');
   if(e.choiceCount===0){
    const zero=node('div','出典に記載された選択肢なしの結果','choice');
    chips(zero,e.alternatives[0]);list.append(zero);
   }else{
    const none=node('button','選択を解除','choice');none.type='button';
    none.dataset.choice='';none.disabled=!info.eligible;
    none.setAttribute('aria-pressed',String(info.eligible&&!info.resolved));
    none.addEventListener('click',()=>{selected.delete(e.id);render(card)});
    list.append(none);
    for(const [k,alt] of e.alternatives.entries()){
     const button=node('button','','choice');
     button.type='button';button.dataset.choice=alt.id;
     button.disabled=!info.eligible;
     button.setAttribute('aria-pressed',String(info.eligible&&info.choice===alt.id));
     button.append(node('span',k===0?'上の選択肢':'下の選択肢','choice-title'));
     chips(button,alt);
     button.addEventListener('click',()=>{
      selected.set(e.id,alt.id);
      // A changed predecessor invalidates descendant selections.
      for(const next of card.events.slice(e.ordinal))selected.delete(next.id);
      render(card);
     });
     list.append(button);
    }
   }
   article.append(list);
   const selectedRoutes=routes.filter(r=>r.eventId===e.id);
   const output=node('output','','result');
   output.dataset.hintCount=String(selectedRoutes.length);
   if(!info.eligible)output.textContent='前段のフラグが立っていません';
   else if(!info.resolved)output.textContent='選択肢を決めると、この段階の報酬候補を計算します';
   else if(!selectedRoutes.length)output.textContent='この段階・選択肢のスキルヒント記載はありません';
   else{
    const matched=e.alternatives.find(a=>a.id===info.choice);
    const labels=selectedRoutes.map(r=>{
     const h=matched.hints.find(h=>h[0]===r.skillId&&h[1]===r.level);
     if(!h)throw Error('スキルの数値ID/日本語名が一致しません');
     return h[2]+' ヒントLv'+r.level;
    });
    output.append(node('b','獲得可能スキル：'),document.createTextNode(labels.join(' / ')));
   }
   article.append(output);
   const src=node('a','出典記事を確認する ↗','source');
   src.href=e.sourceUrl;src.target='_blank';src.rel='noopener noreferrer';
   article.append(src);
   grid.append(article);
  }
  mount.append(grid);
  for(const tab of tabs.querySelectorAll('button[data-card-id]'))
   tab.setAttribute('aria-selected',String(tab.dataset.cardId===card.cardId));
 }
 try{
  if(typeof window.UmaCore?.directRoutes!=='function')
   throw Error('本番スキル集計エンジンを読み込めません');
  const response=await fetch('./preview/phase2-chain-plan.v1.json',{cache:'no-store'});
  if(!response.ok)throw Error('計画用JSONのHTTP '+response.status);
  const data=await response.json();
  validate(data);
  data.cards.forEach(card=>{
   const tab=node('button',card.name,'tab');tab.type='button';
   tab.dataset.cardId=card.cardId;tab.setAttribute('aria-selected','false');
   tab.addEventListener('click',()=>render(card));tabs.append(tab);
  });
  ready.textContent='5枚・15段階・通常継続フラグ17件を適用しています。';
  render(data.cards[0]);document.documentElement.dataset.ready='true';
 }catch(err){
  ready.textContent='連続イベント計画を表示できません：'+String(err.message||err);
  ready.classList.add('error');document.documentElement.dataset.ready='error';
 }
})();
