import { chromium } from 'playwright';
const b = await chromium.launch({ args: [
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
] });
const p = await (await b.newContext({ viewport: { width: 900, height: 1250 }, permissions: ['microphone'] })).newPage();
await p.goto('http://localhost:5175/', { waitUntil: 'networkidle' });

// Drive the real file-picker + Analyze button so the screenshot shows the
// actual rendered table, not a hand-built stand-in.
const wav = await (await fetch('http://localhost:5175/test-audio/scale-C4-C5.wav')).arrayBuffer();
await p.setInputFiles('#file', {
  name: 'scale-C4-C5.wav',
  mimeType: 'audio/wav',
  buffer: Buffer.from(wav),
});
await p.click('#analyzeFile');
await p.waitForSelector('#fileResult table tbody tr', { timeout: 15000 });
const rows = await p.$$eval('#fileResult tbody tr', rs => rs.map(r => r.children[2].textContent).join(' '));
console.log('rendered table notes:', rows);
console.log('file status:', await p.textContent('#fileStatus'));
await p.screenshot({ path: 'scripts/page.png', fullPage: true });

// Second shot with the mic running, so the live readout state is captured too.
await p.click('#toggle');
await p.waitForTimeout(1200);
await p.screenshot({ path: 'scripts/page-live.png', fullPage: true });
await p.click('#toggle');
console.log('screenshot written');
await b.close();
