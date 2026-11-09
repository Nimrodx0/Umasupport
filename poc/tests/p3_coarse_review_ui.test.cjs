'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=require('../src/p3_coarse_review_ui.js');
const labels={逃げ:'favorable',先行:'mixed',差し:'unresolved',追込:'unfavorable'};
function sample(id='30101'){
  return {
    cardId:id,cardName:'架空・<img src=x onerror=alert(1)>',stage:4,
    coverage:{verifiedNormalHints:true,reviewedEventData:false,
      unmatchedSkills:1,uniqueSkillCandidates:1},
    coarseDirection:{status:'non-dominated-evidence-candidates-not-card-score',styles:['逃げ']},
    styles:Object.fromEntries(ui.STYLES.map(s=>[s,{
      label:labels[s],evidenceCount:s==='逃げ'?1:0,
      headlineFavorable:s==='逃げ'?1:0,
      headlineUnfavorable:s==='追込'?1:0,
      conditionalFavorable:0,unknown:s==='差し'?1:0,
      onlyBroadReference:s==='先行'
    }])),
    sourceHints:[{id:'hint:a',name:'架空スキル',
      availability:'route-conditional-only',sourceRouteTypes:['event'],
      sourceNumericId:null,researchSignals:{逃げ:'explicit-targeted',
        先行:'broad-favorable',差し:'unresolved',追込:'explicit-ineligible'}}]
  };
}
function report(examples=[sample()]){
  return {schemaVersion:1,
    status:'p3-default-style-research-preview-only-not-product-deck-score',
    version:'p3-coarse-default-preview-v0',
    modelRevision:'fixed-test',examples};
}
test('accepts only the expected research-only report and separate exact 4-style results',()=>{
  assert.equal(ui.validateReport(report()).examples.length,1);
  assert.throws(()=>ui.validateReport({...report(),schemaVersion:2}),/研究レポート/);
  assert.throws(()=>ui.validateReport({...report(),status:'production-grade'}),/研究レポート/);
  const corrupted=report();
  corrupted.examples[0].styles['逃げ'].label='best-overall-card';
  assert.throws(()=>ui.validateReport(corrupted),/脚質別/);
});
test('denies duplicate card IDs and malformed evidence route schema',()=>{
  assert.throws(()=>ui.validateReport(report([sample(),sample()])),/重複/);
  const corrupted=report();corrupted.examples[0].sourceHints[0].availability='guaranteed';
  assert.throws(()=>ui.validateReport(corrupted),/根拠スキル/);
});
test('keeps conditional and unknown independent of directional counts',()=>{
  const x=sample(),c=ui.counts(x,'差し');
  assert.equal(c.unknown,1);
  assert.equal(c.positive,0);
  assert.equal(c.negative,0);
  assert.equal(ui.counts(x,'逃げ').positive,1);
  assert.equal(ui.signalInfo('unresolved').kind,'unknown');
  assert.equal(ui.signalInfo('explicit-ineligible').kind,'explicit');
  assert.equal(ui.signalInfo('not-a-signal').kind,'unknown');
});
test('filters samples without converting unresolved or broad-only into high card ratings',()=>{
  const a=sample('30101'),b=sample('30102');
  b.cardName='別カード';
  b.coarseDirection={status:'not-distinguishable-with-current-evidence',styles:[]};
  b.styles['先行'].label='unresolved';
  const r=ui.validateReport(report([a,b]));
  assert.equal(ui.filterCards(r,{query:'30102'}).length,1);
  assert.deepEqual(ui.filterCards(r,{filter:'direction'}).map(x=>x.cardId),['30101']);
  assert.deepEqual(ui.filterCards(r,{filter:'ambiguous'}).map(x=>x.cardId),['30102']);
  assert.equal(ui.filterCards(r,{style:'先行',filter:'weak-only'}).length,2);
  assert.equal(ui.filterCards(r,{style:'逃げ',filter:'mixed'}).length,0);
  assert.equal(ui.filterCards(r,{style:'先行',filter:'mixed'}).length,1);
  assert.equal(ui.cardDirection(b),'単独の方向は判断保留');
});

test('diagnostic sample deliberately covers mixed, unknown, limited, and conditional cases',()=>{
  const {selectReviewExamples}=require('../tools/audit_default_coarse_card_preview.cjs');
  function scenario(id){
    const c=sample(id);c.skills=[];
    for(const style of ui.STYLES)c.styles[style].strongFourStyleEvidence=0;
    return c;
  }
  const a=scenario('1'),b=scenario('2'),c=scenario('3'),d=scenario('4'),e=scenario('5'),f=scenario('6');
  b.coarseDirection.styles=['逃げ','先行'];
  c.coarseDirection.styles=[]; c.styles['逃げ'].label='mixed';
  d.coarseDirection.styles=[];for(const style of ui.STYLES)d.styles[style].label='unresolved';
  e.skills=[{availability:'route-conditional-only',styles:Object.fromEntries(
    ui.STYLES.map(s=>[s,{signal:s==='逃げ'?'explicit-targeted':'unresolved'}]))}];
  f.styles['差し'].strongFourStyleEvidence=3;
  const picked=selectReviewExamples([f,e,d,c,b,a],6);
  assert.equal(picked.length,6);
  assert.equal(new Set(picked.map(x=>x.card.cardId)).size,6);
  assert(picked.some(x=>x.reason==='single-style-candidate'));
  assert(picked.some(x=>x.reason==='multi-style-candidate'));
  assert(picked.some(x=>x.reason==='mixed-without-leader'));
  assert(picked.some(x=>x.reason==='all-material-insufficient'));
});

test('static reviewer is independent of production app and does not transmit or persist file data',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../p3-coarse-review.html'),'utf8');
  assert(html.includes('p3_coarse_review_ui.js'));
  assert(html.includes('type="file"'));
  assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|innerHTML\s*=/.test(html));
  assert(!/<script[^>]+src=["']https?:/i.test(html));
  assert(!/live_app\.js|core\.js/.test(html));
  assert(html.includes('未収録・条件付き・未照合は低評価に含めません'));
});
