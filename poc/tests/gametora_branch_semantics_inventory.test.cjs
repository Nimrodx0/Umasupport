'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inventory}=require('../src/gametora_branch_semantics_inventory.cjs');
const {transformDocument}=require('../src/gametora_whole_event_normalize.cjs');
function makeCandidate(){
 const doc={kind:'support',id:30311,events_ja:{
  example:{id:1,section:'arrows',name:'never publish this original title',
   choices:[1,2,3].map((n)=>({label:'secret original choice text',
    random_either:true,
    outcomes:[
     [{type:'skill_hint',skill_id:200532,value:n===1?'+1/+3':'+1'}],
     [{type:'skill_hint',skill_id:200532,value:'+2'},
      ...(n===3?[{type:'chain_end'}]:[])]
    ]}))},
  alternate:{id:2,section:'random',name:'private random',choices:[{
   label:'',effects:[{type:'skill_hint_or',options:[
    {skill_id:201272,value:'+1'},{skill_id:400000,value:'+1/+3'}]}]}]},
  guard:{id:3,section:'special',name:'private special',choices:[{
   label:'',segments:[{when:[{kind:'success'}],effects:[
    {type:'obtain_skill',skill_id:200532},{type:'chain_end'}]},
    {when:[{kind:'fail'}],effects:[{type:'speed',value:'+1'}]}]}]}
 }};
 const normalized=transformDocument(doc);
 const {reviewQueue,effectTypeCounts,...card}=normalized;
 const candidate={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  originalSourceTextIncluded:false,sourcePins:{gameToraDerived:'fixed-test'},
  cards:[{...card,sourceMissing:false}],
  totals:{rosterCards:1,sourceEvents:normalized.sourceEventCount,
   sourceChoices:normalized.sourceChoiceCount,expandedRoutes:normalized.sourceExpandedRoutes,
   explicitTerminalRoutes:normalized.explicitChainEndRoutes,
   directSkillGrantMentions:normalized.directSkillGrantMentions}};
 return candidate;
}
test('three random two-outcome choices are separate from skill_hint_or effect',()=>{
 const doc=makeCandidate(),out=inventory(doc),c=out.totals;
 assert.equal(c.sourceEvents,3);
 assert.equal(c.sourceChoices,5);
 assert.equal(c.sourceRoutes,10);
 assert.equal(c.multiRouteChoices,4);
 assert.equal(c.explicitRandomMultiRouteChoices,3);
 assert.equal(c.unflaggedMultiRouteChoices,1);
 assert.equal(c.multiRouteEvents,2);
 assert.equal(c.skillHintOrEffectMentions,1);
 assert.equal(c.skillHintOrOptions,2);
 assert.equal(c.eventsWithSkillHintOr,1);
 assert.equal(c.rangeLevelHintMentions,1);
 assert.equal(c.rangeLevelOrOptions,1);
 assert.equal(c.nonChainEndRoutes,1);
 assert.equal(c.explicitChainEndRoutes,2);
 assert.deepEqual(out.terminalRoutesBySection,{arrows:1,special:1});
 assert.equal(c.guardedRoutes,2);
 assert.equal(c.directSkillGrantMentions,1);
 assert.equal(out.numericOnlyReviewPositions.filter(r=>r.cardId==='30311').length,3);
 assert.ok(out.numericOnlyReviewPositions.some(x=>x.section==='arrows'&&x.multiRouteChoices===3));
 const raw=JSON.stringify(out);
 assert.ok(!raw.includes('never publish'));
 assert.ok(!raw.includes('secret original'));
 assert.ok(!raw.includes('private random'));
 assert.equal(out.publicationApproved,false);
 assert.equal(out.gameVerified,false);
});
test('refuse fabricated totals and automatically publishable input',()=>{
 const source=makeCandidate();
 source.totals.expandedRoutes++;
 assert.throws(()=>inventory(source),/整合不一致/);
 source.totals.expandedRoutes--;
 source.releaseApproved=true;
 assert.throws(()=>inventory(source),/未公開/);
});
