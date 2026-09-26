'use client';
import { useEffect, useState } from 'react';
import { sfx } from '@/lib/audio';
import { weekKey } from '@/lib/week';
import { ENEMIES, INSTRUMENTS } from '@/lib/content';
import { useGame } from '@/lib/store';
import { YellowButton } from '../ui';
import { MenuShell } from './Menus';

export interface BoardRow {
  rank: number;
  username: string;
  score: number;
  floor: number;
  instrument: string;
  accuracy: number;
  at: string;
}

const instName = (id: string) => INSTRUMENTS.find((i) => i.id === id)?.name ?? id;
const instIcon = (id: string) => INSTRUMENTS.find((i) => i.id === id)?.sprite ?? INSTRUMENTS[0].sprite;

// ---------------------------------------------------------------- H6 Leaderboard

export function Leaderboard() {
  const user = useGame((s) => s.user);
  const best = useGame((s) => s.best);
  const [range, setRange] = useState<'all' | 'week'>('all');
  const [data, setData] = useState<{ rows: BoardRow[]; me: BoardRow | null; previous: Record<string, number> } | 'offline' | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    let request: AbortController | null = null;
    let previous: Record<string, number> = {};
    const refresh = async () => {
      request?.abort();
      const current = request = new AbortController();
      try {
        const response = await fetch(`/api/leaderboard?range=${range}`, { signal: current.signal });
        if (!response.ok) throw new Error('Leaderboard unavailable');
        const next: { rows: BoardRow[]; me: BoardRow | null } = await response.json();
        if (!mounted || current.signal.aborted) return;
        setData({ ...next, previous });
        previous = Object.fromEntries(next.rows.map((row) => [row.username, row.score]));
      } catch {
        if (mounted && !current.signal.aborted) setData((last) => last ?? 'offline');
      }
    };
    void refresh();
    const source = new EventSource('/api/leaderboard/live');
    source.addEventListener('ready', () => { setConnected(true); void refresh(); });
    source.addEventListener('run', (event) => {
      try {
        const run = JSON.parse(event.data) as { weekKey: string };
        if (range === 'all' || run.weekKey === weekKey()) void refresh();
      } catch { /* Ignore an incomplete event; reconnect refreshes the board. */ }
    });
    source.onerror = () => setConnected(false);
    return () => { mounted = false; request?.abort(); source.close(); };
  }, [range]);

  const rows = data && data !== 'offline' ? data.rows : [];
  const me = data && data !== 'offline' ? data.me : null;

  return (
    <MenuShell title="LEADERBOARD">
      <div style={{ position: 'absolute', left: 250, top: 190, width: 940, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'week'] as const).map((r) => (
              <button
                key={r}
                onMouseEnter={() => sfx('hover')}
                onClick={() => { if (r !== range) { sfx('click'); setData(null); setConnected(false); setRange(r); } }}
                className="f-press"
                style={{ padding: '10px 16px', fontSize: 12, background: range === r ? 'var(--sun)' : '#1E2140', color: range === r ? '#101126' : 'var(--muted)', border: '3px solid #101126' }}
              >
                {r === 'all' ? 'ALL TIME' : 'THIS WEEK'}
              </button>
            ))}
            <span role="status" aria-label={connected ? 'Leaderboard live' : 'Leaderboard reconnecting'} className="f-label" style={{ alignSelf: 'center', marginLeft: 10, fontSize: 14, color: connected ? 'var(--meadow)' : 'var(--muted)' }}><span style={{ animation: connected ? 'blink 1.6s steps(2) infinite' : undefined }}>●</span> LIVE</span>
          </div>
          <span className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>BEST VERIFIED RUN PER CLIMBER</span>
        </div>

        <div style={{ background: 'rgba(16,17,38,0.88)', border: '4px solid #3A3F70', boxShadow: '#101126 8px 8px 0', animation: 'unrollDown 400ms steps(8) both' }}>
          <div className="f-label" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 170px 110px 110px 150px', padding: '12px 22px', fontSize: 11, color: 'var(--muted)', borderBottom: '3px solid #2A2F55' }}>
            <span>RANK</span><span>PLAYER</span><span>INSTRUMENT</span><span>FLOOR</span><span>ACC</span><span style={{ textAlign: 'right' }}>SCORE</span>
          </div>
          <div style={{ height: 390, overflow: 'auto' }}>
            {data === null && <Empty text="Tuning up…" />}
            {data === 'offline' && <Empty text="Leaderboard is offline (no database configured). Local best shown below." />}
            {data && data !== 'offline' && rows.length === 0 && <Empty text="No scores yet. Be the first up the spire." />}
            {rows.map((r, i) => <Row key={`${r.username}-${r.rank}-${r.score}`} r={r} mine={r.username === user?.username} delay={i * 40} from={data && data !== 'offline' ? data.previous[r.username] ?? 0 : 0} />)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 22px', background: 'rgba(209,48,126,0.18)', border: '3px solid var(--magenta-dark)' }}>
          {user ? (
            <span className="f-body" style={{ fontSize: 17 }}>
              {me ? <>You are <b style={{ color: 'var(--sun)' }}>#{me.rank}</b> with {me.score.toLocaleString()} as {user.username}.</> : `${user.username}: finish a run to get ranked.`}
            </span>
          ) : (
            <>
              <span className="f-body" style={{ fontSize: 17 }}>
                Your best on this device: <b style={{ color: 'var(--sun)' }}>{best ? `${best.score.toLocaleString()} · floor ${best.floor}` : '—'}</b>. Sign in to post it.
              </span>
              <YellowButton small onClick={() => useGame.getState().setOverlay('signin')}>SIGN IN</YellowButton>
            </>
          )}
        </div>
      </div>
    </MenuShell>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="f-body" style={{ padding: 40, textAlign: 'center', fontSize: 18, color: 'var(--muted)' }}>{text}</div>;
}

function Row({ r, mine, delay, from }: { r: BoardRow; mine: boolean; delay: number; from: number }) {
  const medal = ['#FFD23F', '#C9CDE8', '#E0A060'][r.rank - 1];
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '80px 1fr 170px 110px 110px 150px', alignItems: 'center', padding: '10px 22px',
        background: mine ? 'rgba(255,210,63,0.12)' : r.rank % 2 ? 'transparent' : 'rgba(42,47,85,0.35)',
        borderLeft: mine ? '4px solid var(--sun)' : '4px solid transparent',
        animation: `countUp 200ms ${delay}ms steps(3) both`,
      }}
    >
      <span className="f-press" style={{ fontSize: 16, color: medal ?? 'var(--muted)' }}>{r.rank}</span>
      <span className="f-body" style={{ fontSize: 19, fontWeight: 600, color: '#fff' }}>{r.username}{mine && <span className="f-label" style={{ fontSize: 10, color: 'var(--sun)', marginLeft: 10 }}>YOU</span>}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ position: 'relative', width: 28, height: 28, overflow: 'hidden', background: '#2A2F55' }}>
          <span className="sprite" style={{ left: -36, top: 0, width: 100, height: 100, backgroundImage: `url(${instIcon(r.instrument)})`, backgroundPosition: '50% 0' }} />
        </span>
        <span className="f-body" style={{ fontSize: 15, color: 'var(--soft)' }}>{instName(r.instrument)}</span>
      </span>
      <span className="f-press" style={{ fontSize: 13, color: r.floor >= 18 ? 'var(--sun)' : '#fff' }}>{r.floor >= 18 ? '★ 18' : r.floor}</span>
      <span className="f-press" style={{ fontSize: 13, color: 'var(--meadow)' }}>{r.accuracy}%</span>
      <span className="f-press" style={{ fontSize: 16, color: '#fff', textAlign: 'right' }}><Score from={from} to={r.score} /></span>
    </div>
  );
}

function Score({ from, to }: { from: number; to: number }) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (performance.now() - start) / 650);
      setValue(Math.round(from + (to - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to]);
  return value.toLocaleString();
}

// ---------------------------------------------------------------- H5 Profile

interface ProfileData {
  username: string;
  level: number;
  createdAt: string;
  rank: number | null;
  best: { score: number; floor: number } | null;
  totals: { runs: number; wins: number; notesHit: number; notesTotal: number; encores: number };
  runs: { score: number; floor: number; instrument: string; endedBy: string; at: string }[];
  deepest: number;
}

export function Profile() {
  const user = useGame((s) => s.user);
  const [p, setP] = useState<ProfileData | 'offline' | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : 'offline'))
      .then(setP)
      .catch(() => setP('offline'));
  }, []);

  const data = p && p !== 'offline' ? p : null;
  const acc = data && data.totals.notesTotal ? Math.round((data.totals.notesHit / data.totals.notesTotal) * 100) : 0;

  return (
    <MenuShell title="PROFILE">
      <div style={{ position: 'absolute', left: 170, top: 190, width: 1100, display: 'flex', gap: 24 }}>
        {/* Card */}
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24, background: 'rgba(16,17,38,0.9)', border: '4px solid var(--sun)', boxShadow: '#101126 8px 8px 0', animation: 'panelIn 400ms steps(6) both' }}>
          <div style={{ position: 'relative', width: 150, height: 150, overflow: 'hidden', background: '#2A2F55', border: '4px solid #101126' }}>
            <div className="sprite" style={{ left: -30, top: 4, width: 210, height: 210, backgroundImage: 'url(/assets/sprites/riff-trumpet.png)', backgroundPosition: '50% 0', animation: 'breathe 1.2s steps(2) infinite' }} />
          </div>
          <div className="f-press" style={{ fontSize: 22, color: '#fff' }}>{user?.username ?? 'GUEST'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="f-press" style={{ padding: '4px 8px', background: '#101126', border: '2px solid var(--sun)', fontSize: 11, color: 'var(--sun)' }}>LV {data?.level ?? user?.level ?? 1}</span>
            {data?.rank && <span className="f-press" style={{ padding: '4px 8px', background: 'var(--magenta-dark)', fontSize: 11 }}>RANK #{data.rank}</span>}
          </div>
          {data && <span className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>CLIMBING SINCE {new Date(data.createdAt).toLocaleDateString()}</span>}
          <div style={{ width: '100%', marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['BEST', data?.best ? data.best.score.toLocaleString() : '—', 'var(--sun)'],
              ['RUNS', data ? `${data.totals.runs}` : '—', '#fff'],
              ['CLEARS', data ? `${data.totals.wins}` : '—', 'var(--meadow)'],
              ['ACCURACY', data ? `${acc}%` : '—', 'var(--sky)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ padding: '10px 12px', background: '#1E2140', border: '2px solid #3A3F70' }}>
                <div className="f-label" style={{ fontSize: 10, color: 'var(--muted)' }}>{l}</div>
                <div className="f-press" style={{ fontSize: 16, marginTop: 6, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Bestiary */}
          <div style={{ padding: '16px 20px', background: 'rgba(16,17,38,0.88)', border: '3px solid #3A3F70', animation: 'panelIn 400ms 120ms steps(6) both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="f-press" style={{ fontSize: 14 }}>BESTIARY</span>
              <span className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>{data?.deepest ?? 0}/18 DEFEATED</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 8 }}>
              {ENEMIES.map((e, i) => {
                const seen = (data?.deepest ?? 0) > i;
                return (
                  <div key={e.id} title={seen ? e.name : '???'} style={{ position: 'relative', height: 70, background: seen ? '#2A2F55' : '#15172E', border: `2px solid ${e.boss ? 'var(--magenta-dark)' : '#3A3F70'}`, overflow: 'hidden', animation: `popIn 200ms ${200 + i * 30}ms steps(3) both` }}>
                    <div className="sprite" style={{ inset: 4, backgroundImage: `url(${e.sprite})`, filter: seen ? undefined : 'brightness(0) opacity(0.5)' }} />
                  </div>
                );
              })}
            </div>
          </div>
          {/* Recent runs */}
          <div style={{ flex: 1, padding: '16px 20px', background: 'rgba(16,17,38,0.88)', border: '3px solid #3A3F70', animation: 'panelIn 400ms 240ms steps(6) both' }}>
            <div className="f-press" style={{ fontSize: 14, marginBottom: 10 }}>RECENT RUNS</div>
            {p === null && <Empty text="Loading…" />}
            {p === 'offline' && <Empty text="Profile needs the database. Set MONGODB_URI and sign in." />}
            {data?.runs.length === 0 && <Empty text="No runs yet." />}
            {data?.runs.slice(0, 5).map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 140px', alignItems: 'center', padding: '8px 0', borderBottom: '2px dashed #2A2F55' }}>
                <span className="f-press" style={{ fontSize: 11, color: r.endedBy === 'victory' ? 'var(--sun)' : 'var(--hp)' }}>{r.endedBy === 'victory' ? 'CLEARED' : `FELL · F${r.floor + 1}`}</span>
                <span className="f-body" style={{ fontSize: 15, color: 'var(--soft)' }}>{instName(r.instrument)} · {new Date(r.at).toLocaleDateString()}</span>
                <span className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>FLOOR {r.floor}</span>
                <span className="f-press" style={{ fontSize: 14, textAlign: 'right' }}>{r.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MenuShell>
  );
}
