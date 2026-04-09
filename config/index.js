import dotenv from 'dotenv';
dotenv.config();

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  oddsApiKey: process.env.ODDS_API_KEY || '',
  oddsApiBase: 'https://api.the-odds-api.com/v4',
  polymarketBase: 'https://clob.polymarket.com',
  polymarketGamma: 'https://gamma-api.polymarket.com',
  kalshiBase: 'https://api.elections.kalshi.com/trade-api/v2',
  fcmServerKey: process.env.FCM_SERVER_KEY || '',
  thresholds: {
    strong: parseInt(process.env.STRONG_EDGE_THRESHOLD || '8'),
    moderate: parseInt(process.env.MODERATE_EDGE_THRESHOLD || '5'),
    weak: parseInt(process.env.WEAK_EDGE_THRESHOLD || '3'),
  },
  scanIntervalSeconds: parseInt(process.env.SCAN_INTERVAL_SECONDS || '60'),
};
