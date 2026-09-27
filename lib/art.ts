'use client';

/**
 * Which copy of a piece of art to draw (scripts/optimize-art.mjs builds them).
 * Desktop and tablets draw the original PNGs. Phones draw light WebP copies:
 * a 1024 px sprite drawn ~300 css px tall on a phone costs 4 MB of decoded
 * memory as a PNG and 1 MB as its 512 px copy. Small portraits (map peek,
 * bestiary, target icons) always use a 256 px thumbnail, which also downsizes
 * more cleanly than nearest-neighbour shrinking a 1024 px sprite.
 */
const phone = typeof window !== 'undefined'
  && window.matchMedia('(pointer: coarse)').matches
  && Math.min(window.screen.width, window.screen.height) <= 500;

const LIGHT = /^(\/assets\/(?:sprites|bg|tavern\/characters))\/([\w-]+)\.png$/;
const SHEETS = new Set(['/assets/sprites/instruments.png']); // full size only: cell offsets are in source pixels

export function art(src: string, use: 'full' | 'thumb' = 'full'): string {
  if (src === '/assets/logo.png') return phone ? '/assets/m/logo.webp' : src;
  const match = LIGHT.exec(src);
  if (!match) return src;
  const [, dir, name] = match;
  if (use === 'thumb' && !dir.endsWith('/bg') && !SHEETS.has(src)) return `${dir}/t/${name}.webp`;
  return phone ? `${dir}/m/${name}.webp` : src;
}
