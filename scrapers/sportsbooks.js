/**
 * Sportsbook Odds Scraper — DraftKings, FanDuel, BetMGM + Kalshi API
 * These are the "fair value" baseline for edge detection vs Polymarket.
 */

const { chromium } = require('playwright');

const API_URL  = process.env.EDGE_API_URL    || 'http://localhost:4000';
const API_KEY  = process.env.SCRAPER_API_KEY || 'dev-key-change-me';
const INTERVAL = parseInt(process.env.SCRAPE_INTERVAL || '60000');

const TARGETS = [
  {
    source: 'draftkings',
    sports: [
      { sport: 'nba', url: 'https://sportsbook.draftkings.com/leagues/basketball/nba' },
      { sport: 'mlb', url: 'https://sportsbook.draftkings.com/leagues/baseball/mlb'   },
      { sport: 'nhl', url: 'https://sportsbook.draftkings.com/leagues/hockey/nhl'     },
      { sport: 'ufc', url: 'https://sportsbook.draftkings.com/leagues/mma/ufc'        },
    ]
  },
  {
    source: 'fanduel',
    sports: [
      { sport: 'nba', url: 'https://sportsbook.fanduel.com/basketball/nba'  },
      { sport: 'mlb', url: 'https://sportsbook.fanduel.com/baseball/mlb'    },
      { sport: 'nhl', url: 'https://sportsbook.fanduel.com/hockey/nhl'      },
      { sport: 'ufc', url: 'https://sportsbook.fanduel.com/mma/ufc'         },
    ]
  },
  {
    source: 'betmgm',
    sports: [
      { sport: 'nba', url: 'https://sports.betmgm.com/en/sports/basketball-7/betting/usa-9/nba-6004' },
      { sport: 'mlb', url: 'https://sports.betmgm.com/en/sports/baseball-23/betting/usa-9/mlb-75'    },
    ]
  }
];

async function scrapeAll() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });

  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
    });

    for (const target of TARGETS) {
      for (const { sport, url } of target.sports) {
        const page = await ctx.newPage();
        try {
          console.log(`[${new Date().toISOString()}] ${target.source} ${sport}…`);
          await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 });
          await page.waitForTimeout(4000);
          const games = await parseMoneylineOdds(page, sport);
          console.log(`  Found ${games.length} games`);
          for (const g of games) await pushToAPI(g, target.source);
        } catch (err) {
          console.error(`  Error ${target.source} ${sport}:`, err.message);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

async function parseMoneylineOdds(page, sport) {
  return page.evaluate((sport) => {
    function americanToProb(american) {
      const n = parseInt(american.replace(/[^-\d]/g, ''));
      if (isNaN(n)) return null;
      return n > 0 ? 100 / (n + 100) : Math.abs(n) / (Math.abs(n) + 100);
    }

    const games = [];
    const rows = document.querySelectorAll(
      '[class*="event-row"],[class*="EventRow"],[class*="game-row"],[data-testid*="event"],li[class*="event"]'
    );

    rows.forEach(row => {
      try {
        const teamEls = row.querySelectorAll('[class*="team-name"],[class*="TeamName"],[class*="participant"],[class*="Participant"]');
        const teams = Array.from(teamEls).map(el => el.textContent.trim()).filter(Boolean);
        if (teams.length < 2) return;

        const oddsEls = row.querySelectorAll('[class*="odds"],[class*="Odds"],[class*="price"],[class*="Price"]');
        const oddsTexts = Array.from(oddsEls).map(el => el.textContent.trim()).filter(t => /^[+-]\d+$/.test(t));
        if (oddsTexts.length < 2) return;

        const p1 = americanToProb(oddsTexts[0]);
        const p2 = americanToProb(oddsTexts[1]);
        if (!p1 || !p2) return;

        const total = p1 + p2;
        const homeProb = parseFloat((p2 / total).toFixed(3));
        const awayProb = parseFloat((p1 / total).toFixed(3));
        const gameId   = `${sport}-${teams[0].toLowerCase().replace(/\s+/g,'')}-${teams[1].toLowerCase().replace(/\s+/g,'')}`;

        games.push({ game_id: gameId, sport, away: teams[0].toUpperCase(), home: teams[1].toUpperCase(), home_odds: homeProb, away_odds: awayProb });
      } catch (e) {}
    });
    return games;
  }, sport);
}

async function scrapeKalshi() {
  const SPORTS = ['nba','mlb','nhl','nfl'];
  for (const sport of SPORTS) {
    try {
      const res = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=SPORTS-${sport.toUpperCase()}&status=open&limit=50`);
      if (!res.ok) continue;
      const json = await res.json();
      for (const market of (json.markets || [])) {
        const yesPrice = market.last_price ? market.last_price / 100 : market.yes_ask / 100;
        if (!yesPrice) continue;
        const teams = (market.title || '').split(' vs ');
        if (teams.length < 2) continue;
        const gameId = `${sport}-${teams[0].toLowerCase().trim().replace(/\s+/g,'-')}-${teams[1].toLowerCase().trim().replace(/\s+/g,'-')}`;
        await pushToAPI({ game_id: gameId, sport, away: teams[0].trim().toUpperCase(), home: teams[1].trim().toUpperCase(), home_odds: parseFloat(yesPrice.toFixed(3)), away_odds: parseFloat((1-yesPrice).toFixed(3)) }, 'kalshi');
      }
    } catch (err) {
      console.error(`Kalshi ${sport}:`, err.message);
    }
  }
}

async function pushToAPI(gameData, source) {
  try {
    const res = await fetch(`${API_URL}/api/odds/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...gameData, source, api_key: API_KEY })
    });
    if (!res.ok) console.error(`  API ${res.status} for ${gameData.game_id}`);
  } catch (err) {
    console.error(`  Push failed:`, err.message);
  }
}

async function main() {
  console.log('📊 Sportsbook Scraper Starting');
  console.log(`   API: ${API_URL} | Interval: ${INTERVAL}ms\n`);
  async function cycle() {
    await Promise.allSettled([scrapeAll(), scrapeKalshi()]);
  }
  await cycle();
  setInterval(async () => { try { await cycle(); } catch(e) { console.error('Cycle error:', e.message); }}, INTERVAL);
}

main().catch(console.error);
