'use strict';
/*
 * Card-agnostic, GameTora original-site DOM -> original route pieces.
 * Runs inside Playwright's browser via locator.evaluate(extractRoutePieces).
 * No GameWith, mirrored source, source/event card whitelist or text export.
 * The returned raw pieces are ephemeral process memory, not deployment data.
 */
function extractRoutePieces(button){
     const panel=[...button.parentElement.children].find(x=>x.tagName==='DIV');
     const body=panel?.firstElementChild?.firstElementChild?.firstElementChild
      ?.firstElementChild?.children?.[1];
     if(!body)return [];
     const groups=[...body.children];
     if(groups.length>20)throw Error('GameTora結果表示グループが上限超過、黙って欠落させません');
     return groups.flatMap((group,choiceIndex)=>{
      const inner=group.children.length===1?group.firstElementChild:group;
      const rows=[...inner.children];
      const separators=rows.map((el,i)=>({el,i})).filter(x=>
       /^(?:OR|または|又は)$/i.test((x.el.innerText||'').trim()));
      const allOrLeaves=[...group.querySelectorAll('*')].filter(el=>
       el.children.length===0&&/^(?:OR|または|又は)$/i.test((el.innerText||'').trim()));
      let segments=[[group]],ambiguous=allOrLeaves.length>0;
      if(separators.length===1){
       const pos=separators[0].i;
       if(pos>0&&pos<rows.length-1){
        segments=[rows.slice(0,pos),rows.slice(pos+1)];
        ambiguous=false;
       }
      }else if(allOrLeaves.length===1){
       // Some newly released cards nest an OR into a reward row instead
       // of placing it among the direct children of the choice group.
       // Find a *structurally explicit* delimiter with nonempty siblings
       // on both sides. Do not fabricate branch counts from old mirrors.
       const orLeaf=allOrLeaves[0];
       let at=orLeaf;
       while(at&&group.contains(at.parentElement)){
        const parent=at.parentElement;
        const siblings=[...parent.children];
        const index=siblings.indexOf(at);
        if(index>0&&index<siblings.length-1&&
           /^(?:OR|または|又は)$/i.test((at.innerText||'').trim())){
         segments=[siblings.slice(0,index),siblings.slice(index+1)];
         ambiguous=false;
         break;
        }
        at=parent;
       }
      }
      const fragments=[group,...group.querySelectorAll('*')]
       .map(el=>[...el.childNodes].filter(n=>n.nodeType===3)
        .map(n=>n.textContent||'').join('').trim())
       .filter(t=>t.length>0);
      if(fragments.length>100)throw Error('GameTora結果グループの文字列件数上限、黙って切り捨てません');
      const groupOwnTextFragments=fragments.map(t=>t.slice(0,250));
      return segments.map((roots,outcomeIndex)=>{
       const own=[];
       for(const root of roots)for(const el of [root,...root.querySelectorAll('*')]){
        const t=[...el.childNodes].filter(x=>x.nodeType===3)
         .map(n=>n.textContent||'').join('').trim();
        if(/ヒント|hint/i.test(t)&&/[+＋\-－−]\s*\d/.test(t)){
         const contexts=[];
         for(let p=el,d=0;p&&group.contains(p)&&d<5;p=p.parentElement,d++){
          const str=p.innerText||'';
          if(str.length<=240)contexts.push(str);
         }
         own.push({text:t.slice(0,240),contexts:contexts.slice(0,5)});
        }
       }
       const numericEffectTexts=[],numericEffectContexts=[];
       for(const root of roots)for(const el of [root,...root.querySelectorAll('*')]){
        const t=[...el.childNodes].filter(n=>n.nodeType===3)
         .map(n=>n.textContent||'').join('').trim();
        if(!/[+＋\-－−]\s*\d/.test(t)||t.length>400)continue;
        const contexts=[];
        for(let p=el;p&&root.contains(p)&&contexts.length<6;p=p.parentElement){
         const text=(p.innerText||'').trim();
         if(text.length&&text.length<=300)contexts.push(text);
        }
        numericEffectTexts.push(t);
        numericEffectContexts.push(contexts);
       }
       const directOwnTexts=roots.flatMap(root=>
         [root,...root.querySelectorAll('*')].map(el=>
          [...el.childNodes].filter(n=>n.nodeType===3)
           .map(n=>n.textContent||'').join('').trim())
          .filter(t=>t.length<=300&&/(?:獲得|習得|取得)/.test(t))
        );
       const flowOwnTexts=roots.flatMap(root=>
         [root,...root.querySelectorAll('*')].map(el=>
          [...el.childNodes].filter(n=>n.nodeType===3)
           .map(n=>n.textContent||'').join('').trim())
          .filter(t=>t.length<=300&&
           /(?:連続|イベントチェーン|お出かけ|おでかけ)/.test(t)&&
           /(?:打ち切り|終了|中断|発生しない|可能|解放|できるようになる)/.test(t))
        );
       if(numericEffectTexts.length>80||own.length>60||
          directOwnTexts.length>80||flowOwnTexts.length>80)
        throw Error('GameTora結果内の効果やヒントの件数が上限超過、黙って省略しません');
       return {
        numericEffectTexts,
        numericEffectContexts,
        groupOwnTextFragments,
        choiceOrdinal:choiceIndex+1,
        outcomeOrdinal:outcomeIndex+1,
        unresolvedOr:ambiguous,
        hints:own,
        // Take only small own-text fragments from each verified result.
        // Never mix text from the enclosing alternative outcome.
        directOwnTexts,
        flowOwnTexts
       };
      });
     });
}
module.exports={extractRoutePieces};
