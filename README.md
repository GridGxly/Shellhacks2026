# Kill the Squire

**Sight-Reading Spire** — a Slay-the-Spire-style browser game for ShellHacks 2026,
where every card is a short sight-reading exercise you play on a real instrument
into your mic. Pitch detection grades each note.

> **The full design lives in [`PRD.md`](./PRD.md) — that's the source of truth.**
> All tunable numbers live in [`src/config.ts`](./src/config.ts); never hard-code
> them elsewhere.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # typecheck + production build
npm run typecheck
```

You need **Node 20+**. Mic access requires `https://` (or `localhost`, which
browsers treat as secure — so `npm run dev` works for mic testing).

## Tech stack (PRD §10)

React + Vite + **TypeScript**, [Zustand](https://github.com/pmndrs/zustand) for
state, [abcjs](https://www.abcjs.net/) for notation, [Pitchy](https://github.com/ianprime0509/pitchy)
for pitch detection, [Tone.js](https://tonejs.github.io/) for audio timing.
Hosting: Vercel (static, free HTTPS for the mic).

## Project layout (PRD §8)

```
src/
  config.ts          # ALL tunable numbers — change balance here only
  types.ts           # shared data model (Note, Exercise, Level, GameState, ...)
  store.ts           # Zustand store (run state + navigation; combat actions TODO)
  App.tsx            # screen router (switch on store.screen)
  content/levels.ts  # exercise pools + main-song excerpt  [TODO: author music]
  audio/             # clock.ts, pitch.ts, onset.ts, grade.ts  [TODO]
  notation/          # toAbc.ts, Staff.tsx  [TODO]
  screens/           # Title, KeySelect, Map, Combat, Victory, FinalVictory, Loss
  components/        # Card, HpBar, Sprite, UltimateButton, RecordingOverlay, Review
  styles/palette.css # single color/style file
```

## What's done vs TODO

- **Done:** runnable app, screen routing, full `config.ts`, all shared types, the
  store's run state + reset, title → key select → map flow, `HpBar`.
- **TODO (see the `[TODO]` markers + PRD sections):** the audio pipeline
  (clock/mic/onset/grading — build the **audio spike first**, PRD §11), abcjs
  staff rendering, combat logic in the store, the music content, and card/combat
  UI.

Your friend's pitch-detection spike is on the `pitch-detection` branch — reuse
that code inside `src/audio/pitch.ts` rather than rewriting it.
