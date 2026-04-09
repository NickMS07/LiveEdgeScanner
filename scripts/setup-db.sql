CREATE TABLE IF NOT EXISTS markets (
  market_id TEXT PRIMARY KEY,
  sport TEXT NOT NULL,
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  question TEXT DEFAULT '',
  prices JSONB NOT NULL DEFAULT '{}',
  edge_gap INTEGER DEFAULT 0,
  edge_side TEXT,
  edge_class TEXT DEFAULT 'none',
  edge_platform TEXT,
  bet_team TEXT,
  poly_price INTEGER,
  book_price INTEGER,
  volume NUMERIC DEFAULT 0,
  commence_time TIMESTAMPTZ,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_markets_edge_gap ON markets (edge_gap DESC);
CREATE INDEX IF NOT EXISTS idx_markets_sport ON markets (sport);
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Markets are viewable by everyone" ON markets FOR SELECT USING (true);
CREATE POLICY "Service role can manage markets" ON markets FOR ALL USING (true);
