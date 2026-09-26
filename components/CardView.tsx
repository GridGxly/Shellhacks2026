'use client';
import type { CSSProperties } from 'react';
import type { CardType, Exercise } from '@/lib/music';

export const CARD_STYLE: Record<CardType, { body: string; inner: string; art: string; tag: string; staff: string }> = {
  chord: { body: '#C23A7E', inner: '#FF7DB8', art: '#1E1030', tag: '#FF9ACB', staff: '#5A3A70' },
  rhythm: { body: '#C9901B', inner: '#FFE08A', art: '#2A2010', tag: '#FFE08A', staff: '#6A5420' },
  scale: { body: '#2F7EC4', inner: '#9FD8FF', art: '#0F1E33', tag: '#9FD8FF', staff: '#2A4A70' },
};

const DESC: Record<CardType, (ex: Exercise) => string> = {
  chord: (ex) => `Arpeggiate ${ex.title}, one note at a time.`,
  rhythm: () => 'Play the rhythm on one note: concert F.',
  scale: () => 'Run the B♭ major scale, up and back.',
};

function Art({ type, color }: { type: CardType; color: string }) {
  if (type === 'chord')
    return (
      <svg width="152" height="84" viewBox="0 0 38 21" shapeRendering="crispEdges">
        {[3, 7, 11, 15, 19].map((y) => <rect key={y} x="0" y={y} width="38" height="1" fill={color} />)}
        {[[4, 14], [4, 10], [4, 6], [17, 12], [17, 8], [17, 4], [30, 16], [30, 12], [30, 8]].map(([x, y], i) => (
          <g key={i} fill={i >= 3 && i < 6 ? '#FF7DB8' : '#FFF6E0'}><rect x={x + 1} y={y} width="3" height="1" /><rect x={x} y={y + 1} width="4" height="1" /><rect x={x} y={y + 2} width="3" height="1" /></g>
        ))}
      </svg>
    );
  if (type === 'rhythm')
    return (
      <svg width="152" height="84" viewBox="0 0 38 21" shapeRendering="crispEdges">
        <rect x="0" y="14" width="38" height="1" fill={color} />
        {[3, 11, 18].map((x) => <g key={x} fill="#FFF6E0"><rect x={x + 1} y="13" width="3" height="1" /><rect x={x} y="14" width="4" height="1" /><rect x={x} y="15" width="3" height="1" /><rect x={x + 3} y="4" width="1" height="10" /></g>)}
        <rect x="14" y="4" width="8" height="2" fill="#FFF6E0" />
        <g fill="#FFD23F"><rect x="29" y="13" width="3" height="1" /><rect x="28" y="14" width="4" height="1" /><rect x="28" y="15" width="3" height="1" /><rect x="31" y="4" width="1" height="10" /><rect x="32" y="5" width="1" height="1" /><rect x="33" y="6" width="1" height="2" /></g>
      </svg>
    );
  return (
    <svg width="152" height="84" viewBox="0 0 38 21" shapeRendering="crispEdges">
      {[3, 7, 11, 15, 19].map((y) => <rect key={y} x="0" y={y} width="38" height="1" fill={color} />)}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <g key={i} fill={i > 3 ? '#9FD8FF' : '#FFF6E0'}><rect x={2 + i * 5} y={17 - i * 2} width="3" height="1" /><rect x={1 + i * 5} y={18 - i * 2} width="4" height="1" /></g>)}
    </svg>
  );
}

export default function CardView({ type, ex, damage, style, lifted, dim }: { type: CardType; ex: Exercise; damage: number; style?: CSSProperties; lifted?: boolean; dim?: boolean }) {
  const c = CARD_STYLE[type];
  return (
    <div
      className="game-card"
      style={{
        position: 'relative', width: 200, height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 8,
        background: c.body, border: '4px solid #101126', boxShadow: `${c.inner} 0 0 0 3px inset, rgba(16,17,38,0.6) 6px ${lifted ? 18 : 8}px 0`,
        filter: dim ? 'brightness(0.5) saturate(0.5)' : undefined, ...style,
      }}
    >
      <div className="card-damage" style={{ position: 'absolute', left: -16, top: -16, width: 42, height: 42, display: 'grid', placeItems: 'center', background: 'var(--sun)', border: '4px solid #101126', boxShadow: '#E0A91F -4px -4px 0 inset', rotate: '45deg', zIndex: 3 }}>
        <span className="f-press" style={{ rotate: '-45deg', fontSize: 13, color: '#101126' }}>{damage}</span>
      </div>
      <div className="card-title" style={{ width: 196, height: 34, display: 'grid', placeItems: 'center', background: 'var(--parchment)', border: '3px solid #101126', translate: '0 4px', position: 'relative', zIndex: 2 }}>
        <span className="f-press" style={{ fontSize: 13, color: '#101126' }}>{type.toUpperCase()}</span>
      </div>
      <div className="card-art" style={{ width: 172, height: 98, display: 'grid', placeItems: 'center', background: c.art, border: '3px solid #101126' }}>
        <Art type={type} color={c.staff} />
      </div>
      <div className="f-label card-bars" style={{ padding: '3px 8px', background: '#101126', fontSize: 10, color: c.tag, translate: '0 -8px', letterSpacing: '0.14em' }}><span className="kbd-only">ATTACK · </span>{ex.bars} BARS</div>
      <div className="f-body card-description" style={{ flex: 1, width: 172, display: 'grid', placeItems: 'center', padding: '0 8px', background: '#FFF1E6', border: '3px solid #101126', fontSize: 15, fontWeight: 600, lineHeight: '20px', color: '#101126', textAlign: 'center' }}>
        <span className="kbd-only">{DESC[type](ex)}</span>
        <span className="touch-only">{type === 'rhythm' ? 'Follow the rhythm' : ex.title}</span>
      </div>
    </div>
  );
}
