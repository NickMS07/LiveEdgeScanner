import { config } from '../config/index.js';
const { thresholds } = config;

function normalizeTeamName(name) {
  return name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

function teamsMatch(a, b) {
  const na = normalizeTeamName(a), nb = normalizeTeamName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const la = na.split(' ').pop(), lb = nb.split(' ').pop();
  if (la.length > 3 && la === lb) return true;
  return false;
}

export function matchMarkets(polyMarkets, kalshiMarkets, oddsApiMarkets) {
  const matched = [];
  for (const poly of polyMarkets) {
    const combined = {
      id: poly.id, sport: poly.sport, teamA: poly.teamA, teamB: poly.teamB,
      question: poly.question, slug: poly.slug, volume: poly.volume, endDate: poly.endDate,
      prices: { Polymarket: [poly.priceA, poly.priceB] },
      lastUpdated: new Date().toISOString(),
    };

    // Match with Kalshi
    for (const kalshi of kalshiMarkets) {
      if (kalshi.sport !== poly.sport) continue;
      if (teamsMatch(kalshi.teamA, poly.teamA) || teamsMatch(kalshi.teamB, poly.teamA)) {
        if (teamsMatch(kalshi.teamA, poly.teamA)) combined.prices.Kalshi = [kalshi.priceA, kalshi.priceB];
        else combined.prices.Kalshi = [kalshi.priceB, kalshi.priceA];
        break;
      }
    }

    // Match with sportsbooks (juice already removed)
    for (const odds of oddsApiMarkets) {
      if (odds.sport !== poly.sport) continue;
      const homeMatches = teamsMatch(odds.homeTeam, poly.teamA) || teamsMatch(odds.homeTeam, poly.teamB);
      const awayMatches = teamsMatch(odds.awayTeam, poly.teamA) || teamsMatch(odds.awayTeam, poly.teamB);
      if (homeMatches || awayMatches) {
        for (const [bookName, bookData] of Object.entries(odds.bookPrices)) {
          if (teamsMatch(bookData.teamA, poly.teamA)) {
            combined.prices[bookName] = [bookData.priceA, bookData.priceB];
          } else if (teamsMatch(bookData.teamB, poly.teamA)) {
            combined.prices[bookName] = [bookData.priceB, bookData.priceA];
          }
        }
        combined.commenceTime = odds.commenceTime;
        break;
      }
    }
    matched.push(combined);
  }
  return matched;
}

export function calculateEdge(market) {
  const polyPrices = market.prices.Polymarket;
  if (!polyPrices) return null;
  let maxGapA = 0, maxGapB = 0, bestPlatA = '', bestPlatB = '';
  
  for (const [platform, prices] of Object.entries(market.prices)) {
    if (platform === 'Polymarket' || !prices) continue;
    const gA = prices[0] - polyPrices[0], gB = prices[1] - polyPrices[1];
    if (gA > maxGapA) { maxGapA = gA; bestPlatA = platform; }
    if (gB > maxGapB) { maxGapB = gB; bestPlatB = platform; }
  }

  const bestGap = Math.max(maxGapA, maxGapB);
  const bestSide = maxGapA >= maxGapB ? 'A' : 'B';
  const bestPlatform = bestSide === 'A' ? bestPlatA : bestPlatB;
  const polyPrice = bestSide === 'A' ? polyPrices[0] : polyPrices[1];
  const betTeam = bestSide === 'A' ? market.teamA : market.teamB;

  // Cap edges at 15 cents — anything higher is likely a data error
  const cappedGap = Math.min(bestGap, 15);

  let edgeClass = 'none';
  if (cappedGap >= thresholds.strong) edgeClass = 'strong';
  else if (cappedGap >= thresholds.moderate) edgeClass = 'moderate';
  else if (cappedGap >= thresholds.weak) edgeClass = 'weak';

  return {
    gap: cappedGap, side: bestSide, betTeam, platform: bestPlatform,
    polyPrice, bookPrice: polyPrice + cappedGap, edgeClass,
    platformsCompared: Object.keys(market.prices).length,
  };
}

export function detectEdges(matchedMarkets) {
  const results = matchedMarkets.map(m => ({ ...m, edge: calculateEdge(m) }))
    .filter(m => m.edge !== null).sort((a, b) => b.edge.gap - a.edge.gap);
  const strong = results.filter(r => r.edge.edgeClass === 'strong').length;
  const moderate = results.filter(r => r.edge.edgeClass === 'moderate').length;
  const weak = results.filter(r => r.edge.edgeClass === 'weak').length;
  const multi = results.filter(r => r.edge.platformsCompared > 1).length;
  console.log(`\n  Edge Detection Results (juice removed from sportsbooks):`);
  console.log(`  Strong edges (${thresholds.strong}+): ${strong}`);
  console.log(`  Moderate edges (${thresholds.moderate}+): ${moderate}`);
  console.log(`  Weak edges (${thresholds.weak}+): ${weak}`);
  console.log(`  Markets matched across 2+ platforms: ${multi}`);
  console.log(`  Total markets scanned: ${results.length}\n`);
  return results;
}
