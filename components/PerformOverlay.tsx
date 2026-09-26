'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { settings } from '@/lib/audio';
import { useViewport } from '@/lib/viewport';
import type { Exercise } from '@/lib/music';
import type { NoteResult } from '@/lib/mic';
import type { Enemy, Instrument } from '@/lib/content';
import { CARD_STYLE } from './CardView';
import Staff from './Staff';
import { CONCERT_KEY_NAME, noteName, writtenKey } from '@/lib/music';
import { art } from '@/lib/art';

export type PerformStage = 'unfold' | 'countin' | 'recording' | 'review';

interface Props {
  ex: Exercise;
  inst: Instrument;
  enemy: Enemy;
  damage: number;
  stage: PerformStage;
  count: number; // count-in beat shown (1..4)
  beat: number | null;
  results: (NoteResult | undefined)[];
  hearing: number | null; // concert midi
  passLine: number; // 0..1
  demo: boolean;
}

export default function PerformOverlay({ ex, inst, enemy, damage, stage, count, beat, results, hearing, passLine, demo }: Props) {
  const encore = ex.type === 'encore';
  const color = encore ? { body: '#D1307E' } : CARD_STYLE[ex.type as 'chord'];
  const done = results.filter(Boolean) as NoteResult[];
  const hits = done.filter((r) => r.status === 'hit').length;
  const acc = done.length ? hits / done.length : 0;
  const finalAcc = hits / ex.notes.length;
  const key = writtenKey(inst.writtenOffset);
  const pass = finalAcc >= passLine;
  const width = encore ? 1260 : 1164;
  const bars = Array.from({ length: ex.bars }, (_, b) => ex.notes.map((n, i) => ({ n, i })).filter(({ n }) => Math.floor(n.startBeat / ex.beatsPerBar) === b));
  const curBar = beat !== null ? Math.floor(beat / ex.beatsPerBar) : -1;
  const fit = useFit(encore ? 96 : 150);

  return (
    <>
      <div className="fill bleed" style={{ zIndex: 30, background: 'rgba(12,13,30,0.72)', animation: 'fadeIn 200ms var(--ease-out) both' }} />
      <div
        ref={fit.ref}
        className="performance-panel"
        style={{
          position: 'absolute', left: (1440 - width - 56) / 2, top: fit.top, width: width + 56, zIndex: 31, scale: fit.k === 1 ? undefined : fit.k, transformOrigin: '50% 0',
          display: 'flex', flexDirection: 'column', background: '#14162E', border: '4px solid #2A2F55', boxShadow: '#101126 0 0 0 4px, rgba(0,0,0,0.5) 10px 10px 0',
          animation: stage === 'unfold' ? 'unfold 200ms var(--ease-out) both' : undefined,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 28px', borderBottom: '3px solid #2A2F55' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="f-press performance-tag" style={{ padding: '6px 10px', background: color.body, border: '2px solid #FF4FA3', fontSize: 13, color: '#FFF6E0' }}>{encore ? 'ENCORE' : ex.type.toUpperCase()}</div>
            <div className="f-press performance-title" style={{ fontSize: 17, color: '#fff' }}>{ex.title}</div>
            <div className="f-body performance-key-detail" style={{ fontSize: 16, color: 'var(--muted)' }}>concert {CONCERT_KEY_NAME} · written in {key.name} for {inst.name.toLowerCase()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>TARGET</span>
            <div style={{ position: 'relative', width: 36, height: 36, overflow: 'hidden', background: '#2A2240', border: '2px solid #43365F' }}>
              <div className="sprite" style={{ left: -8, top: -2, width: 52, height: 52, backgroundImage: `url(${art(enemy.sprite, 'thumb')})`, filter: enemy.spriteFilter }} />
            </div>
            <div className="f-press performance-tag" style={{ padding: '8px 12px', background: 'var(--sun)', color: '#101126', fontSize: 13 }}>{damage} DMG</div>
          </div>
        </div>
        {/* Progress track */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 28px' }}>
          <div style={{ flex: 1, display: 'flex', gap: 10 }}>
            {bars.map((bn, b) => (
              <div key={b} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: `3px solid ${b === curBar ? 'var(--sun)' : bn.every(({ i }) => results[i]?.status === 'hit') && bn.every(({ i }) => results[i]) ? '#3FA75C' : '#2A2F55'}`, background: '#101126' }}>
                {!encore && <span className="f-label" style={{ fontSize: 10, color: 'var(--muted)', marginRight: 4 }}>BAR {b + 1}</span>}
                {bn.map(({ i }) => {
                  const r = results[i];
                  const cur = beat !== null && !r && beat >= ex.notes[i].startBeat && beat < ex.notes[i].startBeat + ex.notes[i].durBeats;
                  return <div key={i} style={{ flex: 1, maxWidth: 24, height: 12, background: r ? (r.status === 'hit' ? 'var(--meadow)' : r.status === 'wrong' ? 'var(--hp)' : '#6B6F8E') : cur ? 'var(--sun)' : '#2A2F55' }} />;
                })}
              </div>
            ))}
          </div>
          <div className="performance-note-total" style={{ display: 'flex', alignItems: 'baseline', gap: 8, width: 170, justifyContent: 'flex-end' }}>
            <span className="f-press" style={{ fontSize: 22, color: '#fff' }}>{hits}</span>
            <span className="f-press performance-tag" style={{ fontSize: 13, color: 'var(--muted)' }}>/ {ex.notes.length} NOTES</span>
          </div>
        </div>
        {/* Sheet */}
        <div style={{ position: 'relative', margin: '0 28px', background: 'var(--parchment)', borderBottom: '6px solid var(--parchment-shade)' }}>
          <div className="f-press performance-tempo" style={{ position: 'absolute', left: 14, top: 10, padding: '4px 8px', background: '#101126', color: '#fff', fontSize: 11, zIndex: 2 }}>
            <span className="f-music" style={{ fontSize: 14 }}>♩</span> = {ex.tempo}
          </div>
          <Staff
            ex={ex}
            shift={inst.shift}
            writtenOffset={inst.writtenOffset}
            width={width}
            beat={stage === 'recording' || (stage === 'countin' && settings.approach === 'on') ? beat : null}
            approach={settings.approach === 'on'}
            results={results}
            barsPerLine={encore ? 4 : Math.min(ex.bars, 4)}
            revealUpTo={stage === 'unfold' ? -1 : Infinity}
          />
          {stage === 'countin' && (
            <div key={count} className="f-press" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 96, color: 'var(--magenta)', textShadow: '#101126 6px 6px 0', animation: 'countSlam 500ms var(--ease-out) both' }}>
              {count}
            </div>
          )}
        </div>
        {/* Recording row / review */}
        <div className="performance-footer" style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '20px 28px 24px', minHeight: 116 }}>
          {stage === 'review' ? (
            <>
              <div className="f-press" style={{ padding: '14px 22px', fontSize: 34, color: pass ? '#101126' : '#fff', background: pass ? 'var(--meadow)' : 'var(--hp)', border: '4px solid #101126', boxShadow: `${pass ? '#FFD23F' : '#101126'} 6px 6px 0`, animation: 'stamp 360ms var(--ease-out) both' }}>
                {pass ? 'HIT!' : 'MISSED'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="f-press" style={{ fontSize: 34, color: pass ? 'var(--meadow)' : 'var(--hp)' }}>{Math.round(finalAcc * 100)}%</div>
                <div className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>{hits} OF {ex.notes.length} NOTES</div>
              </div>
              <AccuracyBar value={finalAcc} passLine={passLine} />
              <div className="f-body" style={{ width: 220, fontSize: 16, color: 'var(--soft)' }}>
                {pass ? `${damage} damage incoming.` : encore ? 'The Encore fizzles. Land your cards to recharge it.' : 'The card slides back with new music.'}
              </div>
            </>
          ) : (
            <>
              <div className="performance-recording" style={{ display: 'flex', alignItems: 'center', gap: 14, width: 280 }}>
                <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', background: '#3A1B2E', border: '3px solid #E8434F' }}>
                  <div style={{ width: 16, height: 16, background: stage === 'recording' ? '#fff' : '#6B6F8E', animation: stage === 'recording' ? 'blink 1s steps(1) infinite' : undefined }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="f-label" style={{ fontSize: 12, color: '#FF7DB8' }}>{stage === 'recording' ? (demo ? 'DEMO · SIMULATED' : 'RECORDING') : 'GET READY'}</span>
                  <span className="f-body" style={{ fontSize: 17, color: 'var(--parchment)' }}>
                    {stage === 'recording' ? `Bar ${Math.min(ex.bars, curBar + 1)} of ${ex.bars} · keep going` : 'Count-in. Play on the next 1.'}
                  </span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="f-label" style={{ fontSize: 12, color: 'var(--soft)' }}>LIVE ACCURACY</span>
                  <span className="f-press performance-value" style={{ fontSize: 20, color: acc >= passLine ? 'var(--meadow)' : done.length ? 'var(--hp)' : 'var(--muted)' }}>{done.length ? `${Math.round(acc * 100)}%` : '—'}</span>
                </div>
                <AccuracyBar value={acc} passLine={passLine} />
              </div>
              <div className="performance-hearing" style={{ width: 190, display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', background: '#101126', border: '3px solid #3A3F70' }}>
                <span className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>HEARING</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="f-press performance-value" style={{ fontSize: 18, color: hearing !== null ? 'var(--sun)' : '#3A3F70' }}>
                    {hearing !== null ? noteName(Math.round(hearing) + inst.writtenOffset, key) : '—'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 20 }}>
                    {[6, 12, 18, 10, 5].map((h, i) => <div key={i} style={{ width: 5, height: h, background: hearing !== null ? 'var(--meadow)' : '#2A2F55', animation: hearing !== null ? `wave ${300 + i * 80}ms steps(3) infinite` : undefined, transformOrigin: 'bottom' }} />)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function AccuracyBar({ value, passLine }: { value: number; passLine: number }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 240, height: 22, background: '#101126', border: '3px solid #3A3F70' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 16, width: `${Math.round(value * 100)}%`, background: value >= passLine ? 'var(--meadow)' : 'var(--hp)', transition: 'width 200ms var(--ease-out)' }} />
      <div style={{ position: 'absolute', left: `${passLine * 100}%`, top: -8, width: 4, height: 32, background: 'var(--parchment)' }} />
      <div className="f-label" style={{ position: 'absolute', left: `${passLine * 100}%`, top: 26, transform: 'translateX(-50%)', fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>PASS {Math.round(passLine * 100)}%</div>
    </div>
  );
}

/**
 * Handhelds: the sheet is what the player reads, so it grows to the largest
 * size that fits under the HUD and inside the notch and home-indicator insets,
 * using the whole width of the glass. Desktop keeps the designed placement.
 */
function useFit(designedTop: number) {
  const { handheld, ui, scale, bleedX, safe } = useViewport();
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!handheld || !el) return;
    // The observer reports the first size right away, then every change.
    const watch = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight }));
    watch.observe(el);
    return () => watch.disconnect();
  }, [handheld]);
  if (!handheld || !box) return { ref, k: 1, top: designedTop };
  const hudBottom = 63 * ui;
  const availW = 1440 + 2 * bleedX - (safe.l + safe.r) / scale - 64;
  const availH = 900 - hudBottom - safe.b / scale - 40;
  const k = Math.max(1, Math.min(availW / box.w, availH / box.h));
  return { ref, k, top: hudBottom + 20 + Math.max(0, (availH - box.h * k) / 2) };
}
