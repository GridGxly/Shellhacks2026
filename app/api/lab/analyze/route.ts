import { ANALYZE_SCHEMA, analyzePrompt, cleanAnalysis, cleanProfile, MOCK_ANALYSIS, type Analysis } from '@/lib/compose/lab';
import { GeminiError, geminiConfigured, geminiJson } from '@/lib/server/gemini';
import { bad, handled, mutation, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';

// Student stats -> strengths, weaknesses, and suggested settings with reasons.
export async function POST(request: Request) {
  return handled(async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 4096); if (b instanceof Response) return b;
    const profile = cleanProfile(b.profile); if (!profile) return bad('Bad profile.');
    if (!geminiConfigured() || b.mock === true) return Response.json({ analysis: MOCK_ANALYSIS, mock: true });
    const limited = await limit(`lab:${clientIp(request)}`, 20, 60_000); if (limited) return limited;
    try {
      const r = await geminiJson<Analysis>(analyzePrompt(profile), ANALYZE_SCHEMA, b.fresh === true);
      return Response.json({ analysis: cleanAnalysis(r.data), cached: r.cached, usage: r.usage, model: r.model });
    } catch (e) {
      if (e instanceof GeminiError) return bad(e.message, 502);
      throw e;
    }
  });
}
