import { config } from '../config/index.js';
import { fetchPolymarketSports } from '../lib/polymarket.js';
import { fetchKalshiSports } from '../lib/kalshi.js';
import { fetchAllOdds } from '../lib/oddsapi.js';
import { matchMarkets, detectEdges } from '../lib/edge-detector.js';
import { storeResults } from '../lib/database.js';
import { processNotifications } from '../lib/notifications.js';

async function runScan() {
  const start = Date.now();
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  EDGE SCANNER — ${new Date().toLocaleString()}`);
  console.log(`  Sportsbook juice removed for fair comparison`);
  console.log(`${'='.repeat(50)}`);

  console.log('\nFetching market data...');
  const [polyMarkets, kalshiMarkets, oddsMarkets] = await Promise.all([
    fetchPolymarketSports(),
    fetchKalshiSports(),
    fetchAllOdds(),
  ]);
  console.log(`  Polymarket: ${polyMarkets.length} markets`);
  console.log(`  Kalshi: ${kalshiMarkets.length} markets`);
  console.log(`  Sportsbooks (de-juiced): ${oddsMarkets.length} events`);

  console.log('\nMatching markets across platforms...');
  const matched = matchMarkets(polyMarkets, kalshiMarkets, oddsMarkets);
  const multiPlatform = matched.filter(m => Object.keys(m.prices).length > 1).length;
  console.log(`  Total: ${matched.length} | Cross-platform: ${multiPlatform}`);

  console.log('\nDetecting edges...');
  const results = detectEdges(matched);

  console.log('Storing results...');
  await storeResults(results);

  console.log('Processing notifications...');
  await processNotifications(results);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nScan complete in ${elapsed}s`);

  const top = results.filter(r => r.edge.gap >= config.thresholds.weak).slice(0, 5);
  if (top.length > 0) {
    console.log('\n  TOP EDGES:');
    for (const r of top) {
      const e = r.edge.edgeClass === 'strong' ? 'STRONG' : r.edge.edgeClass === 'moderate' ? 'GOOD' : 'SLIGHT';
      console.log(`  [${e}] +${r.edge.gap}c | ${r.edge.betTeam} at ${r.edge.polyPrice}c (Poly) vs ${r.edge.bookPrice}c (${r.edge.platform}) | ${r.sport.toUpperCase()}`);
    }
  } else {
    console.log('\n  No edges detected this scan.');
  }
  return results;
}

const runOnce = process.argv.includes('--once');
if (runOnce) {
  runScan().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  console.log(`\nEdge Scanner starting — scanning every ${config.scanIntervalSeconds}s`);
  runScan();
  setInterval(runScan, config.scanIntervalSeconds * 1000);
}
