import { config } from '../config/index.js';

const SPORT_MAP = {
  nba: 'basketball_nba', mlb: 'baseball_mlb', nhl: 'icehockey_nhl',
  ufc: 'mma_mixed_martial_arts', nfl: 'americanfootball_nfl',
  epl: 'soccer_epl',
};
const BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'williamhill_us'];

function americanToRawProb(odds) {
  if (odds < 0) return (-odds) / (-odds + 100);
  return 100 / (odds + 100);
}

function removeJuice(oddsA, oddsB) {
  const rawA = americanToRawProb(oddsA);
  const rawB = americanToRawProb(oddsB);
  const total = rawA + rawB;
  return {
    probA: Math.round((rawA / total) * 100),
    probB: Math.round((rawB / total) * 100),
  };
}

export async function fetchOddsForSport(sportKey) {
  const markets = [];
  if (!config.oddsApiKey) return markets;
  try {
    const params = new URLSearchParams({
      apiKey: config.oddsApiKey, regions: 'us', markets: 'h2h',
      oddsFormat: 'american', bookmakers: BOOKMAKERS.join(','),
    });
    const res = await fetch(`${config.oddsApiBase}/sports/${sportKey}/odds?${params}`);
    if (!res.ok) { console.error(`Odds API error for ${sportKey}: ${res.status}`); return markets; }
    const data = await res.json();
    const remaining = res.headers.get('x-requests-remaining');
    if (remaining) console.log(`  Odds API requests remaining: ${remaining}`);

    for (const event of data) {
      const bookPrices = {};
      for (const bookmaker of (event.bookmakers || [])) {
        const h2h = bookmaker.markets?.find(m => m.key === 'h2h');
        if (!h2h || !h2h.outcomes || h2h.outcomes.length < 2) continue;
        const displayName = bookmaker.key === 'draftkings' ? 'DraftKings' :
          bookmaker.key === 'fanduel' ? 'FanDuel' :
          bookmaker.key === 'betmgm' ? 'BetMGM' :
          bookmaker.key === 'williamhill_us' ? 'Caesars' : bookmaker.key;
        const fair = removeJuice(h2h.outcomes[0].price, h2h.outcomes[1].price);
        bookPrices[displayName] = {
          teamA: h2h.outcomes[0].name, teamB: h2h.outcomes[1].name,
          priceA: fair.probA, priceB: fair.probB,
          rawOddsA: h2h.outcomes[0].price, rawOddsB: h2h.outcomes[1].price,
        };
      }
      let sport = 'other';
      for (const [s, key] of Object.entries(SPORT_MAP)) {
        if (key === sportKey) { sport = s; break; }
      }
      markets.push({
        id: event.id, sport, homeTeam: event.home_team,
        awayTeam: event.away_team, commenceTime: event.commence_time,
        bookPrices, lastUpdated: new Date().toISOString(),
      });
    }
  } catch (err) { console.error(`Odds API error: ${err.message}`); }
  return markets;
}

export async function fetchAllOdds() {
  const all = [];
  for (const [sport, key] of Object.entries(SPORT_MAP)) {
    console.log(`  Fetching ${sport} odds...`);
    const markets = await fetchOddsForSport(key);
    all.push(...markets);
    await new Promise(r => setTimeout(r, 500));
  }
  return all;
}
