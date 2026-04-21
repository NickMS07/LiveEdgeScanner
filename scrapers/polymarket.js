/**
 * Polymarket Odds Scraper
 * 
 * Uses Playwright to scrape real-time odds from Polymarket's
 * sports pages. Polymarket renders odds client-side via React,
 * so we need a real browser to extract the data.
 * 
 * Run: node scrapers/polymarket.js
 * Schedule: Every 60 seconds via cron or process manager
 */

const { chromium } = require('playwright');

const API_URL = process.env.EDGE_API_URL || 'http://localhost:4000';
const API_KEY = process.env.SCRAPER_API_KEY || 'dev-key-change-me';

// ── Sport-specific scraper configs ──────────────────────

const SCRAPE_TARGETS = [
  {
    sport: 'nba',
    url: 'https://polymarket.com/sports/nba/games',
    parser: parseNBAGames
  },
  {
    sport: 'ufc',
    url: 'https://polymarket.com/sports/ufc/games', 
    parser: parseUFCFights
  },
  {
    sport: 'mlb',
    url: 'https://polymarket.com/sports/mlb/games',
    parser: parseMLBGames
  },
  {
    sport: 'nhl',
    url: 'https://polymarket.com/sports/nhl/games',
    parser: parseNHLGames
  }
];

// ── Main Scraper Loop ───────────────────────────────────

async function scrape() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 }
    });

    for (const target of SCRAPE_TARGETS) {
      try {
        console.log(`[${new Date().toISOString()}] Scraping ${target.sport}...`);
        const page = await context.newPage();
        
        await page.goto(target.url, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });

        // Wait for odds to render (Polymarket loads data async)
        await page.waitForTimeout(3000);

        // Extract odds data from the page
        const games = await target.parser(page);
        
        console.log(`  Found ${games.length} games with odds`);

        // Push each game's odds to the Phoenix API
        for (const game of games) {
          await pushToAPI(game);
        }

        await page.close();
      } catch (err) {
        console.error(`  Error scraping ${target.sport}:`, err.message);
      }
    }
  } finally {
    await browser.close();
  }
}

// ── Parser: NBA Games ───────────────────────────────────

async function parseNBAGames(page) {
  return page.evaluate(() => {
    const games = [];
    
    // Target the game cards on Polymarket's NBA page
    // Note: Selectors may need updating as Polymarket changes their UI
    const gameCards = document.querySelectorAll('[class*="GameCard"], [class*="game-card"], a[href*="/sports/nba/"]');
    
    gameCards.forEach(card => {
      try {
        // Extract team names and odds from the card
        const textContent = card.textContent;
        
        // Look for percentage patterns like "67%" or price patterns like "67¢"
        const percentMatches = textContent.match(/(\d+)[%¢]/g);
        const teamElements = card.querySelectorAll('[class*="team"], [class*="Team"]');
        
        if (percentMatches && percentMatches.length >= 2) {
          const odds1 = parseInt(percentMatches[0]) / 100;
          const odds2 = parseInt(percentMatches[1]) / 100;
          
          // Extract team abbreviations from href or text
          const href = card.closest('a')?.href || card.querySelector('a')?.href || '';
          const urlMatch = href.match(/nba-(\w+)-(\w+)-/);
          
          if (urlMatch) {
            games.push({
              game_id: `nba-${urlMatch[1]}-${urlMatch[2]}`,
              sport: 'nba',
              home: urlMatch[2].toUpperCase(),
              away: urlMatch[1].toUpperCase(),
              home_odds: odds2,
              away_odds: odds1
            });
          }
        }
      } catch (e) {
        // Skip malformed cards
      }
    });
    
    return games;
  });
}

// ── Parser: UFC Fights ──────────────────────────────────

async function parseUFCFights(page) {
  return page.evaluate(() => {
    const fights = [];
    
    const fightCards = document.querySelectorAll('a[href*="/sports/ufc/"], a[href*="/sports/mma/"]');
    
    fightCards.forEach(card => {
      try {
        const textContent = card.textContent;
        const percentMatches = textContent.match(/(\d+)[%¢]/g);
        
        if (percentMatches && percentMatches.length >= 2) {
          const odds1 = parseInt(percentMatches[0]) / 100;
          const odds2 = parseInt(percentMatches[1]) / 100;
          
          const href = card.href || '';
          const urlMatch = href.match(/ufc[^/]*\/([^/]+)/);
          
          if (urlMatch) {
            fights.push({
              game_id: `ufc-${urlMatch[1]}`,
              sport: 'ufc',
              home: 'Fighter1',
              away: 'Fighter2',
              home_odds: odds1,
              away_odds: odds2
            });
          }
        }
      } catch (e) {}
    });
    
    return fights;
  });
}

// ── Parser: MLB Games ───────────────────────────────────

async function parseMLBGames(page) {
  return page.evaluate(() => {
    const games = [];
    const gameCards = document.querySelectorAll('a[href*="/sports/mlb/"]');
    
    gameCards.forEach(card => {
      try {
        const textContent = card.textContent;
        const percentMatches = textContent.match(/(\d+)[%¢]/g);
        
        if (percentMatches && percentMatches.length >= 2) {
          const odds1 = parseInt(percentMatches[0]) / 100;
          const odds2 = parseInt(percentMatches[1]) / 100;
          
          const href = card.href || '';
          const urlMatch = href.match(/mlb-(\w+)-(\w+)-/);
          
          if (urlMatch) {
            games.push({
              game_id: `mlb-${urlMatch[1]}-${urlMatch[2]}`,
              sport: 'mlb',
              home: urlMatch[2].toUpperCase(),
              away: urlMatch[1].toUpperCase(),
              home_odds: odds2,
              away_odds: odds1
            });
          }
        }
      } catch (e) {}
    });
    
    return games;
  });
}

// ── Parser: NHL Games ───────────────────────────────────

async function parseNHLGames(page) {
  return page.evaluate(() => {
    const games = [];
    const gameCards = document.querySelectorAll('a[href*="/sports/nhl/"]');
    
    gameCards.forEach(card => {
      try {
        const textContent = card.textContent;
        const percentMatches = textContent.match(/(\d+)[%¢]/g);
        
        if (percentMatches && percentMatches.length >= 2) {
          const odds1 = parseInt(percentMatches[0]) / 100;
          const odds2 = parseInt(percentMatches[1]) / 100;
          
          const href = card.href || '';
          const urlMatch = href.match(/nhl-(\w+)-(\w+)-/);
          
          if (urlMatch) {
            games.push({
              game_id: `nhl-${urlMatch[1]}-${urlMatch[2]}`,
              sport: 'nhl',
              home: urlMatch[2].toUpperCase(),
              away: urlMatch[1].toUpperCase(),
              home_odds: odds2,
              away_odds: odds1
            });
          }
        }
      } catch (e) {}
    });
    
    return games;
  });
}

// ── Push to Phoenix API ─────────────────────────────────

async function pushToAPI(gameData) {
  try {
    const response = await fetch(`${API_URL}/api/odds/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...gameData,
        source: 'polymarket',
        api_key: API_KEY
      })
    });

    if (!response.ok) {
      console.error(`  API error for ${gameData.game_id}: ${response.status}`);
    }
  } catch (err) {
    console.error(`  Failed to push ${gameData.game_id}:`, err.message);
  }
}

// ── Sportsbook Scraper (DraftKings/FanDuel) ─────────────

async function scrapeSportsbook(browser, sport) {
  // This would scrape DraftKings or FanDuel for comparison odds
  // Implementation similar to Polymarket but targeting different selectors
  // The key insight: sportsbook odds are the "fair value" baseline
  // Polymarket odds that deviate from sportsbooks = edge
  
  console.log(`  [TODO] Sportsbook scraper for ${sport}`);
}

// ── Run ─────────────────────────────────────────────────

const INTERVAL = parseInt(process.env.SCRAPE_INTERVAL || '60000'); // 60 seconds

async function main() {
  console.log('🔍 Live Edge Scanner — Scraper Starting');
  console.log(`   API: ${API_URL}`);
  console.log(`   Interval: ${INTERVAL}ms`);
  console.log('');

  // Initial scrape
  await scrape();

  // Schedule recurring scrapes
  setInterval(async () => {
    try {
      await scrape();
    } catch (err) {
      console.error('Scrape cycle failed:', err.message);
    }
  }, INTERVAL);
}

main().catch(console.error);
