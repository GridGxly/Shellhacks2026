// Builds the light copies of the art that phones and small portraits use.
// Desktop keeps the original PNGs untouched. Re-run after adding or changing art:
//   node scripts/optimize-art.mjs
// - m/  handheld copies: sprites at 512 px (a phone draws them at ~130–330 css px),
//       backgrounds at full size but lossy. About 1/20 of the PNG download and
//       1/4 of the decoded memory for sprites.
// - t/  portraits and thumbnails (map peek, bestiary, roll calls): 256 px.
// Sprite sheets keep their full size (their cell offsets are in source pixels).
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const jobs = [
  { dir: 'public/assets/sprites', m: { width: 512, quality: 90 }, t: { width: 256, quality: 88 }, sheets: ['instruments.png'] },
  { dir: 'public/assets/tavern/characters', m: { width: 512, quality: 90 }, t: { width: 256, quality: 88 } },
  { dir: 'public/assets/bg', m: { quality: 86 } },
  { dir: 'public/assets', only: ['logo.png'], m: { width: 624, quality: 90 } },
];

let before = 0;
let after = 0;
for (const job of jobs) {
  const files = (await readdir(job.dir)).filter((f) => f.endsWith('.png') && (!job.only || job.only.includes(f)));
  for (const file of files) {
    const src = path.join(job.dir, file);
    const name = file.replace(/\.png$/, '.webp');
    before += (await stat(src)).size;
    const sheet = job.sheets?.includes(file);
    for (const variant of ['m', 't']) {
      const spec = job[variant] && sheet ? variant === 'm' && { quality: job.m.quality } : job[variant];
      if (!spec) continue;
      const out = path.join(job.dir, variant, name);
      await mkdir(path.dirname(out), { recursive: true });
      let img = sharp(src);
      const { width } = await img.metadata();
      if (spec.width && width > spec.width) img = img.resize({ width: spec.width, kernel: 'lanczos3' });
      await img.webp({ quality: spec.quality, alphaQuality: 100, effort: 5, smartSubsample: true }).toFile(out);
      if (variant === 'm') after += (await stat(out)).size;
    }
  }
}

// Menus sit on a dim, blurred summit. Baking that look into a tiny image
// replaces a full-screen blur filter the phone GPU re-ran on every frame.
await mkdir('public/assets/bg/t', { recursive: true });
await sharp('public/assets/bg/summit.png')
  .resize({ width: 400, kernel: 'lanczos3' })
  .blur(1.1)
  .modulate({ brightness: 0.26, saturation: 0.6 })
  .webp({ quality: 82, effort: 6 })
  .toFile('public/assets/bg/t/summit-dim.webp');

console.log(`handheld art: ${(before / 1048576).toFixed(1)} MB of PNG -> ${(after / 1048576).toFixed(1)} MB of WebP`);
