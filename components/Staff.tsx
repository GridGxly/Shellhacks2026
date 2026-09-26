'use client';
import { FLAT_STEPS, SHARP_STEPS, staffStep, writtenKey, type Exercise } from '@/lib/music';
import type { NoteResult } from '@/lib/mic';

const GAP = 12; // px between staff lines

interface Props {
  ex: Exercise;
  shift: number;
  writtenOffset: number;
  width: number;
  beat: number | null; // cursor position in beats (null = hidden)
  results: (NoteResult | undefined)[];
  barsPerLine?: number;
  revealUpTo?: number; // notes after this index fade in (M1 step 4)
}

export default function Staff({ ex, shift, writtenOffset, width, beat, results, barsPerLine = ex.bars, revealUpTo = Infinity }: Props) {
  const key = writtenKey(writtenOffset);
  const lines = Math.ceil(ex.bars / barsPerLine);
  const lineH = GAP * 4 + 96;
  const left = 150;
  const right = 20;
  const beatsPerLine = barsPerLine * ex.beatsPerBar;
  const beatW = (width - left - right) / beatsPerLine;
  const yOf = (step: number) => 48 + GAP * 4 - step * (GAP / 2);

  return (
    <svg width={width} height={lines * lineH} viewBox={`0 0 ${width} ${lines * lineH}`} style={{ display: 'block' }}>
      {Array.from({ length: lines }, (_, line) => {
        const oy = line * lineH;
        const b0 = line * beatsPerLine;
        const notes = ex.notes.map((n, i) => ({ n, i })).filter(({ n }) => n.startBeat >= b0 && n.startBeat < b0 + beatsPerLine);
        const cursorBeat = beat !== null && beat >= b0 && beat < b0 + beatsPerLine ? beat : null;
        return (
          <g key={line} transform={`translate(0 ${oy})`}>
            {/* played-region wash */}
            {cursorBeat !== null && <rect x={left} y={36} width={Math.max(0, (cursorBeat - b0) * beatW)} height={GAP * 4 + 24} fill="#4CC26B" opacity={0.1} />}
            {[0, 1, 2, 3, 4].map((l) => <rect key={l} x={16} y={48 + l * GAP} width={width - 32} height={2} fill="#1B1F3B" />)}
            <text x={20} y={48 + GAP * 4 + 12} fontFamily="var(--music)" fontSize={78} fill="#1B1F3B">𝄞</text>
            {(key.accidentals > 0 ? SHARP_STEPS : FLAT_STEPS).slice(0, Math.abs(key.accidentals)).map((st, k) => (
              <text key={k} x={66 + k * 11} y={yOf(st) + 6} fontFamily="var(--music)" fontSize={26} fill="#1B1F3B">{key.accidentals > 0 ? '♯' : '♭'}</text>
            ))}
            {line === 0 && (
              <g fontFamily="var(--press)" fontSize={20} fill="#1B1F3B">
                <text x={96 + Math.abs(key.accidentals) * 6} y={48 + GAP * 2 - 2}>4</text>
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
            {notes.map(({ n, i }) => {
              const written = n.midi + shift + writtenOffset;
              const step = staffStep(written, key);
              const x = left + (n.startBeat - b0) * beatW + beatW * 0.45;
              const y = yOf(step);
              const r = results[i];
              const passed = cursorBeat !== null ? n.startBeat + n.durBeats <= (beat ?? 0) : !!r;
              const isCurrent = beat !== null && beat >= n.startBeat && beat < n.startBeat + n.durBeats;
              const color = r ? (r.status === 'hit' ? '#3FA75C' : r.status === 'wrong' ? '#E8434F' : '#9A9CB4') : isCurrent ? '#1B1F3B' : passed ? '#1B1F3B' : beat === null ? '#1B1F3B' : '#6B6F8E';
              const hollow = n.durBeats >= 2;
              const stemUp = step < 4;
              const ghost = r?.status === 'wrong' && r.playedMidi !== null ? yOf(staffStep(r.playedMidi + writtenOffset, key)) : null;
              const hidden = i > revealUpTo;
              const ledgers: number[] = [];
              for (let s = -2; s >= step; s -= 2) ledgers.push(s);
              for (let s = 10; s <= step; s += 2) ledgers.push(s);
              return (
                <g key={i} opacity={hidden ? 0 : 1} style={{ transition: 'opacity 120ms steps(2)' }}>
                  {isCurrent && !r && <circle cx={x} cy={y} r={16} fill="#FFD23F" opacity={0.45} />}
                  {r?.status === 'hit' && <circle cx={x} cy={y} r={12} fill="none" stroke="#4CC26B" strokeWidth={3} style={{ animation: 'burst 300ms steps(4) forwards', transformOrigin: `${x}px ${y}px` }} />}
                  {ledgers.map((s) => <rect key={s} x={x - 16} y={yOf(s) - 1} width={32} height={2} fill="#1B1F3B" />)}
                  {ghost !== null && <ellipse cx={x + 4} cy={ghost} rx={10} ry={7.5} transform={`rotate(-20 ${x + 4} ${ghost})`} fill="none" stroke="#E8434F" strokeWidth={2} strokeDasharray="3 3" />}
                  <g style={{ animation: r?.status === 'wrong' ? 'shakeSmall 180ms steps(2) 3' : r?.status === 'hit' ? 'popIn 220ms steps(3)' : undefined, transformOrigin: `${x}px ${y}px` }}>
                    <ellipse cx={x} cy={y} rx={10} ry={7.5} transform={`rotate(-20 ${x} ${y})`} fill={hollow ? 'none' : color} stroke={color} strokeWidth={hollow ? 3 : 0} />
                    {n.durBeats < 4 && <rect x={stemUp ? x + 8 : x - 10} y={stemUp ? y - 46 : y} width={2.5} height={46} fill={color} />}
                    {n.durBeats <= 0.5 && <path d={stemUp ? `M${x + 10} ${y - 46} q 14 10 8 26` : `M${x - 8} ${y + 46} q 14 -10 8 -26`} stroke={color} strokeWidth={3} fill="none" />}
                    {n.durBeats === 1.5 || n.durBeats === 3 ? <circle cx={x + 16} cy={y - 3} r={2.5} fill={color} /> : null}
                  </g>
                </g>
              );
            })}
            {cursorBeat !== null && (
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
