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

// One voice per foe, shared with the live taunt route.
const villains = JSON.parse(readFileSync('lib/villain-voices.json', 'utf8'));
const VOICES = Object.fromEntries(Object.entries(villains.voices).map(([k, v]) => [k, v.id]));

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

// Acts 2-6 use eleven_v3, whose [audio tags] direct the delivery. These lines aren't live, so latency doesn't matter.
const V3_LINES = {
  'cymbal-crab-intro': "[gruff] Ahoy, horn-blower! [clacks claws] Let's see if ye can keep time with the tide!",
  'cymbal-crab-ko': '[laughs heartily] Sunk! Straight to the bottom, sailor!',
  'cymbal-crab-defeat': '[groans] Me cymbals... cracked... [sighs] fair winds, sailor.',
  'maraca-twins-intro': "[giggles] Shake shake! We're two! [excited] You're one! That's not fair! [laughs]",
  'maraca-twins-ko': '[giggling] We win! We win! Twice!',
  'maraca-twins-defeat': "[whimpers] Our beads... they're all over the floor...",
  'tuba-golem-intro': '[slowly, deep] Small horn. [pause] Big mountain. [rumbling] Golem. Guard. Mountain.',
  'tuba-golem-ko': '[slowly] Golem... win. [satisfied grunt]',
  'tuba-golem-defeat': '[slowly, fading] Golem... crumble... good... low... notes...',
  'metronome-knight-intro': '[formal] Halt, squire. [clipped] None shall pass who cannot hold a tempo. Tick. Tock.',
  'metronome-knight-ko': '[coldly] Off the beat. As I foretold.',
  'metronome-knight-defeat': '[exhales] Your time... was true. [quietly] I yield.',
  'xylophone-skeleton-intro': "[cackling] Heh heh! Fresh meat! [rattling] I'll play you a tune on your own ribs!",
  'xylophone-skeleton-ko': "[laughs] Welcome to the bone yard, pal!",
  'xylophone-skeleton-defeat': '[groans] Aw... I fell to pieces... [sighs] again.',
  'organ-gargoyle-intro': '[deep, echoing] Nine hundred years I have guarded these pipes. [menacing] You will not be the one who passes.',
  'organ-gargoyle-ko': '[deep] Back to stone with you.',
  'organ-gargoyle-defeat': '[cracking voice] The chord... resolves... [fading] at last.',
  'violin-specter-intro': '[whispers] Another musician... [mournfully] come to haunt these halls with me?',
  'violin-specter-ko': '[whispers] Stay. Forever. [sighs]',
  'violin-specter-defeat': '[softly] That melody... [relieved sigh] I can finally rest.',
  'harp-siren-intro': '[seductively] Hello, darling. [softly] Come closer. Play me something... before you drown.',
  'harp-siren-ko': '[whispers] Sink, darling. [laughs softly]',
  'harp-siren-defeat': '[gasps] Your song... pulled me under instead...',
  'accordion-mimic-intro': "[mimicking] Hello, climber. [creepy laugh] Oh, I can play that too. I can play anything you play.",
  'accordion-mimic-ko': '[mocking] I learned your song. [laughs] You forgot it.',
  'accordion-mimic-defeat': '[wheezing] Out of... air... [deflating sigh]',
  'kazoo-harpy-intro': '[screeching] Caw caw! [cackles] Fresh ears to torment! Bzzzt!',
  'kazoo-harpy-ko': '[cackling] Bzzzt! Down you go!',
  'kazoo-harpy-defeat': '[squawks] My kazoo! [crying] You bent my kazoo!',
  'bagpipe-beast-intro': '[roars] Och! [Scottish growl] Who dares climb into my glen with a wee horn like that?',
  'bagpipe-beast-ko': '[laughs heartily] Back to the lowlands wi\' ye!',
  'bagpipe-beast-defeat': '[wheezing] Me pipes... they\'ve gone flat... [sighs]',
  'theremin-wisp-intro': "[eerie whisper] Wooo... reach for the note... [echoing] you'll never quite touch it.",
  'theremin-wisp-ko': '[whispers] Snuffed out. [eerie laugh]',
  'theremin-wisp-defeat': '[fading] You touched it... [whispers] the note...',
  'autotune-android-intro': '[robotic] Scanning. Human detected. Pitch deviation: unacceptable. [monotone] Correction will begin now.',
  'autotune-android-ko': '[robotic] Human terminated. Pitch corrected.',
  'autotune-android-defeat': '[glitching] Error. Error. Human pitch... perfect? [powering down]',
  'conductor-lich-intro': '[theatrical] Ah. A soloist. [sinister] My orchestra has waited centuries for fresh blood. From the top!',
  'conductor-lich-ko': '[grandly] And... cut. [cruel laugh] The requiem is yours.',
  'conductor-lich-defeat': '[shocked] Bravo? [crumbling] I never... said bravo... before...',
  'silent-maestro-intro': '[many voices, echoing] You reached the top. [menacing] Now hear the final silence.',
  'silent-maestro-ko': '[echoing whisper] Silence. Forever.',
  'silent-maestro-defeat': '[many voices, fading] The Choir... is... slain...',
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

for (const [name, text] of Object.entries(V3_LINES)) {
  const path = `public/audio/voice/${name}.mp3`;
  if (existsSync(path) && !force) continue;
  const foe = name.replace(/-(intro|ko|defeat)$/, '');
  await save(
    path,
    await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[foe]}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: villains.lineModel, voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
    }),
  );
}
