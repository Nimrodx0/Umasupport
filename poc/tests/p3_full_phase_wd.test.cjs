'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {index,observationPairs}=require('../tools/audit_p3_full_phase_wd.cjs');
const {COURSES,STYLES}=require('../tools/globalsim_position_expanded.cjs');
const {PIN}=require('../tools/globalsim_position_pilot.cjs');
const {BANDS}=require('../tools/globalsim_rank_band_dominance.cjs');
const {choose}=require('../src/p3_rank_window_margin_screen.cjs');
function fixture(){
 const rows=COURSES.flatMap(({id:courseId})=>[9,12].flatMap(fieldSize=>['equal','jitter10'].flatMap(mode=>[0,1,2,3].flatMap(phase=>BANDS.flatMap(({id:bandId})=>STYLES.map((style,i)=>({courseId,fieldSize,mode,phase,bandId,style,runners:60,pointPercent:[75,70,30,25][i],random10mOpportunityPercent:[80,75,35,30][i]})))))));
 return [{status:'research-GlobalSim-10m-rank-opportunity-not-game-activation',sourceRevision:PIN,scenario:'balanced',simulations:720,seedsPerCell:30,contextRows:rows},{status:'p2-fixed-15-plus-15-full-phase-bands-not-game-activation',sourceRevision:PIN,scenario:'balanced',baseRaces:720,seedsPerHalf:15,contextRows:rows.flatMap(x=>['first15','last15'].map(half=>({...x,half,runners:30})))}];
}
test('same full and paired seed halves permit existing W/D top group; W and D stay separate',()=>{
 const idx=index(...fixture()),pairs=observationPairs(idx,1,'top50',[10502,10304]);
 a.deepEqual(choose(pairs,10,true),{state:'targeted-window-candidate',styles:['Nige','Senkou']});
 a.deepEqual(pairs.find(x=>x.first==='Nige'&&x.second==='Sasi').W,{min:45,max:45});
});
test('reject incomplete and inconsistent paired split',()=>{
 let [f,s]=fixture();s.contextRows[0].pointPercent+=1;a.throws(()=>index(f,s),/half recomposition/);
 [f,s]=fixture();s.contextRows.pop();a.throws(()=>index(f,s));
});
