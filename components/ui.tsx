'use client';
import type { CSSProperties, ReactNode } from 'react';
import { sfx } from '@/lib/audio';
import { art } from '@/lib/art';

export function Bg({ src, style, dim = 0, blur = 0 }: { src: string; style?: CSSProperties; dim?: number; blur?: number }) {
  return (
    <div
      className="bg"
      style={{
        left: -80,
        top: 0,
        width: 1600,
        height: 900,
        backgroundImage: `url(${art(src)})`,
        filter: dim || blur ? `brightness(${1 - dim}) ${blur ? `blur(${blur}px)` : ''}` : undefined,
        ...style,
      }}
    />
  );
}

/** Art plus whatever stands on it, scaled together to cover the window (see .scene). */
export function Scene({ children, shift, style }: { children: ReactNode; shift?: string; style?: CSSProperties }) {
  return <div className="scene" style={{ ...(shift ? { ['--scene-shift' as string]: shift } : null), ...style }}>{children}</div>;
}

export function Sprite({ src, x, y, size, style, className }: { src: string; x: number; y: number; size: number; style?: CSSProperties; className?: string }) {
  return (
    <div
      className={`sprite ${className ?? ''}`}
      style={{ left: x, top: y, width: size, height: size, backgroundImage: `url(${art(src)})`, ...style }}
    />
  );
}

export function Arrow({ dir = 'right', size = 40, color = '#FFD23F', tip = '#FF4FA3' }: { dir?: 'left' | 'right'; size?: number; color?: string; tip?: string }) {
  const flip = dir === 'left';
  return (
    <svg width={size} height={size * 0.4} viewBox="0 0 10 4" shapeRendering="crispEdges" style={{ transform: flip ? 'scaleX(-1)' : undefined, flexShrink: 0 }}>
      <rect x="0" y="1" width="5" height="2" fill={color} />
      <rect x="5" y="0" width="2" height="4" fill={color} />
      <rect x="7" y="1" width="1" height="2" fill={color} />
      <rect x="9" y="1" width="1" height="2" fill={tip} />
    </svg>
  );
}

export function Ornament({ width = 560 }: { width?: number }) {
  return (
    <svg width={width} height={(width / 140) * 6} viewBox="0 0 140 6" shapeRendering="crispEdges" style={{ animation: 'fadeIn 400ms 150ms both' }}>
      <rect x="0" y="3" width="52" height="1" fill="#FFF6E0" opacity="0.7" />
      <rect x="88" y="3" width="52" height="1" fill="#FFF6E0" opacity="0.7" />
      <rect x="54" y="2" width="2" height="2" fill="#FF4FA3" />
      <rect x="84" y="2" width="2" height="2" fill="#FF4FA3" />
      <rect x="59" y="3" width="4" height="1" fill="#FFD23F" />
      <rect x="77" y="3" width="4" height="1" fill="#FFD23F" />
      <rect x="69" y="0" width="2" height="6" fill="#FFD23F" />
      <rect x="68" y="1" width="4" height="4" fill="#FFD23F" />
      <rect x="67" y="2" width="6" height="2" fill="#FFD23F" />
      <rect x="69" y="2" width="2" height="2" fill="#101126" />
      <rect x="64" y="2" width="2" height="2" fill="#FFF6E0" />
      <rect x="74" y="2" width="2" height="2" fill="#FFF6E0" />
    </svg>
  );
}

/** `big`: the handheld size, so the numbers stay readable when the stage is drawn small. */
export function HpBar({ hp, max, width = 210, big, style }: { hp: number; max: number; width?: number; big?: boolean; style?: CSSProperties }) {
  const pct = Math.max(0, hp) / max;
  const w = big ? Math.round(width * 1.12) : width;
  const inner = big ? 26 : 16;
  return (
    <div style={{ position: 'relative', width: w, height: inner + 6, backgroundColor: '#2A1520', border: '3px solid #101126', ...style }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: inner, width: (w - 6) * pct, backgroundColor: 'var(--hp)', boxShadow: '#FF8A93 0 3px 0 inset', transition: 'width 500ms steps(8)' }} />
      <div className="f-press" style={{ position: 'absolute', inset: 0, height: inner, display: 'grid', placeItems: 'center', fontSize: big ? 20 : 11, lineHeight: big ? '22px' : '12px', textShadow: '#101126 2px 2px 0', color: '#fff' }}>
        {Math.max(0, hp)}/{max}
      </div>
    </div>
  );
}

export function YellowButton({ children, onClick, style, small }: { children: ReactNode; onClick?: () => void; style?: CSSProperties; small?: boolean }) {
  return (
    <button
      className="f-press hoverable pressable"
      onMouseEnter={() => sfx('hover')}
      onClick={() => {
        sfx('click');
        onClick?.();
      }}
      style={{
        padding: small ? '12px 20px' : '18px 32px',
        fontSize: small ? 13 : 18,
        lineHeight: 1,
        color: '#101126',
        backgroundColor: 'var(--sun)',
        border: '4px solid #101126',
        boxShadow: 'inset -4px -4px 0 #D9A21B, #D1307E 6px 6px 0',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function KeyHint({ k }: { k: string }) {
  return (
    <span className="f-label kbd-only" style={{ padding: '2px 6px', border: '2px solid #6B6F8E', fontSize: 11, lineHeight: '13px', color: 'var(--muted)', letterSpacing: '0.1em' }}>
      {k}
    </span>
  );
}

/** Pixel eighth notes drifting upward (title / menus / victory). */
export function FloatingNotes({ count = 10, colors = ['#FFD23F', '#FF7DB8', '#9FD8FF', '#FFE88A'] }: { count?: number; colors?: string[] }) {
  return (
    <div className="fill" style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const x = (i * 137) % 1400;
        const y = 300 + ((i * 263) % 520);
        const c = colors[i % colors.length];
        return (
          <svg
            key={i}
            width="20"
            height="24"
            viewBox="0 0 5 6"
            shapeRendering="crispEdges"
            style={{ position: 'absolute', left: x, top: y, animation: `floatUp ${6 + (i % 4)}s ${i * 0.7}s linear infinite` }}
          >
            <rect x="3" y="0" width="1" height="5" fill={c} />
            <rect x="0" y="3" width="4" height="3" fill={c} />
            <rect x="4" y="0" width="1" height="2" fill={c} />
          </svg>
        );
      })}
    </div>
  );
}

export function Stars() {
  return (
    <div className="fill" style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 24 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (i * 211) % 1440,
            top: (i * 97) % 420,
            width: 4,
            height: 4,
            background: i % 5 === 0 ? '#FFD23F' : '#fff',
            animation: `glow ${2 + (i % 3)}s ${i * 0.3}s steps(2) infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function Octagon({ size, children, ring = '#3A3F70', fill = '#1E2140', style, className }: { size: number; children: ReactNode; ring?: string; fill?: string; style?: CSSProperties; className?: string }) {
  const c = size * 0.25;
  const i = size - 12;
  const ci = i * 0.25;
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, flexShrink: 0, background: '#101126', clipPath: `polygon(${c}px 0, ${size - c}px 0, ${size}px ${c}px, ${size}px ${size - c}px, ${size - c}px ${size}px, ${c}px ${size}px, 0 ${size - c}px, 0 ${c}px)`, ...style }}>
      <div style={{ position: 'absolute', left: 6, top: 6, width: i, height: i, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: fill, boxShadow: `${ring} 0 0 0 4px inset`, clipPath: `polygon(${ci}px 0, ${i - ci}px 0, ${i}px ${ci}px, ${i}px ${i - ci}px, ${i - ci}px ${i}px, ${ci}px ${i}px, 0 ${i - ci}px, 0 ${ci}px)` }}>
        {children}
      </div>
    </div>
  );
}

/** Pixel padlock. */
export function Padlock({ size, color = '#E6E8F7', style }: { size: number; color?: string; style?: CSSProperties }) {
  return (
    <svg style={style} width={size} height={size * 1.16} viewBox="0 0 6 7" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M1 0h4v1H1zM0 1h1v2H0zM5 1h1v2H5zM0 3h6v4H0z" fill={color} /><rect x="2" y="4" width="2" height="2" fill="#3A3F70" />
    </svg>
  );
}
