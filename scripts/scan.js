import { config } from '../config/index.js';
import { fetchPolymarketSports } from '../lib/polymarket.js';
import { fetchAllOdds } from '../lib/oddsapi.js';
import { storeResults } from '../lib/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function runScan(){
  console.log('\n==== EDGE SCANNER ====');
  console.log('\nFetching Polymarket...');
  const poly=await fetchPolymarketSports();
  console.log('\nFetching sportsbooks...');
  const odds=await fetchAllOdds();
  console.log(`\nPolymarket: ${poly.length} | Sportsbooks: ${odds.length}`);

  const results=[];
  for(const ev of odds){
    const p={};
    for(const[b,d]of Object.entries(ev.bookPrices||{}))p[b]=[d.priceA,d.priceB];
    if(Object.keys(p).length<2)continue;
    const bks=Object.keys(p);
    let gap=0,side='A',team=ev.homeTeam,lo='',hi='',loP=0,hiP=0;
    for(let i=0;i<bks.length;i++)for(let j=i+1;j<bks.length;j++){
      const gA=Math.abs(p[bks[i]][0]-p[bks[j]][0]);
      const gB=Math.abs(p[bks[i]][1]-p[bks[j]][1]);
      if(gA>gap){gap=gA;side='A';team=ev.homeTeam;lo=p[bks[i]][0]<p[bks[j]][0]?bks[i]:bks[j];hi=p[bks[i]][0]>=p[bks[j]][0]?bks[i]:bks[j];loP=Math.min(p[bks[i]][0],p[bks[j]][0]);hiP=Math.max(p[bks[i]][0],p[bks[j]][0]);}
      if(gB>gap){gap=gB;side='B';team=ev.awayTeam;lo=p[bks[i]][1]<p[bks[j]][1]?bks[i]:bks[j];hi=p[bks[i]][1]>=p[bks[j]][1]?bks[i]:bks[j];loP=Math.min(p[bks[i]][1],p[bks[j]][1]);hiP=Math.max(p[bks[i]][1],p[bks[j]][1]);}
    }
    let ec='none';
    if(gap>=8)ec='strong';else if(gap>=5)ec='moderate';else if(gap>=3)ec='weak';
    results.push({id:'o_'+ev.id,sport:ev.sport,teamA:ev.homeTeam,teamB:ev.awayTeam,question:`${ev.homeTeam} vs ${ev.awayTeam}`,prices:p,edge:{gap,side,betTeam:team,platform:hi,polyPrice:loP,bookPrice:hiP,edgeClass:ec},volume:0,commenceTime:ev.commenceTime,endDate:ev.commenceTime});
  }
  const polyR=poly.map(m=>({id:m.id,sport:m.sport,teamA:m.teamA,teamB:m.teamB,question:m.question,prices:{Polymarket:[m.priceA,m.priceB]},edge:{gap:0,side:'A',betTeam:m.teamA,platform:null,polyPrice:m.priceA,bookPrice:m.priceA,edgeClass:'none'},volume:m.volume,endDate:m.endDate,commenceTime:m.endDate}));
  const all=[...results,...polyR];
  const s=results.filter(r=>r.edge.gap>=8).length;
  const m=results.filter(r=>r.edge.gap>=5).length;
  const w=results.filter(r=>r.edge.gap>=3).length;
  console.log(`\nGames with 2+ books: ${results.length}`);
  console.log(`Strong(8+): ${s} | Moderate(5+): ${m} | Weak(3+): ${w}`);
  results.filter(r=>r.edge.gap>=3).sort((a,b)=>b.edge.gap-a.edge.gap).slice(0,10).forEach(r=>{
    console.log(`  +${r.edge.gap}c ${r.edge.betTeam} | ${r.edge.platform} ${r.edge.bookPrice}% vs ${r.edge.polyPrice}% | ${r.sport}`);
  });
  console.log('\nStoring...');
  await storeResults(all);
  console.log(`Done! ${all.length} markets stored.`);
}
runScan().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
