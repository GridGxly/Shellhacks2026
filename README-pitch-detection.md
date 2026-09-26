# Pitch Detection Validation

Standalone validation of microphone pitch detection — step 1 of the
sight-reading RPG. Mic capture → `AnalyserNode` → `pitchy` (McLeod) → `tonal`
note names, with the identical pipeline runnable offline against a `.wav`.

## Run

```bash
npm install
npm run dev          # open the printed URL
node scripts/gen-test-wavs.mjs   # regenerate public/test-audio/*.wav
```

Click **Start Listening** and play a sustained note, or pick a file from
`public/test-audio/` and hit **Analyze file**.

## Layout

| File | Role |
| --- | --- |
| `src/pitch-engine.js` | Detection + note naming + accept/reject gating |
| `src/stabilizer.js` | Median filter that stops note-name flicker |
| `src/mic.js` | `getUserMedia` → `AnalyserNode` → rAF loop |
| `src/analyze-file.js` | Same pipeline over a decoded file, frame by frame |
| `src/main.js` | UI wiring, live readout, log, file results table |
| `scripts/gen-test-wavs.mjs` | Synthesizes plucked-string test `.wav`s |
| `scripts/validate.mjs` | Headless Chromium validation suite |

## Accept/reject gating

A frame is only reported as a note when it passes **three** gates, in order.
Rejections carry a `rejectedBy` reason (`level`, `no-pitch`, `clarity`,
`range`) so threshold tuning against a recording is not guesswork.

1. **Level** — RMS ≥ `-48 dBFS`. Required; see below.
2. **Clarity** — pitchy's clarity ≥ `0.85`.
3. **Range** — up to 4200 Hz (~C8), and no lower than whichever is higher of
   A0 (27.5 Hz) or the buffer's reliable floor (see below).

### The low-frequency floor depends on buffer size

A pitch is only believable when several periods fit in the analysis window; at
one period per window the detector will find a "pitch" in anything. The floor
is derived as `2.5 × sampleRate / bufferSize`:

| fftSize | Floor @44.1 kHz | Lowest usable note |
| --- | --- | --- |
| 1024 | 107.7 Hz | ~A2 |
| 2048 | 53.8 Hz | ~A1 |
| 4096 | 27.0 Hz | A0 (piano floor) |
| 8192 | 27.0 Hz | A0 |

This matters in practice. At fftSize 2048 a **bass low E (41.2 Hz) is below
the floor and is rejected** rather than guessed; at 8192 it resolves correctly
as `E1`. Likewise fftSize 1024 rejects a guitar low E (82.4 Hz). If the game
needs to cover bass or piano's bottom octave, 4096 is the minimum.

### Clarity alone does not reject room noise

Measured over 300 frames of room tone (RMS ≈ 0.0023, −52.8 dBFS), with the
level gate disabled:

| Clarity threshold | False positives |
| --- | --- |
| 0.70 | 73/300 |
| 0.80 | 43/300 |
| 0.85 | 23/300 |
| 0.90 | 15/300 |
| 0.95 | 4/300 |

Every false reading was **21.6 Hz** — the lowest frequency a 2048-sample
window resolves. Random noise occasionally autocorrelates at very long lags and
scores high clarity by chance. With the level gate at −48 dBFS: **0/300 at
every threshold**, all rejected by `level`.

Note that `pitchy`'s own `minVolumeDecibels` is a setter-only property (it
reads back `undefined`), which is why the level gate is computed here instead.

## Validation results

Run `npm run dev`, then `node scripts/validate.mjs` in a second terminal.

**Octave errors** — none. 13 tones E1→A6 (12 harmonics each) all named
correctly, within 0.9 cents. A deliberately weak fundamental (2% of the second
harmonic) still resolved to the true pitch, not the octave above.

**Sustain stability** — no flicker. A4: 121/121 frames `A4`. E2: 118/118
frames `E2`, raw *and* stabilized.

**Attack** — usable almost immediately: correct raw note 0–35 ms after onset,
stable 23–58 ms. The level gate suppresses the broadband attack click, so no
wrong note is ever displayed before settling.

**Low range** — accurate at every buffer size, but precision improves:

| fftSize | Window | E2 detected? | Cents spread |
| --- | --- | --- | --- |
| 1024 | 23 ms | no — below floor | — |
| 2048 | 46 ms | yes | 12.5 |
| 4096 | 93 ms | yes | 10.3 |
| 8192 | 186 ms | yes | 9.8 |

2048 is the right default for guitar/violin range. Drop to 4096 for anything
below ~A1, past which latency grows faster than accuracy.

**Boundary behaviour** — a note played 50 cents sharp sits exactly between two
names. The switch is deterministic (A3 up to +49 cents, Bb3 from +51), not
random, so genuine flicker only occurs for notes played badly out of tune. The
median filter absorbs that; it settles in 3 frames (~35 ms) and tolerates 2
dropped frames mid-note so a brief dip does not force a re-settle.

## Notes for the next step

- Browser AGC/noise-suppression/echo-cancellation are all explicitly off;
  leaving them on visibly disturbs sustained tones.
- `AnalyserNode` + `requestAnimationFrame` runs at the display rate (~60 fps,
  ~16 ms hop) against a 46 ms window, so consecutive frames overlap heavily.
  Onset detection will want its own hop, not this loop.
- The frequency floor is deliberately honest: a note below the buffer's
  resolving power is rejected (`rejectedBy: 'range'`) rather than reported as a
  guess. If low notes go missing, raise fftSize — do not lower the floor.
- The synthetic `.wav`s are a smoke test, not a substitute for real recordings.
  Record actual instrument takes and re-run before trusting the thresholds —
  in particular `-48 dBFS` assumes a reasonably quiet room and should be
  re-checked against a real noise floor.
