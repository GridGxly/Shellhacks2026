import { cleanSettings, COMPOSE_SCHEMA, composePrompt, MOCK_SONG, validateSong, type Song } from '@/lib/compose/lab';
import { GeminiError, geminiConfigured, geminiJson } from '@/lib/server/gemini';
import { bad, handled, mutation, object, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';

// Settings (AI-suggested, possibly edited by the player) -> a piece, checked
// against everything the Staff and grader need before it's sent back.
export async function POST(request: Request) {
  return handled(async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 8192); if (b instanceof Response) return b;
    if (!object(b.settings)) return bad('Bad settings.');
    const settings = cleanSettings(b.settings);
    const weaknesses = Array.isArray(b.weaknesses) ? b.weaknesses.filter((w): w is string => typeof w === 'string').slice(0, 3).map((w) => w.slice(0, 200)) : [];
    if (!geminiConfigured() || b.mock === true) return Response.json({ song: MOCK_SONG, settings, errors: validateSong(MOCK_SONG, settings), mock: true });
    const limited = await limit(`lab:${clientIp(request)}`, 20, 60_000); if (limited) return limited;
    try {
      const r = await geminiJson<Song>(composePrompt(settings, weaknesses), COMPOSE_SCHEMA, b.fresh === true, 'low'); // music has more rules to get right
      const song: Song = {
        title: String(r.data.title ?? 'Untitled').slice(0, 80),
        notes: (Array.isArray(r.data.notes) ? r.data.notes : []).slice(0, 128).map((n) => ({ midi: Number(n.midi), startBeat: Number(n.startBeat), durBeats: Number(n.durBeats) })),
        chords: (Array.isArray(r.data.chords) ? r.data.chords : []).map((c) => String(c).slice(0, 8)),
        trickySpots: (Array.isArray(r.data.trickySpots) ? r.data.trickySpots : []).slice(0, 8),
      };
      return Response.json({ song, settings, errors: validateSong(song, settings), cached: r.cached, usage: r.usage, model: r.model });
    } catch (e) {
      if (e instanceof GeminiError) return bad(e.message, 502);
      throw e;
    }
  });
}
