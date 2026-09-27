# Handoff: finish the "remove slop" pass and build the Gemini Lab in Gems and I

You are taking over an in-progress branch of **Slay the Choir**, a pixel-art roguelike where every
card is a short piece of sheet music the player performs on a real instrument into the mic. Read
this whole file before touching anything. Attention to detail and craft are the bar: the owner
(Ralph) reviews every pixel, every spacing value and every animation.

---

## 1. Ground rules (non-negotiable)

- **Repo:** `/Users/ralph/Documents/Projects/shellhacks` · GitHub `GridGxly/SlayTheChoir`.
- **Branch:** `remove-slop` (already pushed). **Source of truth:** commit `b2d4419` on `main`.
  Ignore every other branch and anything after that commit on main.
- **Never push to `main`.** Hosting deploys from main.
- **Commits:** small and frequent, all lowercase conventional style, subject only, no body.
  Examples: `fix: lock upgrades mid-fight and before the first win`, `perf: encode the quiet music bed at 80 kbps`.
- **Author identity** (the repo has no user.email set):
  ```bash
  export GIT_AUTHOR_NAME="Ralph" GIT_AUTHOR_EMAIL="149209580+GridGxly@users.noreply.github.com" GIT_COMMITTER_NAME="Ralph" GIT_COMMITTER_EMAIL="149209580+GridGxly@users.noreply.github.com"
  ```
- **No AI attribution** anywhere: no Co-Authored-By lines, no "generated with" footers, in commits or the PR.
- **Secrets:** `.env.local` holds `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, MongoDB and so on. Never print,
  log, commit or paste them anywhere. Read them from the environment. The Gemini key you were given
  goes in `.env.local` as `GEMINI_API_KEY`, never in code or chat.
- **Next.js 16.3.6** with breaking changes versus what you know. Read `node_modules/next/dist/docs/`
  before using any Next API. React 19, Zustand store, TypeScript strict.
- **Teammates own `grade()` in `lib/mic.ts`.** Don't rewrite grading.
- **Motion rule:** the game's motion is stepped (`steps(n)`), per the Paper M6 spec. Don't add easing
  curves or idle loops to screens nobody asked about. Every infinite animation costs frames.
- **Before every commit:** `npx tsc --noEmit` and `npx eslint components lib app` must show 0 errors.
  The branch is currently at 0 errors and 0 warnings; keep it there.

---

## 2. How the game is built (read before designing or coding)

**Stage model** (`lib/viewport.ts`, `app/globals.css`, `docs/MOBILE.md`):
- Every screen is authored on a **1440×900 stage** in stage px, scaled uniformly to the window.
- The window beyond the frame is **bleed** (`--bleed-x/--bleed-y`). Full-screen layers use `.bleed`, so
  there are never letterbox bars on any device.
- **`<Scene>`** (in `components/ui.tsx`) wraps art plus anything standing on it (characters, map
  nodes). It scales by `--cover` so characters stay on their ground at any window shape. `Bg`
  covers the window by itself.
- **Rails:** edge controls use `left: calc(40px - var(--rail-l))` etc. to hug the window's safe edge.
- **Handheld** (`:root[data-handheld]`, set for touch screens and windows ≤540px tall): control
  clusters scale with `.ui-tl/.ui-tr/.ui-bl/.ui-br/.ui-t/.ui-b/.ui-l/.ui-r` (by `--ui`) or add `.ui-soft`
  for half strength. `.desk-only` / `.hand-only` choose what each shows. `.tap` gives small
  controls a 44px hit area.
- Phones (852×393 landscape) are designed in Paper at **1950×900 stage px** (852×393 × 2.29).

**Art:** `art(src)` in `lib/art.ts` picks `d/` (desktop WebP), `m/` (phone 512px) or `t/` (256px
thumbnail). The PNGs are masters only. After adding art, run `node scripts/optimize-art.mjs`.

**Audio:** `lib/audio.ts`. Music is a quiet bed (`MUSIC_BED_GAIN`); SFX run through a low-pass and a
master limiter. `sfx('click')` etc. for UI.

**Gems and I (training), the part you'll extend:**
- `components/screens/Training.tsx`: the full flow (welcome, choose, configure, ready, count-in,
  performing, feedback, complete, review, playback, claimed, paused). **Copy its patterns.**
- `components/training/TrainingStage.tsx` + `training-stage.css`: the S5 room. Castor and Pollux stand
  **together** at the **Harmonic Canon** on the left, and panels sit on the right. `activeMentor` +
  `line` props show a **speech bubble** over the speaking twin.
- The twins are the **Dioscuri, twin princes of Sparta**. They play the Harmonic Canon together
  (Harry Partch wrote *Castor and Pollux* for it), so **never draw them apart**. Art:
  `public/assets/training/dioscuri.svg` from `scripts/art/twins.mjs` (a procedural pixel generator;
  edit it and re-run).
- **Voices:** `lib/twins.json` is the single source. Both twins use ElevenLabs voice
  `NNl6r8mD7vthiJatiJt1` (Bradford), made into two people by per-twin `settings` plus a playback
  `rate` (Castor 0.95, steadier; Pollux 1.07, looser). `lib/training-audio.ts` has
  `speakTraining()`, `greetTwin()` and `playTwin()`. Greetings are pre-recorded by
  `node scripts/voice/twins.mjs` into `public/audio/voice/twins-greet-*.mp3`.
- **Server:** `lib/server/training-provider.ts` has `geminiJson(prompt, schema)` for Gemini calls,
  `createTrainingFeedback()` (the twins-persona prompt), `voiceTicket()`/`readVoiceTicket()` (signed
  text for TTS; the browser can never send arbitrary text to ElevenLabs) and `trainingVoice()`.
  Routes live under `app/api/training/*` through `trainingRequest()` in `lib/server/training.ts`.

---

## 3. Paper MCP (you design in Paper before you code)

**Every visual change is designed in Paper first**, then built to match, then the board is opened
for Ralph to review.

- **Server:** the Paper desktop app serves MCP over HTTP at **`http://127.0.0.1:29979/mcp`**
  (`type: http`, no auth header in the current config). It only works while the Paper app is open,
  and your agent must run **on Ralph's Mac**, since a cloud agent can't reach 127.0.0.1. Register it
  in your MCP client as an HTTP/streamable server named `paper`.
- **File:** "Shellhacks" · file id `01M3DRNNWNJ9ZYFPFHF5YF6BJQ` · page **`p-2-0` ("v2 · Redesign")**.
  Don't edit "Page 1" (old v1).
- **First call every session:** `get_guide({ topic: "paper-mcp-instructions" })`, then
  `get_basic_info`. Call `get_font_family_info` before any typography. Post a short design brief in
  chat before creating new designs. Screenshot-review after each section. End with
  `finish_working_on_nodes`.
- **Board layout:** 14 sections stacked vertically. Each section has a 760×180 header frame at
  `left:-860` (kicker "SECTION NN", title, note; clone an existing header such as `EPS-0` rather than
  rebuilding it). Artboards sit in rows from `left:0` with an 80px gap and 120px between rows, 240px
  between sections.
- **Section 14 · Remove Slop** is at `top: 21433`:
  - `S1 · Home · Desktop` (EPW-0), `S2 · Home · Phone` (ES8-0, 1950 wide), `S3 · Combat · Phone` (ET8-0)
  - `S4 · Castor & Pollux · Character Sheet` (F13-0), `S5 · Gems and I · Choose` (F1R-0), `S6 · How to Play` (F3B-0)
  - Put new work to the right of S6 (the next free `left` is about **10140**), or start a row below at
    `top ≈ 22453`. Name artboards `S7 · …`, `S8 · …`.
- **Paper tool tips from experience:**
  - `zoom` works on groups (it scales everything, positions included); the `scale` style is ignored.
  - Local images: `<img src="paper-asset:///absolute/path.svg">`.
  - Prefer `duplicate_nodes` plus `update_styles`/`set_text_content` over rewriting big trees.
  - Tokens: `--color-ink #1B1F3B`, `--color-parchment #FFF6E0`, `--color-sun #FFD23F`,
    `--color-magenta #FF4FA3`, `--color-sky #6EC6FF`; fonts Press Start 2P (display),
    Pixelify Sans (body), Silkscreen (labels, wide tracking).
- **When done, open the board for Ralph** (the link is in the PR too):
  https://app.paper.design/file/01M3DRNNWNJ9ZYFPFHF5YF6BJQ/p-2-0

---

## 4. What's already done on `remove-slop` (25 commits)

Evidence and the baseline are in `docs/pr/remove-slop/` (`before/*.jpg`, `before/results.json`,
`TRACKING.md`). Commit log, oldest first:

- 197c77e chore: add a benchmark and record the baseline
- f925931 fix: lock upgrades mid-fight and before the first win
- 6ef37ab fix: switch pages with the wipe again and drop the iris
- 2e77bd5 fix: clear the training lint errors
- cccf8a3 fix: go home with escape from the gems and i first pages
- a568446 fix: quiet the music and stop the sfx clipping
- 16b3b5a feat: add vercel analytics
- 9ce170e feat: fill every window edge to edge and scale scenes as one
- 8d17396 feat: rebuild the home screen from the s1 and s2 designs
- a47f848 fix: keep map nodes on their clearings at any window shape
- 452db46 feat: give phones the s3 fight layout
- f0e4966 chore: clear the remaining lint warnings
- d01fa74 fix: stretch screen dims across the whole window
- 2378a9a feat: redraw castor and pollux together at the harmonic canon
- de31705 fix: give the twins their own princely voice instead of the bosses
- b6a31d1 feat: coach in the twins' own voices, warm or candid by result
- 55ea027 feat: rebuild gems and i around the twins with speech bubbles and greetings
- ddb6f9a chore: drop the old gems and i stage art
- 5f0dea5 feat: double the boss insults and stop repeats across fights
- 455a454 perf: serve desktop art as full size webp instead of png
- 5b18de3 perf: stop the idle loops on menus, showroom, tavern and results
- e870023 fix: close the tavern stylesheet after the lantern cut
- 5edfbf3 perf: encode the quiet music bed at 80 kbps
- c476167 fix: teach the real rules and damage on how to play
- 9197174 fix: fill the window in the tavern too

**Verified results so far** (interim run, production build, 1512×982 @2x, headless Chromium):

| Metric | Before (b2d4419) | Now |
|---|---|---|
| Desktop download before title | 14.83 MB | 3.29 MB |
| Title idle animations | 39 | 1 |
| Title main thread | 37 ms/s | 17 ms/s |
| Title GPU process CPU | 7% | 2% |
| Credits idle animations / main thread | 9 / 26 ms/s | 0 / 7 ms/s |
| Tavern idle animations | 5 | 0 |

Also verified in the browser: upgrades locked before the first win and mid-fight; dying in act 2
resets to act 1 with base stats; Escape on the Gems and I first page goes home; drag and tap hit
tests line up with the enemy at 1440×900, 852×393 and 1920×1080.

---

## 5. Your tasks, in order

### Task A: design the Gemini Lab screen in Paper (S7, S8)

Ralph's reference screenshots show a first attempt ("GEMINI LAB": student presets on the left,
KEY/BPM/TIME/BARS/DIFFICULTY/STYLE/FOCUS rows with "Analyze first…" hints on the right, GENERATE,
then a card list plus a staff and PLAY). It's cluttered: long rows of repeated grey hint text,
native blue range sliders that break the pixel art, and no twins. Redesign it to live **inside Gems
and I**, in the S5 language:
- The twins stay together at the Canon on the left, and the lab panel sits on the right.
- The twins talk to you in a speech bubble.
- Reached from the S5 "HOW SHALL WE TRAIN?" panel as a third choice: **GEMINI LAB**, tag "COMPOSE".
- Needed artboards: **S7 · Gemini Lab · Compose** (the chat, below), **S8 · Gemini Lab · Cards**
  (the generated piece broken into practice cards, a staff, HEAR IT / PLAY / REVIEW), plus a phone
  version of each at 1950×900.
- Pixel-art controls only: stepped +/− steppers or segmented pills, never native range inputs.
  Keep hints to one line under the control that is focused, not a column of repeats.

### Task B: build the Gemini Lab exactly like the other training modes

First check whether the original lab code exists: `buildCards()`, `analyzeTake()`, a
`hooks/usePerformance.ts` and a GeminiLab screen. **It is not in `b2d4419` or any pushed branch.**
Ask Ralph whether he has it locally. If he doesn't, implement it:
- `lib/lab.ts`: `buildCards(ex)` splits a composed `Exercise` into practice cards (per-bar
  scale/chord/rhythm drills, "bar N slow" at 70% tempo, whole piece at 70%, whole piece at full
  tempo), matching the card list in the screenshot. `analyzeTake(ex, notes, inst)` returns plain-
  language "IN DETAIL" lines.
- The composition route: `POST /api/training/lab/compose` via `geminiJson` with a strict schema,
  validated like `validatePlan()` (monophonic, MIDI 60..84, half-beat grid, key-true, ≤64 notes).
  Fall back to an offline generator when Gemini is unavailable.

Then follow this spec to the letter. The only difference between the Lab and Gems and I training
is where the music comes from; everything the player does with an exercise must reuse
Training.tsx's code paths. **Do not use `hooks/usePerformance.ts`.**

1. **Hear it first:** `previewTraining(card.ex, inst.shift, signal)` from `lib/training-audio.ts`.
   Staff cursor while previewing: `beat = (Date.now() - previewAt - 160) / (60000 / card.ex.tempo)`.
2. **Play and judging:** the same as `perform()` in Training.tsx.
   - A mode select "PLAY AS: Real microphone | Demo practice" (`demo` flag; demo needs no mic).
   - If not demo: `if (!(await mic.start()))`, show "Allow microphone access…".
   - `const downbeat = Date.now() + 250 + countBeats * 60000 / card.ex.tempo`, where
     `countBeats = settings.countIn === 2 ? 2 : 4` and `settings` comes from `lib/audio.ts`.
   - Record the take: `const take = new TavernRecorder(); take.start(demo ? null : mic.mediaStream, toPerfClock(downbeat));`
     with `toPerfClock = (ms) => performance.now() + ms - Date.now()`.
   - `const notes = await performTraining(card.ex, inst.shift, demo, downbeat, signal, frame => …, take);`
     then `const clip = await take.stop();` and keep `clip`.
   - During the take render `<Staff ex={card.ex} beat={frame.beat} results={frame.results} approach … />`,
     the big count-in from `frame.count`, the input meter from `frame.activity` and the live note from
     `frame.pitch`, using the same `.training-sheet` + `.training-count` markup.
3. **Twins feedback and voices:** `POST /api/training/feedback` with
   `{ exercise: card.ex, notes, instrument: run.instrument, final: false }`, which returns
   `{ feedback: { source, castor, pollux }, voiceToken }`. Show it with Training's `Feedback` layout
   **and** the speech bubble (pass `activeMentor` + `line` to `TrainingStage`). Speak with
   `speakTraining({ voiceToken, speaker: 'castor' }, signal)`, then `'pollux'`, and add a REPLAY VOICES
   button. If the call fails, still show the code-based feedback and never block the player.
4. **Walkthrough that stops on mistakes:** the same as Training's review.
   - Misses are notes with status `wrong`/`silent`, or `|onsetOffsetMs| > PERFECT_MS` (`lib/config.ts`).
   - For each miss: `await playTake(clip, Math.max(0, (startBeat - 2) * beatMs), (startBeat + 1) * beatMs, signal, ms => setBeat(ms / beatMs))`,
     where `beatMs = 60000 / card.ex.tempo`.
   - Match "WHERE IT WENT WRONG" (← PREVIOUS · ▶ HEAR IT · NEXT MISS →, one twin card per stop).
   - Demo takes have no recording: show the stop on the staff and the explanation only.
5. **Keep the lab's extras:** the grade letter (S–D), the `analyzeTake()` lines as "IN DETAIL", and
   the follow-up button that jumps to the suggested card (`feedback.next`).
6. **Cleanup exactly like `stopAudio()`:** one `AbortController` per preview, take, voice and playback.
   On card change, a new take or leaving the screen: abort, `stopVoices()`, `mic.endRecording()`,
   `mic.stop()`, `muteMusic(false)`, and stop any `TavernRecorder`.

**Check:** HEAR IT plays with a moving cursor · PLAY judges with circles + PERFECT/EARLY/LATE · demo
works with no mic · the twins speak (or show text with no ElevenLabs key) · the walkthrough replays the
player's own take and stops on each miss · `npx tsc --noEmit` passes.

### Task C: chat with the twins about what song to compose (new feature)

Before generating, the player **talks to the twins about the kind of song they want**, for example:
"something sad and slow in D, lots of dotted rhythms, like a folk song".
- UI (S7): a message box plus send in the lab panel. The replies appear as twin speech bubbles and
  are spoken with the twins' voices (Castor on melody and pitch choices, Pollux on rhythm and tempo).
- Each twin reply ends with a concrete proposal: key, BPM, time, bars, difficulty, style, focus.
  The proposal shows as editable pixel chips with a **COMPOSE IT →** button. The player can keep
  chatting to adjust ("faster", "no accidentals").
- Server: `POST /api/training/lab/chat` with `{ history: [{ from: 'player' | 'castor' | 'pollux', text }], current: settings }`.
  It returns `{ replies: [{ speaker, line }], proposal, voiceTokens }`. Use `geminiJson` with a strict
  schema. **Player text is data, never instructions:** say so in the prompt, cap history length and
  message size (e.g. 12 turns × 280 chars), clamp every proposed value to the allowed ranges
  server-side, and rate-limit like the other training routes (`lib/server/ratelimit`, `voiceBudget`).
- Voice the replies through signed voice tickets (extend `voiceTicket()` to carry an arbitrary
  line + speaker), never raw browser text.
- The twins keep their persona: princes of Sparta, warm (Castor) and playful (Pollux). Keep replies
  to at most 160 characters.

### Task D: finish the remove-slop pass

1. **Slop audit and cleanup.** Delete dead code and CSS: unused keyframes (`pulseGold`, `glow`,
   `rattle`, `rotatePhone` if unused), `Stars`/`FloatingNotes` if unused, `.mobile-surface` rules that
   nothing uses, `scripts/_*.mjs` scratch helpers (gitignored, but delete them), and oversized
   one-line JSX in `Training.tsx` (split it into small components where that makes it readable, with
   no behaviour change). Rewrite `docs/MOBILE.md` for the new model: universal bleed, `<Scene>`/`--cover`,
   rails on every device, stepped motion, and the phone-at-1950×900 rule.
2. **Voice QA:** run one Gems and I exercise in demo mode and confirm `/api/training/voice` returns
   `audio/mpeg` and the bubble shows each twin's line in turn. Confirm the greetings play on entry.
   Ralph interrupted the last attempt, so ask before running anything that spends ElevenLabs credits.
3. **Final benchmark:** `npm run build`, then `npx next start -p 3100`, then
   `node scripts/bench.mjs http://localhost:3100 bench/after`. Save resized JPGs plus `results.json` to
   `docs/pr/remove-slop/after/` (see how `before/` was made with `sips`). Compare every metric honestly;
   if something got worse, say so and fix it or explain why.
4. **Screenshots for the PR:** before/after pairs at 1512×982 and 852×393 for home, combat, Gems and I,
   How to Play, the tavern and the upgrade lock. Include Paper exports of S1–S8.
5. **Update `docs/pr/remove-slop/TRACKING.md`:** tick what's done and fill in the evidence log.

### Task E: open the PR

- `gh pr create --repo GridGxly/SlayTheChoir --base main --head remove-slop --title "remove slop" --body-file docs/pr/remove-slop/PR.md`
- The body is a detailed document modelled on pingdotgg/t3code#4700: a **Why**, then numbered
  **Changes** each with a Before | After table of images, a **Benchmarks** table (the numbers
  above plus the final run), a **Testing** section stating exactly what was verified and what wasn't,
  and the Paper board link. Host images by committing them under `docs/pr/remove-slop/` and linking
  `https://github.com/GridGxly/SlayTheChoir/blob/remove-slop/<path>?raw=true`.
- No AI attribution lines. Then open the Paper board for Ralph.

---

## 6. Useful commands

```bash
npx tsc --noEmit && npx eslint components lib app     # must be clean before each commit
node scripts/optimize-art.mjs                          # after adding or changing art
node scripts/art/twins.mjs                             # regenerate the twins' pixel art
node scripts/voice/twins.mjs                           # re-record greetings (spends ElevenLabs credits)
node scripts/bench.mjs http://localhost:3100 bench/x   # benchmark a production build
```

A dev server usually runs at `http://127.0.0.1:3002`. In development, `window.__stc` is the Zustand
store, so `window.__stc.setState({ screen: 'training', transition: null })` jumps between screens,
which is handy for Playwright screenshots (Playwright + Chromium are installed as dev dependencies).
