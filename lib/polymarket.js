import { config } from '../config/index.js';

function detectSport(market) {
  const text = ((market.question || '') + ' ' + (market.tags || []).join(' ') + ' ' + (market.groupItemTitle || '') + ' ' + (market.description || '')).toLowerCase();
  
  // MLB - check BEFORE NHL because "rangers" could be either
  // Use "texas rangers" specifically for MLB
  if (text.includes('mlb') || text.includes('world series') || text.includes('yankees') || text.includes('dodgers') || text.includes('astros') || text.includes('braves') || text.includes('phillies') || text.includes('orioles') || text.includes('padres') || text.includes('mets') || text.includes('red sox') || text.includes('cubs') || text.includes('mariners') || text.includes('guardians') || text.includes('cardinals') || text.includes('brewers') || text.includes('rays') || text.includes('twins') || text.includes('diamondbacks') || text.includes('pirates') || text.includes('reds') || text.includes('tigers') || text.includes('royals') || text.includes('rockies') || text.includes('athletics') || text.includes('white sox') || text.includes('angels') || text.includes('nationals') || text.includes('marlins') || text.includes('blue jays') || text.includes('texas rangers')) return 'mlb';
  
  // NBA
  if (text.includes('nba') || text.includes('lakers') || text.includes('celtics') || text.includes('warriors') || text.includes('nuggets') || text.includes('bucks') || text.includes('knicks') || text.includes('nets') || text.includes('76ers') || text.includes('cavaliers') || text.includes('pistons') || text.includes('raptors') || text.includes('heat') || text.includes('thunder') || text.includes('spurs') || text.includes('rockets') || text.includes('clippers') || text.includes('suns') || text.includes('kings') || text.includes('grizzlies') || text.includes('mavericks') || text.includes('timberwolves') || text.includes('pelicans') || text.includes('hawks') || text.includes('hornets') || text.includes('bulls') || text.includes('pacers') || text.includes('magic') || text.includes('wizards') || text.includes('trail blazers') || text.includes('jazz')) return 'nba';
  
  // NHL - "rangers" without "texas" = NY Rangers (NHL)
  if (text.includes('nhl') || text.includes('stanley cup') || text.includes('oilers') || text.includes('maple leafs') || text.includes('bruins') || text.includes('panthers') || text.includes('hurricanes') || text.includes('avalanche') || text.includes('stars') || text.includes('flames') || text.includes('penguins') || (text.includes('rangers') && !text.includes('texas')) || text.includes('devils') || text.includes('capitals') || text.includes('lightning') || text.includes('canadiens') || text.includes('red wings') || text.includes('blackhawks') || text.includes('canucks') || text.includes('senators') || text.includes('predators') || text.includes('blue jackets') || text.includes('islanders') || text.includes('flyers') || text.includes('wild') || text.includes('kraken') || text.includes('jets') || text.includes('sabres') || text.includes('golden knights') || text.includes('sharks') || text.includes('ducks') || text.includes('coyotes') || text.includes('blues')) return 'nhl';
  
  // UFC / MMA
  if (text.includes('ufc') || text.includes('mma') || text.includes('prochazka') || text.includes('ulberg') || text.includes('murzakanov') || text.includes('bellator') || text.includes('pfl') || text.includes('pico') || text.includes('pitbull') || text.includes('blaydes') || text.includes('lightweight') || text.includes('heavyweight') || text.includes('middleweight') || text.includes('welterweight') || text.includes('featherweight') || text.includes('bantamweight') || text.includes('flyweight')) return 'ufc';
  
  // NFL
  if (text.includes('nfl') || text.includes('super bowl') || text.includes('touchdown') || text.includes('quarterback')) return 'nfl';
  
  // Soccer
  if (text.includes('soccer') || text.includes('epl') || text.includes('premier league') || text.includes('champions league') || text.includes('la liga') || text.includes('bundesliga') || text.includes('serie a') || text.includes('mls') || text.includes('world cup') || text.includes('arsenal') || text.includes('barcelona') || text.includes('real madrid') || text.includes('manchester') || text.includes('liverpool') || text.includes('chelsea')) return 'soccer';
  
  // Politics
  if (text.includes('president') || text.includes('trump') || text.includes('biden') || text.includes('election') || text.includes('congress') || text.includes('senate') || text.includes('governor') || text.includes('democrat') || text.includes('republican') || text.includes('recession') || text.includes('fed ') || text.includes('federal reserve') || text.includes('tariff') || text.includes('nato') || text.includes('iran') || text.includes('china invades')) return 'politics';
  
  return 'other';
}

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

      const sport = detectSport(market);

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
