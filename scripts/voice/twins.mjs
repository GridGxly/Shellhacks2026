// Records the Dioscuri's greetings with ElevenLabs into public/audio/voice/.
// Lines and voices live in lib/twins.json. Re-run after changing a greeting:
//   node scripts/voice/twins.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const env = await readFile('.env.local', 'utf8').catch(() => '');
const key = process.env.ELEVENLABS_API_KEY || env.match(/^ELEVENLABS_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^"|"$/g, '');
if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
const twins = JSON.parse(await readFile('lib/twins.json', 'utf8'));
await mkdir('public/audio/voice', { recursive: true });

for (const [n, greeting] of twins.greetings.entries()) {
  for (const twin of ['castor', 'pollux']) {
    const voice = twins.voices[twin];
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: greeting[twin], model_id: twins.model, voice_settings: voice.settings }),
    });
    if (!res.ok) throw new Error(`${twin} ${n}: ${res.status} ${await res.text()}`);
    const out = `public/audio/voice/twins-greet-${n}-${twin}.mp3`;
    await writeFile(out, Buffer.from(await res.arrayBuffer()));
    console.log(out);
  }
}
