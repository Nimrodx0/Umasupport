'use strict';
/*
 * Precisely reviewed event identity aliases; metadata hashes only.
 * This does NOT transfer event reward authority, certify current gameplay,
 * or publish source event titles. Restrict to pinned one-to-one source cases.
 */
const fail=msg=>{throw Error('Phase2 P0イベント同定: '+msg);};
// Eleven individual, pinned source-title variants. No general fuzzy matching.
// Numeric source keys and hashes identify the exact source events; no prose.
const TITLE_VARIANTS=Object.freeze([
 {cardId:"20003",checkerOrdinal:2,sourceOrdinal:4,gtLocalId:276,
  section:"arrows",checkerChoices:1,gtChoices:1,
  sourceKey:"checker:20003:64b991ae85ce3698544b",checkerTitleSha:"sha256:e851f6901a3bb170ee7c24883da21b6886b4c9d3c0b94ff7b10a15b55143c31d",
  gtTitleSha:"sha256:da6e88a2cbd5ecad8cc7a3819e7da4e574765ce8b83f172d8b69b6154c99cd8d",choiceShape:"N",
  hintSignatures:[[[200632,"+1"]]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_20003.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"20016",checkerOrdinal:3,sourceOrdinal:2,gtLocalId:84,
  section:"random",checkerChoices:2,gtChoices:2,
  sourceKey:"checker:20016:82e222e45bbcd4373e53",checkerTitleSha:"sha256:cb0b9f5d65a454c655a19715f9094fba305138abca537fad8836e25108b82974",
  gtTitleSha:"sha256:fc4f836792f7d206e16c7c184344fd81f1720ecb5d48bae3cc84f9851533a9b4",choiceShape:"SS",
  hintSignatures:[[],[]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_20016.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"20019",checkerOrdinal:2,sourceOrdinal:4,gtLocalId:308,
  section:"arrows",checkerChoices:1,gtChoices:1,
  sourceKey:"checker:20019:a470d4433e24a2b4e901",checkerTitleSha:"sha256:95bc8a0664e082df16507651a3d8cfe6e2c42aeedbeccce894173249222968ec",
  gtTitleSha:"sha256:a9dd5a19cf9ca7bf46f79785618f623ccf1927310327ef333c7fe70d2ecc7488",choiceShape:"N",
  hintSignatures:[[[200762,"+1"]]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_20019.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"20078",checkerOrdinal:3,sourceOrdinal:2,gtLocalId:84,
  section:"random",checkerChoices:2,gtChoices:2,
  sourceKey:"checker:20078:9412bebe510dc1dc2434",checkerTitleSha:"sha256:cb0b9f5d65a454c655a19715f9094fba305138abca537fad8836e25108b82974",
  gtTitleSha:"sha256:fc4f836792f7d206e16c7c184344fd81f1720ecb5d48bae3cc84f9851533a9b4",choiceShape:"SS",
  hintSignatures:[[],[]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_20078.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"20084",checkerOrdinal:1,sourceOrdinal:3,gtLocalId:435,
  section:"arrows",checkerChoices:1,gtChoices:1,
  sourceKey:"checker:20084:e85cdc4b4f8743c0565c",checkerTitleSha:"sha256:2fd4917bc91112ee487e522f9e0439205ed827317f319e5fb237807035495685",
  gtTitleSha:"sha256:cde6e50f4c4012a60d5819d4cce0150906c732b45e0a83850a9302cc8919de17",choiceShape:"N",
  hintSignatures:[[]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_20084.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"20100",checkerOrdinal:1,sourceOrdinal:3,gtLocalId:467,
  section:"arrows",checkerChoices:1,gtChoices:1,
  sourceKey:"checker:20100:f177a635c712e9ce3f5f",checkerTitleSha:"sha256:976d60a64de7df13b56eabc6fd69b9924412148fbc0e377388fd37e39a95b41b",
  gtTitleSha:"sha256:243a0e2b5be03b95987fcf61c3d74a1195c74252dd0332d73b79a26966fa9a45",choiceShape:"N",
  hintSignatures:[[]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_20100.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"20101",checkerOrdinal:2,sourceOrdinal:4,gtLocalId:470,
  section:"arrows",checkerChoices:1,gtChoices:1,
  sourceKey:"checker:20101:4ae2afa263cd8c4ebad9",checkerTitleSha:"sha256:61194cdcf818d591602ffa97b4702f6559c097703f941e5fc793580845214372",
  gtTitleSha:"sha256:ce60622be7c06dfe07ccefdb3446640f08250d1f72820ab1d888c0d72f2011ec",choiceShape:"N",
  hintSignatures:[[[203642,"+1"]]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_20101.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"30023",checkerOrdinal:2,sourceOrdinal:4,gtLocalId:535,
  section:"arrows",checkerChoices:1,gtChoices:1,
  sourceKey:"checker:30023:8f7bbf3ecd3c0ffe6b3c",checkerTitleSha:"sha256:a509ba1a484fa4f692a6d217d3bbe57b85c1ea41b7193a9759f12202e512925d",
  gtTitleSha:"sha256:d66ae7964cac51b36689ea680e6219f8e9eaf2d3f2e8a1fe84359d603c517243",choiceShape:"N",
  hintSignatures:[[]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_30023.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"30078",checkerOrdinal:4,sourceOrdinal:2,gtLocalId:84,
  section:"random",checkerChoices:2,gtChoices:2,
  sourceKey:"checker:30078:97254b85ee5bbac3481b",checkerTitleSha:"sha256:cb0b9f5d65a454c655a19715f9094fba305138abca537fad8836e25108b82974",
  gtTitleSha:"sha256:fc4f836792f7d206e16c7c184344fd81f1720ecb5d48bae3cc84f9851533a9b4",choiceShape:"SS",
  hintSignatures:[[],[]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_30078.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"30264",checkerOrdinal:2,sourceOrdinal:4,gtLocalId:1197,
  section:"arrows",checkerChoices:2,gtChoices:2,
  sourceKey:"checker:30264:8ae0be92df4edc630f06",checkerTitleSha:"sha256:0b280a6e1336ed300138e21f7899d86d6d59535ea00d2345ae6d24d1c10cdfa6",
  gtTitleSha:"sha256:2a5ae17ad0eeacfe477e0fa32fdfca665a3f50d528739b148349a472e67e3c56",choiceShape:"SS",
  hintSignatures:[[[203502,"+1"]],[]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_30264.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
 {cardId:"30315",checkerOrdinal:2,sourceOrdinal:4,gtLocalId:1333,
  section:"arrows",checkerChoices:2,gtChoices:2,
  sourceKey:"checker:30315:9214da7e3ef573a7024e",checkerTitleSha:"sha256:b53456b041145c65486762553c54d8e9f3dbf4912535da627c0e18df3f0520a6",
  gtTitleSha:"sha256:6eef93476e885d559fbd5f834c787578690146f6d57e43d4a384ad6c539e6e88",choiceShape:"SS",
  hintSignatures:[[[203872,"+1"]],[]],
  evidence:[
   'https://github.com/Cilda/UmaUmaChecker/blob/8cf9fcb3cc7239041161be75c84daf9f8f22d29f/UmaUmaChecker/Library/Events.json',
   'https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora/support_30315.json'
  ],decision:'SAME_EVENT_REVIEWED_TITLE_VARIANT'},
]);
// Title changes requiring independent editorial corroboration, not mere glyph normalization.
const EDITORIAL_RENAMES=Object.freeze([
 {cardId:'30104',checkerOrdinal:3,sourceOrdinal:5,gtLocalId:746,
  section:'arrows',checkerChoices:1,gtChoices:1,
  sourceKey:'checker:30104:79ed0ec24eb6ded2dbb9',
  checkerTitleSha:'sha256:e4a281c3a19e161596eeec428716a1ae812e2ffc123a3701326324dd5f96875a',
  gtTitleSha:'sha256:ea535cb1500d23b9873255942c234d8e80fb1b6e2525eae22a8414a5a46aabf0',
  evidence:['https://game8.jp/umamusume/464017','https://altema.jp/umamusume/support/226'],
  decision:'SAME_EVENT_INDEPENDENT_EDITORIAL_RENAMED',shape:'NO_CHOICE_HINT',
  expectedHint:[201121,'+1']},
 {cardId:'30267',checkerOrdinal:1,sourceOrdinal:3,gtLocalId:1205,
  section:'arrows',checkerChoices:1,gtChoices:1,
  sourceKey:'checker:30267:3b6b74eba72ee2687557',
  checkerTitleSha:'sha256:3b65fa1aa011f7c85a4a464105e2490d71e352640898126ba8b8eecf2c874d00',
  gtTitleSha:'sha256:163a9c33f1f7ae1c11cf365b7884ab0c15ec30155c67031b9a13a20c9efd1fd8',
  evidence:['https://game8.jp/umamusume/713261','https://gametora.com/ja/umamusume/supports/30267-calstone-light-o'],
  decision:'SAME_EVENT_INDEPENDENT_EDITORIAL_RENAMED',shape:'NO_CHOICE_TWO_RANDOM_OUTCOMES',
  expectedSpeeds:[30,20],expectedBonds:[15,5]}
]);
const CASES=Object.freeze([
 {
  cardId:'30139',checkerOrdinal:3,sourceKey:'checker:30139:1fb0bc07b47e6c3519b2',
  sourceOrdinal:5,gtLocalId:857,section:'arrows',checkerChoices:1,gtChoices:1,
  checkerTitleSha:'sha256:ffedb2a1ae173a568bb652c1478302066f461ef6697904dd0a2dcf10afd8df23',
  gtTitleSha:'sha256:c03ac5ed70e5afb12487bb27aa5b85cb3e61250f4c768c491616c50a4be0da3c',
  evidence:[
   'https://gamewith.jp/uma-musume/article/show/393389',
   'https://game8.jp/umamusume/520179'
  ],
  decision:'SAME_EVENT_KANJI_VARIANT',hintId:202581,hintLevels:[3,1]
 },
 {
  cardId:'30198',checkerOrdinal:1,sourceKey:'checker:30198:e7635856789a93b65b31',
  sourceOrdinal:3,gtLocalId:1017,section:'arrows',checkerChoices:2,gtChoices:2,
  checkerTitleSha:'sha256:00521f8a7574bb8953742b9f60939a03605787fd953cc12ebb5a0f9353e13ee4',
  gtTitleSha:'sha256:b375c832551b3b98b540b52b5f143eccf24785e059426aec62d869b37d944d51',
  evidence:[
   'https://gamewith.jp/uma-musume/article/show/444503',
   'https://game8.jp/umamusume/603618'
  ],
  decision:'SAME_EVENT_ABBREVIATED_TITLE'
 }
,...TITLE_VARIANTS,...EDITORIAL_RENAMES]);
function applyReviewedAliases({cardId,checkerEvents,gtEvents,rawGtEvents,paired}){
 if(!Array.isArray(checkerEvents)||!Array.isArray(gtEvents)||!paired||
    !Array.isArray(paired.selected)||!Array.isArray(paired.unmatchedC)||
    !Array.isArray(paired.unmatchedG))fail('元索引の形式が不正');
 const cases=CASES.filter(x=>x.cardId===cardId);
 if(!cases.length)return {paired,matched:[]};
 const selected=[...paired.selected],
   unmatchedC=new Set(paired.unmatchedC),
   unmatchedG=new Set(paired.unmatchedG),matched=[];
 for(const rule of cases){
  const cIdx=rule.checkerOrdinal-1,gIdx=rule.sourceOrdinal-1;
  const c=checkerEvents[cIdx],g=gtEvents[gIdx],original=rawGtEvents?.[gIdx];
  if(!unmatchedC.has(cIdx)||!unmatchedG.has(gIdx)||
     !c||!g||!original||c.sourceKey!==rule.sourceKey||
     c.sourceIndex!==cIdx||c.strict!==rule.checkerTitleSha||
     g.strict!==rule.gtTitleSha||
     c.optionCount!==rule.checkerChoices||
     g.choiceCount!==rule.gtChoices||
     g.sourceOrdinal!==rule.sourceOrdinal||
     g.sourceLocalEventId!==rule.gtLocalId||
     g.section!==rule.section||
     original.id!==rule.gtLocalId||original.section!==rule.section||
     original.choices?.length!==rule.gtChoices)
    fail('個別のタイトル・カードID・元の選択/結果構造が変更されています: '+cardId);
  if(rule.decision==='SAME_EVENT_KANJI_VARIANT'){
   const choice=original.choices[0];
   const hints=choice?.outcomes?.map(outcome=>
    outcome.filter(e=>e.type==='skill_hint').map(e=>[e.skill_id,e.value]));
   if(choice.label!==''||choice.random_either!==true||
      hints?.length!==2||hints.some((h,i)=>h.length!==1||
       h[0][0]!==rule.hintId||h[0][1]!=='+'+rule.hintLevels[i]))
    fail('大成功／成功のヒントLvが変化した: '+cardId);
  }else if(rule.decision==='SAME_EVENT_ABBREVIATED_TITLE'){
   if(original.choices[0].label===''||
      original.choices[1].label===''||
      (original.choices[0].effects||[]).some(x=>x.type==='chain_end')||
      !(original.choices[1].effects||[]).some(x=>x.type==='chain_end'))
    fail('前段イベントの選択肢別終了状態が変化した: '+cardId);
  }else if(rule.decision==='SAME_EVENT_REVIEWED_TITLE_VARIANT'){
   if(original.choices.map(c=>c.label?'S':'N').join('')!==rule.choiceShape||
      original.choices.some(c=>c.random_either!==false||
       c.outcomes!==undefined||c.segments!==undefined||
       !Array.isArray(c.effects)||
       c.effects.some(e=>e.type==='chain_end'))||
      JSON.stringify(original.choices.map(c=>c.effects.filter(e=>
       e.type==='skill_hint').map(e=>[e.skill_id,e.value])))!==
       JSON.stringify(rule.hintSignatures))
    fail('個別表記差イベントの選択とヒントの元形状が変化した: '+cardId);
  }else if(rule.decision==='SAME_EVENT_INDEPENDENT_EDITORIAL_RENAMED'){
   const choice=original.choices[0];
   if(choice.label!==''||rule.gtChoices!==1)
    fail('編集記事同定イベントの元選択肢が変化した: '+cardId);
   if(rule.shape==='NO_CHOICE_HINT'){
    const hints=choice.effects?.filter(e=>e.type==='skill_hint')||[];
    if(choice.random_either!==false||choice.outcomes!==undefined||
       hints.length!==1||hints[0].skill_id!==rule.expectedHint[0]||
       hints[0].value!==rule.expectedHint[1])
     fail('編集記事のスキルヒントが固定元と一致しない: '+cardId);
   }else if(rule.shape==='NO_CHOICE_TWO_RANDOM_OUTCOMES'){
    const routes=choice.outcomes?.map(row=>({
     speed:row.filter(e=>e.type==='speed').map(e=>e.value),
     bond:row.filter(e=>e.type==='bond').map(e=>e.value)
    }));
    if(choice.random_either!==true||routes?.length!==2||
       !routes.every((row,i)=>row.speed.length===1&&
        row.speed[0]==='+'+rule.expectedSpeeds[i]&&
        row.bond.length===1&&row.bond[0]==='+'+rule.expectedBonds[i]))
     fail('編集記事の大成功／成功2結果形状が固定元と一致しない: '+cardId);
   }else fail('未対応の編集記事同定の構造');
  }else fail('不明な同定の根拠');
  unmatchedC.delete(cIdx);unmatchedG.delete(gIdx);
  selected.push({ci:cIdx,gi:gIdx,status:'reviewed-alias-paired',reviewEvidence:{
   decision:rule.decision,
   evidenceUrls:rule.evidence,sourceRevisionPinned:true,
   currentGameVerified:false,publicationApproved:false
  }});
  matched.push({cardId,sourceKey:rule.sourceKey,checkerOrdinal:rule.checkerOrdinal,
   sourceOrdinal:rule.sourceOrdinal,gtLocalId:rule.gtLocalId,
   decision:rule.decision,evidenceUrls:rule.evidence,
   currentGameVerified:false,publicationApproved:false});
 }
 return {paired:{selected,unmatchedC:[...unmatchedC].sort((a,b)=>a-b),
  unmatchedG:[...unmatchedG].sort((a,b)=>a-b)},matched};
}
module.exports={CASES,applyReviewedAliases};
