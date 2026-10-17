(function(g){
'use strict';
// 副作用のない集計層。テストとUIから同じ関数を呼ぶ。
function prerequisites(event){
  if(!event.requires)return [];
  const r=event.requires;
  return Array.isArray(r.all)?r.all:[r];
}
function isReachable(event,choices,events,visiting=new Set()){
  if(!event||visiting.has(event.id))return false;
  const next=new Set(visiting);next.add(event.id);
  for(const r of prerequisites(event)){
    if(!r||typeof r.eventId!=='string')return false;
    if(!events){
      if(typeof r.choiceId!=='string'||choices[r.eventId]!==r.choiceId)return false;
      continue;
    }
    const parent=events.find(x=>x.id===r.eventId);
    if(!parent||!isReachable(parent,choices,events,next))return false;
    if(parent.type==='choice'){
      const selected=(parent.choices||[]).find(c=>c.id===choices[parent.id]);
      if(!selected||selected.terminal===true)return false;
      if(r.choiceId!==undefined&&r.choiceId!==selected.id)return false;
    }else if(parent.type==='auto'){
      if(r.choiceId!==undefined)return false;
    }else return false;
  }
  return true;
}
function directRoutes(card,config){
  const choices=(config&&config.choices)||{},routes=[];
  const hintList=(card.hintsByStage&&Object.prototype.hasOwnProperty.call(card.hintsByStage,String(config?.stage??4)))
    ?card.hintsByStage[String(config.stage)]:card.hints||[];
  const perf=card.hintPerformanceByStage?.[String(config?.stage??4)];
  const validHintLevel=perf&&Number.isSafeInteger(perf.levelBase)&&Number.isSafeInteger(perf.levelUnique)&&
    perf.levelBase>=0&&perf.levelUnique>=0;
  const hintLevel=validHintLevel?1+perf.levelBase+perf.levelUnique:null;
  for(const id of hintList)routes.push({skillId:id,source:'hint',eventId:null,eventName:'通常ヒント',level:hintLevel,conditional:false,condition:null});
  const events=card.events||[];
  function add(rewards,event,choiceLabel,outcome){
    for(const r of rewards||[]){
      const condition=[outcome,r.condition].filter(Boolean).join(' / ')||null;
      routes.push({skillId:r.skillId,source:'event',eventId:event.id,eventName:event.name,
        ...(choiceLabel?{choiceLabel}:{}),level:r.level??null,conditional:!!condition,condition});
    }
  }
  function collect(part,event,choiceLabel){
    add(part.rewards,event,choiceLabel,null);
    for(const outcome of part.outcomes||[]){
      add(outcome.rewards,event,choiceLabel,(outcome.label||outcome.id)+'時');
    }
  }
  for(const event of events){
    if(!isReachable(event,choices,events))continue;
    if(event.type==='choice'){
      const selected=(event.choices||[]).find(c=>c.id===choices[event.id]);
      if(selected)collect(selected,event,selected.label);
    }else if(event.type==='auto')collect(event,event,null);
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
function clearDescendants(card,choices,eventId){
  const next={...choices},queue=[eventId],visited=new Set();
  while(queue.length){
    const parent=queue.shift();
    if(visited.has(parent))continue;
    visited.add(parent);
    for(const e of card.events||[]){
      if(prerequisites(e).some(r=>r.eventId===parent)){
        delete next[e.id];
        queue.push(e.id);
      }
    }
  }
  return next;
}
const core={directRoutes,aggregate,coverage,goalStatus,combinedRows,hierarchyRows,clearDescendants,isReachable};
if(typeof module!=='undefined'&&module.exports)module.exports=core;
g.UmaCore=core;
})(typeof globalThis!=='undefined'?globalThis:this);