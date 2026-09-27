'use client';
import { useMemo } from 'react';
import { accidentalFor, FLAT_STEPS, SHARP_STEPS, staffStep, writtenKey, type Exercise, type KeySig } from '@/lib/music';
import { PERFECT_MS } from '@/lib/config';
import type { NoteResult } from '@/lib/mic';

const GAP = 12; // px between staff lines

// Follow-along circles (osu!-style): a ring shrinks onto each note head and
// closes exactly on its beat. A fixed time, not a beat count, so the reaction
// time is the same at any tempo.
const APPROACH_MS = 900;
const FLASH_MS = 160; // pulse when the ring closes
const R_HIT = 14; // ring size at the moment of the beat (hugs the note head)
const R_FAR = 46; // ring size when it first appears
const PINK = '#FF4FA3';

// Timing judgment under each hit note, in its own row below the staff.
const JUDGE_Y = 48 + GAP * 4 + 30;
function judge(offsetMs: number | null): { word: string; short: string; color: string } {
  if (offsetMs === null) return { word: 'UNTIMED', short: '?', color: '#9A9CB4' }; // pitch right, no attack found
  if (Math.abs(offsetMs) <= PERFECT_MS) return { word: 'PERFECT', short: 'P', color: '#3FA75C' };
  return offsetMs < 0 ? { word: 'EARLY', short: 'E', color: '#D98A1C' } : { word: 'LATE', short: 'L', color: '#D98A1C' };
}

interface Props {
  ex: Exercise;
  shift: number;
  writtenOffset: number;
  width: number;
  beat: number | null; // cursor position in beats (null = hidden)
  results: (NoteResult | undefined)[];
  barsPerLine?: number;
  revealUpTo?: number; // notes after this index fade in (M1 step 4)
  keySig?: KeySig; // override the instrument's written key (Pitch Lab's C major scale)
  // Closing circles instead of the sweeping bar. `beat` may be negative during
  // the count-in so the first note's circle is already closing.
  approach?: boolean;
}

export default function Staff({ ex, shift, writtenOffset, width, beat, results, barsPerLine = ex.bars, revealUpTo = Infinity, keySig, approach = false }: Props) {
  // Callers often build keySig inline; key the memo on its contents, not its identity.
  const keyName = keySig?.name, keyAccidentals = keySig?.accidentals;
  const key = useMemo(() => (keyName !== undefined && keyAccidentals !== undefined ? { name: keyName, accidentals: keyAccidentals } : writtenKey(writtenOffset)), [keyName, keyAccidentals, writtenOffset]);
  const lines = Math.ceil(ex.bars / barsPerLine);
  const lineH = GAP * 4 + 96;
  const left = 150;
  const right = 20;
  const beatsPerLine = barsPerLine * ex.beatsPerBar;
  const beatW = (width - left - right) / beatsPerLine;
  /**
   * Centre a notehead inside the time it occupies rather than a fixed 0.45 of
   * a whole beat — otherwise a short note (an 8th on the and-of-3) is pushed
   * nearly a full beat right and collides with the next barline.
   */
  const noteOffset = (durBeats: number) => Math.min(durBeats, 1) * beatW * 0.45;
  // An accidental is drawn to the left of its note head. Nudge the head right
  // by that much so the sign sits inside its own bar instead of overlapping
  // the barline (or the clef, on the first note of a line).
  const ACC_SIZE = 40;
  const ACC_GAP = ACC_SIZE * 0.72; // how far left of the head the glyph starts
  const yOf = (step: number) => 48 + GAP * 4 - step * (GAP / 2);
  const mspb = 60000 / ex.tempo;

  // Everything below depends only on the music and the layout, never on the
  // cursor: computed once per exercise instead of on every animation frame.
  const layout = useMemo(() => {
  // Beam runs of consecutive eighths that sit in the same bar, so they read as
    // one rhythmic group instead of separate flagged notes. A beamed group takes
    // a single stem direction and a shared stem end, as engraved music does.
    const stepOf = (n: Exercise['notes'][number]) => staffStep(n.midi + shift + writtenOffset, key);
    // Mirrors the note-head x below, accidental shift included, so beams land on
    // their stems.
    const accAt = (n: Exercise['notes'][number], idx: number) => {
      const raw = accidentalFor(n.midi + shift + writtenOffset, key);
      if (!raw) return 0;
      const bar = Math.floor(n.startBeat / ex.beatsPerBar);
      const step = stepOf(n);
      const marked = ex.notes.some(
        (o, oi) =>
          oi < idx &&
          Math.floor(o.startBeat / ex.beatsPerBar) === bar &&
          stepOf(o) === step &&
          accidentalFor(o.midi + shift + writtenOffset, key) === raw,
      );
      return marked ? 0 : ACC_GAP;
    };
    const xOf = (n: Exercise['notes'][number], b0: number, idx: number) =>
      left + (n.startBeat - b0) * beatW + noteOffset(n.durBeats) + accAt(n, idx);
    const beamOf = new Map<number, { stemUp: boolean; y: number }>();
    const beamGroups = new Map<number, { x0: number; x1: number; y0: number; y1: number; stemUp: boolean }[]>();
    {
      let run: number[] = [];
      const flush = () => {
        if (run.length > 1) {
          const line = Math.floor(ex.notes[run[0]].startBeat / beatsPerLine);
          const b0 = line * beatsPerLine;
          const steps = run.map((i) => stepOf(ex.notes[i]));
          // One direction for the whole group: follow whichever end is farther
          // from the middle line, the usual engraving rule.
          const avg = steps.reduce((a, b) => a + b, 0) / steps.length;
          const stemUp = avg < 4;
          // Shared stem end, pushed out to clear the most extreme notehead.
          const ys = steps.map((s) => yOf(s));
          const xs = run.map((i) => xOf(ex.notes[i], b0, i));
          // Slope the beam with the notes, as engraved music does, but keep the
          // tilt gentle so stems stay readable.
          const first = ys[0];
          const lastY = ys[ys.length - 1];
          const span = xs[xs.length - 1] - xs[0];
          const rise = Math.max(-14, Math.min(14, lastY - first));
          const base = stemUp ? Math.min(...ys) - 46 : Math.max(...ys) + 46;
          // Anchor the sloped line so no notehead's stem falls short.
          const yAt = (x: number) => base + ((x - xs[0]) / (span || 1)) * rise;
          let shiftY = 0;
          run.forEach((_, k) => {
            const need = ys[k] + (stemUp ? -18 : 18);
            const have = yAt(xs[k]);
            shiftY = stemUp ? Math.min(shiftY, need - have) : Math.max(shiftY, need - have);
          });
          run.forEach((i, k) => beamOf.set(i, { stemUp, y: yAt(xs[k]) + shiftY }));
          const list = beamGroups.get(line) ?? [];
          list.push({
            x0: xs[0] + (stemUp ? 8 : -10),
            x1: xs[xs.length - 1] + (stemUp ? 10.5 : -7.5),
            y0: yAt(xs[0]) + shiftY,
            y1: yAt(xs[xs.length - 1]) + shiftY,
            stemUp,
          });
          beamGroups.set(line, list);
        }
        run = [];
      };
      ex.notes.forEach((n, i) => {
        const prev = ex.notes[i - 1];
        const sameBar = prev && Math.floor(prev.startBeat / ex.beatsPerBar) === Math.floor(n.startBeat / ex.beatsPerBar);
        const sameLine = prev && Math.floor(prev.startBeat / beatsPerLine) === Math.floor(n.startBeat / beatsPerLine);
        if (n.durBeats > 0.5) { flush(); return; }
        // Beam within a beat, not across one: in 3/4 six eighths read as three
        // pairs, which is how the pulse is engraved.
        const sameBeat = prev && Math.floor(prev.startBeat) === Math.floor(n.startBeat);
        if (run.length && (!sameBar || !sameLine || !sameBeat)) flush();
        run.push(i);
      });
      flush();
    }
    // Per-note engraving: an accidental holds for the rest of its bar, so only
    // the first note that needs one in each bar carries the sign.
    const heads = ex.notes.map((n, i) => {
      const written = n.midi + shift + writtenOffset;
      const step = staffStep(written, key);
      const accidental = accAt(n, i) ? accidentalFor(written, key) : '';
      const b0 = Math.floor(n.startBeat / beatsPerLine) * beatsPerLine;
      const ledgers: number[] = [];
      for (let st = -2; st >= step; st -= 2) ledgers.push(st);
      for (let st = 10; st <= step; st += 2) ledgers.push(st);
      return { step, accidental, x: xOf(n, b0, i), y: yOf(step), ledgers };
    });
    return { beamOf, beamGroups, heads };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- beatW/yOf/xOf derive from these
  }, [ex, shift, writtenOffset, key, width, barsPerLine]);
  const { beamOf, beamGroups, heads } = layout;

  return (
    <svg width={width} height={lines * lineH} viewBox={`0 0 ${width} ${lines * lineH}`} style={{ display: 'block', overflow: 'visible' }}>
      {Array.from({ length: lines }, (_, line) => {
        const oy = line * lineH;
        const b0 = line * beatsPerLine;
        const notes = ex.notes.map((n, i) => ({ n, i })).filter(({ n }) => n.startBeat >= b0 && n.startBeat < b0 + beatsPerLine);
        const cursorBeat = beat !== null && beat >= b0 && beat < b0 + beatsPerLine ? beat : null;
        return (
          <g key={line} transform={`translate(0 ${oy})`}>
            {/* played-region wash */}
            {cursorBeat !== null && !approach && <rect x={left} y={36} width={Math.max(0, (cursorBeat - b0) * beatW)} height={GAP * 4 + 24} fill="#4CC26B" opacity={0.1} />}
            {[0, 1, 2, 3, 4].map((l) => <rect key={l} x={16} y={48 + l * GAP} width={width - 32} height={2} fill="#1B1F3B" />)}
            <text x={20} y={48 + GAP * 4 + 12} fontFamily="var(--music)" fontSize={78} fill="#1B1F3B">𝄞</text>
            {(key.accidentals > 0 ? SHARP_STEPS : FLAT_STEPS).slice(0, Math.abs(key.accidentals)).map((st, k) => (
              <text key={k} x={66 + k * 11} y={yOf(st) + 6} fontFamily="var(--music)" fontSize={26} fill="#1B1F3B">{key.accidentals > 0 ? '♯' : '♭'}</text>
            ))}
            {line === 0 && (
              <g fontFamily="var(--press)" fontSize={20} fill="#1B1F3B">
                <text x={96 + Math.abs(key.accidentals) * 6} y={48 + GAP * 2 - 2}>{ex.beatsPerBar}</text>
                <text x={96 + Math.abs(key.accidentals) * 6} y={48 + GAP * 4}>4</text>
              </g>
            )}
            {Array.from({ length: barsPerLine + 1 }, (_, b) => (
              <rect key={b} x={left + b * ex.beatsPerBar * beatW - (b === barsPerLine ? 6 : 1)} y={48} width={b === barsPerLine && line === lines - 1 ? 6 : 2} height={GAP * 4 + 2} fill="#1B1F3B" />
            ))}
            {ex.chordLabels?.map((c) =>
              Math.floor(c.bar / barsPerLine) === line ? (
                <text key={c.bar} x={left + (c.bar % barsPerLine) * ex.beatsPerBar * beatW + 20} y={30} fontFamily="var(--press)" fontSize={11} fill="#D1307E">{c.label}</text>
              ) : null,
            )}
            {beamGroups.get(line)?.map((g, gi) => {
              const t = g.stemUp ? 0 : -5;
              return (
                <polygon
                  key={`beam${gi}`}
                  points={`${g.x0},${g.y0 + t} ${g.x1},${g.y1 + t} ${g.x1},${g.y1 + t + 5} ${g.x0},${g.y0 + t + 5}`}
                  fill="#1B1F3B"
                />
              );
            })}
            {notes.map(({ n, i }) => {
              const { step, accidental, x, y, ledgers } = heads[i];
              const beam = beamOf.get(i);
              const r = results[i];
              const passed = cursorBeat !== null ? n.startBeat + n.durBeats <= (beat ?? 0) : !!r;
              const isCurrent = beat !== null && beat >= n.startBeat && beat < n.startBeat + n.durBeats;
              const color = r ? (r.status === 'hit' ? '#3FA75C' : r.status === 'wrong' ? '#E8434F' : '#9A9CB4') : isCurrent ? '#1B1F3B' : passed ? '#1B1F3B' : beat === null ? '#1B1F3B' : '#6B6F8E';
              const hollow = n.durBeats >= 2;
              const stemUp = beam ? beam.stemUp : step < 4;
              const ghost = r?.status === 'wrong' && r.playedMidi !== null ? yOf(staffStep(r.playedMidi + writtenOffset, key)) : null;
              const hidden = i > revealUpTo;
              // ms until this note's beat (negative once it has started)
              const untilMs = approach && beat !== null && !hidden ? (n.startBeat - beat) * mspb : null;
              const closing = untilMs !== null && untilMs > 0 && untilMs <= APPROACH_MS ? untilMs / APPROACH_MS : null; // 1 -> 0
              const flash = untilMs !== null && untilMs <= 0 && -untilMs < FLASH_MS && !r ? -untilMs / FLASH_MS : null; // 0 -> 1
              return (
                <g key={i} opacity={hidden ? 0 : 1} style={{ transition: 'opacity 120ms steps(2)' }}>
                  {isCurrent && !r && <circle cx={x} cy={y} r={16} fill="#FFD23F" opacity={0.45} />}
                  {r?.status === 'hit' && <circle cx={x} cy={y} r={12} fill="none" stroke="#4CC26B" strokeWidth={3} style={{ animation: 'burst 300ms steps(4) forwards', transformOrigin: `${x}px ${y}px` }} />}
                  {ledgers.map((s) => <rect key={s} x={x - 16} y={yOf(s) - 1} width={32} height={2} fill="#1B1F3B" />)}
                  {accidental && (
                    <text x={x - ACC_GAP} y={y + 11} fontFamily="var(--music)" fontSize={ACC_SIZE} textAnchor="middle" fill={color}>{accidental}</text>
                  )}
                  {ghost !== null && <ellipse cx={x + 4} cy={ghost} rx={10} ry={7.5} transform={`rotate(-20 ${x + 4} ${ghost})`} fill="none" stroke="#E8434F" strokeWidth={2} strokeDasharray="3 3" />}
                  <g style={{ animation: r?.status === 'wrong' ? 'shakeSmall 180ms steps(2) 3' : r?.status === 'hit' ? 'popIn 220ms steps(3)' : undefined, transformOrigin: `${x}px ${y}px` }}>
                    <ellipse cx={x} cy={y} rx={10} ry={7.5} transform={`rotate(-20 ${x} ${y})`} fill={hollow ? 'none' : color} stroke={color} strokeWidth={hollow ? 3 : 0} />
                    {n.durBeats < 4 && (
                      <rect
                        x={stemUp ? x + 8 : x - 10}
                        y={beam ? Math.min(beam.y, y) : stemUp ? y - 46 : y}
                        width={2.5}
                        // A beamed stem runs to the group's shared beam line;
                        // an unbeamed one is a fixed length.
                        height={beam ? Math.abs(beam.y - y) : 46}
                        fill={color}
                      />
                    )}
                    {n.durBeats <= 0.5 && !beam && <path d={stemUp ? `M${x + 10} ${y - 46} q 14 10 8 26` : `M${x - 8} ${y + 46} q 14 -10 8 -26`} stroke={color} strokeWidth={3} fill="none" />}
                    {n.durBeats === 1.5 || n.durBeats === 3 ? <circle cx={x + 16} cy={y - 3} r={2.5} fill={color} /> : null}
                  </g>
                  {closing !== null && (
                    <>
                      <circle cx={x} cy={y} r={R_HIT} fill="none" stroke="#1B1F3B" strokeWidth={2} opacity={0.25 + 0.5 * (1 - closing)} />
                      <circle cx={x} cy={y} r={R_HIT + (R_FAR - R_HIT) * closing} fill="none" stroke={PINK} strokeWidth={3} opacity={Math.min(1, (1 - closing) * 3)} />
                    </>
                  )}
                  {r?.status === 'hit' && (() => {
                    const j = judge(r.onsetOffsetMs);
                    const origin = `${x}px ${JUDGE_Y}px`;
                    // Word pops up for ~0.9 s, then settles to its initial so
                    // neighbouring notes' labels never pile up.
                    return (
                      <g fontFamily="var(--press)" textAnchor="middle" fill={j.color}>
                        <title>{r.onsetOffsetMs === null ? 'No attack detected: pitch was right, timing unknown' : `${r.onsetOffsetMs >= 0 ? '+' : ''}${Math.round(r.onsetOffsetMs)} ms`}</title>
                        <text x={x} y={JUDGE_Y} fontSize={10} opacity={0} style={{ animation: 'judgeInitial 1100ms steps(4) forwards' }}>{j.short}</text>
                        <text x={x} y={JUDGE_Y} fontSize={11} opacity={0} stroke="var(--parchment)" strokeWidth={3} paintOrder="stroke" style={{ animation: 'judgeWord 1100ms steps(8) forwards', transformOrigin: origin }}>{j.word}</text>
                      </g>
                    );
                  })()}
                  {flash !== null && <circle cx={x} cy={y} r={R_HIT + 10 * flash} fill={PINK} opacity={0.55 * (1 - flash)} />}
                </g>
              );
            })}
            {cursorBeat !== null && !approach && (
              <g transform={`translate(${left + (cursorBeat - b0) * beatW} 0)`}>
                <rect x={-2} y={26} width={4} height={GAP * 4 + 50} fill="#FF4FA3" />
                <rect x={-8} y={22} width={16} height={6} fill="#FF4FA3" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
