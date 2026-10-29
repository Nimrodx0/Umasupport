'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {classifyNumericLeaf,summarizeNumericPieces,categorizePanelGeometry}=
 require('../src/official_gametora_source_diagnostics.cjs');
test('numeric observation reports distinct root causes without emitting source prose',()=>{
 assert.equal(classifyNumericLeaf('体力 +10'),'parsed-scalar');
 assert.equal(classifyNumericLeaf('体力 +10/20'),'numeric-range-or-alternative');
 assert.equal(classifyNumericLeaf('スキルPt +10 / +20'),'numeric-range-or-alternative');
 assert.equal(classifyNumericLeaf('体力 +10 ・スピード +5'),'multiple-signed-numbers');
 assert.equal(classifyNumericLeaf('未登録効果 +12'),'unclassified-effect-kind');
 // A matching *ancestor* can make an otherwise unclassified leaf look
 // locally classifiable. Record this as contextual, not independently proven.
 assert.equal(classifyNumericLeaf('新しい効果 +5',['『未知スキル』ヒントLv +5']),
  'resolved-by-unique-local-context');
 assert.equal(classifyNumericLeaf('何もない'),'not-signed-numeric');
});
test('source-only numeric summary retains route coordinates and no raw text',()=>{
 const result=summarizeNumericPieces([{
  choiceOrdinal:1,outcomeOrdinal:1,
  numericEffectTexts:['体力 +10','体力 +10/20','未登録効果 +2'],
  numericEffectContexts:[[],[],[]]
 },{
  choiceOrdinal:1,outcomeOrdinal:2,
  numericEffectTexts:['スキルPt +10'],numericEffectContexts:[[]]
 }]);
 assert.equal(result.rawSignedLeaves,4);
 assert.deepEqual(result.unresolvedRoutePositions,[{
  choiceOrdinal:1,outcomeOrdinal:1,
  'numeric-range-or-alternative':1,
  'unclassified-effect-kind':1
 }]);
 assert.equal(result.categoryCounts['parsed-scalar'],2);
 assert.equal(result.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(result),/体力|未登録効果|スキルPt/);
 const broken=[{choiceOrdinal:1,outcomeOrdinal:1,numericEffectTexts:['数字なし'],
  numericEffectContexts:[[]]}];
 assert.throws(()=>summarizeNumericPieces(broken),/source-numeric-leaf-invalid/);
});
test('panel geometry distinguishes text-only / no-effect / effect, not publication',()=>{
 const base={panelElementCount:10,panelOwnTextNodes:2,panelDirectChildren:1,
  panelImages:0,panelLinks:0,panelTables:0,panelButtons:0,
  panelSignedOwnTextCount:0};
 assert.equal(categorizePanelGeometry(base),'nonempty-panel-without-signed-effects');
 assert.equal(categorizePanelGeometry({...base,panelSignedOwnTextCount:1}),'panel-with-signed-effects');
 assert.equal(categorizePanelGeometry({...base,panelOwnTextNodes:0}),'no-panel-text');
 assert.throws(()=>categorizePanelGeometry({...base,panelElementCount:-1}),/geometry-invalid/);
});
