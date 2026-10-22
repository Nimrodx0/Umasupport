'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CASES,applyReviewedAliases}=require('../src/phase2_reviewed_event_aliases.cjs');
function source(id){
 const rule=CASES.find(c=>c.cardId===id);
 if(!rule)throw Error('missing fixture');
 const c=Array.from({length:rule.checkerOrdinal},(_,i)=>({
  sourceKey:'unrelated:'+i,sourceIndex:i,optionCount:1,strict:'other'+i
 }));
 c[rule.checkerOrdinal-1]={sourceKey:rule.sourceKey,sourceIndex:rule.checkerOrdinal-1,
  optionCount:rule.checkerChoices,strict:rule.checkerTitleSha};
 const g=Array.from({length:rule.sourceOrdinal},(_,i)=>({
  sourceOrdinal:i+1,sourceLocalEventId:100+i,section:'random',choiceCount:1,strict:'other'+i
 }));
 g[rule.sourceOrdinal-1]={sourceOrdinal:rule.sourceOrdinal,sourceLocalEventId:rule.gtLocalId,
  section:rule.section,choiceCount:rule.gtChoices,strict:rule.gtTitleSha};
 const raw=Array.from({length:rule.sourceOrdinal},()=>({id:1,section:'random',choices:[{}]}));
 raw[rule.sourceOrdinal-1]=id==='30139'?
  {id:857,section:'arrows',choices:[{label:'',random_either:true,outcomes:[
   [{type:'skill_hint',skill_id:202581,value:'+3'}],
   [{type:'skill_hint',skill_id:202581,value:'+1'}]]}]}:
  {id:1017,section:'arrows',choices:[
   {label:'option A',effects:[]},
   {label:'option B',effects:[{type:'chain_end'}]}]};
 return {cardId:id,checkerEvents:c,gtEvents:g,rawGtEvents:raw,
  paired:{selected:[],unmatchedC:[rule.checkerOrdinal-1],
   unmatchedG:[rule.sourceOrdinal-1]}};
}
test('P0 30139: source glyph variant maps one existing final stage, not an extra event',()=>{
 const input=source('30139');
 const out=applyReviewedAliases(input);
 assert.equal(out.matched.length,1);
 assert.equal(out.paired.selected.length,1);
 assert.deepEqual(out.paired.unmatchedC,[]);
 assert.deepEqual(out.paired.unmatchedG,[]);
 assert.equal(out.paired.selected[0].status,'reviewed-alias-paired');
 assert.equal(out.paired.selected[0].reviewEvidence.currentGameVerified,false);
 assert.equal(out.paired.selected[0].reviewEvidence.publicationApproved,false);
 assert.equal(out.matched[0].gtLocalId,857);
});
test('P0 30198: abbreviation maps pre-existing two-choice stage, keeping stop result',()=>{
 const input=source('30198'),out=applyReviewedAliases(input);
 assert.equal(out.matched.length,1);
 assert.equal(out.paired.selected[0].ci,0);
 assert.equal(out.paired.selected[0].gi,2);
 assert.equal(out.matched[0].decision,'SAME_EVENT_ABBREVIATED_TITLE');
});
test('P0 alias gate rejects drift, ambiguous matches, changed reward or continuation',()=>{
 const mutations=[
  x=>{x.checkerEvents[x.paired.unmatchedC[0]].strict='sha256:0';},
  x=>{x.checkerEvents[x.paired.unmatchedC[0]].optionCount=5;},
  x=>{x.gtEvents[x.paired.unmatchedG[0]].sourceLocalEventId=9999;},
  x=>{x.paired.unmatchedG=[];},
  x=>{x.rawGtEvents[x.paired.unmatchedG[0]].choices[0].outcomes[0][0].value='+2';}
 ];
 for(const mutate of mutations){
  const x=source('30139');mutate(x);
  assert.throws(()=>applyReviewedAliases(x),/P0イベント同定/);
 }
 const other=[
  x=>{x.rawGtEvents[2].choices[1].effects=[];},
  x=>{x.rawGtEvents[2].choices[0].effects=[{type:'chain_end'}];},
  x=>{x.checkerEvents[0].sourceKey='wrong';},
  x=>{x.gtEvents[2].strict='wrong';}
 ];
 for(const mutate of other){
  const x=source('30198');mutate(x);
  assert.throws(()=>applyReviewedAliases(x),/P0イベント同定/);
 }
});
test('does not globally merge approximate or shortened titles on another card',()=>{
 const x=source('30198');x.cardId='30001';
 const got=applyReviewedAliases(x);
 assert.equal(got.matched.length,0);
 assert.deepEqual(got.paired.unmatchedC,[0]);
 assert.deepEqual(got.paired.unmatchedG,[2]);
});
