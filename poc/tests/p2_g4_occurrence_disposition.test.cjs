'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const x=require('../src/p2_g4_occurrence_disposition.cjs');
test('scope explicit necessary gates and conditional same-state comparison separately',()=>{
 a.equal(x.decision('running_style').disposition,'adopt-static-necessary-gate-only');
 a.equal(x.decision('track_id').disposition,'retain-original-context-gate');
 const m=x.decision('motivation');
 a.equal(m.disposition,'conditional-fixed-state-shortcut-candidate');
 a.equal(m.requiredAssumptions.length,2);
 a.equal(m.actualOmissionApplied,false);
 a.equal(m.wholeANDVerified,false);
});
test('known mechanism never promotes full skill, approximate event state stays rejected, unknown stays held',()=>{
 a.equal(x.decision('order_rate').disposition,'conditional-mechanism-reference-only');
 a.equal(x.decision('is_overtake',[{disposition:'hold'}]).disposition,'reject-approximation-as-game-style-evidence');
 a.equal(x.decision('is_lastspurt',[{disposition:'hold'}]).disposition,'hold-spurt-full-conjunction');
 a.equal(x.decision('unseen_type').disposition,'hold-unverified-impact');
 a.throws(()=>x.decision('unknown',[{}]));
});
