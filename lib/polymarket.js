import { config } from '../config/index.js';

function extractTeams(question, outcomes) {
  let teamA = '', teamB = '';
  if (Array.isArray(outcomes)) { teamA = outcomes[0]||''; teamB = outcomes[1]||''; }
  else if (typeof outcomes === 'string') {
    try { const p = JSON.parse(outcomes); teamA = p[0]||''; teamB = p[1]||''; } catch { teamA = outcomes; }
  }
  if (teamA === 'Yes' || teamA === 'No') {
    const q = question || '';
    const vs = q.match(/(.+?)\s+vs\.?\s+(.+?)[\?\!\.]/i);
    if (vs) { teamA = vs[1].replace(/^will\s+/i,'').trim(); teamB = vs[2].trim(); }
    else {
      const w = q.match(/will (?:the )?(.+?)(?:\s+win|\s+beat|\s+make|\s+reach|\s+be)/i);
      if (w) { teamA = w[1].trim(); teamB = ''; }
      else { teamA = q.length>60 ? q.slice(0,57)+'...' : q; teamB = ''; }
    }
  }
  return { teamA, teamB };
}

export async function fetchPolymarketSports() {
  const markets = [];
  const seen = new Set();
  const tags = [
    {tag:'nba',sport:'nba'},{tag:'mlb',sport:'mlb'},{tag:'nhl',sport:'nhl'},
    {tag:'ufc',sport:'ufc'},{tag:'mma',sport:'ufc'},{tag:'soccer',sport:'soccer'},
    {tag:'nfl',sport:'nfl'},{tag:'politics',sport:'politics'},
    {tag:'boxing',sport:'ufc'},{tag:'tennis',sport:'other'},{tag:'golf',sport:'other'},
  ];
  try {
    for (const {tag,sport} of tags) {
      try {
        const res = await fetch(`${config.polymarketGamma}/markets?closed=false&tag=${tag}&limit=50`,
          {headers:{'Accept':'application/json'}});
        if (!res.ok) { console.error(`  Poly ${tag}: error ${res.status}`); continue; }
        const data = await res.json();
        let count = 0;
        for (const market of data) {
          if (!market.outcomes) continue;
          const id = market.id || market.conditionId;
          if (seen.has(id)) continue;
          seen.add(id);
          let prices;
          try {
            if (typeof market.outcomePrices === 'string') prices = JSON.parse(market.outcomePrices).map(p=>Math.round(parseFloat(p)*100));
            else if (Array.isArray(market.outcomePrices)) prices = market.outcomePrices.map(p=>Math.round(parseFloat(p)*100));
            else continue;
          } catch { continue; }
          if (prices.length < 2) continue;
          const {teamA,teamB} = extractTeams(market.question, market.outcomes);
          markets.push({id,platform:'Polymarket',sport,question:market.question||'',teamA,teamB,
            priceA:prices[0],priceB:prices[1],volume:parseFloat(market.volume||0),
            endDate:market.endDate||null,slug:market.slug||'',active:market.active!==false,
            lastUpdated:new Date().toISOString()});
          count++;
        }
        console.log(`  Poly ${tag}: ${count} markets`);
      } catch (err) { console.error(`  Poly ${tag} error:`,err.message); }
      await new Promise(r=>setTimeout(r,300));
    }
  } catch (err) { console.error('Polymarket error:',err.message); }
  console.log(`  Polymarket total: ${markets.length} unique markets`);
  return markets;
}
