'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { duck, saveSettings, settings, sfx, type AudioSettings } from '@/lib/audio';
import { STATS, XP_PER_LEVEL, type StatId } from '@/lib/config';
import { ACTS, ENEMIES } from '@/lib/content';
import { mic } from '@/lib/mic';
import { canAfford, instrumentOf, level, stat, upgradeLock, useGame } from '@/lib/store';
import { enterFullscreen, useFullscreenOffer, useStageFit } from '@/lib/viewport';
import { Padlock, Sprite, YellowButton } from '../ui';
import { art } from '@/lib/art';

/** M5: dim fades in, panel pops from the HUD button it came from. */
function Shell({ children, origin, onClose }: { children: ReactNode; origin: string; onClose?: () => void }) {
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    duck(true);
    return () => duck(false);
  }, []);
  const close = () => {
    sfx('back');
    setClosing(true);
    window.setTimeout(() => (onClose ?? (() => useGame.getState().setOverlay(null)))(), 160);
  };
  return (
    <div className="fill" style={{ zIndex: 60 }}>
      <div className="fill bleed" onClick={close} style={{ background: 'rgba(8,9,20,0.72)', animation: closing ? 'fadeOut 160ms steps(3) forwards' : 'fadeIn 180ms steps(3) both' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transformOrigin: origin, animation: closing ? 'fadeOut 160ms steps(3) forwards' : 'popIn 240ms steps(5) both' }}>
        <div style={{ pointerEvents: 'auto' }}>{children}</div>
      </div>
      <CloseCtx close={close} />
    </div>
  );
}
let closeRef: () => void = () => {};
function CloseCtx({ close }: { close: () => void }) {
  closeRef = close;
  return null;
}

function CloseButton() {
  return (
    <button
      aria-label="Close"
      onMouseEnter={() => sfx('hover')}
      onClick={() => closeRef()}
      className="f-press hoverable tap"
      style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', background: '#2A2F55', border: '3px solid #101126', fontSize: 16, color: '#fff' }}
    >
      ✕
    </button>
  );
}

// ---------------------------------------------------------------- 03b Stats

export function StatsOverlay() {
  const run = useGame((s) => s.run);
  const lock = useGame(upgradeLock);
  const inst = instrumentOf(run);
  const [flash, setFlash] = useState<{ id: StatId; key: number } | null>(null);
  const [deny, setDeny] = useState<StatId | null>(null);
  const lv = level(run);
  const xpInto = run.xp % XP_PER_LEVEL;

  const buy = (id: StatId) => {
    if (useGame.getState().buy(id)) {
      sfx('upgrade');
      window.setTimeout(() => sfx('coin'), 120);
      setFlash((previous) => ({ id, key: (previous?.key ?? 0) + 1 }));
    } else {
      sfx('denied');
      setDeny(id);
      window.setTimeout(() => setDeny(null), 400);
    }
  };

  const panel = useRef<HTMLDivElement>(null);
  const fit = useStageFit(panel, 100);
  return (
    <Shell origin="60px 30px">
      <div ref={panel} className="stats-panel" style={{ position: 'absolute', left: 140, top: fit.top, scale: fit.k === 1 ? undefined : fit.k, transformOrigin: '50% 0', width: 1160, height: 700, display: 'flex', background: '#14162E', border: '4px solid #101126', boxShadow: '#3A3F70 0 0 0 4px inset, rgba(0,0,0,0.5) 12px 12px 0' }}>
        {/* Showcase (desktop only: phones keep the rows and a compact level chip) */}
        <div className="desk-only" style={{ position: 'relative', width: 400, background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(255,210,63,0.2), rgba(16,17,38,0) 70%), #101126', borderRight: '4px solid #2A2F55' }}>
          <div style={{ position: 'absolute', left: 28, top: 26, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="f-press" style={{ fontSize: 26, color: '#fff' }}>RIFF</span>
            <span className="f-body" style={{ fontSize: 17, color: 'var(--muted)' }}>the {inst.name}</span>
          </div>
          <Sprite key={flash?.key} src={inst.sprite} x={40} y={130} size={320} style={{ animation: flash ? 'hitFlash 300ms steps(2)' : undefined }} />
          <div style={{ position: 'absolute', left: 28, right: 28, bottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="f-press" style={{ fontSize: 14, color: 'var(--sun)' }}>LEVEL {lv}</span>
              <span className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>{xpInto}/{XP_PER_LEVEL} XP</span>
            </div>
            <div style={{ height: 14, background: '#2A2F55', border: '3px solid #101126' }}>
              <div style={{ height: 8, width: `${(xpInto / XP_PER_LEVEL) * 100}%`, background: 'var(--sky)' }} />
            </div>
          </div>
        </div>
        {/* Stats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '26px 30px', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="f-press" style={{ fontSize: 20 }}>UPGRADES</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="f-press hand-only" style={{ padding: '6px 12px', fontSize: 16, color: 'var(--sky)', background: '#1E2140', border: '3px solid #3A3F70' }}>LV {lv} · {xpInto}/{XP_PER_LEVEL} XP</span>
              <div key={run.tips} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#1E2140', border: '3px solid var(--sun)', animation: 'popIn 260ms steps(4)' }}>
                <span className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>TIPS</span>
                <span className="f-press" style={{ fontSize: 16, color: 'var(--sun)' }}>{run.tips}</span>
              </div>
              <CloseButton />
            </div>
          </div>
          <div className="f-body" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, color: lock ? 'var(--sun)' : 'var(--muted)' }}>
            {lock && <Padlock size={14} color="var(--sun)" />}
            {lock === 'fight' ? 'Upgrades are locked mid-fight. Spend tips on the map between fights.' : lock === 'first' ? 'Win your first fight to unlock upgrades.' : 'Tips come from every win. Upgrades last the whole climb.'}
          </div>
          {STATS.map((d, i) => {
            const v = stat(run, d.id);
            const { maxed, affordable, cost } = canAfford(run, d.id);
            const open = affordable && !lock;
            const pips = Math.round((d.max - d.base) / d.step);
            const hot = flash?.id === d.id;
            return (
              <div
                key={d.id + (hot ? flash!.key : '')}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 96px 110px 140px', alignItems: 'center', gap: 16, padding: '12px 18px',
                  background: hot ? 'rgba(76,194,107,0.18)' : '#1B1E3B', border: `3px solid ${hot ? 'var(--meadow)' : '#2A2F55'}`,
                  animation: deny === d.id ? 'errShake 300ms steps(5)' : `countUp 200ms ${i * 50}ms steps(3) both`,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="f-press" style={{ fontSize: 14, color: d.color }}>{d.label.toUpperCase()}</span>
                  <span className="f-body" style={{ fontSize: 15, color: 'var(--muted)' }}>{d.blurb}</span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {Array.from({ length: pips }, (_, p) => (
                    <div key={p} style={{ width: 18, height: 18, background: p < run.levels[d.id] ? d.color : '#2A2F55', border: '2px solid #101126', animation: hot && p === run.levels[d.id] - 1 ? 'popIn 300ms steps(4)' : undefined }} />
                  ))}
                </div>
                <span key={v} className="f-press" style={{ fontSize: 18, color: '#fff', animation: hot ? 'slam 300ms steps(4)' : undefined }}>{d.format(v)}</span>
                <button
                  disabled={maxed}
                  aria-disabled={Boolean(lock) || !affordable}
                  onMouseEnter={() => sfx('hover')}
                  onClick={() => buy(d.id)}
                  className="f-press hoverable pressable"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', fontSize: 12, border: '3px solid #101126',
                    background: maxed ? '#2A2F55' : open ? 'var(--meadow)' : '#2A2F55',
                    color: maxed ? 'var(--muted)' : open ? '#101126' : '#9AA0C8',
                    boxShadow: open ? '#1F6B34 -3px -3px 0 inset' : undefined,
                  }}
                >
                  {!maxed && !open && <Padlock size={11} color="#9AA0C8" />}
                  {maxed ? 'MAXED' : lock ? 'LOCKED' : open ? `+ ${cost} TIPS` : `${cost} TIPS`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- 11 Pause / Settings

export function Pause() {
  const screen = useGame((s) => s.screen);
  const [s, setS] = useState<AudioSettings>({ ...settings });
  const [confirmQuit, setConfirmQuit] = useState(false);
  const fullscreen = useFullscreenOffer();
  const set =<K extends keyof AudioSettings>(k: K, v: AudioSettings[K]) => {
    saveSettings({ [k]: v } as Partial<AudioSettings>);
    setS({ ...settings });
  };
  const quit = () => {
    sfx('click');
    if (useGame.getState().bossDemo) return useGame.getState().endBossDemo(); // hand the real run back
    useGame.getState().go('title');
  };

  const panel = useRef<HTMLDivElement>(null);
  const fit = useStageFit(panel, 110);
  return (
    <Shell origin="1400px 30px">
      <div ref={panel} className="pause-panel" style={{ position: 'absolute', left: 300, top: fit.top, scale: fit.k === 1 ? undefined : fit.k, transformOrigin: '50% 0', width: 840, display: 'flex', flexDirection: 'column', background: '#14162E', border: '4px solid #101126', boxShadow: '#3A3F70 0 0 0 4px inset, rgba(0,0,0,0.5) 12px 12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '3px solid #2A2F55' }}>
          <span className="f-press" style={{ fontSize: 24 }}>PAUSED</span>
          <CloseButton />
        </div>
        <div className="pause-rows" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '22px 28px' }}>
          <Slider label="MUSIC" value={s.music} onChange={(v) => set('music', v)} />
          <Slider label="SOUND FX" value={s.sfx} onChange={(v) => { set('sfx', v); sfx('pop'); }} />
          <Slider label="VOICES" value={s.voice} onChange={(v) => set('voice', v)} />
          <Choice label="TRASH TALK" value={s.trashTalk} options={[['spicy', 'SPICY'], ['mild', 'MILD'], ['off', 'OFF']]} onChange={(v) => set('trashTalk', v)} hint="Enemies roast your wrong notes. Voices never play while you record." />
          <Choice label="METRONOME" value={s.metronome} options={[['click', 'CLICK'], ['flash', 'FLASH'], ['off', 'OFF']]} onChange={(v) => set('metronome', v)} />
          <Choice label="FOLLOW ALONG" value={s.approach} options={[['on', 'CIRCLES'], ['off', 'BAR']]} onChange={(v) => set('approach', v)} hint="Circles close in on each note right on its beat. BAR is the classic sweeping line." />
          <Choice label="COUNT-IN" value={String(s.countIn)} options={[['4', '4 BEATS'], ['2', '2 BEATS']]} onChange={(v) => set('countIn', Number(v) as 2 | 4)} />
          <div className="pause-mic" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#1B1E3B', border: '3px solid #2A2F55' }}>
            <span className="f-label" style={{ fontSize: 13, color: 'var(--muted)' }}>MICROPHONE</span>
            <span className="f-body" style={{ fontSize: 16, color: mic.status === 'on' ? 'var(--meadow)' : 'var(--hp)' }}>
              {mic.status === 'on' ? `● ${mic.deviceLabel}` : mic.status === 'denied' ? 'Blocked. Allow it in the address bar.' : 'Not started'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 28px 24px', borderTop: '3px solid #2A2F55' }}>
          {confirmQuit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, animation: 'popIn 200ms steps(3)' }}>
              <span className="f-body" style={{ fontSize: 16, color: 'var(--soft)' }}>{screen === 'combat' ? 'This fight restarts. Your checkpoint is safe.' : 'Your checkpoint is saved.'}</span>
              <button className="f-press" onClick={quit} style={{ padding: '10px 14px', fontSize: 12, background: 'var(--hp)', border: '3px solid #101126' }}>QUIT</button>
              <button className="f-press" onClick={() => { sfx('back'); setConfirmQuit(false); }} style={{ padding: '10px 14px', fontSize: 12, background: '#2A2F55', border: '3px solid #101126' }}>STAY</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14 }}>
              <button className="f-press hoverable" onMouseEnter={() => sfx('hover')} onClick={() => { sfx('click'); setConfirmQuit(true); }} style={{ padding: '12px 16px', fontSize: 12, color: 'var(--hp)', border: '3px solid var(--hp)' }}>
                QUIT TO TITLE
              </button>
              {fullscreen && <button className="f-press" onClick={() => { sfx('click'); void enterFullscreen(); }} style={{ padding: '12px 16px', fontSize: 12, color: 'var(--sun)', border: '3px solid #3A3F70' }}>FULL SCREEN</button>}
            </div>
          )}
          <YellowButton small onClick={() => closeRef()}>RESUME</YellowButton>
        </div>
      </div>
    </Shell>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const steps = 10;
  const on = Math.round(value * steps);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span className="f-label" style={{ fontSize: 13, color: 'var(--muted)', width: 160 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: steps }, (_, i) => (
          <button key={i} className="pause-step" aria-label={`${label} ${i + 1}`} onClick={() => onChange(i + 1 === on ? i / steps : (i + 1) / steps)} style={{ width: 36, height: 24, background: i < on ? 'var(--sun)' : '#2A2F55', border: '3px solid #101126' }} />
        ))}
      </div>
      <span className="f-press" style={{ fontSize: 13, width: 50, textAlign: 'right' }}>{on * 10}</span>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160 }}>
        <span className="f-label" style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      </div>
      {hint && <span className="f-body desk-only" style={{ flex: 1, fontSize: 14, color: '#6B6F8E' }}>{hint}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(([v, l]) => (
          <button key={v} onClick={() => { sfx('click'); onChange(v); }} className="f-press pause-choice" style={{ padding: '8px 12px', fontSize: 11, background: value === v ? 'var(--sun)' : '#2A2F55', color: value === v ? '#101126' : 'var(--muted)', border: '3px solid #101126' }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 11b Map peek

export function MapPeek() {
  const run = useGame((s) => s.run);
  const act = Math.min(5, Math.floor(run.floor / 3));
  const panel = useRef<HTMLDivElement>(null);
  const fit = useStageFit(panel, 96);
  return (
    <Shell origin="1340px 30px">
      <div ref={panel} className="peek-panel" style={{ position: 'absolute', left: 250, top: fit.top, scale: fit.k === 1 ? undefined : fit.k, transformOrigin: '50% 0', width: 940, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 980, height: 26, background: '#8A6A45', border: '4px solid #101126' }} />
        <div style={{ width: 920, padding: '22px 34px 30px', background: 'linear-gradient(180deg, #F7E7C2, #E9D3A2)', border: '4px solid #101126', borderTop: 0, animation: 'unrollDown 420ms steps(8) both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="f-press" style={{ fontSize: 18, color: '#101126' }}>THE SPIRE</span>
            <span className="f-label" style={{ fontSize: 12, color: '#6A5420' }}>FLOOR {Math.min(18, run.floor + 1)} OF 18 · {run.score.toLocaleString()} PTS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 10 }}>
            {ACTS.map((a, ai) => (
              <div key={a.n} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 10px', background: ai === act ? 'rgba(255,210,63,0.35)' : 'transparent', border: ai === act ? '3px solid #101126' : '3px solid transparent' }}>
                <span className="f-press peek-act" style={{ width: 200, fontSize: 11, color: ai <= act ? '#101126' : '#A08B60' }}>{ai + 1}. {a.name.toUpperCase()}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  {ENEMIES.slice(ai * 3, ai * 3 + 3).map((e, i) => {
                    const f = ai * 3 + i;
                    const cleared = f < run.floor;
                    const here = f === run.floor;
                    return (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : undefined }}>
                        <div style={{ position: 'relative', width: e.boss ? 58 : 46, height: e.boss ? 58 : 46, background: here ? 'var(--sun)' : cleared ? '#C9B48A' : '#D8C49A', border: `3px solid ${e.boss ? '#C23A7E' : '#101126'}`, overflow: 'hidden', animation: `popIn 200ms ${300 + f * 30}ms steps(3) both` }}>
                          <div className="sprite" style={{ inset: 2, backgroundImage: `url(${art(e.sprite, 'thumb')})`, filter: `${e.spriteFilter ?? ''} ${cleared ? 'grayscale(1) opacity(0.5)' : f > run.floor ? 'brightness(0) opacity(0.35)' : ''}`.trim() || undefined }} />
                          {cleared && <span className="f-press" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 20, color: '#E8434F' }}>✕</span>}
                        </div>
                        {i < 2 && <div style={{ flex: 1, height: 0, borderTop: `4px dashed ${cleared ? '#8A6A45' : '#C9B48A'}`, margin: '0 6px' }} />}
                      </div>
                    );
                  })}
                </div>
                {ai === act && <span className="f-press" style={{ fontSize: 10, color: '#C23A7E' }}>◀ YOU</span>}
              </div>
            ))}
          </div>
          <div className="f-label" style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#6A5420' }}><span className="kbd-only">PRESS M OR ESC TO CLOSE</span><span className="touch-only">TAP OUTSIDE TO CLOSE</span></div>
        </div>
        <div style={{ width: 980, height: 26, background: '#8A6A45', border: '4px solid #101126', animation: 'dropIn 420ms steps(8) both' }} />
      </div>
    </Shell>
  );
}
