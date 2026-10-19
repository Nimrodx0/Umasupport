#!/usr/bin/env node
'use strict';
const {fromDisk}=require('../src/editorial_choice_review.cjs');
try{
 const counts=fromDisk();
 if(counts.reviewedEventKeys!==3||counts.reviewedChoicePositions!==6||
   counts.numericHintMentions!==11||counts.unresolvedNonSkillDiscrepancies!==2||
   counts.currentGameOutcomeTiersConfirmed!==0||counts.verifiedAcquisitionRoutes!==0)
  throw Error('Review population or approval status differs from expected fixed evidence');
 console.log('Numeric choice-position editorial review integrity:',JSON.stringify(counts));
}catch(e){console.error('EDITORIAL_CHOICE_REVIEW_FAILED:',e.message);process.exitCode=1}
