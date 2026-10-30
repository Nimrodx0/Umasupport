'use strict';
// Test-only invented data. No GT / GameWith records or published catalogs.
const crypto=require('node:crypto');
const PIN=require('../src/private_local_event_preview.js').PIN;
const KIND=require('../src/private_local_event_preview.js').KIND;
const clone=x=>structuredClone(x);
function fixture(){
 const cards=[],modelCards=[];
 for(let i=0;i<563;i++){
  const id=String(30001+i);
  const events=[];
  for(let j=0;j<(i<260?5:4);j++){
   const eventId='synthetic-'+id+'-event-'+j;
   if(i===0&&j===0){
    events.push({id:eventId,name:'架空の選択式',type:'choice',choices:[
     {id:'option1',label:'上',rewards:[{
      skillId:'skill:700001',level:2,verifiedSkillName:'架空ヒント'}]},
     {id:'option2',label:'下',rewards:[]}]});
   }else{
    events.push({id:eventId,name:'架空イベント',type:'auto',rewards:[]});
   }
  }
  cards.push({cardId:id,coverageStatus:'partial',events});
  modelCards.push({id,name:'サポカ'+id,character:'サポカ'+id,
   type:'スピード',rarity:'SSR',hints:['hint:架空ヒント'],
   events:[],sourceStatus:'verified_hints'});
 }
 const catalog={schemaVersion:1,cards};
 const bundle={schemaVersion:1,dataKind:KIND,sourceRevision:PIN,
  publicationApproved:false,reviewedEventsPublished:0,
  noAutomaticRuntimeAdoption:true,sourceNarrativeOrChoiceProseIncluded:false,
  fullEventRewardOrChainCoverageVerified:false,
  sourceDatasetPublished:false,
  catalogSha256:crypto.createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),
  summary:{cards:563,events:2512},catalog};
 const model={cards:modelCards,cardById:Object.fromEntries(modelCards.map(c=>[c.id,c])),
  skillById:{'hint:架空ヒント':{
   id:'hint:架空ヒント',name:'架空ヒント',tier:'unknown'}},
  skills:[{id:'hint:架空ヒント',name:'架空ヒント'}],
  meta:{eventStatus:'reviewed-empty',reviewedEventRecords:0,
   runtimeSources:{events:{mode:'reviewed'}}}};
 const skillText=JSON.stringify([{id:'700001',name:'架空ヒント',
  rarity:'normal',group:100},...Array.from({length:105},(_,i)=>({
  id:String(800000+i),name:'架空'+i,rarity:'normal',group:200+i}))]);
 return {bundle,model,skillText,clone};
}
module.exports={fixture};
