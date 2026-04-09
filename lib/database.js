import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

let supabase = null;
function getClient() {
  if (!supabase && config.supabaseUrl && config.supabaseKey) {
    supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }
  return supabase;
}

export async function storeResults(edgeResults) {
  const db = getClient();
  if (!db) { console.warn('No Supabase config — results printed to console only'); return; }
  try {
    const rows = edgeResults.map(r => ({
      market_id: r.id, sport: r.sport, team_a: r.teamA, team_b: r.teamB,
      question: r.question || '', prices: r.prices,
      edge_gap: r.edge?.gap || 0, edge_side: r.edge?.side || null,
      edge_class: r.edge?.edgeClass || 'none', edge_platform: r.edge?.platform || null,
      bet_team: r.edge?.betTeam || null, poly_price: r.edge?.polyPrice || null,
      book_price: r.edge?.bookPrice || null, volume: r.volume || 0,
      commence_time: r.commenceTime || r.endDate || null,
      scanned_at: new Date().toISOString(),
    }));
    const { error } = await db.from('markets').upsert(rows, { onConflict: 'market_id' });
    if (error) console.error('Supabase error:', error.message);
    else console.log(`  Stored ${rows.length} markets in database`);
  } catch (err) { console.error('Database error:', err.message); }
}

export async function getLatestEdges(options = {}) {
  const db = getClient();
  if (!db) return [];
  const { sport = null, minEdge = 0, limit = 50 } = options;
  try {
    let query = db.from('markets').select('*').gte('edge_gap', minEdge)
      .order('edge_gap', { ascending: false }).limit(limit);
    if (sport && sport !== 'all') query = query.eq('sport', sport);
    const { data, error } = await query;
    if (error) { console.error('Supabase fetch error:', error.message); return []; }
    return data || [];
  } catch (err) { console.error('Database fetch error:', err.message); return []; }
}
