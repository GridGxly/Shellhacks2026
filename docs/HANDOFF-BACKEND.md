# Handoff: backend follow-ups for Slay the Choir

_Updated 2026-09-26. Repo: `GridGxly/Shellhacks2026`. Feature specs: `tavern.md` and `mentor.md` (ask Tarun for them)._

## Where things stand
- **Branch `feat/tavern-mentor-mongo`** (from `main` @ `3f9ad8a`) is **not committed or pushed yet**. It contains:
  - **Tavern:** recorded clips moved out of the room document into a `tavernTakes` collection (binary, expires on its own). Polls now write a heartbeat at most every 2 s (`TAVERN_HEARTBEAT_MS`), with a condition so a poll can't undo a finished show's expiry. The unused `/api/tavern/buff` endpoint was removed.
  - **Mentor ("Gems and I"):** `GET /api/training/profile` returns the player file (`lib/server/mentor.ts`, type `MentorProfile` in `lib/training-types.ts`). Training days get a permanent `completedAt`, so the streak survives ending or replacing a set.
  - **MongoDB:**
    - All indexes live in **`lib/mongo-indexes.json`**. Both `lib/db.ts` (on first connect) and `scripts/atlas-setup.mjs` read it; edit indexes only there.
    - The setup script also adds database-level validation for `tavernRooms` and `tavernTakes`.
    - `performanceEvents` now expires after 180 days.
  - **Fixes:**
    - Score verification rejects actions after the enemy must already be dead (`lib/score.ts`).
    - The pending-run queue is per account (`lib/store.ts`, `stc.pending.v2`).
    - Login applies a per-IP limit before bcrypt.
    - Reward claims with no buffs no longer write a receipt.
  - **Cleanup:** shared `lib/validation.ts` and `lib/server/hash.ts`; tunables moved to `lib/config.ts` (`SESSION_DAYS`, `LEADERBOARD_SIZE`, `TRAINING_BUFF_TIPS`, `TAVERN_HEARTBEAT_MS`, `MENTOR_*`).
- **Verified:** `npx next typegen && npx tsc --noEmit` is clean, and the score-verification cases pass.
- **Not verified:** nothing has run against a real MongoDB yet (no cluster).
- **Out of scope for this work:**
  - The Gemini prompts and logic.
  - The mentor-UI "offline practice" fallback (a teammate is removing it).
  - UI changes such as character instruments.
  - Pitch detection (`lib/mic.ts`, `lib/pitch/**`).

## First steps for whoever picks this up
1. Get a MongoDB Atlas **M0 (free)** cluster, and put `MONGODB_URI=mongodb+srv://…` in `.env.local` (gitignored). `ELEVENLABS_API_KEY` and `GEMINI_API_KEY` are optional.
2. Run `node --env-file=.env.local scripts/atlas-setup.mjs`. It sets up the username search index, the validators and all indexes. The validator step needs a dbAdmin user; if the app's user lacks it, set `MONGODB_ADMIN_URI`.
3. Smoke test:
   - sign up / log in,
   - a climb (the checkpoint saves; losing posts the run),
   - a tavern duet in two browsers (host, join, start, play, combined playback, verdict),
   - a training day (plan, 4 exercises, claim),
   - `GET /api/training/profile`.
4. **Hook up the mentor screen:** nothing calls `/api/training/profile` yet. The Gemini side should read `MentorProfile`. The spec says recommended plans use `weaknesses` and `climbs`, and custom plans use `recent.bySource`.

## Open items (found in the audit, not fixed)
Ordered by value. Each item gives the file, the problem, and a suggested fix.

1. **Live leaderboard: one MongoDB change stream per viewer.** `app/api/leaderboard/live/route.ts:50` opens `runs.watch(...)` for every connected browser; reconnects open another. On M0's shared resources this grows with the number of viewers.
   - **Fix:** share one change stream per server process and fan events out to connected clients, or replace it with a cached `/api/leaderboard` poll every few seconds.
2. **Checkpoint save races.** `lib/store.ts:202` (`syncSave`) and `app/api/save/route.ts` do unconditional upserts and deletes. A delayed old PUT can bring back a finished run's save after it was deleted, and a delayed DELETE can wipe a newer climb. HTTP failures are ignored.
   - **Fix:** send the run id (and a revision) with each save. Server side, only update when the stored `run.id` matches or the incoming save is newer, and only delete `{ _id: user, 'run.id': runId }`. Client side, serialize save calls.
3. **Claimed buffs can be lost on refresh.** `lib/store.ts:316` calls `/api/rewards/claim`, which clears `tavernBuff`/`trainingBuff`, but the bonus tips only live in the in-memory run until the first checkpoint. A refresh before then loses them.
   - **Fix:** have the claim route also write the initial rewarded save (`saves` collection) in the same transaction, or have the client write the checkpoint right after a successful claim.
4. **Adventure practice data dropped on failure.** `lib/client-performance.ts:22` (`reportAdventurePerformance`, called from `components/screens/Combat.tsx:281`) returns `false` on a timeout or 5xx, and the caller ignores it, so the mentor file silently misses that attempt.
   - **Fix:** keep a small per-account retry queue in localStorage (the endpoint is already idempotent by `attemptId`), flushed on the next success or sign-in.
5. **`fights` grows forever and the danger stats scan all of it.** `app/api/fights/route.ts` runs its aggregation over every fight document; the `{ enemyId: 1 }` index doesn't help sums or averages.
   - **Fix:** keep per-enemy counters (`$inc` attempts, losses and accuracy sums on a `fightStats` doc per enemy), plus an optional TTL on raw fights.
6. **Mentor climb totals read a player's whole history.** `lib/server/mentor.ts` (a `$facet` over all of the user's runs). Fine at hackathon scale.
   - **Fix, if histories get large:** keep per-user totals and instrument counts on the user doc, updated in `/api/runs`.
7. **Old leaderboard indexes still exist on live clusters.** The manifest replaced `runs { score: -1 }` and `runs { weekKey: 1, score: -1 }` with longer versions that match the full sort. Existing clusters keep the old ones until someone drops them. They're harmless, just unused space.
8. **Remove leftovers** (check with the owners first):
   - `legacy/` (the old Vite app, excluded from build and typecheck).
   - `scripts/validate.mjs`, `scripts/shot.mjs`, `README-pitch-detection.md`, and the tracked `scripts/page-live.png` (old pitch tooling that points at removed paths). **Pitch team.**
   - The `tone` dependency in `package.json`: nothing imports it. Run `npm uninstall tone`.
9. **Docs out of date.** `docs/PRD.md` §4 and §9 balance numbers (HP, damage, coverage, review time) don't match `lib/config.ts`. The PRD has no tavern or mentor sections. `docs/HANDOFF.md` and `docs/HANDOFF-APP.md` are historical. Update the PRD from the specs and mark the handoffs as archived.
10. **Smaller hardening:**
    - `lib/training-core.ts` validators check `String(v.mode)` etc. but return the raw value (for example, an array passes the check); use real `typeof` checks.
    - `readJSON<T>` in `lib/store.ts` trusts localStorage shapes.

## Environment notes (WSL)
- Use **Node 22** (`nvm use 22`); the system Node is v10. Install and run npm **from WSL**, not Windows (native binaries differ).
- `npm ci` takes about 6 minutes on `/mnt/c`, so give it time. Run `npx next typegen` before `npx tsc --noEmit`, or the `LayoutProps` types are missing.
- ESLint is slow here and there's no CI. The typecheck is the useful gate; lint shows 12 existing React Compiler warnings on main.
- `next dev` rewrites `AGENTS.md`; that's expected (see the file).
