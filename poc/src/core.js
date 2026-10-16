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
  for(const id of hintList)routes.push({skillId:id,source:'hint',eventId:null,eventName:'通常ヒント',level:null,conditional:false,condition:null});
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
  deck.slots.forEach((slot,index)=>{
    if(!slot||!data.cardById[slot.cardId])return;
    const card=data.cardById[slot.cardId];
    const routes=directRoutes(card,slot);
    for(const route of routes){
      const v=bySkill[route.skillId]||(bySkill[route.skillId]={skillId:route.skillId,providers:{},count:0,conditionalOnly:true});
      const key=String(index); // 枚数は物理スロット単位。１枚に複数経路があっても重複しない。
      if(!v.providers[key]){v.providers[key]={slotIndex:index,cardId:card.id,routes:[]};v.count++;}
      v.providers[key].routes.push(route);
      if(!route.conditional)v.conditionalOnly=false;
    }
  });
  return bySkill;
}
function coverage(skillId,bySkill,data){
  const direct=bySkill[skillId];
  if(direct){return {kind:'direct',conditional:direct.conditionalOnly,count:direct.count};}
  const upper = data.skills.filter(s=>s.lowerId===skillId).map(s=>bySkill[s.id]).filter(Boolean);
  if(upper.length){return {kind:'indirect',conditional:upper.every(x=>x.conditionalOnly),count:0};}
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
  const used=new Set();
  const groups=[];
  for(const row of rows){
    const lowerId=row.skill.tier==='gold'?row.skill.lowerId:null;
    const lower=lowerId&&byId.get(lowerId);
    if(lower&&!used.has(row.skill.id)&&!used.has(lowerId)&&lowerId!==row.skill.id){
      groups.push({name:row.skill.name,items:[
        {...row,groupRole:'parent'},
        {...lower,groupRole:'child',parentSkillId:row.skill.id}
      ]});
      used.add(row.skill.id);
      used.add(lowerId);
    }
  }
  for(const row of rows){
    if(!used.has(row.skill.id))groups.push({name:row.skill.name,items:[{...row,groupRole:'solo'}]});
  }
  groups.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  return groups.flatMap(group=>group.items);
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