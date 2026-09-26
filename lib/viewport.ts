'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * How the 1440×900 stage meets the physical screen (docs/MOBILE.md).
 *
 * The art frame always keeps its composition and pixel density. On handheld
 * screens the controls around it get three extra tools, published as CSS
 * variables on <html>:
 * - `--ui`: controls scale up so they never render below UI_FLOOR of their
 *   designed size (the whole cluster grows, so its design stays intact).
 * - `--bleed-x` / `--bleed-y`: stage px between the frame and the screen edge.
 *   Full-screen layers (`.bleed`) and edge rails reach into it.
 * - `--rail-*` (globals.css): the bleed minus the notch and home-indicator
 *   insets, so edge controls hug the safe edge of the glass.
 * Desktop keeps `--ui: 1` and no bleed, so it renders exactly as designed.
 */
export const STAGE_W = 1440;
export const STAGE_H = 900;

const UI_FLOOR = 0.85;
const UI_MAX = 2.4;
/** Screens this short get handheld density even without a touch screen. */
const COMPACT_HEIGHT = 540;

export interface Viewport {
  /** Rendered px per stage px. */
  scale: number;
  /** Handheld control scale; 1 on desktop. */
  ui: number;
  bleedX: number;
  bleedY: number;
  handheld: boolean;
  portrait: boolean;
  /** Notch / home-indicator insets in css px. */
  safe: { t: number; r: number; b: number; l: number };
  /** Stage centre in page px. */
  x: number;
  y: number;
}

const DESKTOP: Viewport = { scale: 1, ui: 1, bleedX: 0, bleedY: 0, handheld: false, portrait: false, safe: { t: 0, r: 0, b: 0, l: 0 }, x: STAGE_W / 2, y: STAGE_H / 2 };

let probe: HTMLDivElement | null = null;
/** env(safe-area-inset-*) as numbers, read from a hidden probe. */
function safeInsets() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
}
let current = DESKTOP;
const listeners = new Set<() => void>();

export function measureViewport(width: number, height: number, left = 0, top = 0): Viewport {
  const scale = Math.min(width / STAGE_W, height / STAGE_H);
  const handheld = window.matchMedia('(pointer: coarse)').matches || height <= COMPACT_HEIGHT;
  return {
    scale,
    ui: handheld ? Math.min(UI_MAX, Math.max(1, UI_FLOOR / scale)) : 1,
    bleedX: handheld ? Math.max(0, (width / scale - STAGE_W) / 2) : 0,
    bleedY: handheld ? Math.max(0, (height / scale - STAGE_H) / 2) : 0,
    handheld,
    portrait: window.matchMedia('(orientation: portrait)').matches,
    safe: safeInsets(),
    x: left + width / 2,
    y: top + height / 2,
  };
}

export function applyViewport(next: Viewport) {
  const root = document.documentElement;
  root.style.setProperty('--stage-scale', String(next.scale));
  root.style.setProperty('--ui', String(next.ui));
  root.style.setProperty('--bleed-x', `${next.bleedX}px`);
  root.style.setProperty('--bleed-y', `${next.bleedY}px`);
  root.toggleAttribute('data-handheld', next.handheld);
  // Turning a phone from portrait to landscape reveals the stage with a short
  // stepped wake instead of the browser's half-resized frames.
  if (current.portrait && !next.portrait && next.handheld) {
    root.removeAttribute('data-waking');
    void root.offsetWidth;
    root.setAttribute('data-waking', '');
    window.setTimeout(() => root.removeAttribute('data-waking'), 700);
  }
  current = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The live viewport model; re-renders on resize and rotation. */
export function useViewport() {
  return useSyncExternalStore(subscribe, () => current, () => DESKTOP);
}

export const touchDevice = () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/** Android Chrome goes full screen and locks landscape; iPhone Safari has no element full screen and skips this. */
export async function enterFullscreen() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await (screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined)?.lock?.('landscape');
  } catch { /* not supported: the stage still scales to fit */ }
}

/** True when a touch browser could go full screen but isn't: menus then offer it (never a floating button over play). */
export function useFullscreenOffer() {
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    const on = () => setOffer(touchDevice() && document.fullscreenEnabled && !document.fullscreenElement);
    on();
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  return offer;
}
