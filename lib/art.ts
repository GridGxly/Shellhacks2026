'use client';

/**
 * Which copy of a piece of art to draw (scripts/optimize-art.mjs builds them; the
 * PNGs are masters and never load). Desktop and tablets draw full-size WebP (d/),
 * 6-60x lighter than the PNG. Phones draw 512 px copies (m/): a 1024 px sprite drawn
 * ~300 css px tall costs a quarter of the decoded memory at 512. Small portraits (map
 * peek, bestiary, target icons) use a 256 px thumbnail (t/), which also downsizes
 * more cleanly than nearest-neighbour shrinking a 1024 px sprite.
 */
const phone = typeof window !== 'undefined'
  && window.matchMedia('(pointer: coarse)').matches
  && Math.min(window.screen.width, window.screen.height) <= 500;

const ART = /^(\/assets(?:\/(?:sprites|bg|tavern\/characters))?)\/([\w-]+)\.png$/;
const SHEETS = new Set(['/assets/sprites/instruments.png']); // no thumbnail: cell offsets are in source pixels

export function art(src: string, use: 'full' | 'thumb' = 'full'): string {
  const match = ART.exec(src);
  if (!match) return src;
  const [, dir, name] = match;
  if (dir === '/assets' && name !== 'logo') return src;
  if (use === 'thumb' && !dir.endsWith('/bg') && dir !== '/assets' && !SHEETS.has(src)) return `${dir}/t/${name}.webp`;
  return `${dir}/${phone ? 'm' : 'd'}/${name}.webp`;
}
