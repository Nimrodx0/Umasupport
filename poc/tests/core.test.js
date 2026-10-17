const assert=require('node:assert/strict');
const D=require('../src/demo_data.js');
const C=require('../src/core.js');
const S=(cardId,choices={})=>({cardId,stage:4,choices});
const deck=(...slots)=>({slots:[...slots,...Array.from({length:Math.max(0,6-slots.length)},()=>({cardId:null,stage:4,choices:{}}))]});
const tests=[];const test=(name,fn)=>{fn();tests.push(name)};

test('初期の未選択イベントは除外、選択肢のない単独イベントは自動加算',()=>{
 let r=C.aggregate(deck(S('A')),D);
 assert.equal(r.straight.count,1); // 通常ヒント＋自動イベント
 assert.equal(r.umazuki,undefined);
 assert.equal(r.kunrin,undefined);
});
test('イベント継続で後続が到達可能、成功失敗の候補は両方条件付き',()=>{
 let r=C.aggregate(deck(S('A',{'a-start':'continue'})),D);
 assert.equal(r.kunrin.count,1);assert.equal(r.kunrin.conditionalOnly,true);
 assert.equal(r.step.conditionalOnly,true);
 assert.equal(r.umazuki,undefined);
});
test('イベント打ち切りは後続イベントを除外',()=>{
 let r=C.aggregate(deck(S('A',{'a-start':'stop','a-final':'anything'})),D);
 assert.equal(r.umazuki.count,1);assert.equal(r.kunrin,undefined);
});
test('1枚に2経路あっても提供カード数は1',()=>{
 let r=C.aggregate(deck(S('B',{'b-choice':'steady'})),D);
 assert.equal(r.focus.count,1);
 assert.equal(r.focus.providers[0].routes.length,2);
});
test('複数カード間の重複は枚数で判定',()=>{
 let r=C.aggregate(deck(S('A'),S('B'),S('C')),D);
 assert.equal(r.straight.count,2);assert.equal(r.tail.count,2);
});
test('同じカードIDの複数枠は提供枚数1、枠ごとの経路と選択はすべて保持',()=>{
 const r=C.aggregate(deck(S('A'),S('A',{'a-start':'continue'})),D);
 assert.equal(r.straight.count,1,'通常ヒントと自動イベントが複数枠でも1枚');
 assert.equal(Object.keys(r.straight.providers).length,2,'各物理枠の経路は残す');
 assert.equal(r.straight.providers[0].cardId,r.straight.providers[1].cardId);
 assert.equal(r.kunrin.count,1,'片方のスロットだけのイベント報酬');
 assert.equal(r.kunrin.providers[1].routes[0].source,'event');
 assert.equal(r.kunrin.providers[0],undefined);
 const multi=C.aggregate(deck(S('A'),S('A'),S('B')),D);
 assert.equal(multi.straight.count,2,'同カード2枠＋別カード1枠は提供2枚');
 assert.equal(Object.keys(multi.straight.providers).length,3);
 assert.equal(C.coverage('straight',r,D).count,1);
});
test('重複カード2枠だけではデッキ内重複の判定にならず、両デッキ共通は維持',()=>{
 const main=C.aggregate(deck(S('A'),S('A')),D);
 const inherit=C.aggregate(deck(S('A')),D);
 const rows=C.combinedRows(main,inherit,[],D);
 const skill=rows.find(x=>x.skill.id==='straight');
 assert.equal(skill.main.count,1);
 assert.equal(skill.inherit.count,1);
 assert.equal(skill.main.count>1,false);
 assert.ok(skill.main&&skill.inherit,'デッキ間共通は真');
});
test('段階別ヒントLvは個々のスロット経路に表示し、未収録データは不明のまま',()=>{
 const example={id:'A',hints:['straight'],hintsByStage:{'0':['straight'],'4':['straight']},
  hintPerformanceByStage:{'0':{levelBase:0,levelUnique:0},'4':{levelBase:2,levelUnique:1}},events:[]};
 const stageData={cardById:{A:example}};
 const r=C.aggregate(deck({cardId:'A',stage:0,choices:{}},{cardId:'A',stage:4,choices:{}}),stageData);
 assert.equal(r.straight.count,1);
 assert.equal(r.straight.providers['0'].routes[0].level,1);
 assert.equal(r.straight.providers['1'].routes[0].level,4);
 assert.equal(Object.keys(r.straight.providers).length,2);
 const missing={...example,hintPerformanceByStage:{'0':{levelBase:'0',levelUnique:0}}};
 const unknown=C.directRoutes(missing,{stage:0,choices:{}});
 assert.equal(unknown[0].level,null,'unknown values never become invented numerical hint levels');
});
test('上位スキルによる間接カバーは直接枚数には加算しない',()=>{
 let r=C.aggregate(deck(S('A',{'a-start':'continue'})),D);
 // Aには直接のstepは失敗時の候補もあるため、この場合は直接カバー。
 assert.equal(C.coverage('step',r,D).kind,'direct');
 let onlyGold=deck(S('E',{'e-begin':'go'}));let r2=C.aggregate(onlyGold,D);
 assert.equal(r2.kunrin.count,1);assert.equal(r2.step.count,1); // E 自身が白ヒントを持つ
 // 純粋に上位だけの集計辞書でも間接カバーを確認
 let fake={kunrin:r2.kunrin};
 assert.equal(C.coverage('step',fake,D).kind,'indirect');
 assert.equal(fake.step,undefined);
});
test('目標「両方」は両デッキがカバーして初めて達成',()=>{
 let main=C.aggregate(deck(S('A')),D),inherit=C.aggregate(deck(S('F')),D);
 assert.equal(C.goalStatus({skillId:'straight',scope:'both'},main,inherit,D).satisfied,true);
 assert.equal(C.goalStatus({skillId:'umazuki',scope:'both'},main,inherit,D).satisfied,false);
});
test('上流のイベント選択を変えると下流の選択情報を消去',()=>{
 let choices=C.clearDescendants(D.cardById.A,{'a-start':'continue','a-final':'foo'},'a-start');
 assert.equal(choices['a-final'],undefined);
 assert.equal(choices['a-start'],'continue');
});
test('未カバーでも目標スキルは統合一覧に残る',()=>{
 let m=C.aggregate(deck(),D),i=C.aggregate(deck(),D);
 let rows=C.combinedRows(m,i,[{skillId:'umazuki',scope:'main'}],D);
 assert.equal(rows.length,1);assert.equal(rows[0].goal.skillId,'umazuki');
});
console.log(`OK: ${tests.length} checks\n`+tests.map((x,i)=>` ${i+1}. ${x}`).join('\n'));

test('金スキルと下位スキルは隣接し、下位行にはインデント用の属性が付く',()=>{
 const main=C.aggregate(deck(S('A',{'a-start':'continue'}),S('C')),D);
 const rows=C.combinedRows(main,{},[],D);
 const ordered=C.hierarchyRows(rows,D);
 const g=ordered.findIndex(r=>r.skill.id==='kunrin');
 assert.ok(g>=0);
 assert.equal(ordered[g].groupRole,'parent');
 assert.equal(ordered[g+1].skill.id,'step');
 assert.equal(ordered[g+1].groupRole,'child');
 assert.equal(ordered[g+1].parentSkillId,'kunrin');
 assert.equal(ordered.length,rows.length);
 assert.equal(new Set(ordered.map(x=>x.skill.id)).size,rows.length);
 assert.equal(rows.find(x=>x.skill.id==='step').groupRole,undefined); // 元データは変更しない
});
test('フィルターで片側だけ残った場合は架空のスキル行を増やさない',()=>{
 const main=C.aggregate(deck(S('A',{'a-start':'continue'})),D);
 const rows=C.combinedRows(main,{},[],D);
 for(const id of ['step','kunrin']){
  const filtered=rows.filter(r=>r.skill.id===id);
  const ordered=C.hierarchyRows(filtered,D);
  assert.equal(ordered.length,1);
  assert.equal(ordered[0].skill.id,id);
  assert.equal(ordered[0].groupRole,'solo');
 }
});
console.log('OK: 2 additional skill-family checks');