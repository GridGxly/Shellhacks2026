# remove slop · tracking

Base: `b2d4419` (main). Every item from the brief, with the evidence that closes it.
Benchmarks: `node scripts/bench.mjs <url> <dir>` on a production build, headless Chromium,
1512×982 at 2x (a 14" MacBook Pro). Baseline in `before/`.

## Performance and code
- [ ] Idle animations: cut what runs, how big it is, and what it repaints
- [ ] Memory: renderer and GPU memory per screen (art decode, layers)
- [ ] Download: 14.8 MB before the title on desktop
- [ ] Intro frame drops (worst frame 317 ms in the first run)
- [ ] Slop pass: oversized files, dead code, duplicated logic
- [ ] SFX: harsh, clipping square waves; no limiter
- [ ] Background music quieter and subtler

## Screens and design (Paper first)
- [ ] Title / home: less cluttered, visually great
- [ ] Mobile: its own landscape interface designed in Paper; full screen on rotate, no background-image patch
- [ ] Desktop full screen: no letterbox bars at any window shape
- [ ] Gems and I: decluttered UX and UI
- [ ] Gemini twins redesigned from Castor and Pollux (the Dioscuri)
- [ ] How to Play polish
- [ ] Page transition back to the wipe (drop the iris circle)

## Game rules
- [ ] No stat upgrades mid-match
- [ ] Upgrade lock when unaffordable and before clearing the first fight
- [ ] Dying after an act resets the run to act 1 and resets stats
- [ ] Escape on the Gems and I first page returns home

## Voice and writing
- [ ] Boss insults: more variety, same quality
- [ ] Every character's ElevenLabs voice fits (Gems and I twins no longer sound like the serpent)
- [ ] ElevenLabs prompt / voice settings rewritten

## Platform
- [ ] Vercel Analytics
- [ ] Gemini Lab on the training code path (blocked: the lab's code is not in any pushed branch)

## Evidence log
| When | What | Before | After |
|---|---|---|---|
