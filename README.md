# 🔍 LiveEdgeScanner v2

Real-time prediction market edge finder. Compares **Polymarket** and **Kalshi** odds
against **DraftKings**, **FanDuel**, and **BetMGM** to surface mispriced bets instantly.

## What's New in v2

| Feature | v1 | v2 |
|---------|----|----|
| Sportsbook scrapers | DK + FD via API | DK + FD + BetMGM via Playwright |
| Prediction markets  | Polymarket only | Polymarket + Kalshi |
| Real-time engine    | Supabase polling | Elixir/Phoenix WebSockets |
| Odds display        | Static table | Live-animated, updates every 3s |
| Edge detection      | Supabase SQL | Elixir GenServer + ETS cache |
| Infrastructure      | Vercel + Supabase | Docker → Fly.io + Railway |

## Architecture

```
┌─────────────────────────────────────────────┐
│           FRONTEND (Vercel / Static)         │
│   Live odds board with WebSocket connection  │
│   Odds animate on every price change         │
└──────────────────┬──────────────────────────┘
                   │ wss://
                   ▼
┌─────────────────────────────────────────────┐
│        PHOENIX API SERVER (Fly.io)           │
│                                             │
│  WebSocket Channels  ←  EdgeCalculator      │
│  REST  /api/odds/*      (GenServer)         │
│  REST  /api/edges/*                         │
│        ↕                                    │
│  OddsCache (ETS) ← ingest_odds/3            │
│        ↕                                    │
│  PostgreSQL + Redis                         │
└──────────────────┬──────────────────────────┘
                   │ POST /api/odds/ingest
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│  Polymarket   │    │  Sportsbook Scraper │
│  Scraper      │    │  DK + FD + BetMGM  │
│  (Playwright) │    │  + Kalshi REST API  │
│  (Railway)    │    │  (Railway)          │
└───────────────┘    └────────────────────┘
```

## Quick Start (Docker)

```bash
git clone https://github.com/NickMS07/LiveEdgeScanner.git
cd LiveEdgeScanner
cp .env.example .env
# Edit .env and set SCRAPER_API_KEY to a strong random string

docker-compose up
```

Services started:
- **PostgreSQL** → port 5432
- **Redis** → port 6379
- **Phoenix API** → http://localhost:4000
- **Polymarket scraper** → runs every 60s
- **Sportsbook scraper** → runs every 60s

Open `frontend/index.html` in your browser (or deploy to Vercel).

## Local Development (no Docker)

### 1. Start the Phoenix API
```bash
cd edge_api
mix deps.get
mix ecto.setup          # creates DB + runs migrations
mix phx.server          # starts on http://localhost:4000
```

### 2. Start the scrapers
```bash
cd scrapers
npm install
npx playwright install chromium

node polymarket.js &     # Polymarket odds
node sportsbooks.js &    # DK / FD / BetMGM / Kalshi
```

### 3. Open the frontend
```bash
open frontend/index.html
```

The frontend connects to `ws://localhost:4000` automatically.
Simulated live data runs even before scraper data arrives.

## Project Structure

```
LiveEdgeScanner/
├── edge_api/                    # Elixir/Phoenix real-time API
│   ├── lib/
│   │   ├── edge_api/
│   │   │   ├── application.ex       # OTP supervision tree
│   │   │   ├── odds_cache.ex        # ETS-backed GenServer
│   │   │   ├── odds_history.ex      # Ecto schema + persistence
│   │   │   └── edge_calculator.ex   # Edge detection engine (runs every 30s)
│   │   └── edge_api_web/
│   │       ├── channels/
│   │       │   └── edges_channel.ex # WebSocket broadcasting
│   │       ├── controllers/
│   │       │   └── odds_controller.ex
│   │       └── router.ex
│   ├── priv/repo/migrations/
│   │   └── ..._create_odds_history.exs
│   ├── mix.exs
│   └── Dockerfile
│
├── scrapers/                    # Playwright scraping workers
│   ├── polymarket.js            # Polymarket sports odds
│   ├── sportsbooks.js           # DraftKings, FanDuel, BetMGM + Kalshi API
│   ├── package.json
│   └── Dockerfile
│
├── frontend/
│   └── index.html               # Self-contained dashboard (deploy to Vercel)
│
├── docker-compose.yml           # Full local stack
├── .env.example
└── README.md
```

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/odds/ingest` | API key | Scrapers push odds here |
| GET | `/api/odds/:game_id` | None | Get odds for a game |
| GET | `/api/edges` | None | All edges above threshold |
| GET | `/api/edges/:sport` | None | Edges filtered by sport |

## WebSocket Channels

Connect to `wss://your-api.fly.dev/socket/websocket` and join:
- `edges:all` — every sport
- `edges:nba` / `edges:mlb` / `edges:nhl` / `edges:ufc` — sport-specific

Events received:
- `edge_alert` — broadcast when a new edge is detected

## Deployment

### Phoenix API → Fly.io
```bash
cd edge_api
fly launch
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set DATABASE_URL=...
fly secrets set SCRAPER_API_KEY=your-key
fly deploy
```

### Scrapers → Railway
```bash
cd scrapers
railway init
railway env set EDGE_API_URL=https://your-app.fly.dev
railway env set SCRAPER_API_KEY=your-key
railway up
```

### Frontend → Vercel
Add to `frontend/index.html` before the closing `</head>`:
```html
<script>
  window.__WS_URL__  = 'wss://your-app.fly.dev/socket/websocket';
  window.__API_URL__ = 'https://your-app.fly.dev';
</script>
```
Then `vercel deploy` from the `frontend/` directory.

## Edge Detection Logic

```
fair_value = average(DraftKings, FanDuel, BetMGM) moneyline
edge_cents = (fair_value - polymarket_price) × 100

confidence:
  HIGH   → edge ≥ 10¢
  MEDIUM → edge ≥ 6¢
  LOW    → edge ≥ 5¢
```

Edges are recalculated on every ingest AND by the EdgeCalculator GenServer every 30 seconds.
