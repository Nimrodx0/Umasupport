(function (g) {
  'use strict';
  const skills = [
    ['straight','直線巧者','white'],
    ['tail','尻尾上がり','white'],
    ['umazuki','ウマ好み','white'],
    ['step','渾身の足取り','white'],
    ['kunrin','君臨','gold','step'],
    ['corner','コーナー巧者○','white'],
    ['midstraight','中距離直線○','white'],
    ['focus','集中力','white'],
    ['early','先駆け','white'],
    ['last','末脚','white'],
    ['spirit','闘争心','white'],
    ['tempo','テンポアップ','white'],
    ['position','ポジションセンス','white'],
    ['avoid','垂れウマ回避','white'],
    ['finish','差し切り体勢','white']
  ].map(([id,name,tier,lowerId])=>({id,name,tier,lowerId:lowerId||null}));
  const reward=(skillId,level=1,condition=null)=>({skillId,level,condition});
  const cards = [
    {id:'A',name:'検証カード A',character:'架空・スピード',type:'スピード',rarity:'SSR',accent:'#c76c5c',hints:['straight','tail','last'],effects:['ヒント関連性能：仮データ'],events:[
      {id:'a-free',name:'普段の積み重ね',type:'auto',rewards:[reward('straight',1)]},
      {id:'a-start',name:'道は二つ（連続①）',type:'choice',choices:[
        {id:'continue',label:'先へ進む（後続イベントへ）',rewards:[]},
        {id:'stop',label:'ここで終える（打ち切り）',rewards:[reward('umazuki',2)]}
      ]},
      {id:'a-final',name:'結末の足音（連続②）',type:'auto',requires:{eventId:'a-start',choiceId:'continue'},rewards:[reward('kunrin',2,'成功時'),reward('step',1,'失敗時')]}
    ]},
    {id:'B',name:'検証カード B',character:'架空・賢さ',type:'賢さ',rarity:'SSR',accent:'#748ac6',hints:['straight','umazuki','focus'],effects:['ヒント関連性能：仮データ'],events:[
      {id:'b-auto',name:'一瞬の判断',type:'auto',rewards:[reward('position')]},
      {id:'b-choice',name:'練習の方針',type:'choice',choices:[
        {id:'steady',label:'着実に進める',rewards:[reward('focus',2)]},
        {id:'risky',label:'勝負に出る',rewards:[reward('tail',3,'成功時')]}
      ]}
    ]},
    {id:'C',name:'検証カード C',character:'架空・パワー',type:'パワー',rarity:'SR',accent:'#bf934a',hints:['tail','corner','step'],effects:['ヒント関連性能：仮データ'],events:[
      {id:'c-auto',name:'鍛錬の成果',type:'auto',rewards:[reward('midstraight')]},
      {id:'c-choice',name:'どちらの道を選ぶ？',type:'choice',choices:[
        {id:'left',label:'追い込み練習',rewards:[reward('last',2)]},
        {id:'right',label:'位置取り練習',rewards:[reward('position',1)]}
      ]}
    ]},
    {id:'D',name:'検証カード D',character:'架空・スタミナ',type:'スタミナ',rarity:'SSR',accent:'#579da2',hints:['umazuki','tempo','spirit'],effects:['ヒント関連性能：仮データ'],events:[
      {id:'d-auto',name:'静かな準備',type:'auto',rewards:[reward('avoid')]},
      {id:'d-choice',name:'次なる一歩',type:'choice',choices:[
        {id:'speed',label:'速度に賭ける',rewards:[reward('straight',1)]},
        {id:'endurance',label:'持久力を磨く',rewards:[reward('tempo',2)]}
      ]}
    ]},
    {id:'E',name:'検証カード E',character:'架空・根性',type:'根性',rarity:'SSR',accent:'#916db1',hints:['corner','step'],effects:['ヒント関連性能：仮データ'],events:[
      {id:'e-begin',name:'はじまりの約束（連続①）',type:'choice',choices:[
        {id:'go',label:'挑戦を続ける',rewards:[]},
        {id:'quit',label:'ここでやめる（打ち切り）',rewards:[reward('finish')]}
      ]},
      {id:'e-end',name:'約束の結末（連続②）',type:'auto',requires:{eventId:'e-begin',choiceId:'go'},rewards:[reward('kunrin',1)]}
    ]},
    {id:'F',name:'検証カード F',character:'架空・スピード',type:'スピード',rarity:'SR',accent:'#bc737e',hints:['corner','last','early'],effects:['ヒント関連性能：仮データ'],events:[
      {id:'f-auto',name:'まっすぐな眼差し',type:'auto',rewards:[reward('straight')]},
      {id:'f-choice',name:'いざ本番',type:'choice',choices:[
        {id:'front',label:'前に出る',rewards:[reward('tail')]},
        {id:'back',label:'後ろから攻める',rewards:[reward('finish',2,'成功時')]}
      ]}
    ]}
  ];
  const data={version:'poc-fixture-1',skills,cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),skillById:Object.fromEntries(skills.map(s=>[s.id,s]))};
  if(typeof module!=='undefined'&&module.exports)module.exports=data;
  g.UmaDemoData=data;
})(typeof globalThis!=='undefined'?globalThis:this);