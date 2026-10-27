'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compareTitles}=require('../src/official_gametora_title_crosscheck.cjs');
const model=()=>({kind:'support',id:30001,events_ja:{
 a:{name:'架空の第1段',section:'arrows'},
 b:{name:'架空の第2段',section:'arrows'},
 c:{name:'架空の第3段',section:'arrows'},
 d:{name:'架空の通常一',section:'random'},
 e:{name:'架空の通常二',section:'random'}
}});
test('published title headings uniquely match historic source but no reward acceptance',()=>{
 const cards=[
 {title:'架空の第1段！',sameGroupSize:3},
 {title:'架空の第2段！',sameGroupSize:3},
 {title:'架空の第3段！',sameGroupSize:3},
 {title:'架空の通常一',sameGroupSize:2},
 {title:'架空の通常二',sameGroupSize:2}
 ];
 const r=compareTitles(model(),cards);
 assert.equal(r.expectedEventTitles,5);
 assert.equal(r.uniquelyMatchedTitleCount,5);
 assert.equal(r.groupSemanticsConsistentCount,5);
 assert.equal(r.rewardAndOutcomeFactsVerified,false);
 assert.equal(r.resultForPublication,false);
 assert.equal(JSON.stringify(r).includes('架空'),false);
});
test('missing or ambiguous title groups are not silently equated to verified event',()=>{
 const cards=[
 {title:'架空の第1段',sameGroupSize:2},
 {title:'架空の第1段',sameGroupSize:2},
 {title:'架空の第2段',sameGroupSize:3}
 ];
 const r=compareTitles(model(),cards);
 assert.equal(r.uniquelyMatchedTitleCount,1);
 assert.equal(r.groupSemanticsConsistentCount,1);
 assert.equal(r.notMatchedOrAmbiguousCount,4);
 assert.equal(r.rewardAndOutcomeFactsVerified,false);
});
test('refuse unpinned card, wrong source population and invalid observations',()=>{
 assert.throws(()=>compareTitles({...model(),id:30322},[]),/照合/);
 assert.throws(()=>compareTitles({...model(),events_ja:{}},[]),/照合/);
 assert.throws(()=>compareTitles(model(),[{title:'x',sameGroupSize:0.5}]),/照合/);
});

test('candidate DOM row numbers can differ from old routes without being treated as verified',()=>{
 const source=model();
 source.events_ja.a.choices=[{effects:[]}];
 source.events_ja.b.choices=[{effects:[]},{effects:[]}];
 source.events_ja.c.choices=[{outcomes:[[],[]]}];
 source.events_ja.d.choices=[{effects:[]},{effects:[]}];
 source.events_ja.e.choices=[{effects:[]},{effects:[]}];
 const visible=[
  {title:'架空の第1段',sameGroupSize:3,provisionalDetailRows:1},
  {title:'架空の第2段',sameGroupSize:3,provisionalDetailRows:1},
  {title:'架空の第3段',sameGroupSize:3,provisionalDetailRows:2},
  {title:'架空の通常一',sameGroupSize:2,provisionalDetailRows:2},
  {title:'架空の通常二',sameGroupSize:2,provisionalDetailRows:2}
 ];
 const r=compareTitles(source,visible);
 assert.equal(r.candidateRowHeuristicMatches,4);
 assert.equal(r.candidateRowHeuristicDifferences,1);
 assert.equal(r.provisionalComparisons.find(x=>x.historicalEventOrdinal===2).heuristicRowsMatch,false);
 assert.equal(r.rewardAndOutcomeFactsVerified,false);
 assert.equal(r.sourceRoutesAndRenderedRowsSemanticallyEquivalent,false);
 assert.doesNotMatch(JSON.stringify(r),/架空/);
});
