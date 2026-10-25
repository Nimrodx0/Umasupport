(function(g){
'use strict';
// 副作用のない集計層。テストとUIから同じ関数を呼ぶ。
function prerequisites(event){
  if(!event.requires)return [];
  const r=event.requires;
  return Array.isArray(r.all)?r.all:[r];
}
// A result that has not been chosen is a possible branch, NOT a guaranteed one.
// Return one of reachable, conditional, blocked, with the unresolved assumptions.
function reachability(event,choices,events,outcomes={},visiting=new Set()){
  if(!event||visiting.has(event.id))return {status:'blocked',conditions:[]};
  const next=new Set(visiting);next.add(event.id);
  const conditions=[];
  // Support friend/special/outing events require contextual activation, not
  // an invented player option. The planner must keep their skill rewards
  // conditional even when no earlier support-chain stage is required.
  const availabilityLabels={
    'special-trigger':'特殊イベントの発生時',
    'outing-sequence':'お出かけイベントの発生時',
    'outing-random':'お出かけ中のランダムイベント発生時',
    'scenario-overseas':'海外遠征中の該当イベントが発生した場合'
  };
  if(event.availabilityKind!==undefined){
    if(!Object.prototype.hasOwnProperty.call(availabilityLabels,event.availabilityKind))
      return {status:'blocked',conditions:[]};
    conditions.push(availabilityLabels[event.availabilityKind]);
  }
  const constraints=new Map();
  for(const r of prerequisites(event)){
    // Protect direct callers that bypass schema.validateEvents: an AND
    // requiring contradictory outcomes can never be merely "conditional".
    if(r&&typeof r.eventId==='string'){
      const prev=constraints.get(r.eventId);
      if(prev&&
        (prev.choiceId!==undefined&&r.choiceId!==undefined&&prev.choiceId!==r.choiceId||
         prev.outcomeId!==undefined&&r.outcomeId!==undefined&&prev.outcomeId!==r.outcomeId))
        return {status:'blocked',conditions:[]};
      if(prev){
        if(prev.choiceId===undefined)prev.choiceId=r.choiceId;
        if(prev.outcomeId===undefined)prev.outcomeId=r.outcomeId;
      }else constraints.set(r.eventId,{choiceId:r.choiceId,outcomeId:r.outcomeId});
    }
    if(!r||typeof r.eventId!=='string'||!events)return {status:'blocked',conditions:[]};
    const parent=events.find(x=>x.id===r.eventId);
    const prev=reachability(parent,choices,events,outcomes,next);
    if(prev.status==='blocked')return prev;
    conditions.push(...prev.conditions);
    let part=parent;
    if(parent.type==='choice'){
      part=(parent.choices||[]).find(c=>c.id===choices[parent.id]);
      if(!part||part.terminal===true||r.choiceId!==undefined&&r.choiceId!==part.id)
        return {status:'blocked',conditions:[]};
    }else if(parent.type!=='auto'||r.choiceId!==undefined){
      return {status:'blocked',conditions:[]};
    }
    if(parent.type==='choice'&&part.requires){
      const gate=reachability({id:parent.id+'#'+part.id,requires:part.requires},choices,events,outcomes,next);
      if(gate.status==='blocked')return gate;
      conditions.push(...gate.conditions);
    }
    const variants=part.outcomes||[];
    const chosen=outcomes[parent.id];
    if(chosen!==undefined&&chosen!==''&&!variants.some(o=>o.id===chosen))
      return {status:'blocked',conditions:[]};
    // A recorded outcome can be impossible after earlier selections.
    if(chosen){
      const selected=variants.find(o=>o.id===chosen);
      if(!selected)return {status:'blocked',conditions:[]};
      const selectedGate=outcomeReachability(selected,parent,choices,events,outcomes);
      if(selectedGate.status==='blocked')return selectedGate;
      conditions.push(...selectedGate.conditions);
    }
    if(r.outcomeId!==undefined){
      const target=variants.find(o=>o.id===r.outcomeId);
      if(!target||target.terminal===true||chosen&&chosen!==target.id)
        return {status:'blocked',conditions:[]};
      if(!chosen)conditions.push(parent.name+'・'+target.label+'時');
    }else if(variants.length){
      if(chosen){
        if(variants.find(o=>o.id===chosen).terminal===true)
          return {status:'blocked',conditions:[]};
      }else{
        if(variants.every(o=>o.terminal===true))
          return {status:'blocked',conditions:[]};
        if(variants.some(o=>o.terminal===true))
          conditions.push(parent.name+'・継続する結果の場合');
      }
    }
  }
  return {status:conditions.length?'conditional':'reachable',conditions:[...new Set(conditions)]};
}
// Restrict an outcome by a disjunction of conjunctions on earlier events.
// An unresolved parent can make a reward conditional, never guaranteed.
function outcomeReachability(outcome,event,choices,events,outcomes={}){
  const base=reachability(event,choices,events,outcomes);
  if(base.status==='blocked'||!outcome)return {status:'blocked',conditions:[]};
  if(!outcome.requires)return base;
  const clauses=outcome.requires.any||[];
  if(!clauses.length)return {status:'blocked',conditions:[]};
  let possible=[];
  for(let i=0;i<clauses.length;i++){
    const gate=reachability({id:event.id+'#outcome#'+outcome.id+'#'+i,
      requires:{all:clauses[i].all||[]}},choices,events,outcomes);
    if(gate.status==='reachable')return base;
    if(gate.status==='conditional')possible.push(gate.conditions);
  }
  if(!possible.length)return {status:'blocked',conditions:[]};
  return {status:'conditional',conditions:[...new Set([...base.conditions,
    '前段イベントの結果の組合せによる条件'])]};
}
function choiceReachability(choice,event,choices,events,outcomes={}){
  const base=reachability(event,choices,events,outcomes);
  if(base.status==='blocked'||!choice)return {status:'blocked',conditions:[]};
  if(!choice.requires)return base;
  const gate=reachability({id:event.id+'#'+choice.id,requires:choice.requires},choices,events,outcomes);
  if(gate.status==='blocked')return gate;
  const conditions=[...new Set([...base.conditions,...gate.conditions])];
  return {status:conditions.length?'conditional':'reachable',conditions};
}
function isReachable(event,choices,events,outcomes={}){
  if(!events){
    // Backwards compatibility for old callers that supply just a choice map.
    return prerequisites(event).every(r=>typeof r.choiceId==='string'&&choices[r.eventId]===r.choiceId);
  }
  return reachability(event,choices,events,outcomes).status==='reachable';
}
function directRoutes(card,config){
  const choices=(config&&config.choices)||{},outcomes=(config&&config.outcomes)||{},routes=[];
  const hintList=(card.hintsByStage&&Object.prototype.hasOwnProperty.call(card.hintsByStage,String(config?.stage??4)))
    ?card.hintsByStage[String(config.stage)]:card.hints||[];
  const perf=card.hintPerformanceByStage?.[String(config?.stage??4)];
  const validHintLevel=perf&&Number.isSafeInteger(perf.levelBase)&&Number.isSafeInteger(perf.levelUnique)&&
    perf.levelBase>=0&&perf.levelUnique>=0;
  const hintLevel=validHintLevel?1+perf.levelBase+perf.levelUnique:null;
  for(const id of hintList)routes.push({skillId:id,source:'hint',eventId:null,eventName:'通常ヒント',level:hintLevel,conditional:false,condition:null});
  const events=card.events||[];
  function add(rewards,event,choiceLabel,outcome,priorConditions=[]){
    for(const r of rewards||[]){
      // A minus skill is an adverse effect, never a skill provider.
      if(r.kind==='negative')continue;
      const condition=[...priorConditions,outcome,r.condition].filter(Boolean).join(' / ')||null;
      routes.push({skillId:r.skillId,source:'event',eventId:event.id,eventName:event.name,
        ...(choiceLabel?{choiceLabel}:{}),kind:r.kind==='obtained'?'obtained':'hint',
        level:r.kind==='obtained'?null:r.level??null,conditional:!!condition,condition});
    }
  }
  function collect(part,event,choiceLabel,conditions){
    const variants=part.outcomes||[];
    if(variants.length){
      const chosen=outcomes[event.id];
      if(chosen&& !variants.some(o=>o.id===chosen))return;
      for(const outcome of variants){
        if(chosen&&chosen!==outcome.id)continue;
        const gate=outcomeReachability(outcome,event,choices,events,outcomes);
        if(gate.status==='blocked')continue;
        add(outcome.rewards,event,choiceLabel,(outcome.label||outcome.id)+'時',
          [...conditions,...gate.conditions]);
      }
    }else add(part.rewards,event,choiceLabel,null,conditions);
  }
  for(const event of events){
    const progress=reachability(event,choices,events,outcomes);
    if(progress.status==='blocked')continue;
    if(event.type==='choice'){
      const selected=(event.choices||[]).find(c=>c.id===choices[event.id]);
      if(selected){
        const gate=choiceReachability(selected,event,choices,events,outcomes);
        if(gate.status!=='blocked')collect(selected,event,selected.label,gate.conditions);
      }
    }else if(event.type==='auto')collect(event,event,null,progress.conditions);
  }
  return routes;
}
// Non-skill effects are separate from directRoutes/aggregate/skill coverage.
 // Each row is an outcome-specific CONDITIONAL candidate until its selection
 // and contextual availability are established. Do not infer probabilities.
function directEffectRoutes(card,config={}){
  const choices=config.choices||{},outcomes=config.outcomes||{};
  const events=card.events||[],routes=[];
  function add(effects,event,choice,outcome,conditions){
    for(const effect of effects||[]){
      routes.push({source:'event-effect',cardId:card.id,eventId:event.id,
        eventName:event.name,
        ...(choice?{choiceId:choice.id,choiceLabel:choice.label}:{}),
        ...(outcome?{outcomeId:outcome.id,outcomeLabel:outcome.label}:{}),
        effectKind:effect.kind,delta:effect.delta,
        ...(effect.recipientCharId?{recipientCharId:effect.recipientCharId}:{}),
        ...(effect.sourceBundle?{sourceBundle:effect.sourceBundle}:{}),
        ...(effect.sourceComponent?{sourceComponent:effect.sourceComponent}:{}),
        conditional:conditions.length>0,
        condition:conditions.length?[...new Set(conditions)].join(' / '):null});
    }
  }
  function collect(part,event,choice,baseConditions){
    if(Array.isArray(part.outcomes)&&part.outcomes.length){
      const picked=outcomes[event.id];
      if(picked&&!part.outcomes.some(o=>o.id===picked))return;
      for(const outcome of part.outcomes){
        if(picked&&picked!==outcome.id)continue;
        const gate=outcomeReachability(outcome,event,choices,events,outcomes);
        if(gate.status==='blocked')continue;
        // An unresolved random result is NEVER an unconditional reward.
        const conditions=[...baseConditions,...gate.conditions];
        if(!picked)conditions.push(event.name+'・'+outcome.label+'の結果時');
        add(outcome.effects,event,choice,outcome,conditions);
      }
    }else add(part.effects,event,choice,null,baseConditions);
  }
  for(const event of events){
    const gate=reachability(event,choices,events,outcomes);
    if(gate.status==='blocked')continue;
    if(event.type==='choice'){
      const choice=event.choices?.find(c=>c.id===choices[event.id]);
      if(!choice)continue;
      const selectedGate=choiceReachability(choice,event,choices,events,outcomes);
      if(selectedGate.status==='blocked')continue;
      collect(choice,event,choice,selectedGate.conditions);
    }else if(event.type==='auto')collect(event,event,null,gate.conditions);
  }
  return routes;
}
function directStatusRoutes(card,config={}){
  const choices=config.choices||{},outcomes=config.outcomes||{};
  const events=card.events||[],routes=[];
  function add(statusEffects,event,choice,outcome,conditions){
    for(const effect of statusEffects||[]){
      routes.push({source:'event-status-effect',cardId:card.id,eventId:event.id,
        eventName:event.name,
        ...(choice?{choiceId:choice.id,choiceLabel:choice.label}:{}),
        ...(outcome?{outcomeId:outcome.id,outcomeLabel:outcome.label}:{}),
        statusKind:effect.kind,possible:true,
         ...(effect.conditionId?{conditionId:effect.conditionId}:{}),
         ...(effect.chance!==undefined?{chance:effect.chance}:{}),
        conditional:true,
        condition:[...new Set([...conditions,'状態操作の適用条件・確率は未保証'])].join(' / ')});
    }
  }
  function collect(part,event,choice,baseConditions){
    if(Array.isArray(part.outcomes)&&part.outcomes.length){
      const picked=outcomes[event.id];
      if(picked&&!part.outcomes.some(o=>o.id===picked))return;
      for(const outcome of part.outcomes){
        if(picked&&picked!==outcome.id)continue;
        const gate=outcomeReachability(outcome,event,choices,events,outcomes);
        if(gate.status==='blocked')continue;
        // An unresolved random result is NEVER an unconditional reward.
        const conditions=[...baseConditions,...gate.conditions];
        if(!picked)conditions.push(event.name+'・'+outcome.label+'の結果時');
        add(outcome.statusEffects,event,choice,outcome,conditions);
      }
    }else add(part.statusEffects,event,choice,null,baseConditions);
  }
  for(const event of events){
    const gate=reachability(event,choices,events,outcomes);
    if(gate.status==='blocked')continue;
    if(event.type==='choice'){
      const choice=event.choices?.find(c=>c.id===choices[event.id]);
      if(!choice)continue;
      const selectedGate=choiceReachability(choice,event,choices,events,outcomes);
      if(selectedGate.status==='blocked')continue;
      collect(choice,event,choice,selectedGate.conditions);
    }else if(event.type==='auto')collect(event,event,null,gate.conditions);
  }
  return routes;
}
function directDynamicEffectRoutes(card,config={}){
  const choices=config.choices||{},outcomes=config.outcomes||{};
  const events=card.events||[],routes=[];
  function add(dynamicEffects,event,choice,outcome,conditions){
    for(const effect of dynamicEffects||[]){
      routes.push({source:'event-dynamic-effect',cardId:card.id,eventId:event.id,
        eventName:event.name,
        ...(choice?{choiceId:choice.id,choiceLabel:choice.label}:{}),
        ...(outcome?{outcomeId:outcome.id,outcomeLabel:outcome.label}:{}),
        dynamicKind:effect.kind,
        ...(effect.delta!==undefined?{delta:effect.delta}:{}),
        ...(effect.statCount!==undefined?{statCount:effect.statCount}:{}),
        ...(effect.scenario?{scenario:effect.scenario}:{}),
        ...(effect.possible?{possible:true}:{}),
        targetSelection:effect.targetSelection,
        unresolvedTargets:true,conditional:true,
        condition:[...new Set([...conditions,
          effect.kind==='grand-live-lowest-performance'?
            'グランドライブ限定：現在の最少パフォーマンス項目（取得量は上限に依存）':
          effect.kind==='restore-current-max-energy'?
            '実行時の最大体力まで回復（増加量は現在体力に依存）':
            '対象能力はランダムに決まり固定値として合算できない'])].join(' / ')});
    }
  }
  function collect(part,event,choice,baseConditions){
    if(Array.isArray(part.outcomes)&&part.outcomes.length){
      const picked=outcomes[event.id];
      if(picked&&!part.outcomes.some(o=>o.id===picked))return;
      for(const outcome of part.outcomes){
        if(picked&&picked!==outcome.id)continue;
        const gate=outcomeReachability(outcome,event,choices,events,outcomes);
        if(gate.status==='blocked')continue;
        // An unresolved random result is NEVER an unconditional reward.
        const conditions=[...baseConditions,...gate.conditions];
        if(!picked)conditions.push(event.name+'・'+outcome.label+'の結果時');
        add(outcome.dynamicEffects,event,choice,outcome,conditions);
      }
    }else add(part.dynamicEffects,event,choice,null,baseConditions);
  }
  for(const event of events){
    const gate=reachability(event,choices,events,outcomes);
    if(gate.status==='blocked')continue;
    if(event.type==='choice'){
      const choice=event.choices?.find(c=>c.id===choices[event.id]);
      if(!choice)continue;
      const selectedGate=choiceReachability(choice,event,choices,events,outcomes);
      if(selectedGate.status==='blocked')continue;
      collect(choice,event,choice,selectedGate.conditions);
    }else if(event.type==='auto')collect(event,event,null,gate.conditions);
  }
  return routes;
}
function aggregate(deck,data){
  const bySkill={};
  // F-04: unique support-card IDs define the count. Slot-indexed routes
  // stay separate, preserving different stages and choices for duplicate IDs.
  const countedCards=new Map();
  deck.slots.forEach((slot,index)=>{
    if(!slot||!data.cardById[slot.cardId])return;
    const card=data.cardById[slot.cardId];
    const routes=directRoutes(card,slot);
    for(const route of routes){
      const v=bySkill[route.skillId]||(bySkill[route.skillId]={skillId:route.skillId,providers:{},count:0,conditionalOnly:true});
      const key=String(index); // 経路はスロット別、提供枚数はカードID別。
      if(!v.providers[key])v.providers[key]={slotIndex:index,cardId:card.id,routes:[]};
      let unique=countedCards.get(route.skillId);
      if(!unique){unique=new Set();countedCards.set(route.skillId,unique);}
      if(!unique.has(card.id)){unique.add(card.id);v.count++;}
      v.providers[key].routes.push(route);
      if(!route.conditional)v.conditionalOnly=false;
    }
  });
  return bySkill;
}
function coverage(skillId,bySkill,data){
  const direct=bySkill[skillId];
  if(direct)return {kind:'direct',conditional:direct.conditionalOnly,count:direct.count};
  // The reviewed/source-group hierarchy may be more than one rank:
  // rare -> normal ◎ -> normal ○. Traverse upwards without creating direct providers.
  const parents=new Map();
  for(const skill of data.skills||[]){
    if(!skill.lowerId)continue;
    const found=parents.get(skill.lowerId)||[];
    found.push(skill.id);parents.set(skill.lowerId,found);
  }
  const visited=new Set([skillId]),queue=[skillId],upper=[];
  while(queue.length){
    for(const id of parents.get(queue.shift())||[]){
      if(visited.has(id))continue;
      visited.add(id);
      if(bySkill[id])upper.push(bySkill[id]);
      queue.push(id);
    }
  }
  if(upper.length)return {kind:'indirect',conditional:upper.every(v=>v.conditionalOnly),count:0};
  return {kind:'missing',conditional:false,count:0};
}
function goalStatus(goal,main,inherit,data){
  const m=coverage(goal.skillId,main,data),i=coverage(goal.skillId,inherit,data);
  let relevant=[];
  switch(goal.scope){
    case 'main':relevant=[m];break;
    case 'inherit':relevant=[i];break;
    case 'either':relevant=[m,i];break;
    default:relevant=[m,i];
  }
  const supported=relevant.filter(x=>x.kind!=='missing');
  const satisfied=goal.scope==='either'?supported.length>0:supported.length===relevant.length;
  return {satisfied,conditional:satisfied&&(goal.scope==='either'?supported.every(x=>x.conditional):supported.some(x=>x.conditional)),indirect:satisfied&&(goal.scope==='either'?supported.every(x=>x.kind==='indirect'):supported.some(x=>x.kind==='indirect')),main:m,inherit:i};
}
function combinedRows(main,inherit,goals,data){
  const ids=new Set([...Object.keys(main),...Object.keys(inherit),...goals.map(x=>x.skillId)]);
  return [...ids].map(id=>({skill:data.skillById[id]||{id,name:'未収録スキル ('+id+')',tier:'unknown'},main:main[id]||null,inherit:inherit[id]||null,goal:goals.find(x=>x.skillId===id)||null,mainCover:coverage(id,main,data),inheritCover:coverage(id,inherit,data)})).sort((a,b)=>a.skill.name.localeCompare(b.skill.name,'ja'));
}
// 表示用の順序。集計結果を変更せず、金スキルの直後に対応する下位スキルを配置する。
// フィルター後の行集合にも適用でき、片方がない場合は擬似的な獲得行を生成しない。
function hierarchyRows(rows,data){
  const byId=new Map(rows.map(row=>[row.skill.id,row]));
  const children=new Set(rows.map(row=>row.skill.lowerId).filter(id=>id&&byId.has(id)));
  const used=new Set(),groups=[];
  function append(row,items,depth,parentSkillId){
    if(!row||used.has(row.skill.id))return;
    used.add(row.skill.id);
    const child=row.skill.lowerId&&byId.get(row.skill.lowerId);
    const hasChild=!!child&&!used.has(child.skill.id);
    items.push({...row,groupRole:depth>0?'child':hasChild?'parent':'solo',
      ...(depth>0?{parentSkillId,hierarchyDepth:depth}:{hierarchyDepth:0})});
    if(hasChild)append(child,items,depth+1,row.skill.id);
  }
  for(const row of rows){
    if(children.has(row.skill.id))continue;
    const items=[];append(row,items,0,null);
    if(items.length)groups.push({name:row.skill.name,items});
  }
  // Defensive fallback if invalid external data ever forms a cycle.
  for(const row of rows)if(!used.has(row.skill.id)){
    const items=[];append(row,items,0,null);
    if(items.length)groups.push({name:row.skill.name,items});
  }
  groups.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  return groups.flatMap(g=>g.items);
}
function clearDependentState(card,choices,outcomes,eventId){
  const nextChoices={...choices},nextOutcomes={...outcomes};
  delete nextOutcomes[eventId]; // Changing a choice invalidates its own result.
  const queue=[eventId],visited=new Set();
  while(queue.length){
    const parent=queue.shift();
    if(visited.has(parent))continue;
    visited.add(parent);
    for(const e of card.events||[]){
      const selected=(e.choices||[]).find(c=>c.id===nextChoices[e.id]);
      const affectedChoice=selected&&prerequisites(selected).some(r=>r.eventId===parent);
      const affectedResult=(e.type==='auto'?[e]:e.choices||[]).some(part=>
        (part.outcomes||[]).some(out=>(out.requires?.any||[]).some(clause=>
          (clause.all||[]).some(r=>r.eventId===parent))));
      if(prerequisites(e).some(r=>r.eventId===parent)||affectedChoice||affectedResult){
        delete nextChoices[e.id];delete nextOutcomes[e.id];
        queue.push(e.id);
      }
    }
  }
  return {choices:nextChoices,outcomes:nextOutcomes};
}
function clearDescendants(card,choices,eventId){
  return clearDependentState(card,choices,{},eventId).choices;
}
const core={directRoutes,directEffectRoutes,directStatusRoutes,directDynamicEffectRoutes,aggregate,coverage,goalStatus,combinedRows,hierarchyRows,clearDescendants,clearDependentState,isReachable,reachability,choiceReachability,outcomeReachability};
if(typeof module!=='undefined'&&module.exports)module.exports=core;
g.UmaCore=core;
})(typeof globalThis!=='undefined'?globalThis:this);