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

test('eleven individually pinned title variants pair exactly one pre-existing event each',()=>{
 const variants=CASES.filter(x=>x.decision==='SAME_EVENT_REVIEWED_TITLE_VARIANT');
 assert.equal(variants.length,11);
 for(const rule of variants){
  const checkerEvents=Array.from({length:rule.checkerOrdinal},(_,i)=>({
   sourceKey:'unmatched:'+i,sourceIndex:i,strict:'other'+i,optionCount:1
  }));
  checkerEvents[rule.checkerOrdinal-1]={
   sourceKey:rule.sourceKey,sourceIndex:rule.checkerOrdinal-1,
   strict:rule.checkerTitleSha,optionCount:rule.checkerChoices
  };
  const gtEvents=Array.from({length:rule.sourceOrdinal},(_,i)=>({
   sourceOrdinal:i+1,sourceLocalEventId:100+i,section:'random',
   choiceCount:1,strict:'gt-other'+i
  }));
  gtEvents[rule.sourceOrdinal-1]={
   sourceOrdinal:rule.sourceOrdinal,sourceLocalEventId:rule.gtLocalId,
   section:rule.section,choiceCount:rule.gtChoices,strict:rule.gtTitleSha
  };
  const rawGtEvents=Array.from({length:rule.sourceOrdinal},()=>({
   id:1,section:'random',choices:[{label:'',effects:[]}]
  }));
  rawGtEvents[rule.sourceOrdinal-1]={
   id:rule.gtLocalId,section:rule.section,
   choices:rule.choiceShape.split('').map((ch,i)=>({
    label:ch==='S'?'unique-choice-'+i:'',random_either:false,
    effects:rule.hintSignatures[i].map(([skill_id,value])=>({
     type:'skill_hint',skill_id,value
    }))
   }))
  };
  const make=()=>({
   cardId:rule.cardId,checkerEvents,gtEvents,rawGtEvents,
   paired:{selected:[],unmatchedC:[rule.checkerOrdinal-1],
    unmatchedG:[rule.sourceOrdinal-1]}
  });
  const result=applyReviewedAliases(make());
  assert.equal(result.matched.length,1,rule.cardId);
  assert.equal(result.paired.unmatchedC.length,0,rule.cardId);
  assert.equal(result.paired.unmatchedG.length,0,rule.cardId);
  assert.equal(result.matched[0].decision,'SAME_EVENT_REVIEWED_TITLE_VARIANT');
  assert.equal(result.matched[0].currentGameVerified,false);
  assert.equal(result.matched[0].publicationApproved,false);
  const correct=checkerEvents[rule.checkerOrdinal-1];
  correct.strict='changed-fingerprint';
  assert.throws(()=>applyReviewedAliases(make()),/P0イベント同定/);
  correct.strict=rule.checkerTitleSha;
  const original=rawGtEvents[rule.sourceOrdinal-1].choices[0];
  original.label=original.label?'':'not-an-original-choice';
  assert.throws(()=>applyReviewedAliases(make()),/P0イベント同定/);
  original.label=rule.choiceShape[0]==='S'?'unique-choice-0':'';
  original.random_either=true;
  assert.throws(()=>applyReviewedAliases(make()),/P0イベント同定/);
  original.random_either=false;
  original.effects.push({type:'skill_hint',skill_id:999999,value:'+4'});
  assert.throws(()=>applyReviewedAliases(make()),/P0イベント同定/);
 }
});

// 30267 has two separately reviewed aliases on the same card. Build a complete
// synthetic card for both tests rather than weakening production's all-case gate.
function add30267Companion(fixture){
 if(fixture.cardId!=='30267')return fixture;
 for(const rule of CASES.filter(c=>c.cardId==='30267')){
  const ci=rule.checkerOrdinal-1,gi=rule.sourceOrdinal-1;
  if(fixture.checkerEvents[ci]?.sourceKey===rule.sourceKey)continue;
  fixture.checkerEvents[ci]={sourceIndex:ci,sourceKey:rule.sourceKey,
   strict:rule.checkerTitleSha,optionCount:rule.checkerChoices};
  fixture.gtEvents[gi]={sourceOrdinal:rule.sourceOrdinal,
   sourceLocalEventId:rule.gtLocalId,section:rule.section,
   strict:rule.gtTitleSha,choiceCount:rule.gtChoices};
  const choice=rule.decision==='SAME_EVENT_INDEPENDENT_EDITORIAL_RENAMED'?
   {label:'',random_either:true,outcomes:[
    [{type:'speed',value:'+30'},{type:'bond',value:'+15'}],
    [{type:'speed',value:'+20'},{type:'bond',value:'+5'}]
   ]}:
   {label:'',random_either:false,effects:[
    {type:'speed',value:'+25'},{type:'bond',value:'+5'}]};
  fixture.rawGtEvents[gi]={id:rule.gtLocalId,section:rule.section,
   choices:[choice]};
  fixture.paired.unmatchedC.push(ci);
  fixture.paired.unmatchedG.push(gi);
 }
 return fixture;
}
test('two independently reported title changes retain one actual event and pinned skill/result topology',()=>{
 const cases=CASES.filter(x=>x.decision==='SAME_EVENT_INDEPENDENT_EDITORIAL_RENAMED');
 assert.equal(cases.length,2);
 for(const rule of cases){
  const ce=Array.from({length:rule.checkerOrdinal},(_,i)=>({
   sourceKey:'unrelated:'+i,sourceIndex:i,strict:'other'+i,optionCount:1
  }));
  ce[rule.checkerOrdinal-1]={
   sourceKey:rule.sourceKey,sourceIndex:rule.checkerOrdinal-1,
   strict:rule.checkerTitleSha,optionCount:1
  };
  const ge=Array.from({length:rule.sourceOrdinal},(_,i)=>({
   sourceOrdinal:i+1,sourceLocalEventId:100+i,section:'random',
   choiceCount:1,strict:'other'+i
  }));
  ge[rule.sourceOrdinal-1]={
   sourceOrdinal:rule.sourceOrdinal,sourceLocalEventId:rule.gtLocalId,
   section:rule.section,choiceCount:1,strict:rule.gtTitleSha
  };
  const raw=Array.from({length:rule.sourceOrdinal},()=>({
   section:'random',id:1,choices:[{label:'',effects:[]}]
  }));
  const current=rule.shape==='NO_CHOICE_HINT'?
   {label:'',random_either:false,effects:[
    {type:'stamina',value:'+10'},
    {type:'skill_hint',skill_id:201121,value:'+1'}]}:
   {label:'',random_either:true,outcomes:[
    [{type:'speed',value:'+30'},{type:'bond',value:'+15'}],
    [{type:'speed',value:'+20'},{type:'bond',value:'+5'}]]};
  raw[rule.sourceOrdinal-1]={id:rule.gtLocalId,section:rule.section,
   choices:[current]};
  const make=()=>add30267Companion({
   cardId:rule.cardId,checkerEvents:ce,gtEvents:ge,rawGtEvents:raw,
   paired:{selected:[],unmatchedC:[rule.checkerOrdinal-1],
    unmatchedG:[rule.sourceOrdinal-1]}
  });
  let res=applyReviewedAliases(make());
  assert.equal(res.matched.length,rule.cardId==='30267'?2:1);
  assert.equal(res.paired.unmatchedC.length,0);
  assert.equal(res.paired.unmatchedG.length,0);
  assert.equal(res.matched[0].publicationApproved,false);
  assert.equal(res.matched[0].currentGameVerified,false);
  ce[rule.checkerOrdinal-1].strict='modified';
  assert.throws(()=>applyReviewedAliases(make()),/P0イベント同定/);
  ce[rule.checkerOrdinal-1].strict=rule.checkerTitleSha;
  if(rule.shape==='NO_CHOICE_HINT'){
   current.effects[1].value='+3';
  }else{
   current.outcomes[1][0].value='+30';
  }
  assert.throws(()=>applyReviewedAliases(make()),/P0イベント同定/);
 }
});

test('15 newly source-pinned event identities match only the same card, ordinals and effects',()=>{
 const cases=CASES.filter(x=>x.decision==='SAME_EVENT_PINNED_MORPHOLOGY');
 assert.equal(cases.length,15);
 for(const rule of cases){
  const ce=Array.from({length:rule.checkerOrdinal},(_,i)=>({
   sourceIndex:i,sourceKey:'unrelated:'+i,strict:'unrelated:'+i,optionCount:1
  }));
  ce[rule.checkerOrdinal-1]={
   sourceIndex:rule.checkerOrdinal-1,sourceKey:rule.sourceKey,
   strict:rule.checkerTitleSha,optionCount:rule.checkerChoices
  };
  const ge=Array.from({length:rule.sourceOrdinal},(_,i)=>({
   sourceOrdinal:i+1,sourceLocalEventId:100+i,section:'random',
   strict:'gt-unrelated:'+i,choiceCount:1
  }));
  ge[rule.sourceOrdinal-1]={
   sourceOrdinal:rule.sourceOrdinal,sourceLocalEventId:rule.gtLocalId,
   section:rule.section,strict:rule.gtTitleSha,choiceCount:rule.gtChoices
  };
  const raw=Array.from({length:rule.sourceOrdinal},()=>({
   id:1,section:'random',choices:[{label:'',random_either:false,effects:[]}]
  }));
  raw[rule.sourceOrdinal-1]={
   id:rule.gtLocalId,section:rule.section,
   choices:rule.effectTypes.map((types,i)=>{
    let hintIndex=0;
    return {label:rule.choiceShape[i]==='S'?'selected '+i:'',
     random_either:false,effects:types.split(',').map(type=>{
      if(type==='skill_hint'){
       const [skill_id,value]=rule.hintSignatures[i][hintIndex++];
       return {type,skill_id,value};
      }
      return {type,value:'+5'};
     })};
   })
  };
  const make=()=>add30267Companion({cardId:rule.cardId,checkerEvents:ce,gtEvents:ge,
   rawGtEvents:raw,paired:{selected:[],unmatchedC:[rule.checkerOrdinal-1],
    unmatchedG:[rule.sourceOrdinal-1]}});
  const out=applyReviewedAliases(make());
  assert.equal(out.matched.length,rule.cardId==='30267'?2:1,rule.cardId);
  assert.equal(out.paired.selected.length,rule.cardId==='30267'?2:1,rule.cardId);
  assert.deepEqual(out.paired.unmatchedC,[],rule.cardId);
  assert.deepEqual(out.paired.unmatchedG,[],rule.cardId);
  assert.equal(out.matched[0].currentGameVerified,false,rule.cardId);
  assert.equal(out.matched[0].publicationApproved,false,rule.cardId);
  const c=ce[rule.checkerOrdinal-1],g=ge[rule.sourceOrdinal-1];
  const first=raw[rule.sourceOrdinal-1].choices[0];
  const checkMutation=(apply,undo)=>{
   apply();assert.throws(()=>applyReviewedAliases(make()),/P0イベント同定/,
    rule.cardId);undo();
  };
  checkMutation(()=>{c.sourceKey='bad';},()=>{c.sourceKey=rule.sourceKey;});
  checkMutation(()=>{g.strict='bad';},()=>{g.strict=rule.gtTitleSha;});
  checkMutation(()=>{first.label=first.label?'':'invented choice';},
   ()=>{first.label=rule.choiceShape[0]==='S'?'selected 0':'';});
  checkMutation(()=>{first.random_either=true;},()=>{first.random_either=false;});
  checkMutation(()=>{first.effects[0].type='unrelated';},
   ()=>{first.effects[0].type=rule.effectTypes[0].split(',')[0];});
  const indexed=raw[rule.sourceOrdinal-1].choices.find(x=>
   x.effects.some(e=>e.type==='skill_hint'));
  if(indexed){
   const hint=indexed.effects.find(e=>e.type==='skill_hint'),old=hint.skill_id;
   checkMutation(()=>{hint.skill_id=999999;},()=>{hint.skill_id=old;});
  }
  const wrong=make();
  wrong.cardId='30001';
  assert.equal(applyReviewedAliases(wrong).matched.length,0);
 }
});
