import { validateRegiment, validateWeaknesses } from '@/lib/training-core';
import { ADVICE_SCHEMA, advicePrompt, cleanAdvice, offlineAdvice } from '@/lib/training-suggest';
import { GeminiError, geminiConfigured, geminiJson } from '@/lib/server/gemini';
import { bad, handled, mutation, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';

// "Ask the Twins": measured history -> suggested settings, each with its reason.
// Advice only — it never touches saved training state or rewards, and any
// Gemini failure quietly returns the offline suggestion instead.
export async function POST(request: Request) {
  return handled(async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 8192); if (b instanceof Response) return b;
    const weaknesses = validateWeaknesses(b.weaknesses); const regiment = validateRegiment(b.regiment);
    if (!weaknesses || !regiment) return bad('Bad practice history.');
    const fallback = offlineAdvice(weaknesses, regiment);
    if (!geminiConfigured()) return Response.json({ advice: fallback });
    const blocked = await limit(`training-suggest:${clientIp(request)}`, 12, 600_000); if (blocked) return Response.json({ advice: fallback });
    try {
      const r = await geminiJson<Parameters<typeof cleanAdvice>[0]>(advicePrompt(weaknesses), ADVICE_SCHEMA);
      return Response.json({ advice: cleanAdvice(r.data, fallback), model: r.model, cached: r.cached });
    } catch (e) {
      if (e instanceof GeminiError) return Response.json({ advice: fallback, fallbackReason: e.message });
      throw e;
    }
  });
}
