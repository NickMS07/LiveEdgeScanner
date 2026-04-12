import dotenv from 'dotenv';
dotenv.config();
import { config } from '../config/index.js';
import { fetchAllOdds } from '../lib/oddsapi.js';
import { storeResults } from '../lib/database.js';

async function runScan() {
  const start = Date.now();
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  EDGE SCANNER — ${new Date().toLocaleString()}`);
  console.log(`${'='.repeat(50)}`);

  console.log('\nFetching sportsbook odds...');
  const oddsMarkets = await fetchAllOdds();
  console.log(`  Total events: ${oddsMarkets.length}`);

  // Build matched markets comparing DraftKings vs FanDuel
  const results = [];
  for (const event of oddsMarkets) {
    const dk = event.bookPrices['DraftKings'];
    const fd = event.bookPrices['FanDuel'];
    if (!dk && !fd) continue;

    const prices = {};
    if (dk) prices['DraftKings'] = [dk.priceA, dk.priceB];
    if (fd) prices['FanDuel'] = [fd.priceA, fd.priceB];

    // Calculate edge between platforms
    let gap = 0, side = 'A', betTeam = '', bestPlat = '', polyPrice = 0, bookPrice = 0;
    
    if (dk && fd) {
      const gapA_dk_fd = Math.abs(dk.priceA - fd.priceA);
      const gapB_dk_fd = Math.abs(dk.priceB - fd.priceB);
      const maxGap = Math.max(gapA_dk_fd, gapB_dk_fd);
      gap = maxGap;
      
      if (gapA_dk_fd >= gapB_dk_fd) {
        side = 'A';
        betTeam = dk.priceA < fd.priceA ? dk.teamA : fd.teamA;
        polyPrice = Math.min(dk.priceA, fd.priceA);
        bookPrice = Math.max(dk.priceA, fd.priceA);
        bestPlat = dk.priceA > fd.priceA ? 'DraftKings' : 'FanDuel';
      } else {
        side = 'B';
        betTeam = dk.priceB < fd.priceB ? dk.teamB : fd.teamB;
        polyPrice = Math.min(dk.priceB, fd.priceB);
        bookPrice = Math.max(dk.priceB, fd.priceB);
        bestPlat = dk.priceB > fd.priceB ? 'DraftKings' : 'FanDuel';
      }
    }

    let edgeClass = 'none';
    if (gap >= config.thresholds.strong) edgeClass = 'strong';
    else if (gap >= config.thresholds.moderate) edgeClass = 'moderate';
    else if (gap >= config.thresholds.weak) edgeClass = 'weak';

    const teamA = dk?.teamA || fd?.teamA || event.homeTeam;
    const teamB = dk?.teamB || fd?.teamB || event.awayTeam;

    results.push({
      id: event.id,
      sport: event.sport,
      teamA,
      teamB,
      question: `${teamA} vs ${teamB}`,
      prices,
      volume: 0,
      commenceTime: event.commenceTime,
      edge: { gap, side, betTeam, platform: bestPlat, polyPrice, bookPrice, edgeClass, platformsCompared: Object.keys(prices).length },
    });
  }

  results.sort((a, b) => b.edge.gap - a.edge.gap);

  const strong = results.filter(r => r.edge.edgeClass === 'strong').length;
  const moderate = results.filter(r => r.edge.edgeClass === 'moderate').length;
  const weak = results.filter(r => r.edge.edgeClass === 'weak').length;
  console.log(`\n  Edge Detection (DraftKings vs FanDuel, juice removed):`);
  console.log(`  Strong edges (${config.thresholds.strong}+): ${strong}`);
  console.log(`  Moderate edges (${config.thresholds.moderate}+): ${moderate}`);
  console.log(`  Weak edges (${config.thresholds.weak}+): ${weak}`);
  console.log(`  Total markets: ${results.length}`);

  console.log('\nStoring results...');
  await storeResults(results);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nScan complete in ${elapsed}s`);

  const top = results.filter(r => r.edge.gap >= config.thresholds.weak).slice(0, 10);
  if (top.length > 0) {
    console.log('\n  TOP EDGES:');
    for (const r of top) {
      const e = r.edge.edgeClass === 'strong' ? 'STRONG' : r.edge.edgeClass === 'moderate' ? 'GOOD' : 'SLIGHT';
      console.log(`  [${e}] +${r.edge.gap}c | ${r.edge.betTeam} | ${r.sport} | Buy on cheaper, sells at ${r.edge.bookPrice}c on ${r.edge.platform}`);
    }
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
