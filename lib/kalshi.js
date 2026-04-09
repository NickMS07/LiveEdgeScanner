import { config } from '../config/index.js';

export async function fetchKalshiSports() {
  const markets = [];
  try {
    const sportsSeries = ['NBA', 'MLB', 'NHL', 'UFC', 'NFL', 'MLS'];
    for (const series of sportsSeries) {
      const res = await fetch(
        `${config.kalshiBase}/markets?series_ticker=${series}&status=open&limit=50`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) { console.error(`Kalshi API error for ${series}: ${res.status}`); continue; }
      const data = await res.json();
      const kalshiMarkets = data.markets || [];

      for (const m of kalshiMarkets) {
        const yesPrice = Math.round((m.yes_price || m.last_price || 0) * 100);
        const noPrice = 100 - yesPrice;
        const sport = series.toLowerCase() === 'mls' ? 'soccer' : series.toLowerCase();
        markets.push({
          id: m.ticker || m.id,
          platform: 'Kalshi',
          sport,
          question: m.title || m.subtitle || '',
          teamA: m.yes_sub_title || 'Yes',
          teamB: m.no_sub_title || 'No',
          priceA: yesPrice,
          priceB: noPrice,
          volume: m.volume || 0,
          endDate: m.close_time || m.expiration_time || null,
          slug: m.ticker || '',
          active: m.status === 'open',
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  } catch (err) { console.error('Kalshi fetch error:', err.message); }
  return markets;
}
