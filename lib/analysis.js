// AI Analysis Module
// Uses Claude API to analyze edges and explain why odds are mispriced

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';

export async function analyzeEdge(market) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return generateBasicAnalysis(market);
  }

  try {
    const prompt = `You are a sharp sports betting analyst. Analyze this betting edge in 2-3 sentences. Be specific and actionable. No fluff.

Sport: ${market.sport.toUpperCase()}
Matchup: ${market.teamA} vs ${market.teamB}
Edge: ${market.edge.betTeam} is priced at ${market.edge.polyPrice}% on ${market.edge.cheapPlatform} but ${market.edge.bookPrice}% on ${market.edge.platform}. That's a ${market.edge.gap} cent gap.

Explain: Why might this gap exist? Is it exploitable? What should a bettor know about this matchup right now? Consider recent form, injuries, and any relevant context.`;

    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error(`Claude API error: ${res.status}`);
      return generateBasicAnalysis(market);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    return text.trim();
  } catch (err) {
    console.error('Analysis error:', err.message);
    return generateBasicAnalysis(market);
  }
}

function generateBasicAnalysis(market) {
  const { edge, sport, teamA, teamB } = market;
  const gap = edge.gap;
  const betTeam = edge.betTeam;
  const cheap = edge.cheapPlatform;
  const expensive = edge.platform;

  if (gap >= 8) {
    return `Strong ${gap}c price gap on ${betTeam}. ${cheap} has them significantly cheaper than ${expensive}. This level of disagreement between major sportsbooks is unusual and suggests one platform hasn't adjusted to recent information. Worth investigating for a value play.`;
  } else if (gap >= 5) {
    return `${gap}c gap on ${betTeam} between ${cheap} and ${expensive}. Moderate disagreement between books — could indicate differing injury assessments or varying model inputs. Check for late lineup changes or weather factors before placing.`;
  } else {
    return `Small ${gap}c gap on ${betTeam}. ${cheap} is slightly cheaper than ${expensive}. This is within normal market variance but could widen closer to game time if news breaks.`;
  }
}

export async function analyzeTopEdges(results, maxAnalyze = 10) {
  const edgeMarkets = results.filter(r => r.edge.gap >= 3).slice(0, maxAnalyze);
  
  console.log(`  Analyzing ${edgeMarkets.length} edge markets...`);
  
  for (const market of edgeMarkets) {
    const analysis = await analyzeEdge(market);
    market.analysis = analysis;
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }
  
  return results;
}
