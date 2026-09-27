// Frame rate, main-thread time, memory and download size per screen, measured
// on a production build in headless Chromium, plus a screenshot of each screen.
//   npm run build && npx next start -p 3100
//   node scripts/bench.mjs http://localhost:3100 bench/after
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const [base = 'http://localhost:3100', out = 'bench/run'] = process.argv.slice(2);
const IDLE_MS = 8000;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  channel: 'chromium', // full Chromium (new headless) so the GPU process and compositor match desktop Chrome
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

async function open(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Network.enable');
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
  await page.goto(base, { waitUntil: 'networkidle' });
  return { context, page, cdp, bytes: () => bytes };
}

const system = await browser.newBrowserCDPSession();
/** CPU seconds and resident memory of the renderer and GPU processes. */
async function processes() {
  const { processInfo } = await system.send('SystemInfo.getProcessInfo');
  const out = {};
  for (const p of processInfo.filter((x) => x.type === 'renderer' || x.type === 'GPU')) {
    const kind = p.type === 'GPU' ? 'gpu' : 'renderer';
    const rss = Number(execSync(`ps -o rss= -p ${p.id}`).toString().trim() || 0) / 1024;
    // CPU adds up across processes; memory is the largest one (the page's own renderer, not spares).
    out[kind] = { cpu: (out[kind]?.cpu ?? 0) + p.cpuTime, rss: Math.max(out[kind]?.rss ?? 0, rss) };
  }
  return out;
}

const metrics = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

/** Frame times from requestAnimationFrame plus main-thread time from the tracing metrics. */
async function sample(page, cdp, ms = IDLE_MS) {
  const a = await metrics(cdp);
  const pa = await processes();
  const t = await page.evaluate((ms) => new Promise((done) => {
    const times = [];
    const start = performance.now();
    const frame = (now) => { times.push(now); if (now - start < ms) requestAnimationFrame(frame); else done(times); };
    requestAnimationFrame(frame);
  }), ms);
  const b = await metrics(cdp);
  const pb = await processes();
  const gaps = t.slice(1).map((v, i) => v - t[i]).sort((x, y) => x - y);
  const wall = (t[t.length - 1] - t[0]) / 1000;
  const busy = (k) => Math.round(((b[k] - a[k]) / wall) * 1000); // ms of main thread per second
  const dom = await page.evaluate(() => ({
    animations: document.getAnimations().filter((x) => x.playState === 'running').length,
    nodes: document.getElementsByTagName('*').length,
  }));
  return {
    fps: +((t.length - 1) / wall).toFixed(1),
    p95FrameMs: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1),
    worstFrameMs: +gaps[gaps.length - 1].toFixed(1),
    longFrames: gaps.filter((g) => g > 25).length,
    mainThreadMsPerSec: busy('TaskDuration'),
    scriptMsPerSec: busy('ScriptDuration'),
    styleMsPerSec: busy('RecalcStyleDuration'),
    layoutMsPerSec: busy('LayoutDuration'),
    heapMB: +(b.JSHeapUsedSize / 1048576).toFixed(1),
    rendererCpuPct: Math.round(((pb.renderer.cpu - pa.renderer.cpu) / wall) * 100),
    gpuCpuPct: Math.round((((pb.gpu?.cpu ?? 0) - (pa.gpu?.cpu ?? 0)) / wall) * 100),
    rendererMB: Math.round(pb.renderer.rss),
    gpuMB: Math.round(pb.gpu?.rss ?? 0),
    ...dom,
  };
}

const visible = (page, text) => page.getByText(text, { exact: true }).locator('visible=true').first();

/** Past the boot gate and the intro, onto the title menu. */
async function toTitle(page, w, h) {
  await page.mouse.click(w / 2, h / 2);
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1800);
}

const results = {};
// A 14" MacBook Pro at its default size, drawn at 2x like its Retina screen.
async function scene(name, go, { viewport = { width: 1512, height: 982 }, mobile = false } = {}) {
  const s = await open(viewport, mobile);
  try {
    if (name === 'intro') {
      await s.page.mouse.click(viewport.width / 2, viewport.height / 2);
      results.intro = await sample(s.page, s.cdp, 4500);
    } else {
      await toTitle(s.page, viewport.width, viewport.height);
      if (go) await go(s.page);
      await s.page.waitForTimeout(1500);
      results[name] = await sample(s.page, s.cdp);
    }
    results[name].downloadMB = +(s.bytes() / 1048576).toFixed(2);
    await s.page.screenshot({ path: `${out}/${name}.png` });
    console.log(name, JSON.stringify(results[name]));
  } catch (e) {
    console.log(name, 'FAILED', e.message.split('\n')[0]);
    await s.page.screenshot({ path: `${out}/${name}-failed.png` }).catch(() => {});
  } finally {
    await s.context.close();
  }
}

const click = (text) => async (page) => { await visible(page, text).click(); };
await scene('intro');
await scene('title');
await scene('title-wide', null, { viewport: { width: 1920, height: 1080 } });
await scene('title-phone', null, { viewport: { width: 852, height: 393 }, mobile: true });
await scene('howto', click('HOW TO PLAY'));
await scene('credits', click('CREDITS'));
const gems = async (page) => { await page.getByText(/^GEMS AND I/).locator('visible=true').first().click(); };
await scene('gems', gems);
await scene('tavern', click('TAVERN'));
await scene('map', async (page) => {
  await click('CAMPAIGN')(page);
  await page.waitForTimeout(1200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
});
await scene('combat', async (page) => {
  await click('CAMPAIGN')(page);
  await page.waitForTimeout(1200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
});
await scene('gems-phone', gems, { viewport: { width: 852, height: 393 }, mobile: true });
await scene('combat-phone', async (page) => {
  await click('CAMPAIGN')(page);
  await page.waitForTimeout(1200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
}, { viewport: { width: 852, height: 393 }, mobile: true });

await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
