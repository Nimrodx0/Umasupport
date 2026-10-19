'use strict';
const assert=require('node:assert/strict');
function fixture(){
 const ids=Array.from({length:44},(_,i)=>String(30201+i));
 const entries=[];
 for(let i=0;i<119;i++){
  const id=ids[i%ids.length];
  const base={id:'evt_'+id+'_801'+String(i).padStart(6,'0')};
  if(i%5===0){
   entries.push({...base,selection:'single',choices:[
    {id:'choice-a',skills:[{skillId:700001,skillName:'通常候補',hintLevel:1}]},
    {id:'choice-b',skills:[{skillId:700002,skillName:'希少候補',hintLevel:5}]}
   ]});
  }else entries.push({...base,selection:'auto',skills:[
   {skillId:700001,skillName:'通常候補',hintLevel:1}]});
 }
 for(let i=0;i<3;i++){
  entries.push({id:'evt_30311_83031100'+(i+1),selection:'auto',
   skills:[{skillId:700001,skillName:'通常候補',hintLevel:1}]});
 }
 entries.push({id:'evt_tazuna_oodate5',selection:'auto',
   skills:[{skillId:700001,skillName:'通常候補',hintLevel:1}]});
 entries.push({id:'evt_tazuna_newyear',selection:'auto',
   skills:[{skillId:700001,skillName:'通常候補',hintLevel:1}]});
 for(let i=0;i<2;i++)entries.push({
  id:'evt_'+ids[i]+'_80199999'+i,selection:'auto',
  skills:[{skillId:200831+i*20,skillName:'不明候補',hintLevel:1}]
 });
 assert.equal(entries.length,126);
 const dict=JSON.stringify([
  {id:'700001',name:'通常候補',rarity:'normal',group:70000},
  {id:'700002',name:'希少候補',rarity:'rare',group:70001},
  ...Object.entries(require('../src/efforia30311_review_preview.cjs').SKILLS)
   .map(([id,name],i)=>({id,name,rarity:'normal',group:75000+i})),
  ...Array.from({length:110},(_,i)=>({id:String(800000+i),name:'関係なし'+i,rarity:'normal',group:80000+i}))
 ]);
 const cards=[...ids,'30311'].map(id=>({id,events:[],hints:[]}));
 return {source:{version:2,events:entries},dict,
  model:{cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),
   skills:[],skillById:{},meta:{}}};
}

module.exports={fixture};
