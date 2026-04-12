import { config } from '../config/index.js';

export async function fetchRobinhoodMarkets() {
  const markets = [];
  try {
    // Robinhood prediction markets API
    const res = await fetch(
      'https://api.robinhood.com/marketdata/predictions/events/?active=true&category=sports',
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!res.ok) {
      console.error(`Robinhood API error: ${res.status}`);
      return markets;
    }
    
    const data = await res.json();
    const events = data.results || data || [];
    
    for (const event of events) {
      if (!event.outcomes || event.outcomes.length < 2) continue;
      
      const yesPrice = Math.round((event.outcomes[0]?.price || 0) * 100);
      const noPrice = Math.round((event.outcomes[1]?.price || 0) * 100);
      
      if (yesPrice === 0 && noPrice === 0) continue;
      
      markets.push({
        id: `rh_${event.id || event.event_id}`,
        platform: 'Robinhood',
        sport: 'other',
        question: event.title || event.name || '',
        teamA: event.outcomes[0]?.title || 'Yes',
        teamB: event.outcomes[1]?.title || 'No',
        priceA: yesPrice,
        priceB: noPrice,
        volume: event.volume || 0,
        endDate: event.end_time || null,
        slug: '',
        active: true,
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Robinhood fetch error:', err.message);
  }
  return markets;
}
