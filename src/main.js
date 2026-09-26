import { MicPitchTracker } from './mic.js';
import { analyzeArrayBuffer, summarizeRuns } from './analyze-file.js';

const $ = (id) => document.getElementById(id);
const els = {
  toggle: $('toggle'), fftSize: $('fftSize'), clarity: $('clarity'),
  clarityValue: $('clarityValue'), stabilize: $('stabilize'), status: $('status'),
  note: $('note'), cents: $('cents'), needle: $('tunerNeedle'),
  freq: $('freq'), clarityOut: $('clarityOut'), rms: $('rms'), fps: $('fps'),
  file: $('file'), analyzeFile: $('analyzeFile'), fileStatus: $('fileStatus'),
  fileResult: $('fileResult'),
  log: $('log'), logToConsole: $('logToConsole'), clearLog: $('clearLog'),
};

let tracker = null;
let logLines = [];
let frameCount = 0;
let lastFpsAt = performance.now();

els.clarity.addEventListener('input', () => {
  els.clarityValue.textContent = Number(els.clarity.value).toFixed(2);
  if (tracker?.engine) tracker.engine.clarityThreshold = Number(els.clarity.value);
});

function appendLog(line) {
  logLines.push(line);
  if (logLines.length > 200) logLines = logLines.slice(-200);
  els.log.textContent = logLines.join('\n');
  els.log.scrollTop = els.log.scrollHeight;
}

els.clearLog.addEventListener('click', () => {
  logLines = [];
  els.log.textContent = '';
});

function renderReading(r) {
  frameCount += 1;
  const now = performance.now();
  if (now - lastFpsAt >= 500) {
    els.fps.textContent = Math.round((frameCount * 1000) / (now - lastFpsAt));
    frameCount = 0;
    lastFpsAt = now;
  }

  const useStable = els.stabilize.checked;
  const shownNote = useStable ? r.stableNote : r.noteName;
  const shownFreq = useStable ? r.stableFreq : r.frequency;

  if (shownNote) {
    els.note.textContent = shownNote;
    els.note.classList.remove('silent');
    els.freq.textContent = `${shownFreq.toFixed(2)} Hz`;
    const cents = r.cents ?? 0;
    els.cents.textContent = `${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents`;
    const pct = 50 + Math.max(-50, Math.min(50, cents)) ;
    els.needle.style.left = `${pct}%`;
    els.needle.style.background = Math.abs(cents) < 15 ? 'var(--good)' : 'var(--warn)';
  } else {
    els.note.textContent = useStable && r.accepted ? '…' : '—';
    els.note.classList.add('silent');
    els.freq.textContent = '—';
    els.cents.textContent = ' ';
    els.needle.style.left = '50%';
  }

  els.clarityOut.textContent = r.clarity.toFixed(3);
  els.rms.textContent = `${r.rms.toFixed(4)}${r.rejectedBy ? ` (${r.rejectedBy})` : ''}`;

  // Log only accepted readings, plus the transitions into silence, so the log
  // stays readable while still showing where a note started and stopped.
  const payload = {
    frequency: r.frequency == null ? null : Number(r.frequency.toFixed(2)),
    noteName: r.noteName,
    clarity: Number(r.clarity.toFixed(3)),
    timestamp: Math.round(r.timestamp),
  };
  if (r.accepted) {
    appendLog(
      `${String(payload.timestamp).padStart(8)}  ${String(payload.noteName).padEnd(4)} ` +
      `${payload.frequency.toFixed(2).padStart(9)} Hz  clarity ${payload.clarity.toFixed(3)}`,
    );
    if (els.logToConsole.checked) console.log(payload);
  }
}

els.toggle.addEventListener('click', async () => {
  if (tracker?.running) {
    await tracker.stop();
    tracker = null;
    els.toggle.textContent = 'Start Listening';
    els.toggle.classList.remove('listening');
    els.toggle.classList.add('primary');
    els.status.textContent = 'Stopped.';
    els.note.textContent = '—';
    els.note.classList.add('silent');
    return;
  }

  tracker = new MicPitchTracker({
    fftSize: Number(els.fftSize.value),
    clarityThreshold: Number(els.clarity.value),
    onReading: renderReading,
  });

  try {
    const info = await tracker.start();
    els.toggle.textContent = 'Stop';
    els.toggle.classList.add('listening');
    els.toggle.classList.remove('primary');
    els.status.textContent =
      `Listening — ${info.sampleRate} Hz, fftSize ${info.fftSize} ` +
      `(${(info.fftSize / info.sampleRate * 1000).toFixed(1)} ms window, ` +
      `lowest reliable pitch ≈ ${(info.sampleRate / info.fftSize * 2).toFixed(0)} Hz).`;
  } catch (err) {
    tracker = null;
    els.status.textContent = `Could not start microphone: ${err.message}`;
  }
});

els.analyzeFile.addEventListener('click', async () => {
  const file = els.file.files?.[0];
  if (!file) {
    els.fileStatus.textContent = 'Choose an audio file first.';
    return;
  }
  els.fileStatus.textContent = `Analyzing ${file.name}…`;
  els.fileResult.innerHTML = '';
  try {
    const buf = await file.arrayBuffer();
    const result = await analyzeArrayBuffer(buf, {
      bufferSize: Number(els.fftSize.value),
      clarityThreshold: Number(els.clarity.value),
    });
    renderFileResult(file.name, result);
  } catch (err) {
    els.fileStatus.textContent = `Failed to analyze: ${err.message}`;
  }
});

function renderFileResult(name, result) {
  const accepted = result.frames.filter((f) => f.accepted);
  const runs = summarizeRuns(result.frames).filter((r) => r.noteName && r.durationMs >= 40);

  els.fileStatus.textContent =
    `${name} — ${result.durationSec.toFixed(2)}s, ${result.sampleRate} Hz, ` +
    `${result.channels}ch, ${result.frames.length} frames ` +
    `(buffer ${result.bufferSize}, hop ${result.hopSize}); ` +
    `${accepted.length} above clarity threshold (${((accepted.length / result.frames.length) * 100).toFixed(0)}%).`;

  if (!runs.length) {
    els.fileResult.innerHTML = '<p class="summary">No sustained pitch detected above the clarity threshold.</p>';
    if (els.logToConsole.checked) console.log('file frames', result.frames);
    return;
  }

  const rows = runs.map((r) => `
    <tr>
      <td class="mono">${r.startMs.toFixed(0)}</td>
      <td class="mono">${r.durationMs.toFixed(0)}</td>
      <td>${r.noteName}</td>
      <td class="mono">${r.medianFreq ? r.medianFreq.toFixed(2) : '—'}</td>
      <td class="mono">${r.count}</td>
    </tr>`).join('');

  els.fileResult.innerHTML = `
    <table>
      <thead><tr><th>Start (ms)</th><th>Held (ms)</th><th>Note</th><th>Median Hz</th><th>Frames</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="summary">${runs.length} sustained note run(s) ≥ 40 ms. Full frame data logged to console.</p>`;

  if (els.logToConsole.checked) console.log('file frames', result.frames);
}
