'use client';
import { sfx } from '@/lib/audio';
import { canUpgrade, instrumentOf, level, stat, useGame } from '@/lib/store';
import { art } from '@/lib/art';

export default function Hud({ center, pulse }: { center: string; pulse?: 'map' | 'gear' | 'face' }) {
  const run = useGame((s) => s.run);
  const setOverlay = useGame((s) => s.setOverlay);
  const inst = instrumentOf(run);
  const maxHp = stat(run, 'maxHp');
  const upgradable = useGame(canUpgrade);
  const open = (o: 'stats' | 'pause' | 'mappeek') => {
    sfx('click');
    setOverlay(o);
  };

  const [where, ...rest] = center.split(' · ');
  return (
    <div
      // Handhelds: the bar spans the whole glass and scales as one piece, so the
      // party sits under the left thumb and map/settings under the right.
      className="game-hud ui-tl"
      style={{
        position: 'absolute', left: 'calc(-1 * var(--bleed-x))', top: 'calc(-1 * var(--bleed-y))', width: 'calc((1440px + 2 * var(--bleed-x)) / var(--ui))', height: 60,
        zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        padding: '0 calc(24px + var(--safe-r) / var(--ui)) 0 calc(24px + var(--safe-l) / var(--ui))', background: 'rgba(12,13,30,0.92)', borderBottom: '3px solid #2A2F55',
      }}
    >
      <div className="hud-party" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <button
          aria-label="Riff's stats"
          onMouseEnter={() => sfx('hover')}
          onClick={() => open('stats')}
          className="hoverable hud-avatar tap"
          style={{ position: 'relative', width: 44, height: 44 }}
        >
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#2A2F55', border: '3px solid var(--sun)', boxShadow: pulse === 'face' ? '0 0 0 3px #ffd23f, 0 0 10px rgba(255,210,63,0.4)' : '#101126 3px 3px 0' }}>
            <div className="sprite" style={{ left: -68, top: 2, width: 150, height: 150, backgroundImage: `url(${art(inst.sprite)})`, backgroundPosition: '50% 0' }} />
          </div>
          <div className="f-press hud-level" style={{ position: 'absolute', left: 4, top: 34, padding: '2px 4px', background: '#101126', border: '2px solid var(--sun)', fontSize: 8, lineHeight: '10px', color: 'var(--sun)' }}>
            LV{level(run)}
          </div>
          {upgradable && (
            <div style={{ position: 'absolute', left: 34, top: -7, width: 16, height: 16, display: 'grid', placeItems: 'center', background: 'var(--meadow)', border: '2px solid #101126' }}>
              <svg width="8" height="8" viewBox="0 0 4 4" shapeRendering="crispEdges"><rect x="1" y="0" width="2" height="4" fill="#101126" /><rect x="0" y="1" width="4" height="2" fill="#101126" /></svg>
            </div>
          )}
        </button>
        <div className="hud-identity desk-only" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="f-press" style={{ fontSize: 15, color: '#fff' }}>RIFF</span>
          <span className="f-body" style={{ fontSize: 16, color: 'var(--muted)' }}>the {inst.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="21" height="18" viewBox="0 0 7 6" shapeRendering="crispEdges">
            <rect x="1" y="0" width="2" height="1" fill="#E8434F" /><rect x="4" y="0" width="2" height="1" fill="#E8434F" />
            <rect x="0" y="1" width="7" height="2" fill="#E8434F" /><rect x="1" y="3" width="5" height="1" fill="#E8434F" />
            <rect x="2" y="4" width="3" height="1" fill="#E8434F" /><rect x="3" y="5" width="1" height="1" fill="#E8434F" />
            <rect x="1" y="1" width="1" height="1" fill="#FFB3BA" />
          </svg>
          <span key={run.hp} className="f-press hud-value" style={{ fontSize: 14, color: '#FF8A93', animation: 'popIn 300ms steps(4)' }}>{run.hp}/{maxHp}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--sun)' }}>
          <span className="f-music" style={{ fontSize: 24, lineHeight: '24px' }}>𝄞</span>
          <span className="f-press hud-value" style={{ fontSize: 13 }}>{inst.keyLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 6px', background: '#1E2140', border: '2px solid #3A3F70' }}>
          <svg width="20" height="20" viewBox="0 0 10 10" shapeRendering="crispEdges">
            <rect x="2" y="0" width="6" height="1" fill="#C9901B" /><rect x="1" y="1" width="8" height="1" fill="#FFD23F" />
            <rect x="0" y="2" width="10" height="6" fill="#FFD23F" /><rect x="1" y="8" width="8" height="1" fill="#E0A91F" />
            <rect x="2" y="9" width="6" height="1" fill="#C9901B" /><rect x="5" y="2" width="1" height="4" fill="#101126" />
            <rect x="6" y="2" width="1" height="1" fill="#101126" /><rect x="3" y="5" width="3" height="2" fill="#101126" />
          </svg>
          <span key={run.tips} className="f-press hud-value" style={{ fontSize: 13, color: 'var(--sun)', animation: 'popIn 300ms steps(4)' }}>{run.tips}</span>
        </div>
      </div>
      {/* Handhelds drop the section name ("THE CLIMB") and keep where you are. */}
      <div className="f-label hud-center" style={{ fontSize: 14, color: '#C9CDE8', letterSpacing: '0.16em', whiteSpace: 'nowrap' }}>
        {rest.length ? <><span className="desk-only">{where} · </span>{rest.join(' · ')}</> : where}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <HudButton label="Map (M)" onClick={() => open('mappeek')} active={pulse === 'map'}>
          <svg width="20" height="18" viewBox="0 0 10 9" shapeRendering="crispEdges">
            <rect x="0" y="0" width="10" height="9" fill="#E3CFA0" /><rect x="1" y="1" width="8" height="7" fill="#F7E7C2" />
            <rect x="2" y="6" width="2" height="1" fill="#E8434F" /><rect x="4" y="4" width="2" height="1" fill="#8A6A45" /><rect x="6" y="2" width="2" height="1" fill="#8A6A45" />
          </svg>
        </HudButton>
        <HudButton label="Settings (Esc)" onClick={() => open('pause')} active={pulse === 'gear'}>
          <svg width="18" height="18" viewBox="0 0 10 10" shapeRendering="crispEdges">
            <rect x="4" y="0" width="2" height="2" fill="#B8C2E0" /><rect x="4" y="8" width="2" height="2" fill="#B8C2E0" />
            <rect x="0" y="4" width="2" height="2" fill="#B8C2E0" /><rect x="8" y="4" width="2" height="2" fill="#B8C2E0" />
            <rect x="2" y="2" width="6" height="6" fill="#B8C2E0" /><rect x="4" y="4" width="2" height="2" fill="#2A2F55" />
          </svg>
        </HudButton>
      </div>
    </div>
  );
}

function HudButton({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      onMouseEnter={() => sfx('hover')}
      onClick={onClick}
      className="hoverable pressable hud-button tap"
      style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', background: active ? '#3A3F70' : '#2A2F55', border: `3px solid ${active ? '#FFD23F' : '#3A4070'}` }}
    >
      {children}
    </button>
  );
}
