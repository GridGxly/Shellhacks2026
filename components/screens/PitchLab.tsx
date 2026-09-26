'use client';
// Pitch Lab: the perform loop from Combat (count-in -> record -> grade) on its
// own, with no enemy, HP or taunts, so note mapping can be tested in isolation.
// Uses the real mic + grade() and the real Staff, plus a per-note breakdown.

import { useEffect, useRef, useState } from 'react';
import { ac, clickAt, muteMusic, saveSettings, settings, sfx } from '@/lib/audio';
import { COUNT_IN_BEATS, IGNORE_OCTAVE, INPUT_LATENCY_MS, PERFECT_MS, PITCH_TOLERANCE_CENTS, RECORD_TAIL_MS, TIMING_WINDOW_MS } from '@/lib/config';
import { INSTRUMENTS } from '@/lib/content';
import { grade, mic, type NoteResult, type Reading } from '@/lib/mic';
import { GRAN_VALS, makeExercise, noteName, writtenKey, type Exercise, type KeySig } from '@/lib/music';
import { instrumentOf, useGame } from '@/lib/store';
import Staff from '../Staff';
import { MenuShell } from './Menus';

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const clock = () => performance.now();

type Pick = 'one' | 'scale' | 'chord' | 'rhythm' | 'encore';
type Stage = 'idle' | 'countin' | 'recording' | 'done';

type Inst = { writtenOffset: number; shift: number };
const C_MAJOR: KeySig = { name: 'C', accidentals: 0 };

// Written C major, C4 up to C5 and back, quarter notes with a held final C
// (4 bars of 4/4). Stored concert like all content: concert = written - offset - shift,
// so the Staff (written = concert + shift + offset) draws exactly C D E F G A B C.
function cMajorScale(tempo: number, inst: Inst): Exercise {
  const up = [60, 62, 64, 65, 67, 69, 71, 72];
  const written = [...up, ...up.slice(0, -1).reverse()];
  let beat = 0;
  const notes = written.map((w, i) => {
    const durBeats = i === written.length - 1 ? 2 : 1;
    const n = { midi: w - inst.writtenOffset - inst.shift, startBeat: beat, durBeats };
    beat += durBeats;
    return n;
  });
  return { id: 'lab-c-major', type: 'scale', title: 'C major', tempo, beatsPerBar: 4, bars: 4, notes };
}

// Written C4 on every beat for two bars: one pitch, so each note tests only
// mapping and timing. Re-tongue each note; the attack is what gets timed.
function oneC(tempo: number, inst: Inst): Exercise {
  const midi = 60 - inst.writtenOffset - inst.shift;
  const notes = Array.from({ length: 8 }, (_, i) => ({ midi, startBeat: i, durBeats: 1 }));
  return { id: 'lab-c-beats', type: 'rhythm', title: 'C on the beat', tempo, beatsPerBar: 4, bars: 2, notes };
}

function build(pick: Pick, tempo: number, inst: Inst): Exercise {
  if (pick === 'one') return oneC(tempo, inst);
  if (pick === 'scale') return cMajorScale(tempo, inst);
  return pick === 'encore' ? { ...GRAN_VALS, tempo } : makeExercise(pick, tempo);
}

export function PitchLab() {
  const run = useGame((s) => s.run);
  const inst = instrumentOf(run);

  const [pick, setPick] = useState<Pick>('one');
  const [tempo, setTempo] = useState(72);
  const [ex, setEx] = useState<Exercise>(() => build('one', 72, inst));
  const inC = pick === 'one' || pick === 'scale';
  const key = inC ? C_MAJOR : writtenKey(inst.writtenOffset);
  const [stage, setStage] = useState<Stage>('idle');
  const [count, setCount] = useState(0);
  const [beat, setBeat] = useState<number | null>(null);
  const [results, setResults] = useState<(NoteResult | undefined)[]>([]);
  // What the mic heard over the whole take: concert semitone -> share of pitched frames.
  const [heardMix, setHeardMix] = useState<{ midi: number; pct: number }[]>([]);
  const [reading, setReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState(mic.status);
  const [approach, setApproach] = useState(settings.approach === 'on');
  const alive = useRef(true);

  // Mic on, title music off (it would leak into the mic) for the whole visit.
  useEffect(() => {
    alive.current = true;
    muteMusic(true);
    mic.start().then(() => alive.current && setStatus(mic.status));
    const l = (r: Reading) => setReading(r);
    mic.listeners.add(l);
    return () => {
      alive.current = false;
      mic.listeners.delete(l);
      muteMusic(false);
    };
  }, []);

  const busy = stage === 'countin' || stage === 'recording';

  const choose = (p: Pick, t = tempo) => {
    if (busy) return;
    sfx('click');
    setPick(p);
    setTempo(t);
    setEx(build(p, t, inst));
    setResults([]);
    setBeat(null);
    setStage('idle');
  };

  const cycleInstrument = () => {
    if (busy) return;
    sfx('click');
    const i = INSTRUMENTS.findIndex((x) => x.id === inst.id);
    const next = INSTRUMENTS[(i + 1) % INSTRUMENTS.length];
    useGame.getState().chooseInstrument(next.id);
    setEx(build(pick, tempo, next)); // scale is built in the instrument's written C
    setResults([]);
  };

  // Same timing as Combat.performAction so results match the game exactly.
  const play = async () => {
    if (busy || mic.status !== 'on') return;
    setResults([]);
    setHeardMix([]);
    setStage('countin');
    const mspb = 60000 / ex.tempo;
    const ctx = ac();
    const t0 = ctx.currentTime + 0.12;
    for (let b = 0; b < COUNT_IN_BEATS; b++) clickAt(t0 + (b * mspb) / 1000, b === 0);
    const startPerf = clock() + 120 + COUNT_IN_BEATS * mspb;
    for (let b = 0; b < COUNT_IN_BEATS; b++) window.setTimeout(() => alive.current && setCount(b + 1), 120 + b * mspb);
    // Negative beats through the count-in so the first circles are already
    // closing (bar mode keeps the staff untouched until the downbeat).
    let counting = approach;
    const pre = () => {
      if (!counting || !alive.current) return;
      setBeat((clock() - startPerf) / mspb);
      requestAnimationFrame(pre);
    };
    requestAnimationFrame(pre);
    await wait(120 + COUNT_IN_BEATS * mspb - 30);
    counting = false;
    if (!alive.current) return;

    mic.beginRecording();
    setStage('recording');
    const last = ex.notes[ex.notes.length - 1];
    const totalBeats = last.startBeat + last.durBeats;
    await new Promise<void>((done) => {
      const tick = () => {
        if (!alive.current) return done();
        const now = clock();
        const g = grade(ex, mic.peek(), startPerf, inst.shift, TIMING_WINDOW_MS);
        setBeat(Math.max(0, (now - startPerf) / mspb));
        setResults(ex.notes.map((n, i) => (now >= startPerf + (n.startBeat + n.durBeats) * mspb + 110 ? g[i] : undefined)));
        if (now > startPerf + totalBeats * mspb + RECORD_TAIL_MS) return done();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const readings = mic.endRecording();
    const final = grade(ex, readings, startPerf, inst.shift, TIMING_WINDOW_MS);
    // Same span the grader looks at: first note start -> last note end, plus mic latency.
    const from = startPerf + INPUT_LATENCY_MS;
    const to = startPerf + totalBeats * mspb + INPUT_LATENCY_MS;
    const pitched = readings.filter((r) => r.midi !== null && r.t >= from && r.t <= to);
    const counts = new Map<number, number>();
    pitched.forEach((r) => counts.set(Math.round(r.midi!), (counts.get(Math.round(r.midi!)) ?? 0) + 1));
    setHeardMix([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([midi, c]) => ({ midi, pct: Math.round((c / pitched.length) * 100) })));
    if (!alive.current) return;
    setResults(final);
    setBeat(null);
    setStage('done');
    sfx(final.every((r) => r.status === 'hit') ? 'stampHit' : 'stampMiss');
  };

  // Live readout: stabilized note (what the game shows) + raw frame detail.
  const name = (concert: number) => `${noteName(concert + inst.writtenOffset, key)}${Math.floor((concert + inst.writtenOffset) / 12) - 1}`;
  const heard = reading?.stableMidi != null ? Math.round(reading.stableMidi) : null;
  const cents = reading?.midi != null ? Math.round((reading.midi - Math.round(reading.midi)) * 100) : null;

  const done = results.filter(Boolean) as NoteResult[];
  const hits = done.filter((r) => r.status === 'hit').length;
  // In-time summary: mean onset offset over notes where an onset was found.
  const offs = done.map((r) => r.onsetOffsetMs).filter((v): v is number => v !== null);
  const avgOff = offs.length ? Math.round(offs.reduce((a, b) => a + b, 0) / offs.length) : null;
  const inWindow = offs.filter((v) => Math.abs(v) <= TIMING_WINDOW_MS).length;

  const concertName = (m: number) => `${noteName(m, C_MAJOR)}${Math.floor(m / 12) - 1}`;

  const why = (r: NoteResult, expected: number) => {
    const t = r.onsetOffsetMs === null ? 'onset not found' : `onset ${r.onsetOffsetMs >= 0 ? '+' : ''}${Math.round(r.onsetOffsetMs)}ms`;
    if (r.status === 'silent') return 'too few pitched frames';
    if (r.status === 'hit') return `✓ · ${t}`;
    const octave = (r.playedMidi! - expected) % 12 === 0 ? 'right note, WRONG OCTAVE: ' : '';
    return `${octave}played ${name(r.playedMidi!)} · ${t}`;
  };

  const tab = (p: Pick, label: string) => (
    <button
      key={p}
      onClick={() => choose(p)}
      className="f-label"
      style={{ padding: '8px 14px', fontSize: 12, background: pick === p ? 'var(--sun)' : '#1E2140', color: pick === p ? '#101126' : 'var(--soft)', border: '3px solid #3A3F70', opacity: busy ? 0.5 : 1 }}
    >
      {label}
    </button>
  );

  return (
    <MenuShell title="PITCH LAB">
      {/* controls */}
      <div style={{ position: 'absolute', left: 120, top: 170, width: 1200, display: 'flex', alignItems: 'center', gap: 12 }}>
        {tab('one', 'C ON BEAT')}
        {tab('scale', 'C MAJOR')}
        {tab('chord', 'CHORD')}
        {tab('rhythm', 'RHYTHM')}
        {tab('encore', 'GRAN VALS')}
        <div className="f-label" style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--soft)' }}>
          <button onClick={() => choose(pick, Math.max(40, tempo - 8))} style={{ color: 'var(--sun)', font: 'inherit' }}>◀</button>
          {tempo} BPM
          <button onClick={() => choose(pick, Math.min(200, tempo + 8))} style={{ color: 'var(--sun)', font: 'inherit' }}>▶</button>
        </div>
        <button onClick={cycleInstrument} className="f-label" style={{ marginLeft: 16, fontSize: 12, color: 'var(--sun)', textDecoration: 'underline' }}>
          {inst.name.toUpperCase()} ({inst.keyLabel})
        </button>
        <button
          onClick={() => {
            sfx('click');
            saveSettings({ approach: approach ? 'off' : 'on' });
            setApproach(!approach);
          }}
          className="f-label"
          style={{ marginLeft: 16, fontSize: 12, color: 'var(--soft)' }}
        >
          FOLLOW: <span style={{ color: 'var(--sun)', textDecoration: 'underline' }}>{approach ? 'CIRCLES' : 'BAR'}</span>
        </button>
        <div style={{ flex: 1 }} />
        {/* beat light: count-in beats, then the current beat of the bar */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2, 3].map((b) => {
            const lit = stage === 'countin' ? count === b + 1 : stage === 'recording' && beat !== null ? Math.floor(beat) % 4 === b : false;
            return <div key={b} style={{ width: 22, height: 22, background: lit ? (b === 0 ? 'var(--sun)' : 'var(--meadow)') : '#2A2F55', border: '3px solid #101126' }} />;
          })}
        </div>
        <button
          onClick={play}
          disabled={busy || status !== 'on'}
          className="f-press"
          style={{ padding: '10px 22px', fontSize: 16, background: busy || status !== 'on' ? '#3A3F70' : 'var(--meadow)', color: '#101126', border: '4px solid #101126' }}
        >
          {status !== 'on' ? 'NO MIC' : stage === 'countin' ? `${count}…` : stage === 'recording' ? 'PLAY!' : stage === 'done' ? 'AGAIN ▶' : 'PLAY ▶'}
        </button>
      </div>

      {/* staff on parchment, same component the fight uses */}
      <div style={{ position: 'absolute', left: 120, top: 230, width: 1200, padding: '8px 0', background: 'var(--parchment)', border: '4px solid #101126', boxShadow: '#101126 6px 6px 0' }}>
        <Staff ex={ex} shift={inst.shift} writtenOffset={inst.writtenOffset} width={1192} beat={beat} results={results} barsPerLine={Math.min(ex.bars, 4)} keySig={inC ? C_MAJOR : undefined} approach={approach} />
      </div>

      {/* live mic readout + score */}
      <div style={{ position: 'absolute', left: 120, top: 560, width: 1200, display: 'flex', alignItems: 'center', gap: 28 }}>
        <div className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>HEARING</div>
        <div className="f-press" style={{ width: 90, fontSize: 28, color: heard != null ? 'var(--sun)' : '#3A3F70' }}>{heard != null ? name(heard) : '—'}</div>
        <div className="f-label" style={{ fontSize: 12, color: 'var(--soft)' }}>
          RAW {reading?.midi != null ? `${name(Math.round(reading.midi))} ${cents! >= 0 ? '+' : ''}${cents}¢` : `— (${reading?.rejectedBy ?? 'off'})`}
          {' · '}CLARITY {reading ? reading.clarity.toFixed(2) : '—'}
          {' · '}LEVEL {reading ? Math.round(reading.rmsDb) : '—'} dB
        </div>
        <div style={{ flex: 1 }} />
        <div className="f-press" style={{ fontSize: 20, color: 'var(--parchment)' }}>{done.length ? `${hits}/${ex.notes.length} HIT` : ''}
          {avgOff !== null && (
            <span className="f-label" style={{ marginLeft: 16, fontSize: 12, color: Math.abs(avgOff) <= PERFECT_MS ? 'var(--meadow)' : 'var(--sun)' }}>
              {Math.abs(avgOff) <= PERFECT_MS ? 'IN TIME' : avgOff > 0 ? 'LATE' : 'EARLY'} {avgOff >= 0 ? '+' : ''}{avgOff}ms AVG · {inWindow}/{done.length} WITHIN ±{TIMING_WINDOW_MS}ms
            </span>
          )}</div>
      </div>

      {/* per-note breakdown: why each note passed or failed */}
      <div style={{ position: 'absolute', left: 120, top: 610, width: 1200, height: 170, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' }}>
        {done.length === 0 && (
          <div className="f-body" style={{ fontSize: 16, color: 'var(--muted)' }}>
            Press play, wait for the 4 clicks, then play the notes as the cursor reaches them (re-tongue repeated notes so each attack can be timed). Pitch tolerance ±{PITCH_TOLERANCE_CENTS}¢{IGNORE_OCTAVE ? ' (any octave)' : ''}, timing ±{TIMING_WINDOW_MS}ms.
          </div>
        )}
        {heardMix.length > 0 && (
          <div className="f-body" style={{ width: '100%', padding: '4px 8px', fontSize: 13, color: 'var(--soft)' }}>
            <b style={{ color: 'var(--sun)' }}>MIC HEARD:</b>{' '}
            {heardMix.map((h) => `${name(h.midi)}${inst.writtenOffset !== 0 ? ` (concert ${concertName(h.midi)})` : ''} ${h.pct}%`).join(' · ')}
            {pick === 'one' && `  ·  TARGET ${name(ex.notes[0].midi + inst.shift)}${inst.writtenOffset !== 0 ? ` (concert ${concertName(ex.notes[0].midi + inst.shift)})` : ''}`}
          </div>
        )}
        {results.map((r, i) => {
          if (!r) return null;
          const expected = ex.notes[i].midi + inst.shift;
          const c = r.status === 'hit' ? 'var(--meadow)' : r.status === 'wrong' ? 'var(--hp)' : 'var(--muted)';
          return (
            <div key={i} className="f-body" style={{ padding: '4px 8px', fontSize: 13, background: '#1E2140', borderLeft: `4px solid ${c}`, color: 'var(--soft)' }}>
              <b style={{ color: c }}>{i + 1}. {name(expected)}</b> {why(r, expected)}
            </div>
          );
        })}
      </div>
    </MenuShell>
  );
}
