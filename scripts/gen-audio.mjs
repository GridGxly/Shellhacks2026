// Generates the build-time ElevenLabs audio: big sound effects and fixed
// villain lines. Live taunts are made at runtime by app/api/taunt/route.ts.
// Usage: node scripts/gen-audio.mjs [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.ELEVENLABS_API_KEY;
const force = process.argv.includes('--force');

const VOICES = {
  goblin: 'zauh4pbY6h1ZRErsRiAJ',
  serpent: 'xYWUvKNK6zWCgsdAK7Wi',
  choir: 'mLw8kuDeVGqVstOYjRII',
};

const SFX = {
  'goblin-attack': ['Fast snare drum roll ending in a sharp crash cymbal hit, retro game attack', 1.6],
  'serpent-attack': ['Loud distorted brass trumpet blare with a snake hiss, retro game enemy attack', 1.8],
  'choir-attack': ['Eerie dissonant choir shriek, many ghostly voices, horror game attack', 2.0],
  'ko-slam': ['Huge fighting game K.O. impact, deep boom with a long reverb tail', 2.2],
  'versus-slam': ['Fighting game versus screen slam, heavy metallic impact whoosh', 1.2],
  'encore-charge': ['Magical power charging up, rising shimmer ending in a bright chime', 2.0],
  'encore-hit': ['Massive orchestral hit with an explosion and a choir, final blow', 2.5],
  'victory-sting': ['Short triumphant retro 8-bit victory fanfare jingle', 2.5],
  'boss-lock-rattle': ['Heavy iron chains rattling against a padlock', 1.0],
};

const LINES = {
  'goblin-intro': ['goblin', "Heh heh! Another horn player? I'll drum you right off this mountain!"],
  'goblin-ko': ['goblin', 'Ha! Keep the beat next time, kid.'],
  'goblin-defeat': ['goblin', 'My... my drum... you broke my rhythm!'],
  'serpent-intro': ['serpent', 'Sssso... the little trumpet climbs. Play for me. I dare you.'],
  'serpent-ko': ['serpent', 'Flat. Flat. Flat. Exactly as I expected.'],
  'serpent-defeat': ['serpent', "Impossssible... you're actually... in tune..."],
  'choir-intro': ['choir', 'We heard every note you missed on the way up. Now sing for us.'],
  'choir-ko': ['choir', 'Silence. At last.'],
  'choir-defeat': ['choir', 'No... that was... beautiful...'],
};

async function save(path, res) {
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  console.log('wrote', path);
}

mkdirSync('public/audio/sfx', { recursive: true });
mkdirSync('public/audio/voice', { recursive: true });

for (const [name, [text, duration]] of Object.entries(SFX)) {
  const path = `public/audio/sfx/${name}.mp3`;
  if (existsSync(path) && !force) continue;
  await save(
    path,
    await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, duration_seconds: duration, prompt_influence: 0.5 }),
    }),
  );
}

for (const [name, [enemy, text]] of Object.entries(LINES)) {
  const path = `public/audio/voice/${name}.mp3`;
  if (existsSync(path) && !force) continue;
  await save(
    path,
    await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[enemy]}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.6 },
      }),
    }),
  );
}
