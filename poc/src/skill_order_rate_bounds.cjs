'use strict';
/* Rank-percent-to-integer-position *source interpretation*, never a skill
 * activation probability. GameTora documents round(fieldSize * pct/100),
 * then compares the 1-indexed integer order with the ORIGINAL operator.
 * Pinned UmaSim SkillChecker does not implement order_rate: this is
 * independently documented conversion, not direct JP engine verification. */
const VERSION='order-rate-integer-projection-v1';
const FIELDS=Object.freeze([9,12]);
const OPS=new Set(['==','!=','<','<=','>','>=']);
const SOURCE=Object.freeze({
 sourceSkillCode:'order_rate',
 conversion:'round-half-up(positive fieldSize * sourcePercentage / 100)',
 orderSemantics:'1-indexed rank compared to rounded boundary with original operator',
 documentation:'https://gametora.com/umamusume/skill-condition-viewer',
 corroboration:'https://wiki.biligame.com/umamusume/马娘比赛机制',
 UmaSimSource:'https://github.com/mee1080/umasim/blob/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt',
 status:'secondary-explanation-and-model-agreement-not-independent-JP-engine-verification'
});
function compare(a,operator,b){
 switch(operator){
 case '==':return a===b;
 case '!=':return a!==b;
 case '<':return a<b;
 case '<=':return a<=b;
 case '>':return a>b;
 case '>=':return a>=b;
 default:throw Error('Unsupported comparison operator');
 }
}
function cutoff(fieldSize,sourcePercent){
 if(!FIELDS.includes(fieldSize)||!Number.isSafeInteger(sourcePercent)||
  sourcePercent<0||sourcePercent>100)
  throw Error('Only reference-checked fields 9/12 and source rates 0..100');
 // Integer numerator avoids floating inconsistencies (e.g. 75% of 9).
 return Math.floor((fieldSize*sourcePercent+50)/100);
}
function predicate(cond,fieldSize){
 if(!cond||cond.type!=='order_rate'||!OPS.has(cond.operator)||
  !Number.isSafeInteger(cond.value))
  throw Error('Expected exact original order_rate predicate');
 const boundary=cutoff(fieldSize,cond.value);
 // The source documentation is unclear on an effective 0th-place
 // boundary for small positive percentages. Don't silently clamp it.
 if(boundary===0)return {status:'held-zero-boundary-game-clamp-unverified',
  source:{type:cond.type,operator:cond.operator,value:cond.value},
  fieldSize,boundary,positions:null};
 const positions=Array.from({length:fieldSize},(_,i)=>i+1)
  .filter(n=>compare(n,cond.operator,boundary));
 return {status:'projected-relative-to-sourced-integer-rounding',
  source:{type:cond.type,operator:cond.operator,value:cond.value},
  fieldSize,boundary,positions,
  firstRank:positions[0]??null,lastRank:positions.at(-1)??null};
}
function andProjection(row,fieldSize){
 if(!Array.isArray(row)||row.some(c=>!c||typeof c.type!=='string'||
  typeof c.operator!=='string'||!Number.isSafeInteger(c.value)))
  throw Error('Malformed source AND row');
 const ranks=row.filter(c=>c.type==='order_rate');
 const nonRank=row.filter(c=>c.type!=='order_rate')
  .map(({type,operator,value})=>({type,operator,value}));
 if(!ranks.length)return {status:'no-order-rate',fieldSize,
  sourceRankPredicates:[],otherAndPredicates:nonRank,positions:null};
 const predicates=ranks.map(c=>predicate(c,fieldSize));
 if(predicates.some(c=>c.status!=='projected-relative-to-sourced-integer-rounding'))
  return {status:'held-unverified-boundary',fieldSize,
   sourceRankPredicates:predicates,otherAndPredicates:nonRank,
   positions:null};
 const positions=Array.from({length:fieldSize},(_,i)=>i+1)
  .filter(n=>predicates.every(c=>c.positions.includes(n)));
 return {status:positions.length?'rank-subcondition-projection':
  'rank-subcondition-empty-under-reference-mapping',
  fieldSize,sourceRankPredicates:predicates,
  otherAndPredicates:nonRank,positions,
  firstRank:positions[0]??null,lastRank:positions.at(-1)??null,
  // NOT "skill activation possible" if non-rank AND terms remain.
  caveat:nonRank.length?
   'Rank-only projection. All other AND terms must also pass.':
   'Rank predicate only; actual skill timing/activation not simulated.'};
}
function byField(row){
 return {mappingVersion:VERSION,referenceStatus:SOURCE.status,
  byField:Object.fromEntries(FIELDS.map(n=>[n,andProjection(row,n)]))};
}
function groupedProjection(orRows,fieldSize){
 if(!Array.isArray(orRows))throw Error('Invalid source OR branches');
 const branches=orRows.map(row=>andProjection(row,fieldSize));
 const reachable=branches.filter(b=>b.positions!==null);
 const allComplete=reachable.length===branches.length&&
  branches.every(b=>b.sourceRankPredicates.length>0);
 const positions=allComplete?[...new Set(
  reachable.flatMap(b=>b.positions))].sort((a,b)=>a-b):null;
 return {status:!branches.length?'held-no-OR-paths':!allComplete?
  'held-unknown-OR-path':'rank-only-OR-union',
  fieldSize,branches,positions,
  // Source branches are preserved even if the rank-only union is possible.
  note:'OR projection does not combine non-rank AND/preConditions or invoke effects'};
}
module.exports={VERSION,FIELDS,OPS,SOURCE,cutoff,compare,predicate,
 andProjection,byField,groupedProjection};
