'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {scanOwnText,sourceFacts,compareProvisionalFacts}=
 require('../src/official_gametora_numeric_fact_parser.cjs');
test('parse signed Japanese and English game effects into label-free numeric facts',()=>{
 assert.deepEqual(scanOwnText('スピード +10'),{kind:'speed',amount:10,count:1,requiresReview:false});
 assert.equal(scanOwnText('体力－10').amount,-10);
 assert.equal(scanOwnText('スキル「架空」のヒントLv +2').kind,'skill_hint');
 assert.equal(scanOwnText('絆ゲージ +5').kind,'bond');
 assert.equal(scanOwnText('やる気 +1').kind,'mood');
 assert.equal(scanOwnText('おいしい！'),null);
 assert.equal(scanOwnText('不明 +5').kind,'unclassified');
 assert.equal(scanOwnText('パワー +5、スタミナ +10').requiresReview,true);
});
test('compare only normalized kind/value multiset, not result/choice correctness',()=>{
 const source={choices:[
  {effects:[{type:'speed',value:'+10'},{type:'skill_hint',value:'+1'}]},
  {outcomes:[
   [{type:'power',value:'+5'},{type:'chain_end'}],
   [{type:'power',value:'+15'}]
  ]}
 ]};
 const b=sourceFacts(source);
 assert.equal(b.length,4);
 const r=compareProvisionalFacts(source,
  ['スピード +10','スキルヒント +1','パワー +5','パワー +15'].map(scanOwnText));
 assert.equal(r.matchingKindAmountOccurrences,4);
 assert.equal(r.missingComparedToSource,0);
 assert.equal(r.extraComparedToSource,0);
 assert.equal(r.skillHintLevelMultisetMatches,true);
 assert.equal(r.visibleHintLevelOccurrences,1);
 assert.equal(r.effectOrderingOrBranchingVerified,false);
 assert.equal(r.skillNumericIdsVerified,false);
 assert.equal(JSON.stringify(r).includes('架空'),false);
});
test('missing or changed number remains explicitly unverified',()=>{
 const source={choices:[{effects:[{type:'speed',value:'+10'}]}]};
 const r=compareProvisionalFacts(source,['スピード +5','何か +1'].map(scanOwnText));
 assert.equal(r.matchingKindAmountOccurrences,0);
 assert.equal(r.missingComparedToSource,1);
 assert.equal(r.extraComparedToSource,1);
 assert.equal(r.visibleUnclassifiedFacts,1);
 assert.equal(r.missingEffectKinds.speed,1);
 assert.equal(r.publicationApproved,false);
});

test('bond and other non-skill effects stay visibly unresolved even if hint levels match',()=>{
 const old={choices:[{effects:[
  {type:'skill_hint',value:'+2'},{type:'bond',value:'+5'}
 ]}]};
 const r=compareProvisionalFacts(old,['ヒントLv +2'].map(scanOwnText));
 assert.equal(r.sourceHintLevelOccurrences,1);
 assert.equal(r.visibleHintLevelOccurrences,1);
 assert.equal(r.skillHintLevelMultisetMatches,true);
 assert.deepEqual(r.missingEffectKinds,{bond:1});
 assert.equal(r.missingComparedToSource,1);
 assert.equal(r.skillNumericIdsVerified,false);
 assert.equal(r.publicationApproved,false);
});
