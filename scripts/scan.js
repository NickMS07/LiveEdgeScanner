import dotenv from 'dotenv';
dotenv.config();
import { config } from '../config/index.js';
import { fetchAllOdds } from '../lib/oddsapi.js';
import { storeResults } from '../lib/database.js';
import { analyzeTopEdges } from '../lib/analysis.js';

const PLATFORMS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars'];

function normalName(n) { return n.toLowerCase().replace(/\./g,'').replace(/\s+/g,' ').trim(); }

function namesMatch(a, b) {
  const na = normalName(a), nb = normalName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const la = na.split(' ').pop(), lb = nb.split(' ').pop();
  if (la.length > 3 && la === lb) return true;
  return false;
}

async function runScan() {
  const start = Date.now();
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  EDGE SCANNER — ${new Date().toLocaleString()}`);
  console.log(`${'='.repeat(50)}`);

  console.log('\nFetching odds...');
  const oddsMarkets = await fetchAllOdds();
  console.log(`  Total events: ${oddsMarkets.length}`);

  const results = [];
  for (const event of oddsMarkets) {
    // Use the first available platform to set the canonical team order
    let canonTeamA = event.homeTeam;
    let canonTeamB = event.awayTeam;
    
    // Find first platform with data to establish team names
    for (const plat of PLATFORMS) {
      if (event.bookPrices[plat]) {
        canonTeamA = event.bookPrices[plat].teamA;
        canonTeamB = event.bookPrices[plat].teamB;
        break;
      }
    }

    // Build prices with aligned team order
    const prices = {};
    for (const plat of PLATFORMS) {
      const book = event.bookPrices[plat];
      if (!book) continue;
      
      // Check if this platform's teamA matches our canonical teamA
      if (namesMatch(book.teamA, canonTeamA)) {
        prices[plat] = [book.priceA, book.priceB];
      } else if (namesMatch(book.teamB, canonTeamA)) {
        // Teams are flipped — swap the prices
        prices[plat] = [book.priceB, book.priceA];
      } else {
        // Can't match — use as-is but log it
        prices[plat] = [book.priceA, book.priceB];
      }
    }
    
    if (Object.keys(prices).length < 2) continue;

    // Sanity check: all platforms should roughly agree (within 20c)
    const platNames = Object.keys(prices);
    const avgA = Math.round(platNames.reduce((sum, p) => sum + prices[p][0], 0) / platNames.length);
    let suspicious = false;
    for (const p of platNames) {
      if (Math.abs(prices[p][0] - avgA) > 20) {
        suspicious = true;
        console.log(`  WARNING: ${canonTeamA} vs ${canonTeamB} — ${p} has ${prices[p][0]}c vs avg ${avgA}c. Likely team flip. Skipping.`);
        break;
      }
    }
    if (suspicious) continue;

    // Find biggest gap
    let maxGap = 0, cheapPlat = '', expPlat = '', side = 'A', betTeam = '', cheapPrice = 0, expPrice = 0;

    for (let i = 0; i < platNames.length; i++) {
      for (let j = i + 1; j < platNames.length; j++) {
        const pA = prices[platNames[i]];
        const pB = prices[platNames[j]];
        const gapA = Math.abs(pA[0] - pB[0]);
        const gapB = Math.abs(pA[1] - pB[1]);
        if (gapA > maxGap) {
          maxGap = gapA; side = 'A';
          if (pA[0] < pB[0]) { cheapPlat = platNames[i]; expPlat = platNames[j]; cheapPrice = pA[0]; expPrice = pB[0]; }
          else { cheapPlat = platNames[j]; expPlat = platNames[i]; cheapPrice = pB[0]; expPrice = pA[0]; }
          betTeam = canonTeamA;
        }
        if (gapB > maxGap) {
          maxGap = gapB; side = 'B';
          if (pA[1] < pB[1]) { cheapPlat = platNames[i]; expPlat = platNames[j]; cheapPrice = pA[1]; expPrice = pB[1]; }
          else { cheapPlat = platNames[j]; expPlat = platNames[i]; cheapPrice = pB[1]; expPrice = pA[1]; }
          betTeam = canonTeamB;
        }
      }
    }

    let edgeClass = 'none';
    if (maxGap >= config.thresholds.strong) edgeClass = 'strong';
    else if (maxGap >= config.thresholds.moderate) edgeClass = 'moderate';
    else if (maxGap >= config.thresholds.weak) edgeClass = 'weak';

    results.push({
      id: event.id, sport: event.sport, teamA: canonTeamA, teamB: canonTeamB,
      question: `${canonTeamA} vs ${canonTeamB}`, prices, volume: 0,
      commenceTime: event.commenceTime,
      edge: { gap: maxGap, side, betTeam, platform: expPlat,
        polyPrice: cheapPrice, bookPrice: expPrice, edgeClass,
        cheapPlatform: cheapPlat, platformsCompared: Object.keys(prices).length },
    });
  }

  results.sort((a, b) => b.edge.gap - a.edge.gap);

  console.log('\nRunning AI analysis...');
  await analyzeTopEdges(results);

  const strong = results.filter(r => r.edge.edgeClass === 'strong').length;
  const moderate = results.filter(r => r.edge.edgeClass === 'moderate').length;
  const weak = results.filter(r => r.edge.edgeClass === 'weak').length;
  console.log(`\n  Strong: ${strong} | Moderate: ${moderate} | Weak: ${weak} | Total: ${results.length}`);

  const top = results.filter(r => r.edge.gap >= 3).slice(0, 10);
  if (top.length > 0) {
    console.log('\n  TOP EDGES:');
    for (const r of top) {
      const tag = r.edge.edgeClass === 'strong' ? 'STRONG' : r.edge.edgeClass === 'moderate' ? 'GOOD' : 'SLIGHT';
      console.log(`\n  [${tag}] +${r.edge.gap}c | ${r.edge.betTeam} | ${r.sport}`);
      console.log(`    ${r.edge.cheapPlatform} ${r.edge.polyPrice}c vs ${r.edge.platform} ${r.edge.bookPrice}c`);
      if (r.analysis) console.log(`    AI: ${r.analysis}`);
    }
  }

  console.log('\nStoring...');
  await storeResults(results);
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return results;
}

const runOnce = process.argv.includes('--once');
if (runOnce) {
  runScan().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  console.log(`\nEdge Scanner running every ${config.scanIntervalSeconds}s`);
  runScan();
  setInterval(runScan, config.scanIntervalSeconds * 1000);
}
