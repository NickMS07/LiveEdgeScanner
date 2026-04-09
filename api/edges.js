import { getLatestEdges } from '../lib/database.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const { sport = 'all', minEdge = '0', limit = '50' } = req.query;
    const edges = await getLatestEdges({ sport, minEdge: parseInt(minEdge), limit: parseInt(limit) });
    res.status(200).json({ ok: true, data: edges, count: edges.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
}
