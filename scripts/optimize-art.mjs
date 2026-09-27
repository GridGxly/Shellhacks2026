// Builds the WebP copies of the art that every screen draws (lib/art.ts).
// The original PNGs stay as the source. Re-run after adding or changing art:
//   node scripts/optimize-art.mjs
// Outputs newer than their PNG are skipped, so re-runs only encode what changed.
// - d/  desktop copies at full size. Sprites, characters and the logo are
//       lossless (pixel-exact, about half the PNG); backgrounds are lossy q92,
//       which is visually identical on these flat painted scenes and ~1/20 the size.
// - m/  handheld copies: sprites at 512 px (a phone draws them at ~130–330 css px),
//       backgrounds at full size but lossy. About 1/20 of the PNG download and
//       1/4 of the decoded memory for sprites.
// - t/  portraits and thumbnails (map peek, bestiary, roll calls): 256 px.
// Sprite sheets keep their full size (their cell offsets are in source pixels).
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const LOSSLESS = { lossless: true };
const jobs = [
  { dir: 'public/assets/sprites', d: LOSSLESS, m: { width: 512, quality: 90 }, t: { width: 256, quality: 88 }, sheets: ['instruments.png'] },
  { dir: 'public/assets/tavern/characters', d: LOSSLESS, m: { width: 512, quality: 90 }, t: { width: 256, quality: 88 } },
  { dir: 'public/assets/bg', d: { quality: 92 }, m: { quality: 86 } },
  { dir: 'public/assets', only: ['logo.png'], d: LOSSLESS, m: { width: 624, quality: 90 } },
];
const fresh = async (out, src) => { try { return (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs; } catch { return false; } };

let before = 0;
let after = 0;
let desktopAfter = 0;
for (const job of jobs) {
  const files = (await readdir(job.dir)).filter((f) => f.endsWith('.png') && (!job.only || job.only.includes(f)));
  for (const file of files) {
    const src = path.join(job.dir, file);
    const name = file.replace(/\.png$/, '.webp');
    before += (await stat(src)).size;
    const sheet = job.sheets?.includes(file);
    for (const variant of ['d', 'm', 't']) {
      // Sheets keep full size (cell offsets are in source pixels): no thumbnail.
      const spec = job[variant] && sheet ? variant !== 't' && (variant === 'd' ? job.d : { quality: job.m.quality }) : job[variant];
      if (!spec) continue;
      const out = path.join(job.dir, variant, name);
      if (!(await fresh(out, src))) {
        await mkdir(path.dirname(out), { recursive: true });
        let img = sharp(src);
        const { width } = await img.metadata();
        if (spec.width && width > spec.width) img = img.resize({ width: spec.width, kernel: 'lanczos3' });
        await img.webp(spec.lossless ? { lossless: true, effort: 5 } : { quality: spec.quality, alphaQuality: 100, effort: 5, smartSubsample: true }).toFile(out);
      }
      if (variant === 'm') after += (await stat(out)).size;
      if (variant === 'd') desktopAfter += (await stat(out)).size;
    }
  }
}

// Title-screen silhouettes: the sprite's shape in black, baked once instead of a
// live brightness(0) filter on two large layers that bob forever. Drawn through
// art() as /assets/sprites/<name>-shadow.png, so desktop and phone copies exist.
for (const name of ['choir', 'serpent']) {
  const src = `public/assets/sprites/${name}.png`;
  for (const [variant, width] of [['d', null], ['m', 512]]) {
    const out = `public/assets/sprites/${variant}/${name}-shadow.webp`;
    if (await fresh(out, src)) continue;
    let img = sharp(src).ensureAlpha();
    if (width) img = img.resize({ width, kernel: 'lanczos3' });
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 0;
    await sharp(data, { raw: info }).webp({ lossless: true, effort: 5 }).toFile(out);
  }
}

// Menus sit on a dim, blurred summit. Baking that look into a tiny image
// replaces a full-screen blur filter the phone GPU re-ran on every frame.
await mkdir('public/assets/bg/t', { recursive: true });
if (!(await fresh('public/assets/bg/t/summit-dim.webp', 'public/assets/bg/summit.png'))) await sharp('public/assets/bg/summit.png')
  .resize({ width: 400, kernel: 'lanczos3' })
  .blur(1.1)
  .modulate({ brightness: 0.26, saturation: 0.6 })
  .webp({ quality: 82, effort: 6 })
  .toFile('public/assets/bg/t/summit-dim.webp');

console.log(`art: ${(before / 1048576).toFixed(1)} MB of PNG -> desktop ${(desktopAfter / 1048576).toFixed(1)} MB, handheld ${(after / 1048576).toFixed(1)} MB of WebP`);
