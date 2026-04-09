import http from 'http';
import { getLatestEdges } from '../lib/database.js';

const PORT = process.env.PORT || 3001;
const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  try {
    if (url.pathname === '/api/edges') {
      const sport = url.searchParams.get('sport') || 'all';
      const minEdge = parseInt(url.searchParams.get('minEdge') || '0');
      const edges = await getLatestEdges({ sport, minEdge, limit: 50 });
      res.writeHead(200, cors); res.end(JSON.stringify({ ok: true, data: edges }));
    } else if (url.pathname === '/api/health') {
      res.writeHead(200, cors); res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
    } else {
      res.writeHead(404, cors); res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    }
  } catch (err) {
    res.writeHead(500, cors); res.end(JSON.stringify({ ok: false, error: 'Server error' }));
  }
});
server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
