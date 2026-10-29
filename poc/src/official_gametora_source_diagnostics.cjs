'use strict';
/*
 * Source-only diagnostics for the generic GameTora adapter. Never returns
 * source text, card names, skill names or matched source snippets.
 * A successful structural count is NOT a declaration of valid game rewards.
 */
const {scanOwnText}=require('./official_gametora_numeric_fact_parser.cjs');
const {parseNumericFactWithLocalContext}=
 require('./official_gametora_existing_normalized_parity.cjs');
const fail=s=>{throw Error('GameTora表示効果診断: '+s);};
const validContexts=a=>Array.isArray(a)&&a.length<=6&&
 a.every(x=>typeof x==='string'&&x.length<=300);
const isSigned=s=>/[+＋\-－−]\s*\d/.test(s);
function classifyNumericLeaf(text,contexts=[]){
 if(typeof text!=='string'||text.length>400||!validContexts(contexts))
  fail('raw-leaf-bounds');
 const scanned=scanOwnText(text);
 if(!scanned)return 'not-signed-numeric';
 // A slash/range containing an unsigned second value is easily mistaken
 // for one scalar by the current AMOUNT matcher. Until explicitly modeled,
 // preserve it as an unknown alternative, never a single awarded amount.
 if(/(?:[+＋\\-－−]\\s*)?\\d{1,5}\\s*[/／～〜]\\s*(?:[+＋\\-－−]\\s*)?\\d{1,5}(?!\\d)/.test(text))
  return 'numeric-range-or-alternative';
 const interpreted=parseNumericFactWithLocalContext(text,contexts);
 const fact=interpreted.fact;
 if(!fact||!fact.requiresReview&&Number.isSafeInteger(fact.amount)){
  return interpreted.resolvedWithContext?
   'resolved-by-unique-local-context':'parsed-scalar';
 }
 if(scanned.count>1)return 'multiple-signed-numbers';
 if(scanned.kind==='unclassified'){
  const contextHint=contexts.some(s=>/ヒント|hint/i.test(s));
  const range=/\d\s*[/／～〜]\s*[+＋\-－−]?\s*\d/.test(text);
  if(range)return 'numeric-range-or-alternative';
  return contextHint?'unclassified-hint-related':'unclassified-effect-kind';
 }
 if(scanned.amount===null)return 'unknown-numeric-shape';
 return 'unresolved-amount-or-kind';
}
function summarizeNumericPieces(routes){
 if(!Array.isArray(routes)||routes.length>60)fail('route-count-invalid');
 const totals={};
 const affected=[];
 let rawSignedLeaves=0;
 for(const r of routes){
  if(!r||!Number.isSafeInteger(r.choiceOrdinal)||r.choiceOrdinal<1||
     !Number.isSafeInteger(r.outcomeOrdinal)||r.outcomeOrdinal<1||
     !Array.isArray(r.numericEffectTexts)||!Array.isArray(r.numericEffectContexts)||
     r.numericEffectContexts.length!==r.numericEffectTexts.length||
     r.numericEffectTexts.length>80)fail('route-position-or-effects-invalid');
  const kinds={};
  for(let i=0;i<r.numericEffectTexts.length;i++){
   const raw=r.numericEffectTexts[i],ctx=r.numericEffectContexts[i];
   const category=classifyNumericLeaf(raw,ctx);
   if(category==='not-signed-numeric'||!isSigned(raw))fail('source-numeric-leaf-invalid');
   rawSignedLeaves++;
   totals[category]=(totals[category]||0)+1;
   kinds[category]=(kinds[category]||0)+1;
  }
  const outstanding=Object.keys(kinds).filter(x=>x!=='parsed-scalar'&&
   x!=='resolved-by-unique-local-context');
  if(outstanding.length)affected.push({
   choiceOrdinal:r.choiceOrdinal,outcomeOrdinal:r.outcomeOrdinal,
   ...Object.fromEntries(outstanding.map(x=>[x,kinds[x]]))
  });
 }
 return {rawSignedLeaves,categoryCounts:totals,
  unresolvedRoutePositions:affected,
  rawTextEmitted:false,allEffectSemanticsVerified:false,
  publicationApproved:false};
}
function categorizePanelGeometry(x){
 if(!x||typeof x!=='object')fail('panel-geometry-required');
 const keys=['panelElementCount','panelOwnTextNodes','panelDirectChildren',
  'panelImages','panelLinks','panelTables','panelButtons','panelSignedOwnTextCount'];
 if(keys.some(k=>!Number.isSafeInteger(x[k])||x[k]<0))fail('geometry-invalid');
 if(x.panelElementCount===0)return 'no-panel-elements';
 if(x.panelOwnTextNodes===0)return 'no-panel-text';
 if(x.panelSignedOwnTextCount===0)return 'nonempty-panel-without-signed-effects';
 return 'panel-with-signed-effects';
}
module.exports={classifyNumericLeaf,summarizeNumericPieces,categorizePanelGeometry};
