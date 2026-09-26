'use client';
import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/audio';
import { useGame, type Run } from '@/lib/store';
import { YellowButton } from '../ui';

function Modal({ children, width = 560 }: { children: React.ReactNode; width?: number }) {
  const close = () => { sfx('back'); useGame.getState().setOverlay(null); };
  return (
    <div className="fill" style={{ zIndex: 60 }}>
      <div className="fill" onClick={close} style={{ background: 'rgba(8,9,20,0.78)', animation: 'fadeIn 180ms steps(3) both' }} />
      <div style={{ position: 'absolute', left: (1440 - width) / 2, top: 150, width, animation: 'panelIn 300ms steps(6) both' }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- H2 Sign in

export function SignIn() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errKey, setErrKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), [tab]);

  const submit = async () => {
    if (busy) return;
    const u = username.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(u)) return fail('Usernames are 3–16 letters, numbers or _.');
    if (password.length < 6) return fail('Passwords need at least 6 characters.');
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${tab}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return fail(body.error ?? (res.status === 503 ? 'Accounts are offline right now. Play as guest.' : 'Something went wrong.'));
      sfx('upgrade');
      const s = useGame.getState();
      s.setUser(body.user);
      // Pull the cloud checkpoint if this device has none (PRD §7b).
      if (body.save && !s.saved) {
        try { localStorage.setItem('stc.save.v1', JSON.stringify(body.save)); } catch { /* ignore */ }
        useGame.setState({ saved: body.save as Run });
      } else if (s.saved) {
        void fetch('/api/save', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run: s.saved }) }).catch(() => {});
      }
      s.setOverlay(null);
      s.showToast(tab === 'signup' ? `Welcome, ${body.user.username}. Scores now count.` : `Welcome back, ${body.user.username}.`);
    } catch {
      fail('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };
  const fail = (msg: string) => {
    sfx('denied');
    setError(msg);
    setErrKey((k) => k + 1);
    setBusy(false);
  };

  const input = (props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; innerRef?: React.Ref<HTMLInputElement> }) => {
    const { label, innerRef, ...rest } = props;
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
        <input
          ref={innerRef}
          {...rest}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void submit(); if (e.key === 'Escape') useGame.getState().setOverlay(null); }}
          className="f-body"
          style={{ padding: '12px 14px', fontSize: 20, color: '#101126', background: 'var(--parchment)', border: '4px solid #101126', outline: 'none', boxShadow: 'inset 0 -4px 0 #F0DDB4', userSelect: 'text' }}
        />
      </label>
    );
  };

  return (
    <Modal>
      <div style={{ background: '#14162E', border: '4px solid #101126', boxShadow: '#3A3F70 0 0 0 4px inset, rgba(0,0,0,0.5) 12px 12px 0' }}>
        <div style={{ display: 'flex' }}>
          {(['login', 'signup'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { sfx('click'); setTab(t); setError(null); }}
              className="f-press"
              style={{ flex: 1, padding: '18px 0', fontSize: 14, background: tab === t ? '#14162E' : '#0E0F22', color: tab === t ? 'var(--sun)' : 'var(--muted)', borderBottom: tab === t ? '4px solid var(--sun)' : '4px solid #2A2F55' }}
            >
              {t === 'login' ? 'SIGN IN' : 'NEW CLIMBER'}
            </button>
          ))}
        </div>
        <div key={errKey} style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '26px 32px', animation: errKey ? 'errShake 300ms steps(5)' : undefined }}>
          <div className="f-body" style={{ fontSize: 17, color: 'var(--soft)' }}>
            {tab === 'login' ? 'Pick up your checkpoint on any device.' : 'Save checkpoints and post your scores to the leaderboard.'}
          </div>
          {input({ label: 'USERNAME', value: username, onChange: (e) => setUsername(e.target.value), maxLength: 16, autoComplete: 'username', innerRef: first })}
          {input({ label: 'PASSWORD', type: 'password', value: password, onChange: (e) => setPassword(e.target.value), autoComplete: tab === 'login' ? 'current-password' : 'new-password' })}
          {error && <div className="f-body" style={{ padding: '8px 12px', background: 'rgba(232,67,79,0.15)', border: '2px solid var(--hp)', fontSize: 16, color: '#FF8A93' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <button className="f-label hoverable" onClick={() => { sfx('back'); useGame.getState().setOverlay(null); }} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'underline' }}>
              PLAY AS GUEST
            </button>
            <YellowButton small onClick={() => void submit()}>{busy ? '…' : tab === 'login' ? 'SIGN IN ▸' : 'CREATE ▸'}</YellowButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- H4 Overwrite

export function Overwrite() {
  const saved = useGame((s) => s.saved);
  const confirm = () => {
    sfx('click');
    const s = useGame.getState();
    s.newRun();
    s.go('instrument');
  };
  return (
    <Modal width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '28px 32px', background: '#14162E', border: '4px solid var(--hp)', boxShadow: '#101126 0 0 0 4px, rgba(0,0,0,0.5) 12px 12px 0' }}>
        <div className="f-press" style={{ fontSize: 20, color: '#FF8A93' }}>START OVER?</div>
        <div className="f-body" style={{ fontSize: 18, color: 'var(--soft)', lineHeight: '24px' }}>
          Your checkpoint on <b style={{ color: '#fff' }}>floor {(saved?.floor ?? 0) + 1}</b> with <b style={{ color: 'var(--sun)' }}>{saved?.score.toLocaleString() ?? 0} pts</b> will be erased. This can&apos;t be undone.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14 }}>
          <button className="f-press hoverable" onClick={() => { sfx('back'); useGame.getState().setOverlay(null); }} style={{ padding: '12px 18px', fontSize: 13, background: '#2A2F55', border: '3px solid #101126' }}>KEEP IT</button>
          <button className="f-press hoverable pressable" onClick={confirm} style={{ padding: '12px 18px', fontSize: 13, background: 'var(--hp)', border: '3px solid #101126', boxShadow: '#101126 4px 4px 0' }}>ERASE &amp; CLIMB</button>
        </div>
      </div>
    </Modal>
  );
}
