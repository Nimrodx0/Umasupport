const {test}=require('node:test');
const assert=require('node:assert/strict');
const {classifiedEvents}=require('../src/event_sequence.js');
test('both ends and middle of a verified chain receive the same sequence label',()=>{
 const events=[
  {id:'first',name:'第一',type:'choice',choices:[{id:'go',label:'続行'}]},
  {id:'second',name:'第二',type:'auto',requires:{all:[{eventId:'first',choiceId:'go'}]}},
  {id:'third',name:'第三',type:'auto',requires:{all:[{eventId:'second'}]}},
  {id:'other',name:'単発',type:'auto'}
 ];
 assert.deepEqual([...classifiedEvents(events)].sort(),['first','second','third']);
});
test('choice/result prerequisites and explicit chain_end are recognized',()=>{
 const events=[
  {id:'start',type:'choice',choices:[{id:'yes',outcomes:[{id:'win'}]}]},
  {id:'fork',type:'auto',outcomes:[{id:'a',requires:{any:[{all:[{eventId:'start',choiceId:'yes',outcomeId:'win'}]}]}}]},
  {id:'terminal',type:'choice',choices:[{id:'stop',terminal:true}]},
  {id:'outing',type:'auto',availabilityKind:'outing-sequence'},
  {id:'unrelated',type:'auto',requires:{all:[{eventId:'not-in-public-catalog'}]}}
 ];
 assert.deepEqual([...classifiedEvents(events)].sort(),['fork','outing','start','terminal']);
});
test('empty and unrelated events remain unlabelled',()=>{
 assert.equal(classifiedEvents([]).size,0);
 assert.equal(classifiedEvents([{id:'one',type:'auto'},{id:'two',type:'auto'}]).size,0);
});
