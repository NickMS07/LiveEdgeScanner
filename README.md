# Edge Scanner

Cross-platform prediction market price scanner. Compares Polymarket vs Kalshi vs DraftKings vs FanDuel and finds mispricings.

## Quick Start

1. `npm install`
2. Copy `.env.example` to `.env` and add your Supabase keys
3. Run the SQL in `scripts/setup-db.sql` in your Supabase dashboard
4. `npm run scan -- --once` to run a single scan
5. `npm run dev` to run continuously every 60 seconds

## Architecture

Every 60 seconds the scanner fetches odds from Polymarket (free), Kalshi (free), and optionally The Odds API (DraftKings/FanDuel). It matches events across platforms, calculates price gaps, and stores the results in Supabase. The frontend reads from Supabase.

## Project Structure

- `config/` — configuration
- `lib/` — API integrations and edge detection
- `api/` — HTTP server and Vercel serverless functions
- `scripts/` — scanner cron job and database setup
