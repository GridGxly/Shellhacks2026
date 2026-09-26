'use client';
// Gemini Lab (dev/test screen): student stats -> Gemini analysis -> settings
// prefilled from the AI's suggestions (each shows WHY) -> edit/slide -> compose
// -> the piece drawn on the real Staff. Functional, not pretty.

import { useMemo, useState } from 'react';
import { sfx } from '@/lib/audio';
import {
  cleanSettings, KEYS, PRESETS, SETTING_NAMES, TAG_LABEL, TAGS,
  type Analysis, type KeyName, type SettingName, type Settings, type Song, type Tag,
} from '@/lib/compose/lab';
import { buildCards, type Card } from '@/lib/compose/exercises';
import { analyzeTake, type Feedback } from '@/lib/mentor/analyze';
import { instrumentOf, useGame } from '@/lib/store';
import { usePerformance } from '@/hooks/usePerformance';
import Staff from '../Staff';
import { MenuShell } from './Menus';

type Meta = { cached?: boolean; mock?: boolean; usage?: { in: number; out: number } | null; model?: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

const metaText = (m: Meta | null) =>
  !m ? '' : m.mock ? 'MOCK · free' : m.cached ? 'CACHED · free' : `LIVE ${m.model ?? ''} · ${m.usage?.in ?? '?'} in / ${m.usage?.out ?? '?'} out tokens`;

const panel: React.CSSProperties = { position: 'absolute', background: 'rgba(16,17,38,0.88)', border: '3px solid #3A3F70', padding: 14, overflowY: 'auto' };
const btn = (on = true): React.CSSProperties => ({ padding: '6px 12px', fontSize: 11, background: on ? 'var(--sun)' : '#2A2F55', color: on ? '#101126' : 'var(--soft)', border: '3px solid #101126' });

export function GeminiLab() {
  const [preset, setPreset] = useState('demo');
  const [mock, setMock] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aMeta, setAMeta] = useState<Meta | null>(null);
  const [settings, setSettings] = useState<Settings>(() => cleanSettings({}));
  const [song, setSong] = useState<Song | null>(null);
  const [songSettings, setSongSettings] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [cMeta, setCMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState<'' | 'analyze' | 'compose'>('');
  const [fail, setFail] = useState('');

  const profile = PRESETS[preset].profile;

  // ---- practice: code-built cards from the piece (no AI), graded with the mic
  const inst = instrumentOf(useGame((st) => st.run));
  const perf = usePerformance();
  const cards = useMemo(() => (song && songSettings ? buildCards(song, songSettings) : []), [song, songSettings]);
  const [cardId, setCardId] = useState('piece');
  const [boost, setBoost] = useState(1); // "faster" nudges tempo up 10% at a time
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const card: Card | undefined = cards.find((c) => c.id === cardId) ?? cards[cards.length - 1];
  const ex = card ? { ...card.ex, tempo: Math.round(card.ex.tempo * boost) } : null;
  const performing = perf.stage === 'countin' || perf.stage === 'recording';

  const pick = (id: string) => {
    if (performing) return;
    sfx('click');
    setCardId(id); setBoost(1); setFeedback(null); perf.reset();
  };
  const playCard = async () => {
    if (!ex || performing) return;
    setFeedback(null);
    const final = await perf.play(ex, inst.shift);
    if (!final) return;
    const f = analyzeTake(ex, final, inst.writtenOffset);
    setFeedback(f);
    sfx(f.grade === 'S' || f.grade === 'A' ? 'stampHit' : 'stampMiss');
  };
  const followUp = () => {
    if (!feedback?.next || !card) return;
    if (feedback.next === 'again') return void playCard();
    if (feedback.next === 'faster') { setBoost((b) => Math.round(b * 11) / 10); setFeedback(null); perf.reset(); return; }
    const target = cards.find((c) => c.kind === feedback.next && c.bar === card.bar) ?? cards.find((c) => c.kind === feedback.next);
    if (target) pick(target.id);
  };
  const nextLabel = (f: Feedback) => {
    if (f.next === 'again') return 'AGAIN';
    if (f.next === 'faster') return 'AGAIN, 10% FASTER';
    const t = cards.find((c) => c.kind === f.next && c.bar === card?.bar) ?? cards.find((c) => c.kind === f.next);
    return t ? `TRY: ${t.label.toUpperCase()}` : null;
  };

  const analyze = async (fresh = false) => {
    sfx('click');
    setBusy('analyze'); setFail('');
    try {
      const r = await post<{ analysis: Analysis } & Meta>('/api/lab/analyze', { profile, fresh, mock });
      setAnalysis(r.analysis);
      setAMeta(r);
      // Every input starts at what the AI suggested.
      setSettings(Object.fromEntries(SETTING_NAMES.map((k) => [k, r.analysis.settings[k].value])) as unknown as Settings);
    } catch (e) { setFail(String((e as Error).message)); }
    setBusy('');
  };

  const compose = async (fresh = false) => {
    sfx('click');
    setBusy('compose'); setFail('');
    try {
      const r = await post<{ song: Song; settings: Settings; errors: string[] } & Meta>('/api/lab/compose', {
        settings, fresh, mock, weaknesses: analysis?.weaknesses.map((w) => w.why) ?? [],
      });
      setSong(r.song); setSongSettings(r.settings); setErrors(r.errors); setCMeta(r);
      setCardId('piece'); setBoost(1); setFeedback(null); perf.reset();
    } catch (e) { setFail(String((e as Error).message)); }
    setBusy('');
  };

  const set = <K extends SettingName>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const aiValue = (k: SettingName) => analysis?.settings[k].value;
  const edited = (k: SettingName) => analysis !== null && JSON.stringify(settings[k]) !== JSON.stringify(aiValue(k));

  const row = (k: SettingName, label: string, control: React.ReactNode) => (
    <div key={k} style={{ display: 'grid', gridTemplateColumns: '92px 300px 1fr', alignItems: 'center', gap: 10, minHeight: 32 }}>
      <span className="f-label" style={{ fontSize: 11, color: edited(k) ? 'var(--magenta)' : 'var(--muted)' }}>
        {label}{edited(k) && (
          <button title="Back to the AI's suggestion" onClick={() => set(k, aiValue(k) as never)} style={{ marginLeft: 4, color: 'var(--magenta)', font: 'inherit' }}>↺</button>
        )}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{control}</div>
      <span className="f-body" title={analysis?.settings[k].reason} style={{ fontSize: 12, lineHeight: '14px', color: edited(k) ? '#6B6F8E' : 'var(--soft)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {edited(k) ? `EDITED (AI said ${JSON.stringify(aiValue(k))}) — ` : ''}{analysis ? `AI: ${analysis.settings[k].reason}` : 'Analyze first to get a suggestion + reason.'}
      </span>
    </div>
  );

  const range = (k: 'bpm' | 'bars' | 'difficulty', lo: number, hi: number, step = 1) => (
    <>
      <input type="range" min={lo} max={hi} step={step} value={settings[k]} onChange={(e) => set(k, Number(e.target.value))} style={{ width: 200 }} />
      <span className="f-press" style={{ fontSize: 12, color: 'var(--parchment)' }}>{settings[k]}</span>
    </>
  );


  return (
    <MenuShell title="GEMINI LAB">
      {/* ---------- student + analysis ---------- */}
      <div style={{ ...panel, left: 30, top: 145, width: 470, height: 310 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {Object.entries(PRESETS).map(([id, p]) => (
            <button key={id} className="f-label" style={btn(preset === id)} onClick={() => { sfx('click'); setPreset(id); setAnalysis(null); setAMeta(null); }}>{p.label.toUpperCase()}</button>
          ))}
        </div>
        {TAGS.map((t) => {
          const [hit, total] = profile[t];
          const pct = total ? Math.round((100 * hit) / total) : 0;
          return (
            <div key={t} className="f-body" style={{ display: 'grid', gridTemplateColumns: '150px 70px 1fr', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--soft)' }}>
              <span>{TAG_LABEL[t]}</span><span>{hit}/{total}</span>
              <div style={{ height: 8, background: '#2A2F55' }}><div style={{ width: `${pct}%`, height: '100%', background: pct < 60 ? 'var(--hp)' : pct < 85 ? 'var(--sun)' : 'var(--meadow)' }} /></div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0 6px' }}>
          <button className="f-press" style={btn()} disabled={!!busy} onClick={() => analyze(false)}>{busy === 'analyze' ? 'THINKING…' : 'ANALYZE'}</button>
          {analysis && <button className="f-label" style={btn(false)} disabled={!!busy} onClick={() => analyze(true)}>RE-ASK</button>}
          <label className="f-label" style={{ fontSize: 10, color: 'var(--muted)' }}><input type="checkbox" checked={mock} onChange={(e) => setMock(e.target.checked)} /> MOCK (free)</label>
          <span className="f-label" style={{ fontSize: 9, color: 'var(--muted)' }}>{metaText(aMeta)}</span>
        </div>
        {analysis && (
          <div className="f-body" style={{ fontSize: 13, lineHeight: '16px', color: 'var(--soft)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {analysis.strengths.map((s) => <div key={s.tag}><b style={{ color: 'var(--meadow)' }}>+ {TAG_LABEL[s.tag]}</b> — {s.why}</div>)}
            {analysis.weaknesses.map((s) => <div key={s.tag}><b style={{ color: 'var(--hp)' }}>− {TAG_LABEL[s.tag]}</b> — {s.why}</div>)}
            <div><b style={{ color: 'var(--sun)' }}>NEXT</b> — {analysis.recommendation}</div>
          </div>
        )}
      </div>

      {/* ---------- settings (AI-prefilled, editable) ---------- */}
      <div style={{ ...panel, left: 515, top: 145, width: 895, height: 310, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {row('key', 'KEY', KEYS.map((k) => <button key={k} className="f-label" style={{ ...btn(settings.key === k), padding: '4px 7px' }} onClick={() => set('key', k as KeyName)}>{k}</button>))}
        {row('bpm', 'BPM', range('bpm', 40, 180, 2))}
        {row('beatsPerBar', 'TIME', [3, 4].map((n) => <button key={n} className="f-label" style={btn(settings.beatsPerBar === n)} onClick={() => set('beatsPerBar', n as 3 | 4)}>{n}/4</button>))}
        {row('bars', 'BARS', range('bars', 2, 8))}
        {row('difficulty', 'DIFFICULTY', range('difficulty', 1, 5))}
        {row('style', 'STYLE', <input value={settings.style} maxLength={60} onChange={(e) => set('style', e.target.value)} className="f-body" style={{ width: 280, padding: '4px 8px', fontSize: 14, background: '#1E2140', color: 'var(--parchment)', border: '2px solid #3A3F70' }} />)}
        {row('focus', 'FOCUS', TAGS.map((t) => (
          <button key={t} className="f-label" title={TAG_LABEL[t]} style={{ ...btn(settings.focus.includes(t)), padding: '4px 6px', fontSize: 9 }}
            onClick={() => set('focus', settings.focus.includes(t) ? settings.focus.filter((x) => x !== t) : [...settings.focus, t as Tag])}>{t.toUpperCase()}</button>
        )))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <button className="f-press" style={{ ...btn(), background: 'var(--meadow)' }} disabled={!!busy} onClick={() => compose(false)}>{busy === 'compose' ? 'COMPOSING…' : 'GENERATE ▶'}</button>
          {song && <button className="f-label" style={btn(false)} disabled={!!busy} onClick={() => compose(true)}>NEW TAKE (same settings)</button>}
          <span className="f-label" style={{ fontSize: 9, color: 'var(--muted)' }}>{metaText(cMeta)}</span>
          {fail && <span className="f-body" style={{ fontSize: 13, color: 'var(--hp)' }}>{fail}</span>}
        </div>
      </div>

      {/* ---------- practice: the piece broken into cards (code, no AI) ---------- */}
      {song && songSettings && card && ex ? (
        <>
          <div style={{ ...panel, left: 30, top: 465, width: 290, height: 330, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="f-body" style={{ fontSize: 12, color: 'var(--soft)' }}>
              <b style={{ color: 'var(--parchment)' }}>♪ {song.title}</b> · {songSettings.key} · {songSettings.beatsPerBar}/4
              {errors.length ? <div style={{ color: 'var(--hp)' }}>✗ {errors.join(' · ')}</div> : <span style={{ color: 'var(--meadow)' }}> · ✓ valid</span>}
            </div>
            {cards.map((c) => (
              <button key={c.id} onClick={() => pick(c.id)} title={c.why} className="f-label"
                style={{ textAlign: 'left', padding: '5px 8px', fontSize: 10, background: c.id === card.id ? 'var(--sun)' : '#1E2140', color: c.id === card.id ? '#101126' : 'var(--soft)', border: '2px solid #3A3F70', opacity: performing && c.id !== card.id ? 0.5 : 1 }}>
                {c.label.toUpperCase()}{c.tag && songSettings.focus.includes(c.tag) ? ' ★' : ''}
              </button>
            ))}
          </div>

          <div style={{ position: 'absolute', left: 330, top: 465, width: 1080 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <button className="f-press" onClick={playCard} disabled={performing || perf.micStatus !== 'on'}
                style={{ ...btn(), background: perf.micStatus !== 'on' ? '#3A3F70' : 'var(--meadow)', fontSize: 13 }}>
                {perf.micStatus !== 'on' ? 'NO MIC' : perf.stage === 'countin' ? `${perf.count}…` : perf.stage === 'recording' ? 'PLAY!' : 'PLAY ▶'}
              </button>
              <div className="f-body" style={{ flex: 1, fontSize: 13, lineHeight: '16px', color: 'var(--soft)' }}>
                <b style={{ color: 'var(--parchment)' }}>{card.label}</b> · {ex.tempo} BPM{boost > 1 ? ` (+${Math.round((boost - 1) * 100)}%)` : ''} · {inst.name} — {card.why}
              </div>
            </div>
            <div style={{ background: 'var(--parchment)', border: '4px solid #101126', maxHeight: 215, overflowY: 'auto' }}>
              <Staff ex={ex} shift={inst.shift} writtenOffset={inst.writtenOffset} width={1072} beat={perf.beat} results={perf.results}
                barsPerLine={Math.min(ex.bars, 4)} approach={perf.approach} />
            </div>
            {feedback && (
              <div style={{ marginTop: 6, padding: '8px 12px', background: 'rgba(16,17,38,0.92)', border: '3px solid #3A3F70', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="f-press" style={{ fontSize: 30, color: feedback.grade === 'S' || feedback.grade === 'A' ? 'var(--meadow)' : feedback.grade === 'B' ? 'var(--sun)' : 'var(--hp)' }}>{feedback.grade}</div>
                <div className="f-body" style={{ flex: 1, fontSize: 14, lineHeight: '18px', color: 'var(--parchment)' }}>
                  <div className="f-label" style={{ fontSize: 10, color: 'var(--muted)' }}>BAND DIRECTOR · {feedback.hits}/{feedback.total} NOTES</div>
                  {feedback.lines.map((l, i) => <div key={i}>🎺 {l}</div>)}
                </div>
                {nextLabel(feedback) && <button className="f-press" onClick={followUp} style={{ ...btn(), fontSize: 10 }}>{nextLabel(feedback)}</button>}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="f-body" style={{ position: 'absolute', left: 30, top: 480, width: 1380, fontSize: 16, color: 'var(--muted)', padding: 20 }}>
          Pick a student → ANALYZE → tweak any setting → GENERATE. The piece is then broken into practice cards (no extra AI) you can play with the mic.
        </div>
      )}
    </MenuShell>
  );
}
