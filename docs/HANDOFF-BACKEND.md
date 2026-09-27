# Handoff: backend follow-ups for Slay the Choir

_Updated 2026-09-26. Repo: `GridGxly/Shellhacks2026`. Feature specs: `tavern.md` and `mentor.md` (ask Tarun for them). Rules and data model: [`PRD.md`](PRD.md) §7b. Phone and performance rules: [`MOBILE.md`](MOBILE.md) §12._

## Where things stand
- **`main`** (`b2d4419`) has the tavern/mentor/MongoDB refactor (PR #11) and the mobile work (PR #10).
- **Branch `fix/review-followups`** (from `main`) holds a review-and-performance pass. It is **uncommitted** and **not pushed**; nothing below it is on `main` yet.
- **Verified on the branch:**
  - `npx next typegen && npx tsc --noEmit` is clean.
  - `npx eslint` shows 0 errors; the one warning is the title `<img>`.
  - `next build` succeeds.
  - Smoke test against the production build with no database: 17/17 checks pass. It covered the pages, security headers, WebP art, the new and removed routes, and the tavern binary upload (valid, truncated, oversized, JSON, wrong type, cross-origin).
- **Not verified:** nothing has run against a real MongoDB yet. Every database path on the branch is typechecked but unexercised. Run the checklist under "First steps" before judging.

## What the branch changes

### Game rules
- **Death is final.** A loss ends the climb and resets the player to default stats and starting tips; the only button is **NEW RUN** (`lib/store.ts` `loseRun`, `components/screens/Results.tsx` `Loss`).
  - The Defeat screen still shows the fallen climb (`fallen` in the store).
  - A finished climb's checkpoint can't come back. The browser keeps ended run ids (`stc.ended.v1`). The server refuses a `PUT /api/save` for a run already posted, and `GET /api/save` and login drop such a save (`lib/server/saves.ts`).
- Tips can't be spent during combat; that is by design. Tavern and training rewards are added to a new run at its start.

### Tavern
- **One deadline for a finished show.** Once a show reaches results, the room and both recordings share a single deadline (10 min), and polls no longer extend it (`expireTogether` in `lib/server/tavern.ts`). When it passes, polls get 404 and both players are sent home, so nobody reaches an expired clip.
- **Takes upload as raw bytes**, not base64 JSON. The format is a 4-byte big-endian JSON length, the JSON result, then the clip (`takeBody` in `lib/tavern.ts`, `readResult` on the server). Plain JSON is still accepted for takes without audio.
- **Your own take plays from memory**; only the partner's clip is downloaded.

### Training (mentor)
- Recordings and the cached review are cleared whenever the plan changes, so a new set never replays the old set's misses.
- The screen no longer re-renders at 60 fps while you play (see "Performance").

### Leaderboard
- **Reads come from `bests`**, one document per player all-time (`all:<userId>`) and per week (`<weekKey>:<userId>`). The board and your rank are index reads, not sorts over every run.
  - `recordBest()` updates it inside the `/api/runs` transaction.
  - A later run replaces a best only by scoring strictly higher.
- **`GET /api/leaderboard`** is public and the same for everyone, cached ~10 s at the CDN. **`GET /api/leaderboard/me`** is the private rank, used by the leaderboard and the final-victory screen.
- **The SSE route `/api/leaderboard/live` is removed.** The board polls every 30 s while visible.
- `/api/players` (find-a-climber) reads each hit's best from `bests`.

### Other database work
- **`fightStats`**: `/api/fights` keeps running totals per enemy instead of logging every fight. GET reads 18 small documents and is CDN-cached for 5 min. The old `fights` collection is no longer read or written.
- **One-time schema setup** (`lib/server/schema.ts`): indexes are only created when `lib/mongo-indexes.json` changes. A cold start costs one read of `meta/schema`. The same step backfills `bests` from existing runs, keeping the higher score if both exist.
- **`currentUser()`** looks up the session and the user in one aggregate.
- **Redundant reads removed:**
  - Training writes no longer re-read the user and weaknesses.
  - The training review reads only the stored row.
  - Run submission does one duplicate check.
  - The mentor file's best score and recent climbs are folded into its single `$facet`.
- **Checkpoint saves** are debounced (1.2 s), sent one at a time, and flushed if the tab closes (`syncSave` in `lib/store.ts`).

### Voice (ElevenLabs)
- Every line is cached by voice, settings and text: in memory (64 per instance) and in `ttsCache` (TTL 30 days), via `lib/server/tts.ts`.
- A repeated taunt, review stop or offline coaching line costs no ElevenLabs call and no voice budget. Only a new line spends it.

### Auth and security
- **Passwords use scrypt** (N=2^15, off the main thread, ~100 ms) in `lib/server/password.ts`. Old bcrypt accounts still sign in and are rehashed on their next login.
- **Security headers** are set in `next.config.ts`: frame-ancestors/`X-Frame-Options`, `nosniff`, referrer policy, and a permissions policy that allows the mic for this site only.
- **No full Content-Security-Policy, on purpose.** Inline styles, blob audio and Next's inline bootstrap would all need allowances, and a mistake breaks the game.
- **IP trust is unchanged.** On Vercel `clientIp` already trusts only `x-vercel-forwarded-for`. Restricting it off Vercel risks putting every player in one rate-limit group.

### Performance (details in MOBILE.md §12)
- **Art:** desktop gets full-size WebP (`d/`) instead of PNG. 43.8 MB becomes 16 MB; `tavern` goes from 2.4 MB to 59 KB.
  - Sprites and the logo are lossless; backgrounds are lossy q92.
  - The title silhouettes are pre-darkened.
  - Re-run `node scripts/optimize-art.mjs` after changing art; it only re-encodes what changed.
- **Training:** grading runs every 66 ms, and only the live sheet redraws each frame.
- **Combat:** the scene no longer re-renders on each detected pitch; the mic meter and note readout subscribe themselves via `useHearing`.
- **Staff:** the engraving layout is memoised.
- **Clocks:** Tavern runs one timer instead of two. The Training idle clock waits for the day rollover. The act-clear and victory clocks stop at their last cue. PitchLab and the mic check update ~15 times a second.

### Cleanup
- Removed the unused `createHash` import in `lib/server/tavern.ts` and the `_owner` variable in `lib/store.ts`.
- Renamed an unused parameter in `components/Staff.tsx`.
- Fixed the three React Compiler purity errors in `Training.tsx` with a `wallClock()` helper.

## First steps for whoever picks this up
1. **Environment.** Put the variables in `.env.local` (gitignored) or the Vercel project settings:
   - `MONGODB_URI=mongodb+srv://…` for a MongoDB Atlas M0 (free) cluster.
   - `GEMINI_API_KEY` is optional. Setting it is all Gemini needs: plans and coaching then try Gemini first and fall back to the offline versions on any failure. `GEMINI_MODEL` defaults to `gemini-3.8-flash`.
   - `ELEVENLABS_API_KEY` is optional. `ELEVENLABS_CASTOR_VOICE_ID` and `ELEVENLABS_POLLUX_VOICE_ID` override the mentor voices.
2. **Run `node --env-file=.env.local scripts/atlas-setup.mjs`.** It sets up:
   - the username search index;
   - validators, now including `fightStats`; this step needs a dbAdmin user, so set `MONGODB_ADMIN_URI` if the app's user lacks it;
   - all indexes.

   The app's own first connection also applies the indexes and backfills `bests`.
3. **Smoke test with the database.**
   - **Accounts:**
     - Sign up with a new account; check that its `passwordHash` starts with `scrypt$`.
     - Log in with an account created before the branch; its hash should be rewritten to `scrypt$`.
   - **Climbs:**
     - Win a fight: the checkpoint saves (one PUT, a moment later).
     - Lose: you land on Defeat with default stats. Reloading must not offer **Continue**.
     - Check that `runs`, `bests` (`all:` and week rows) and `/api/leaderboard` + `/me` agree.
   - **Tavern:**
     - Play a duet in two browsers: host, join, start, play, combined playback, verdict.
     - The partner clip loads; your own plays locally.
     - After 10 minutes on results, both players are sent home.
   - **Training:** a full day (plan, 4 exercises, review, claim). Then start a second set and check its recordings don't replay the first set's.
   - **Taunts:** trigger the same taunt twice. The second should come from `ttsCache` (no new ElevenLabs request).
   - **Bestiary:** the map's danger stats fill in from `fightStats`.
   - **Mentor file:** `GET /api/training/profile` returns it.
4. **Commit the branch** when the checklist passes. The new WebP folders under `public/assets/**/d/` and the silhouettes are part of it.

## Open items
Ordered by value. Each gives the file, the problem, and a suggested fix.

1. **Gemini feedback gets wrong pitch data** (`lib/server/training-provider.ts` `createTrainingFeedback`).
   - `expected` is written concert pitch, while `played` comes from `grade()` already shifted for the instrument (`lib/mic.ts`). On clarinet, trumpet, saxes and horn every note looks off by the transposition.
   - The final-set call passes all four exercises' notes with only the final exercise's music, so the per-note arrays don't line up (`lib/server/training.ts` feedback and `guestFacts`).
   - **Fix:** send `expected` as `midi + shift`, or just per-note hit/wrong. For the final set, send per-exercise summaries. The comment at `lib/mic.ts:160` ("concert") is also wrong.
2. **Gemini reliability.** `geminiJson` sets no `thinking_level` and has an 8 s timeout, so plans can time out often. Every failure falls back silently with no logging.
   - **Fix:** use `generation_config.thinking_level: 'low'` for plans and `'minimal'` for feedback, and log the fallback reason. Also check once with a real key that `additionalProperties` in the schemas is accepted.
3. **The mentor screen isn't wired.** Nothing calls `/api/training/profile`, and plans only use `weaknesses`. The spec says recommended plans use `weaknesses` and `climbs`, and custom plans use `recent.bySource`.
4. **Tavern polling cost** (left as is on purpose). Each poll is about 3–4 database ops: two rate-limit writes in `guarded()`, the room read, and a heartbeat every 2 s. At 0.7 s per player that's fine for judging demos (2 players per room), but about 20 simultaneous shows would pass M0's ~100 ops/s.
   - **Fix if it's ever needed:** count poll rate limits in memory, and poll at 1.5 s outside the countdown and results phases. Don't pause polls on hidden tabs: that trips `partnerStale` after 8 s.
5. **Checkpoint races across tabs.** Saves are now serialized per tab, and posted runs can't be revived, but two tabs on the same account can still overwrite each other.
   - **Fix:** send a revision with each save and update only when newer.
6. **Claimed buffs can be lost on refresh.** `/api/rewards/claim` clears `tavernBuff`/`trainingBuff`, but the bonus tips live only in the in-memory run until the first checkpoint.
   - **Fix:** write the initial checkpoint in the claim transaction, or right after a successful claim.
7. **Adventure practice data dropped on failure.** `reportAdventurePerformance` (`lib/client-performance.ts`) returns `false` on a timeout or 5xx, and `Combat.tsx` ignores it.
   - **Fix:** keep a small per-account retry queue; the endpoint is already idempotent by `attemptId`.
8. **Mid-fight reload.** The checkpoint is taken before each fight, so closing the tab mid-fight lets a player retry that fight. That matches PRD §7b ("the fight restarts"); change it only if death should also cover abandoning.
9. **Mentor climb totals still read a player's whole history** (`lib/server/mentor.ts`, one `$facet`). Fine at hackathon scale; if histories grow, keep per-user totals on the user document.
10. **Leftover data and indexes on live clusters.** Nothing drops these automatically:
    - the `fights` collection and its `{ enemyId: 1 }` index;
    - the `runs` indexes `{ score: -1 }`, `{ score: -1, at: 1, userId: 1 }`, `{ weekKey: 1, score: -1[, at: 1, userId: 1] }` and `{ userId: 1, score: -1 }`.

    They're harmless; drop them when convenient. `fightStats` starts from zero, because old fights aren't converted.
11. **Remove leftovers** (check with the owners first):
    - `legacy/`;
    - `scripts/validate.mjs`, `scripts/shot.mjs`, `README-pitch-detection.md` and `scripts/page-live.png` (**pitch team**);
    - the unused `tone` dependency (`npm uninstall tone`).
12. **Docs.** PRD §4 and §9 balance numbers don't match `lib/config.ts`, and the PRD has no tavern or mentor sections. §7b now matches the code. `HANDOFF.md` and `HANDOFF-APP.md` are marked archived.
13. **Smaller hardening:**
    - The `lib/training-core.ts` validators check `String(v.mode)` etc. but return the raw value; use real `typeof` checks.
    - `readJSON<T>` in `lib/store.ts` trusts localStorage shapes.
    - The looping `pulseGold`/`hitFlash` CSS animations were left as is: they're small and stepped, and moving the glow to a pseudo-element would clip it in the HUD avatar.

## Environment notes (WSL)
- **Node:** use Node 22 (`nvm use 22`); the system Node is v10. Install and run npm **from WSL**, not Windows (native binaries differ, including `sharp` for the art script).
- **Install and build:**
  - `npm ci` takes about 6 minutes on `/mnt/c`; `next build` takes several minutes too.
  - Run `npx next typegen` before `npx tsc --noEmit`, or the route types are missing or stale.
- **Checks:** there's no CI. Typecheck, eslint and a production build are the gates.
- **Scripts:**
  - `scripts/test-review.mts` needs `tsx`, which isn't installed.
  - Node 22 can run plain `.ts` modules without `@/` imports via `node --experimental-strip-types`.
- **Local servers:** when starting a server for testing, cap it with `timeout` and stop it by port (`ss -ltnp`). A `pkill -f`/`pgrep -f` pattern can match its own shell and hang or kill it.
- **`AGENTS.md`:** `next dev` rewrites it; that's expected (see the file).
