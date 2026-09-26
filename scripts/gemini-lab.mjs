#!/usr/bin/env node
// Gemini Lab — terminal test bench for Training Mode's AI, no UI.
//
//   node scripts/gemini-lab.mjs analyze --profile=demo
//   node scripts/gemini-lab.mjs compose --profile=demo --key=G --bpm=90 --style="pirate march"
//   add --mock to use canned answers (zero API calls), --fresh to skip the cache
//
// Needs GEMINI_API_KEY (env or .env.local). Optional GEMINI_MODEL.
// Every live answer is cached in node_modules/.cache/gemini-lab, so re-running is free.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------- args / env
const [cmd = 'analyze', ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
if (existsSync('.env.local')) for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MOCK = !!args.mock || !KEY;
const CACHE = 'node_modules/.cache/gemini-lab';

// ---------------------------------------------------------------- profiles (hit/total per tag, same shape as lib/mentor/tags.ts)
const PROFILES = {
  demo: { dotted: [8, 22], eighths: [41, 46], accidental: [7, 16], leap: [29, 31], offbeat: [14, 19], timing: [52, 70] },
  beginner: { dotted: [2, 9], eighths: [5, 14], accidental: [1, 6], leap: [4, 10], offbeat: [1, 5], timing: [10, 30] },
  strong: { dotted: [30, 33], eighths: [88, 92], accidental: [25, 29], leap: [40, 44], offbeat: [21, 24], timing: [80, 95] },
  timing: { dotted: [18, 22], eighths: [40, 44], accidental: [15, 17], leap: [20, 22], offbeat: [9, 20], timing: [12, 60] },
};
const TAGS = ['dotted', 'eighths', 'accidental', 'leap', 'offbeat', 'timing'];
const profileName = args.profile || 'demo';
const profile = PROFILES[profileName];
if (!profile) { console.error(`Unknown profile. Use: ${Object.keys(PROFILES).join(', ')}`); process.exit(1); }
const profileText = TAGS.map((t) => `${t}: ${profile[t][0]}/${profile[t][1]} (${Math.round((100 * profile[t][0]) / profile[t][1])}%)`).join('\n');

// ---------------------------------------------------------------- music helpers
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC = { C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11 };
const keyPc = (s) => PC[String(s).toUpperCase().replace('♯', '#').replace('♭', 'B')];
const noteName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const DUR = { 0.5: 'e', 1: 'q', 1.5: 'q.', 2: 'h', 3: 'h.', 4: 'w' };

// ---------------------------------------------------------------- Gemini call (REST, structured JSON, cached)
async function gemini(label, prompt, schema, mock) {
  const id = createHash('sha256').update(MODEL + prompt + JSON.stringify(schema)).digest('hex').slice(0, 16);
  const file = `${CACHE}/${label}-${id}.json`;
  if (MOCK) { console.log(`\x1b[33m[${label}: MOCK — no API call]\x1b[0m`); return mock; }
  if (!args.fresh && existsSync(file)) { console.log(`\x1b[36m[${label}: cached — free]\x1b[0m`); return JSON.parse(readFileSync(file, 'utf8')); }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 } }),
  });
  const body = await res.json();
  if (!res.ok) { console.error(`Gemini error ${res.status}:`, body.error?.message ?? body); process.exit(1); }
  const u = body.usageMetadata ?? {};
  console.log(`\x1b[32m[${label}: LIVE ${MODEL} — tokens in ${u.promptTokenCount} / out ${u.candidatesTokenCount}]\x1b[0m`);
  const out = JSON.parse(body.candidates[0].content.parts[0].text);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2));
  return out;
}

const S = (type, extra = {}) => ({ type, ...extra });
const reasoned = (valueSchema) => S('OBJECT', { properties: { value: valueSchema, reason: S('STRING') }, required: ['value', 'reason'] });

// ---------------------------------------------------------------- 1. analyze
const ANALYZE_SCHEMA = S('OBJECT', {
  properties: {
    strengths: S('ARRAY', { items: S('OBJECT', { properties: { tag: S('STRING', { enum: TAGS }), why: S('STRING') }, required: ['tag', 'why'] }) }),
    weaknesses: S('ARRAY', { items: S('OBJECT', { properties: { tag: S('STRING', { enum: TAGS }), why: S('STRING') }, required: ['tag', 'why'] }) }),
    recommendation: S('STRING'),
    settings: S('OBJECT', {
      properties: {
        key: reasoned(S('STRING', { enum: ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb'] })),
        bpm: reasoned(S('INTEGER')),
        beatsPerBar: reasoned(S('INTEGER')), // Gemini enums must be strings; clamped to 3|4 in code
        bars: reasoned(S('INTEGER')),
        difficulty: reasoned(S('INTEGER')),
        style: reasoned(S('STRING')),
        focus: reasoned(S('ARRAY', { items: S('STRING', { enum: TAGS }) })),
      },
      required: ['key', 'bpm', 'beatsPerBar', 'bars', 'difficulty', 'style', 'focus'],
    }),
  },
  required: ['strengths', 'weaknesses', 'recommendation', 'settings'],
});

const ANALYZE_PROMPT = `You are a high-school band director reviewing a student's sight-reading stats.
Each line is: skill: notes played correctly / notes attempted (success rate).
${profileText}

Identify up to 2 strengths and up to 2 weaknesses. Every "why" must quote the numbers above.
Recommend what to practice next in one or two sentences.
Suggest settings for ONE short new sight-reading piece that targets the weaknesses while staying readable.
Every setting needs a "reason" that names which numbers it is based on.
Constraints: bpm 50-140, bars 4 or 8, difficulty 1 (easiest) to 5, focus = 1-2 of the tags.`;

const MOCK_ANALYSIS = {
  strengths: [{ tag: 'leap', why: 'Big leaps 29/31 (94%) — very reliable.' }, { tag: 'eighths', why: 'Eighth notes 41/46 (89%).' }],
  weaknesses: [{ tag: 'dotted', why: 'Dotted rhythms only 8/22 (36%).' }, { tag: 'accidental', why: 'Accidentals 7/16 (44%).' }],
  recommendation: 'Drill dotted-quarter figures in a key with one sharp so accidentals show up in context.',
  settings: {
    key: { value: 'G', reason: 'One sharp (F#) adds accidental practice; accidentals are at 44%.' },
    bpm: { value: 80, reason: 'Moderate: timing is 52/70 (74%), not ready to push tempo.' },
    beatsPerBar: { value: 4, reason: 'Dotted quarters sit most naturally in 4/4.' },
    bars: { value: 4, reason: 'Short enough to read cold while two weaknesses are in play.' },
    difficulty: { value: 2, reason: 'Two weaknesses at once — keep everything else easy.' },
    style: { value: 'march', reason: 'Marches are built on dotted rhythms (36% success).' },
    focus: { value: ['dotted', 'accidental'], reason: 'The two lowest rates: 36% and 44%.' },
  },
};

async function analyze() {
  console.log(`\nProfile "${profileName}":\n${profileText}\n`);
  return gemini('analyze', ANALYZE_PROMPT, ANALYZE_SCHEMA, MOCK_ANALYSIS);
}

function printAnalysis(a) {
  console.log('\nSTRENGTHS');  a.strengths.forEach((s) => console.log(`  + ${s.tag}: ${s.why}`));
  console.log('WEAKNESSES'); a.weaknesses.forEach((s) => console.log(`  - ${s.tag}: ${s.why}`));
  console.log(`NEXT: ${a.recommendation}`);
}

// ---------------------------------------------------------------- 2. settings = AI suggestion, overridable by flags
function resolveSettings(ai) {
  const flag = { key: args.key, bpm: args.bpm, beatsPerBar: args.time, bars: args.bars, difficulty: args.difficulty, style: args.style, focus: args.focus };
  const num = (v) => (v === undefined ? undefined : Number(v));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
  const pick = (k, parse = (v) => v) => (flag[k] !== undefined && flag[k] !== true ? { value: parse(flag[k]), by: 'you' } : { value: ai[k].value, by: 'ai', reason: ai[k].reason });
  const s = {
    key: pick('key'), bpm: pick('bpm', num), beatsPerBar: pick('beatsPerBar', num), bars: pick('bars', num),
    difficulty: pick('difficulty', num), style: pick('style'), focus: pick('focus', (v) => String(v).split(',')),
  };
  if (keyPc(s.key.value) === undefined) { console.error(`Bad key "${s.key.value}"`); process.exit(1); }
  s.bpm.value = clamp(s.bpm.value, 40, 180);
  s.beatsPerBar.value = [3, 4].includes(s.beatsPerBar.value) ? s.beatsPerBar.value : 4;
  s.bars.value = clamp(s.bars.value, 2, 8);
  s.difficulty.value = clamp(s.difficulty.value, 1, 5);
  s.focus.value = s.focus.value.filter((t) => TAGS.includes(t));
  console.log('\nSETTINGS  (override any with --key= --bpm= --time=3|4 --bars= --difficulty= --style= --focus=a,b)');
  for (const [k, v] of Object.entries(s)) console.log(`  ${k.padEnd(11)} ${String(v.value).padEnd(16)} ${v.by === 'you' ? '\x1b[35m(you)\x1b[0m' : `\x1b[2mAI: ${v.reason}\x1b[0m`}`);
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.value]));
}

// ---------------------------------------------------------------- 3. compose
const COMPOSE_SCHEMA = S('OBJECT', {
  properties: {
    title: S('STRING'),
    notes: S('ARRAY', { items: S('OBJECT', { properties: { midi: S('INTEGER'), startBeat: S('NUMBER'), durBeats: S('NUMBER') }, required: ['midi', 'startBeat', 'durBeats'] }) }),
    chords: S('ARRAY', { items: S('STRING') }),
    trickySpots: S('ARRAY', { items: S('OBJECT', { properties: { bar: S('INTEGER'), tag: S('STRING', { enum: TAGS }), note: S('STRING') }, required: ['bar', 'tag', 'note'] }) }),
  },
  required: ['title', 'notes', 'chords', 'trickySpots'],
});

const composePrompt = (s, a) => `Compose a short, singable sight-reading melody for a student.
Student weaknesses: ${a.weaknesses.map((w) => w.why).join(' ')}
Key: ${s.key} major. Time: ${s.beatsPerBar}/4. Bars: ${s.bars}. Tempo: ${s.bpm} BPM. Difficulty ${s.difficulty}/5. Style: ${s.style}.
Feature these skills clearly: ${s.focus.join(', ')}.
Rules:
- One note at a time. MIDI numbers, concert pitch, between 60 and 79.
- durBeats only from: 0.5, 1, 1.5, 2, 3, 4. startBeat counts from 0 in quarter-note beats.
- Every bar is exactly ${s.beatsPerBar} beats; no note may cross a bar line; notes are in order and do not overlap.
- Start on a note of the tonic chord, mostly move by step, follow a leap with a step back, repeat a rhythm idea, and END on the tonic.
- chords: one chord symbol per bar (e.g. "G", "C", "D7", "Em").
- trickySpots: the bars that practise the focus skills, with the tag and a short note.`;

const MOCK_SONG = {
  title: 'Dotted March in G',
  notes: [
    [67, 0, 1.5], [69, 1.5, 0.5], [71, 2, 1], [67, 3, 1],
    [72, 4, 1.5], [71, 5.5, 0.5], [69, 6, 2],
    [71, 8, 1.5], [72, 9.5, 0.5], [74, 10, 1], [71, 11, 1],
    [69, 12, 1], [66, 13, 1], [67, 14, 2],
  ].map(([midi, startBeat, durBeats]) => ({ midi, startBeat, durBeats })),
  chords: ['G', 'C', 'G', 'D7'],
  trickySpots: [{ bar: 1, tag: 'dotted', note: 'Dotted quarter + eighth — count "1 (2) &"' }, { bar: 4, tag: 'accidental', note: 'F# leading tone back to G' }],
};

// ---------------------------------------------------------------- 4. validate (never trust the model)
function validate(song, s) {
  const errs = [];
  const bpb = s.beatsPerBar, total = s.bars * bpb;
  let end = 0;
  song.notes.forEach((n, i) => {
    const at = `note ${i + 1} (${noteName(n.midi)} @${n.startBeat})`;
    if (!(n.durBeats in DUR)) errs.push(`${at}: duration ${n.durBeats} not drawable`);
    if (n.startBeat < end - 1e-9) errs.push(`${at}: overlaps previous note`);
    if (Math.floor(n.startBeat / bpb) !== Math.floor((n.startBeat + n.durBeats - 1e-9) / bpb)) errs.push(`${at}: crosses a bar line`);
    if (n.midi < 55 || n.midi > 84) errs.push(`${at}: out of range`);
    end = n.startBeat + n.durBeats;
  });
  if (Math.abs(end - total) > 1e-9) errs.push(`piece fills ${end} beats, expected ${total} (${s.bars} bars)`);
  const last = song.notes[song.notes.length - 1];
  if (last && ((last.midi - keyPc(s.key)) % 12 + 12) % 12 !== 0) errs.push(`ends on ${noteName(last.midi)}, not the tonic`);
  song.trickySpots.forEach((t) => { if (t.bar < 1 || t.bar > s.bars) errs.push(`tricky spot bar ${t.bar} doesn't exist`); });
  return errs;
}

function printSong(song, s) {
  console.log(`\n♪ ${song.title}   (${s.key} major, ${s.beatsPerBar}/4, ${s.bpm} BPM)`);
  for (let b = 0; b < s.bars; b++) {
    const inBar = song.notes.filter((n) => Math.floor(n.startBeat / s.beatsPerBar) === b);
    const spot = song.trickySpots.find((t) => t.bar === b + 1);
    console.log(`  bar ${String(b + 1).padStart(2)} [${(song.chords[b] ?? '?').padEnd(4)}] ${inBar.map((n) => `${noteName(n.midi)}:${DUR[n.durBeats] ?? n.durBeats}`).join('  ').padEnd(44)} ${spot ? `\x1b[33m← ${spot.tag}: ${spot.note}\x1b[0m` : ''}`);
  }
}

// ---------------------------------------------------------------- run
if (MOCK) console.log(`\x1b[33m${KEY ? 'Mock mode' : 'No GEMINI_API_KEY found — mock mode'} (zero API calls).\x1b[0m`);
const analysis = await analyze();
printAnalysis(analysis);
const settings = resolveSettings(analysis.settings);
if (cmd === 'compose') {
  const song = await gemini('compose', composePrompt(settings, analysis), COMPOSE_SCHEMA, MOCK_SONG);
  printSong(song, settings);
  const errs = validate(song, settings);
  console.log(errs.length ? `\n\x1b[31m✗ ${errs.length} problem(s):\x1b[0m\n  ${errs.join('\n  ')}` : '\n\x1b[32m✓ Passes validation\x1b[0m');
  if (args.save) { writeFileSync(String(args.save), JSON.stringify({ settings, song }, null, 2)); console.log(`saved → ${args.save}`); }
}
