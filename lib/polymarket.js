import { config } from '../config/index.js';

export async function fetchPolymarketSports() {
  const markets = [];
  try {
    const res = await fetch(
      `${config.polymarketGamma}/markets?closed=false&tag=sports&limit=100`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) { console.error(`Polymarket API error: ${res.status}`); return markets; }
    const data = await res.json();

    for (const market of data) {
      if (!market.outcomes || market.outcomes.length < 2) continue;
      
      let prices;
      try {
        if (typeof market.outcomePrices === 'string') {
          prices = JSON.parse(market.outcomePrices).map(p => Math.round(parseFloat(p) * 100));
        } else if (Array.isArray(market.outcomePrices)) {
          prices = market.outcomePrices.map(p => Math.round(parseFloat(p) * 100));
        } else { continue; }
      } catch { continue; }
      
      if (prices.length < 2) continue;

      const tags = (market.tags || []).map(t => t.toLowerCase());
      let sport = 'other';
      if (tags.some(t => t.includes('nba') || t.includes('basketball'))) sport = 'nba';
      else if (tags.some(t => t.includes('mlb') || t.includes('baseball'))) sport = 'mlb';
      else if (tags.some(t => t.includes('nhl') || t.includes('hockey'))) sport = 'nhl';
      else if (tags.some(t => t.includes('ufc') || t.includes('mma'))) sport = 'ufc';
      else if (tags.some(t => t.includes('soccer') || t.includes('football') || t.includes('epl'))) sport = 'soccer';
      else if (tags.some(t => t.includes('nfl'))) sport = 'nfl';
      else if (tags.some(t => t.includes('politic') || t.includes('election'))) sport = 'politics';

      markets.push({
        id: market.id || market.conditionId,
        platform: 'Polymarket',
        sport,
        question: market.question || '',
        teamA: market.outcomes[0],
        teamB: market.outcomes[1],
        priceA: prices[0],
        priceB: prices[1],
        volume: parseFloat(market.volume || 0),
        endDate: market.endDate || null,
        slug: market.slug || '',
        active: market.active !== false,
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (err) { console.error('Polymarket fetch error:', err.message); }
  return markets;
}
