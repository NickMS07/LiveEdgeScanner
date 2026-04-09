import { config } from '../config/index.js';

const recentlyNotified = new Map();
const COOLDOWN = 30 * 60 * 1000;

export async function sendEdgeAlert(edge, market) {
  if (!config.fcmServerKey) {
    console.log(`  [ALERT] ${edge.betTeam} +${edge.gap} cents (push disabled)`);
    return;
  }
  const title = `STRONG EDGE: +${edge.gap} cents`;
  const body = `${edge.betTeam} at ${edge.polyPrice} on Polymarket vs ${edge.bookPrice}% on ${edge.platform}`;
  try {
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { 'Authorization': `key=${config.fcmServerKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '/topics/edge-alerts', notification: { title, body } }),
    });
  } catch (err) { console.error('Push error:', err.message); }
}

export async function processNotifications(edgeResults) {
  const strong = edgeResults.filter(r => r.edge?.edgeClass === 'strong');
  for (const result of strong) {
    const last = recentlyNotified.get(result.id);
    if (last && Date.now() - last < COOLDOWN) continue;
    await sendEdgeAlert(result.edge, result);
    recentlyNotified.set(result.id, Date.now());
  }
}
