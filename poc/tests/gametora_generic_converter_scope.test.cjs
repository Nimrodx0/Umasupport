'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateEvents}=require('../src/event_schema.js');
const root=path.resolve(__dirname,'..');

test('GameTora-only generic extractor must not require article-specific adjudication',()=>{
 for(const file of ['src/official_gametora_live_event_assembler.cjs',
    'tools/probe_official_gametora_new_cards.cjs']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  assert.doesNotMatch(source,/require\s*\(\s*['"][^'"]*(?:gamewith|game_with|result_adjudication)[^'"]*['"]\s*\)/i);
  assert.doesNotMatch(source,/gameWithOutcomeEditorialObservations|explicit30322Review/);
 }
});

test('neutral ordinal result labels preserve disjoint rewards without success wording',()=>{
 const model={skillById:{'2001':{id:'2001'},'2002':{id:'2002'}}};
 const events=[{id:'gt-event-1',name:'GameToraイベント1',type:'choice',
  choices:[{id:'group-1',label:'選択肢1',outcomes:[
   {id:'result-1',label:'結果1',rewards:[{skillId:'2001',level:2}],
    effects:[{kind:'speed',delta:15}]},
   {id:'result-2',label:'結果2',rewards:[{skillId:'2001',level:1}],
    effects:[{kind:'speed',delta:5}]}
  ]},{id:'group-2',label:'選択肢2',outcomes:[
   {id:'result-1',label:'結果1',rewards:[{skillId:'2002',level:2}]},
   {id:'result-2',label:'結果2',rewards:[{skillId:'2002',level:1}]}
  ]}]}];
 assert.doesNotThrow(()=>validateEvents(events,model,'30322'));
 assert.deepEqual(events[0].choices.map(c=>c.outcomes.map(o=>o.rewards[0].level)),
  [[2,1],[2,1]]);
 assert.deepEqual(events[0].choices[0].outcomes.map(o=>o.label),['結果1','結果2']);
});

test('a single neutral result branch cannot be flattened into a guaranteed reward',()=>{
 const model={skillById:{'2001':{id:'2001'}}};
 const bad=[{id:'gt-event-1',name:'GameToraイベント1',type:'choice',
  choices:[{id:'group-1',label:'選択肢1',
   rewards:[{skillId:'2001',level:2}],
   outcomes:[
    {id:'result-1',label:'結果1',rewards:[{skillId:'2001',level:2}]},
    {id:'result-2',label:'結果2',rewards:[{skillId:'2001',level:1}]}
   ]}]}];
 assert.throws(()=>validateEvents(bad,model,'30322'),/rewardsとoutcomesは同時指定できません/);
});
