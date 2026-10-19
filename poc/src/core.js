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
  for(const r of prerequisites(event)){
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
    if(part.requires){
      const gate=reachability({id:parent.id+'#'+part.id,requires:part.requires},choices,events,outcomes,next);
      if(gate.status==='blocked')return gate;
      conditions.push(...gate.conditions);
    }
    const variants=part.outcomes||[];
    const chosen=outcomes[parent.id];
    if(chosen!==undefined&&chosen!==''&&!variants.some(o=>o.id===chosen))
      return {status:'blocked',conditions:[]};
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
      const condition=[...priorConditions,outcome,r.condition].filter(Boolean).join(' / ')||null;
      routes.push({skillId:r.skillId,source:'event',eventId:event.id,eventName:event.name,
        ...(choiceLabel?{choiceLabel}:{}),level:r.level??null,conditional:!!condition,condition});
    }
  }
  function collect(part,event,choiceLabel,conditions){
    const variants=part.outcomes||[];
    if(variants.length){
      const chosen=outcomes[event.id];
      if(chosen&& !variants.some(o=>o.id===chosen))return;
      for(const outcome of variants){
        if(chosen&&chosen!==outcome.id)continue;
        add(outcome.rewards,event,choiceLabel,(outcome.label||outcome.id)+'時',conditions);
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
      if(prerequisites(e).some(r=>r.eventId===parent)||affectedChoice){
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
const core={directRoutes,aggregate,coverage,goalStatus,combinedRows,hierarchyRows,clearDescendants,clearDependentState,isReachable,reachability,choiceReachability};
if(typeof module!=='undefined'&&module.exports)module.exports=core;
g.UmaCore=core;
})(typeof globalThis!=='undefined'?globalThis:this);