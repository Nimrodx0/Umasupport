const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/core.js'),'utf8'),context);const core=context.module.exports;
test('stage-specific hint routes, no phantom zero-stage hints',()=>{
 const card={hints:['late'],hintsByStage:{'0':['early'],'4':['late']},events:[]};
 assert.equal(core.directRoutes(card,{stage:0,choices:{}}).map(r=>r.skillId).join(','),'early');
 assert.equal(core.directRoutes(card,{stage:4,choices:{}}).map(r=>r.skillId).join(','),'late');
});