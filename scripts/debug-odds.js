import dotenv from 'dotenv';
dotenv.config();
import { config } from '../config/index.js';

async function debug() {
  if (!config.oddsApiKey) { console.log('No Odds API key set'); return; }
  
  const params = new URLSearchParams({
    apiKey: config.oddsApiKey,
    regions: 'us',
    markets: 'h2h',
    oddsFormat: 'american',
    bookmakers: 'draftkings,fanduel,betmgm',
  });

  const res = await fetch(`${config.oddsApiBase}/sports/baseball_mlb/odds?${params}`);
  const data = await res.json();
  
  console.log(`\nFound ${data.length} MLB events\n`);
  
  for (const event of data) {
    console.log(`${event.away_team} @ ${event.home_team}`);
    console.log(`  Start: ${event.commence_time}`);
    for (const book of (event.bookmakers || [])) {
      const h2h = book.markets?.find(m => m.key === 'h2h');
      if (!h2h) continue;
      console.log(`  ${book.key}:`);
      for (const outcome of h2h.outcomes) {
        console.log(`    ${outcome.name}: ${outcome.price}`);
      }
    }
    console.log('');
  }
  
  console.log(`Requests remaining: ${res.headers.get('x-requests-remaining')}`);
}

debug();
