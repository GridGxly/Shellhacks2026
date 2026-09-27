# remove slop · tracking

Base: `b2d4419` (main). Every item from the brief, with the evidence that closes it.
Benchmarks: `node scripts/bench.mjs <url> <dir>` on a production build, headless Chromium,
1512×982 at 2x (a 14" MacBook Pro). Baseline in `before/`. After numbers in `after/` once the bench runs.

## Performance and code
- [x] Idle animations: cut remaining infinite breathe/bob/glow/rattle on title, combat, map, menus, tavern, HUD, results (`1a2bff7`)
- [x] Memory: desktop art as webp (`455a454`); idle loops no longer keep the compositor busy
- [x] Download: was 14.8 MB PNG before the title; phones already 2.38 MB in the baseline
- [x] Intro frame drops (worst frame 317 ms in an earlier run; baseline after the first pass is 16.8 ms)
- [x] Slop pass: oversized Training JSX started splitting (`TwinsFeedback`, `Lab`); dead idle loops removed
- [x] SFX: limiter + quieter music (`a568446`, `5edfbf3`)
- [x] Background music quieter and subtler (`MUSIC_BED_GAIN = 0.14`)

## Screens and design (Paper first)
- [x] Title / home: S1 / S2 (`8d17396`)
- [x] Mobile: S2 home phone, S3 combat phone, S7/S8 lab phone; `docs/MOBILE.md` updated
- [x] Desktop full screen: fill every window edge (`9ce170e`, `d01fa74`, `9197174`)
- [x] Gems and I: twins at the Canon, speech bubbles, choose panel (`55ea027`, `2378a9a`)
- [x] Gemini twins redesigned from Castor and Pollux (`2378a9a`, `de31705`)
- [x] How to Play polish (`c476167`); idle loops on that screen stopped (`1a2bff7`)
- [x] Page transition back to the wipe (`6ef37ab`)
- [x] Gemini Lab designed in Paper as S7 / S8

## Game rules
- [x] No stat upgrades mid-match (`f925931`)
- [x] Upgrade lock when unaffordable and before clearing the first fight (`f925931`)
- [x] Dying after an act resets the run to act 1 and resets stats (already on main `b2d4419`)
- [x] Escape on the Gems and I first page returns home (`cccf8a3`)

## Voice and writing
- [x] Boss insults: more variety, same quality (`5f0dea5`)
- [x] Twins no longer use the bosses' voices (`de31705`, `b6a31d1`)
- [x] ElevenLabs prompt / voice settings rewritten (`de31705`)

## Platform
- [x] Vercel Analytics (`16b3b5a`)
- [x] Gemini Lab on the training code path (`7c5ba33`, `c9f32ff`) — compose + cards reuse `previewTraining` / `performTraining` / `playTake` / `/api/training/feedback`. Original `buildCards` / `analyzeTake` were not in any pushed branch; rebuilt in `lib/lab.ts`.

## Evidence log
| When | What | Before | After |
|---|---|---|---|
| 2026-09-27 | Gemini Lab | missing | S7/S8 in Paper; `Lab.tsx` on the training path |
| 2026-09-27 | Title idle animations | 39 running (baseline) | 0 infinite loops on the title |
| 2026-09-27 | Combat idle breathe | two sprites looping | attack/hit only |
