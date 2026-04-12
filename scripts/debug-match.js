import dotenv from 'dotenv';
dotenv.config();
import { fetchPolymarketSports } from '../lib/polymarket.js';
import { fetchAllOdds } from '../lib/oddsapi.js';

async function debug() {
  const poly = await fetchPolymarketSports();
  const odds = await fetchAllOdds();
  
  console.log('\n=== POLYMARKET TEAM NAMES (first 15) ===');
  for (const m of poly.slice(0, 15)) {
    console.log(`  [${m.sport}] "${m.teamA}" vs "${m.teamB}"`);
  }
  
  console.log('\n=== SPORTSBOOK TEAM NAMES (first 15) ===');
  for (const m of odds.slice(0, 15)) {
    console.log(`  [${m.sport}] "${m.homeTeam}" vs "${m.awayTeam}"`);
  }
}

debug();
