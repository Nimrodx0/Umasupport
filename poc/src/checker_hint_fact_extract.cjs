/*
 * Local-only checker hint-fact extraction. Checker source material is
 * GameWith-derived; its public GitHub availability does NOT license text
 * republication or GameWith site crawling.
 *
 * Output is an editorial diagnostic, not a public event catalog. No source
 * title, choice dialogue or effect string is included in result.
 */
'use strict';
const pipeline=require('./checker_candidate_pipeline.cjs');
const norm=x=>String(x).normalize('NFKC').replace(/[◯〇]/g,'○').replace(/\s+/g,' ').trim();
const HINT=/[『「]([^』」\n]+)[』」]\s*のヒント\s*Lv\s*[+＋]\s*([0-9]+)/gu;
const CONDITIONAL=/大成功|成功|失敗|確率|ランダム|打ち切り|継続|次のイベント|次に進/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function buildRegistry(sourceText){
 const rows=JSON.parse(sourceText);
 if(!Array.isArray(rows)||rows.length<100)throw Error('invalid full skill registry');
 const ids=new Set(),byName=new Map();
 for(const r of rows){
  if(!object(r)||typeof r.id!=='string'||!/^\d+$/.test(r.id)||ids.has(r.id)||
    typeof r.name!=='string')throw Error('invalid or duplicated skill record');
  ids.add(r.id);
  if(r.rarity!=='normal'&&r.rarity!=='rare')continue;
  const k=norm(r.name);
  if(!byName.has(k))byName.set(k,[]);
  byName.get(k).push(r.id);
 }
 return byName;
}
function extract({source,model,skillText,aliases={}}){
 // Aliases are for cards that have NO strict source-name match. As the
 // community data evolves, a previously aliased card may become an exact
 // name match. Never let a stale alias override that exact join.
 const strict=pipeline.inventory({source,model,aliases:{}});
 const matched=new Set(strict.cards.map(x=>x.cardId));
 const activeAliases={},staleAliasIds=[];
 for(const [id,name] of Object.entries(aliases)){
  if(matched.has(id)){staleAliasIds.push(id);continue;}
  const card=model.cardById?.[id]||model.cards.find(x=>x.id===id);
  if(!card)throw Error('unknown alias card ID '+id);
  const rows=Object.keys(source.Skills[card.rarity]||{})
   .filter(x=>norm(x)===norm(name));
  if(rows.length>1)throw Error('ambiguous alias source '+id);
  if(rows.length===0){staleAliasIds.push(id);continue;}
  activeAliases[id]=name;
 }
 const catalog=pipeline.inventory({source,model,aliases:activeAliases});
 const byName=buildRegistry(skillText);
 const results=[],stats={
  staleAliasRecords:staleAliasIds.length,
  cardsWithCandidates:0,eventsObserved:0,choiceRowsObserved:0,
  extractedHintRows:0,matchedNumericHints:0,
  unresolvedHints:0,ambiguousHints:0,
  conditionalChoiceRows:0,unparsedHintChoiceRows:0
 };
 for(const card of catalog.cards){
  const modelCard=model.cardById?.[card.cardId]||model.cards.find(x=>x.id===card.cardId);
  if(!modelCard)throw Error('unrecognized card ID '+card.cardId);
  const name=card.join==='reviewed-name-alias'?activeAliases[card.cardId]:modelCard.name;
  const bucket=source.Skills[card.rarity];
  const sourceRows=Object.entries(bucket).filter(([key])=>norm(key)===norm(name));
  if(sourceRows.length!==1)throw Error('ambiguous Checker card source for '+card.cardId);
  const originals=sourceRows[0][1].Events;
  if(originals.length!==card.events.length)throw Error('event list cardinality drift');
  const events=[];
  for(const event of card.events){
   const original=originals[event.sourceIndex];
   if(!object(original)||Object.keys(original).length!==1)throw Error('event shape drift');
   const choices=Object.values(original)[0];
   if(!Array.isArray(choices)||choices.length!==event.optionCount)throw Error('option count drift');
   const positions=[];
   choices.forEach((choice,i)=>{
    const effect=choice.Effect;
    if(typeof effect!=='string')throw Error('invalid source effect');
    const matches=[...effect.matchAll(HINT)];
    const residue=effect.replace(HINT,'');
    const unparsedHint=residue.includes('ヒント');
    const conditional=CONDITIONAL.test(effect);
    const hints=matches.map(x=>{
     const level=Number(x[2]),name=norm(x[1]),candidateIds=byName.get(name)||[];
     if(!Number.isSafeInteger(level)||level<1||level>10)throw Error('invalid hint level');
     const fact={level};
     if(candidateIds.length===1){
      fact.skillId=candidateIds[0];
      stats.matchedNumericHints++;
     }else{
      fact.skillName=name; // Game skill name as identifier, not source prose
      fact.resolution=candidateIds.length?'ambiguous':'missing';
      if(candidateIds.length)stats.ambiguousHints++;
      else stats.unresolvedHints++;
     }
     stats.extractedHintRows++;
     return fact;
    });
    if(unparsedHint)stats.unparsedHintChoiceRows++;
    if(conditional)stats.conditionalChoiceRows++;
    positions.push({ordinal:i+1,observedHints:hints,
     needsManualResultReview:conditional||unparsedHint,
     ...(unparsedHint?{unparsedHintSyntax:true}:{})});
    stats.choiceRowsObserved++;
   });
   events.push({
    sourceKey:event.sourceKey,sourceDigest:event.sourceDigest,
    sourceEventOrdinal:event.sourceIndex+1,
    choices:positions,
    requiresFullReview:true
   });
   stats.eventsObserved++;
  }
  results.push({cardId:card.cardId,rarity:card.rarity,events});
  stats.cardsWithCandidates++;
 }
 return {
  schemaVersion:1,source:'UmaUmaChecker local diagnostic',
  approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',
  stats:{...catalog.stats,...stats},
  cards:results,
  warning:'GameWith-derived source, possible rights/accuracy limits; only observed skill facts and candidate IDs, never approved game event routes'
 };
}
module.exports={buildRegistry,extract};
