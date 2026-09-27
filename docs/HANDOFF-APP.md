# Handoff prompt: Slay the Choir app (paste this into a new session)

> **Archived (2026-09-26).** This is the app handoff from before the tavern, mentor and MongoDB refactors. Parts of it no longer match the code. For example, there is no live leaderboard stream, raw `fights` log or bcrypt for new accounts any more. The current backend state, open items and how to verify it are in [`HANDOFF-BACKEND.md`](HANDOFF-BACKEND.md); rules and data model are in [`PRD.md`](PRD.md) (§7b).

You are picking up **Slay the Choir**, a ShellHacks 2026 game: Slay the Spire style, but every card is a sight-reading exercise the player performs on a real instrument into the mic. It is a Next.js 16.3.6 App Router app (Turbopack) in `/Users/ralph/Documents/Projects/shellhacks`, on branch `project-final-readme`. Read `AGENTS.md` first: this Next.js has breaking changes, and its docs live in `node_modules/next/dist/docs/`. Read them before touching routes, cookies or config.

## Hard rules (from the owner, non-negotiable)
- **Do not commit, push, or merge anything.** Hosting deploys from `main`. All of this work is local and uncommitted on purpose. Only commit if the user explicitly says so in that session.
- Never add Claude co-author or attribution lines to commits or PRs.
- Secrets live only in `.env.local`, which is gitignored via `.env*`. It holds `ELEVENLABS_API_KEY`, and `MONGODB_URI` goes there too. Never print, commit or paste their values.
- Teammates own the note-detection / grading logic (`lib/mic.ts` → `grade()`). Don't rewrite it; integrate with it.
- The user wants craft. Every animation must read as cause → effect (who acted, what it hit, what changed). They have been disappointed by static or awkward motion before, so verify visually before calling anything done.

---

## STEP 1 (do this first): connect MongoDB Atlas

The DB layer is fully written but has never run against a real cluster. Every DB route returns `503 {"error":"Accounts are offline…"}` until `MONGODB_URI` is set, and the game falls back to guest-only mode.

1. **Get a connection string.** The user set up the MongoDB Atlas MCP server after the last session started, so it should be loaded now. Check for tools with ToolSearch `mongodb atlas`.
   - Using the Atlas MCP, list the org/projects/clusters. Use an existing free-tier (M0) cluster if there is one.
   - If there is no cluster, **ask the user** before creating one.
   - You need a database user. Creating credentials is the user's call: ask them to create it in the Atlas UI (Database Access), or confirm before you do it via MCP. Never type a real password into a web form yourself.
   - Network Access: the dev machine's IP (or 0.0.0.0/0 for the hackathon demo, and say that's what you did) must be allowlisted. Vercel needs 0.0.0.0/0 or the Atlas–Vercel integration.
2. Put the SRV string in `.env.local` as `MONGODB_URI=mongodb+srv://…`. Optionally add `MONGODB_DB=slay-the-choir`, which is the default. No `SESSION_SECRET` is needed: sessions are random tokens stored sha256-hashed.
3. Restart the dev server so env is re-read. Note that another `next dev` for this same folder has been running on **http://localhost:58724** (PID was 20510). `preview_start {name:"next-dev"}` refuses to start a second one. Either reuse 58724 with `preview_start {url:"http://localhost:58724"}`, or ask before killing it.
4. Smoke test with curl. Use a throwaway username like `stc_smoke_1` and remove it afterwards:
   ```
   curl -i -c /tmp/stc.jar -X POST localhost:58724/api/auth/signup -H 'Content-Type: application/json' -d '{"username":"stc_smoke_1","password":"test-pass-123"}'
   curl -b /tmp/stc.jar localhost:58724/api/me
   curl -b /tmp/stc.jar -X PUT localhost:58724/api/save -H 'Content-Type: application/json' -d '{"run":{"floor":2,"score":3000}}'
   curl -b /tmp/stc.jar localhost:58724/api/save
   curl -b /tmp/stc.jar -X POST localhost:58724/api/runs -H 'Content-Type: application/json' -d '{"run":{"instrument":"trumpet","floor":3,"score":9000,"hp":12,"xp":120,"stats":{"notesHit":80,"notesTotal":100,"cardsLanded":9,"encoresLanded":1}},"endedBy":"loss"}'
   curl localhost:58724/api/leaderboard
   curl -X POST localhost:58724/api/fights -H 'Content-Type: application/json' -d '{"enemyId":"goblin","won":true,"accuracy":85,"rounds":3,"instrument":"trumpet"}'
   curl localhost:58724/api/fights
   curl -b /tmp/stc.jar localhost:58724/api/profile
   curl -b /tmp/stc.jar -X POST localhost:58724/api/auth/logout
   ```
   Then confirm in Atlas (MCP `find`/`count`, or the UI) that the collections `users`, `sessions`, `saves`, `runs` and `fights` exist, along with the indexes created in `lib/db.ts`: sessions TTL on `expiresAt`, `runs {score:-1}`, `runs {userId:1, at:-1}`, `fights {enemyId:1}`. Delete the smoke-test docs afterwards.
5. **Do not seed fake players or fake scores** to make the leaderboard look busy. It's a real leaderboard; if it needs content, the team plays real runs.
6. Test in the browser: Title → SIGN IN chip (top right) → NEW CLIMBER tab → create an account → toast "Welcome…". Then:
   - Beat a fight: the checkpoint PUTs to `/api/save`.
   - Reload, sign in on a fresh profile: CONTINUE · FLOOR N should appear (cloud save pulled on login).
   - Lose a run: the run posts to `/api/runs`, and the Loss screen says "Posted to the leaderboard as …".
   - LEADERBOARD and PROFILE menu items show real data.

### Then: make MongoDB Atlas genuinely central (prize: "Best Use of MongoDB Atlas")
Already built and real:
- Accounts: bcrypt, httpOnly cookie, hashed session tokens with a TTL index.
- Cloud checkpoints.
- Server-capped scores. `/api/runs` clamps to a max possible score for the floor reached.
- Leaderboard via an aggregation pipeline (best run per player, all-time/week).
- Profile aggregation (totals, deepest floor → bestiary, rank).
- **Per-enemy danger stats**: every fight, guests included, is logged to `fights`, and the map's Next Fight panel shows "41% of 212 climbers fell here · avg 78%" once a foe has at least 3 fights.

Good next steps that fit the game (pick with the user; don't bolt on gimmicks):
- **Live leaderboard via Change Streams**: an SSE route (`/api/leaderboard/live`) that watches `runs` inserts. The leaderboard screen pops a new row in with the existing `countUp` animation when someone finishes a run. Atlas clusters are replica sets, so change streams work on M0.
- **Public profiles**: `/api/profile/[username]` (listed in PRD §7b, not built). Clicking a leaderboard row opens that player's profile.
- **Atlas Search** on usernames for a "find a climber" box on the leaderboard (needs a search index; the MCP can create it).
- `$jsonSchema` validators on `users`/`runs`/`fights` so bad writes fail at the DB.
- Weekly leaderboard: currently filters `at >= now-7d`. PRD mentions a `weekKey`; either is fine.
- Mention Atlas in the Credits screen and the README's tech section.

---

## What exists (map of the code)

### lib/
- `config.ts`: every tunable number.
  - HP, damage, timing window, pass threshold, review duration, tips/XP.
  - `ACT_BONUS_TIPS` 60 and `ACT_BONUS_SCORE` 2500.
  - Taunt knobs.
  - `STATS` (upgradeable stats: maxHp, cardDamage, encoreDamage, timingWindow, passLine).
- `content.ts`: 6 instruments (writtenOffset/shift for transposition), 6 `ACTS`, 18 `ENEMIES` (3 per act; the 3rd is the boss). Voice lines exist only for act 1 (goblin/serpent/choir).
- `music.ts`: note model, `ODE_TO_JOY` (Encore), `makeExercise(type, tempo)` for chord/rhythm/scale cards, key signatures and staff math. Content is in concert B♭.
- `mic.ts`: the `mic` singleton (pitchy, gated) plus `grade()` (teammates own this) and `simulate()` (demo mode). `peek()` gives live readings during recording.
- `audio.ts`: Web Audio engine.
  - File music: Ode to Joy clips for title/encore/final. Chip music: map/battle/boss.
  - Synth SFX, metronome `clickAt`, voices with ducking.
  - `muteMusic(true)` during count-in/recording so nothing leaks into the mic.
- `taunts.ts`, `voice.ts`, `app/api/taunt/route.ts`: ElevenLabs trash talk, driven by heat 0–3 (PRD §7a).
- `store.ts`: Zustand store. It holds screens, overlays, transitions ('wipe'/'iris'), the run, combat and user.
  - `winFight` saves the checkpoint (localStorage `stc.save.v1` + `/api/save` if signed in), logs to `/api/fights`, and adds the act bonus on bosses.
  - `loseRun` / `finishRun` post to `/api/runs` and keep the local best.
- `db.ts`: MongoClient singleton on `globalThis`, index creation, session helpers (`createSession`, `currentUser`, `endSession`), `offline()` / `unauthorized()` responses.

### app/api/
`auth/signup`, `auth/login` (returns the cloud save), `auth/logout`, `me` (200 null for guests), `save` (GET/PUT/DELETE), `runs` (POST), `leaderboard` (GET ?range=all|week), `profile` (GET, self), `fights` (POST/GET), `taunt` (POST).

### components/
- `Game.tsx`: 1440×900 stage scaled to fit (absolutely centered).
  - BootGate ("PRESS ANY KEY" unlocks audio).
  - Global keys: Esc pauses; M opens and closes the map peek; C opens stats.
  - Screen and overlay switch, Toast (checkpoint), Wipe and Iris transitions.
  - Loads saved settings (`stc.settings.v1`).
  - **Dev only**: `window.__stc` is the Zustand store. Jump anywhere with `__stc.setState({run:{...__stc.getState().run, floor:3}}); __stc.getState().go('actclear', null)`.
- `screens/Title.tsx`: **new intro film (A3)**, then the logo slam, then the menu. The film is one 12 fps clock with five beats:
  - A: spire tilt-up while notes are sucked into the choir.
  - B: silence; one grey note shatters.
  - C: a spotlight; Riff is revealed and blows, and a shockwave pushes the notes back out.
  - D: smash cuts of goblin, serpent and choir with impact flashes.
  - E: Riff leaps into a whiteout, and the logo lands.
  - Any key skips. Also here: the menu, and the account chip (sign in/out).
- `screens/ChooseInstrument.tsx`: showroom. Icon crop from `instruments.png` (6 cells × 296 px).
- `screens/MapScreen.tsx`: act nodes, the M3 reveal (X stamp, lock shatter, pin drop, toast), the Next Fight panel (with Atlas danger stats), and the dive into the Versus card with its intro voice.
- `screens/Combat.tsx`: the whole fight state machine:
  - enter: letterbox opens, fighters slide in, FIGHT!/BOSS! slam, cards deal.
  - player: drag a card onto the enemy (reticle and arrow), or press keys 1/2/3; E for the Encore.
  - perform: card flip → sheet unfolds → count-in → recording with live grading (demo mode if no mic) → review stamp.
  - attack: note barrage, impact burst, −dmg pop, card fly-off.
  - enemy: lunge, Riff knockback, red flash, taunt.
  - win: dissolve, defeat voice, victory sting → Victory, or **ActClear** after a boss, or **Final** after floor 18.
  - ko: white silhouettes, red wash, K.O. slam, then Loss via iris.
  - A `busy` ref guards against double performance. Strict Mode double-invoked a state updater once; that is why the side effects are kept outside `setState` updaters.
- `PerformOverlay.tsx`, `Staff.tsx`, `CardView.tsx`: the sheet-music UI.
- `screens/Results.tsx`:
  - Victory: count-ups, confetti, upgrade hint.
  - **ActClear (new)**:
    - ACT N → CLEARED! stamp with shake.
    - Act name typed out.
    - The act's 3 foes drop in as octagon portraits and get stamped X one by one.
    - Rewards count up (act bonus, tips, HP).
    - The spire column: the cleared act fills gold bottom-up, the next act unseals with a lock shatter, and Riff's pin hops up.
    - "CLIMB TO ACT N+1 ▸".
  - **FinalVictory (reworked)**:
    - "THE SPIRE FALLS SILENT." typed.
    - A roll call of all 18 foes in 6 act columns, stamped in climb order with ticks.
    - Whiteout, then "…THEN IT SINGS". The summit lights up, notes and confetti fly, ENCORE LANDED.
    - Final score count-up.
    - Leaderboard rank stamp (fetched from `/api/leaderboard` if signed in).
    - START NEW ADVENTURE / LEADERBOARD.
  - Loss.
- `screens/Social.tsx`: Leaderboard (tabs, rows, "you" highlight, offline and guest states) and Profile (card, bestiary grid, recent runs).
- `overlays/HudOverlays.tsx`:
  - Stats/upgrades (buy with tips, flash and pip pop, deny shake).
  - Pause/settings (volumes, trash talk, metronome, count-in, mic status, quit confirm).
  - Map peek (scroll unroll).
- `overlays/Account.tsx`: sign-in/sign-up modal (validation, error shake, cloud-save merge) and the overwrite-checkpoint confirm.
- `app/icon.svg`: the new pixel-note favicon. The stock `favicon.ico` was moved to the session scratchpad.

### Assets
- `public/audio/music`: Ode to Joy clips.
- `public/audio/sfx`: ElevenLabs SFX.
- `public/audio/voice`: act-1 voice lines.
- `public/assets/bg`: 7 backgrounds.
- `public/assets/sprites`: Riff × 9 poses and 18 enemies.
- `scripts/gen-audio.mjs` regenerates the SFX and voice lines.

### Docs
- `docs/PRD.md` (uncommitted copy with v4 edits): §7b accounts/saves/leaderboard/fights (MongoDB) and §7c 6 acts / 18 enemies. Ready to go to `main` **only when the user says so**.
- `docs/HANDOFF.md`: the Paper design board layout.

---

## Known gaps / next tasks (in rough priority after the DB)
1. **Real mic test with the user.** The in-app browser pane blocks the mic, so every fight so far was verified in demo mode (simulated grading). Have the user open http://localhost:58724 in real Chrome and play a card on their instrument. Watch the HEARING readout and the per-note pips.
2. **Paper board.** The new intro film, Act Clear and Final sequences were built directly in code this round. They are **not yet storyboarded in Paper** (file `01M3DRNNWNJ9ZYFPFHF5YF6BJQ`, § F motion row). If the user wants them on the board, add M7 Intro, M8 Act Clear and M9 Final frames matching the beats above.
3. Only the trumpet has attack/hurt/leap poses. Other instruments reuse their idle sprite for those beats.
4. Boss Encore starts charged, so a pass deals 120 against 150 HP. It recharges after landing all 3 cards if failed. Confirm this is the intended balance (see the PRD open question on boss card damage).
5. During the win beat, the HUD shows HP already restored for about 1 s before leaving combat. `winFight()` runs before the transition; move the HP restore to the Victory mount if it bothers anyone.
6. ESLint (React Compiler rules) flags `Date.now()` in render and functions used before declaration in `Combat.tsx`. The compiler is not enabled, so these are safe at runtime; clean them up if time allows.
7. Enemies beyond act 1 have no intro/KO/defeat voice lines. Extend `scripts/gen-audio.mjs` if wanted (ElevenLabs key is in `.env.local`).

## Verification tips
- `npx tsc --noEmit` should be clean.
- The browser pane's compositor sometimes returns **stale screenshots**. Read the DOM (`document.querySelector('.stage').innerText`), or nudge `resize_window` (1440×900, then 1440×901) before a screenshot.
- To auto-play a fight in demo mode for testing, loop in `javascript_tool`: dispatch `keydown` `'1'` whenever the stage text includes "YOUR TURN".
- Finish by starting or reusing the dev server so the user can see it, and **do not commit**.
