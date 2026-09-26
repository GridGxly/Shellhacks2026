# Sight-Reading Spire — PRD (ShellHacks 2026)

_Last updated: 2026-09-26 (v3: added enemy trash talk with ElevenLabs, §7a)_
_v2: added boss ultimate ability, loss screen, heal after victory, changing card music_

> **For AI assistants (Claude / Claude Code):** This file is the source of truth for the project.
> - All tunable numbers live in **§9 Config**. Never hard-code them elsewhere; import from `src/config.ts`.
> - Each decision is tagged **[Decided]**, **[Default]** (placeholder, safe to change), or **[Open]** (ask before building).
> - Scope is controlled only by **§12 Phases**. Build MVP items only unless told otherwise.
> - If this doc and the code disagree, ask which one is right before changing either.

---

## 1. Overview

A browser game, inspired by Slay the Spire 2, where every card is a short sight-reading exercise the player performs on their real instrument into the mic. Pitch detection grades each note. A correct performance makes the card hit the enemy. The cards build toward the final boss, where an **ultimate ability** has the player sight-read an excerpt of the actual song the cards were based on.

**MVP goals**
- A full playable run: title → key select → 3-node map → turn-based combat → victory → back to map → final boss.
- Three card types (chord progression, scale, rhythm), graded note by note for pitch and timing.
- New music on cards every round, so the player is always sight-reading, never repeating.
- Final boss with an ultimate ability: sight-read the main song excerpt to deal a big hit.
- Monkeytype-style feedback: a moving cursor, each note marked right or wrong, and a ghost note showing what was actually played.
- Runs in a desktop browser with a laptop mic, for any treble-clef instrument in a supported key.

**Not in MVP**
- Bass clef or other clefs.
- Branching maps, loot, shops, rest sites, deck building.
- True chords (notes played together). Chord cards are a melodic progression, one note at a time.
- AI-generated music, voice commands, accounts, saved progress.
- Voice is used only for enemy trash talk (§7a). No narrator, no AI companion, no voice reading the UI.

---

## 2. User flow

1. **Title screen** — "Start Campaign" button.
2. **Key select** — choose instrument key (see `INSTRUMENT_KEYS`). Treble clef only. [Decided]
3. **Map** — 3 nodes in a vertical line: enemy → enemy → main boss (larger node). Only the next unbeaten node is clickable. [Decided]
4. **Combat** — play cards (and, against the boss, the ultimate) until the enemy or the player reaches 0 HP.
5. **Victory screen** (regular enemies) — "Victory" + "Proceed" button (no loot in MVP). Player **heals to full HP**. [Decided]
6. **Back to map** — beaten node shows an X and is greyed out / unclickable. Next node unlocks. [Decided]
7. **Final victory** (after the boss) — final victory screen + "Start New Adventure" button → title screen with a fresh run. [Decided]
8. **Loss** (player at 0 HP, any fight) — loss screen + "Continue" button → title screen with all run data reset (HP, map progress, key choice). [Decided]

---

## 3. Screens

| Screen | Contents |
|---|---|
| Title | Game title, "Start Campaign" button, background art. |
| Key select | Buttons for each key in `INSTRUMENT_KEYS`, short explanation ("pick the key your instrument reads in"). |
| Map | 3 nodes bottom-to-top with arrows between them. The boss node is larger. States per node: locked, available, beaten (X, greyed). |
| Combat | Player sprite left with HP bar. Enemy sprite right with HP bar and intent number above head (damage it will deal). Hand of cards along the bottom. Round counter bottom-right. Per-level background image [Default: one background per node]. No "End Turn" button. |
| Ultimate button (boss only) | Round button, bottom-left or bottom-right of the combat screen [Default: bottom-left]. Shows charged (clickable) or not charged (dimmed). |
| Recording overlay | Opens over combat when a card or the ultimate is played. Shows tempo (top-left), the staff (abcjs), the cursor, count-in indicator, per-note feedback. The ultimate version is larger and shows multiple lines of music. |
| Review | End of recording: fully marked staff + score (% correct) + "Hit!" or "Missed" for ~`REVIEW_DURATION_MS`, then closes. |
| Victory | "Victory" banner + "Proceed" button. |
| Final victory | Final victory banner + "Start New Adventure" button. |
| Loss | "Loss" banner, fallen player sprite on the left, enemy on the right, "Continue" button. Animation: the player falls and the background turns dark red (StS2-style). [Decided, layout not strict] |

---

## 4. Combat rules

### All fights
- Turn order: **player first, then enemy**, alternating. [Decided]
- **One action per round**: play one card (or, against the boss, the ultimate). That ends the player's turn. [Decided]
- Hand: 3 cards (1 chord, 1 scale, 1 rhythm). No draw pile, no discard pile in the StS sense. [Decided]
- **Pass** → card deals `CARD_DAMAGE` to the enemy, then is removed from the hand for this fight. [Decided]
- **Fail** → card returns to the hand, no damage. [Decided]
- **New music every round**: each card in the hand gets a fresh exercise of its type at the start of each round, drawn from that level's pool. A failed card comes back with different music. [Decided]
- Cards are **based on the main song** (same key, related rhythms and harmony) but are **not copied excerpts** of it. [Decided]
- After the player's turn, the enemy deals its intent damage **unless it died this turn** (StS logic). [Decided]
- Enemy intent (damage number) is shown above its head at all times. [Decided]
- **HP never displays below 0.** Damage that takes HP to 0 or lower kills the target and the bar shows 0. [Decided]
- Order within a round: refresh card music → player acts → grade → apply damage → check enemy death → enemy attacks → check player death → next round.
- Card play input: select a card and drag it toward the enemy; releasing over the enemy opens the recording overlay. [Decided]
- On pass: card shrinks and flies off to the side (StS2-style). On fail: card slides back into the hand. [Decided]
- After winning a fight, the player **heals to full** `PLAYER_HP`. [Decided]

### Regular enemies (nodes 1 and 2)
- `ENEMY_HP` 90, `ENEMY_DAMAGE` 4. All 3 cards must pass to win. [Decided]

### Main boss (node 3) and the ultimate ability
- `BOSS_HP` 120, `BOSS_DAMAGE` 4. [Decided]
- The **ultimate** plays an excerpt of the main song (`ULTIMATE_BARS` bars). If it passes, it deals `ULTIMATE_DAMAGE` (120), which kills the boss instantly. [Decided]
- **Charge rules** [Decided]:
  1. The ultimate starts **charged** in round 1, so the player can try it immediately.
  2. If it fails, it becomes **uncharged** until all 3 cards in the hand have been passed.
  3. Once the hand is empty, the ultimate is **charged every round**, and it's the only action left. The player keeps trying it until it passes or they die.
- Using the ultimate takes the player's turn, so the boss attacks afterward unless it died. [Default — confirm]
- The ultimate uses the same grading as cards, with its own threshold `ULTIMATE_PASS_THRESHOLD`. [Default]

### Balance check at defaults

**Regular enemies** (`PLAYER_HP` 20, `ENEMY_DAMAGE` 4, `ENEMY_HP` 90, `CARD_DAMAGE` 30): the enemy hits after every round except the winning one, and 5 hits kill the player. Winning takes 3 passes, so the player can afford **at most 2 failed attempts** per fight.

**Boss** (`BOSS_HP` 120, `CARD_DAMAGE` 30, `ULTIMATE_DAMAGE` 120):
- Pass the ultimate in round 1 → instant win.
- The 3 cards alone deal only 90, so **the boss can only be finished by the ultimate**.
- If the round-1 ultimate fails, the player needs 3 card passes + 1 ultimate pass. That's 4 rounds where the boss hits (the failed ultimate + 3 cards) = 16 damage, leaving 4 HP. **Any other mistake after a failed first ultimate is fatal.**
- That's very tight. [Open] Consider `BOSS_DAMAGE` 3, a higher `PLAYER_HP` for the boss fight, or letting the ultimate recharge sooner. Recheck whenever these numbers change.

> **[Open] Card damage in the boss fight:** the design notes say boss-fight cards "each do 90 damage." At 90, a single card would take the boss from 120 to 30 and the 3 cards would kill it without the ultimate, which conflicts with "the last thing left is only the ultimate." This PRD assumes **30 (same as regular fights)** until confirmed.

---

## 5. Cards and music content

| Card | What the player plays | Key |
|---|---|---|
| Chord | A chord progression related to the main song, played as a melody / arpeggio, one note at a time | Key of the main song |
| Scale | A scale in the key of the main song | Key of the main song |
| Rhythm | A rhythm related to the main song on a single pitch (e.g. concert F) | Single note |
| Ultimate (boss only) | An excerpt of the main song itself | Key of the main song |

- Each card = `BARS_PER_CARD` bars of music with a tempo. [Decided: 3 bars]
- **Exercise pools**: each level has a pool of exercises per card type, at least `MIN_POOL_SIZE` each, so a card can get new music every round without repeating. [Decided: new music each round; Default: pool size]
- **Main song** — [Open] which song. Default: a simple public-domain melody, so there's no copyright question.
- **Per level** — [Default] one main song for the whole run; tempo rises per node.

**Transposition**
- Music is stored in **concert pitch**.
- The display shows **written pitch** for the chosen instrument: `written = concert + INSTRUMENT_KEYS[key].writtenOffset` semitones.
- Pitch detection hears concert pitch, so grading compares detected pitch to the **concert** notes. The written notes are only for display.

---

## 6. Recording and grading

### Flow
1. Overlay opens and shows the staff and tempo.
2. **Audible count-in**: metronome clicks `COUNT_IN_BEATS` beats (plus a visual "4-3-2-1"). [Decided]
3. Metronome goes silent. Recording and grading run on an **internal clock** only. [Decided]
4. Cursor moves across the staff in time. For the ultimate, the cursor moves to the next line when it reaches the end of one.
5. Recording ends `RECORD_TAIL_MS` after the last note's end.
6. Review screen → pass/fail → combat resolves.

### One clock for everything [Decided]
- Schedule the count-in clicks, the recording start, and beat 1 of the music on the **same Web Audio clock** (`audioContext.currentTime`, via Tone.js Transport).
- `beat = (now - musicStartTime) * tempo / 60`. The cursor position, "what note should be playing now", and grading all read this one value.
- Subtract `INPUT_LATENCY_MS` from detection timestamps before comparing (mic delay). [Default: fixed offset; calibration is Stretch]

### Per-note check (Monkeytype style) [Decided]
Each note is simply **correct** or **wrong**:
- Poll Pitchy every `PITCH_POLL_MS`. Ignore readings with clarity below `MIN_CLARITY`.
- Convert frequency → MIDI: `midi = 12 * log2(freq / 440) + 69`.
- A note is **correct** if both:
  1. **Right pitch**: the detected pitch is within `PITCH_TOLERANCE_CENTS` of the expected concert note for at least `MIN_PITCH_COVERAGE` of the note's readings.
  2. **Right time**: the note's detected onset is within ±`TIMING_WINDOW_MS` of its expected start.
- Otherwise it's **wrong**. Record what was actually heard (most common detected pitch in that window) for the ghost note, or "silent" if nothing was detected.

### Onset detection
- **Pitch changes** (chord, scale, ultimate): onset = when the detected pitch switches to the new note.
- **Same pitch repeated** (rhythm card, and repeated notes in the song): pitch alone can't separate notes. Detect onsets by volume: a dip followed by a rise of at least `ONSET_RMS_RISE`. This is the riskiest part of the project; build it early and test with the real instrument.

### Pass rule [Default]
- Card passes if `% correct notes >= PASS_THRESHOLD`.
- Ultimate passes if `% correct notes >= ULTIMATE_PASS_THRESHOLD`.

---

## 7. Feedback visuals

- **Cursor**: a vertical line that moves across the staff in time with the internal clock. [Decided]
- **Note marking**: each note is marked once the cursor passes it. [Decided]
  - Correct → green note.
  - Wrong → red note + a **ghost note** (faded, same horizontal position) at the pitch actually played.
  - Silent / not detected → grey note, no ghost.
- **Review**: after recording, the fully marked staff and the score stay up for `REVIEW_DURATION_MS`.
- **Enemy intent**: damage number above the enemy's head.
- **Damage**: floating damage number on hit, HP bar animates down, never below 0.
- **Ultimate button**: glows when charged, dimmed when not.
- **Loss**: player sprite falls, background fades to dark red, then the loss screen.
- Implementation: abcjs renders SVG. Recolor notes by changing the fill of their SVG elements. Draw ghost notes as extra SVG note heads positioned from abcjs's note coordinates.

---

## 7a. Enemy trash talk (ElevenLabs)

Enemies hear how you played and heckle you for it. Each line is built from the grading result (`NoteResult[]`) and spoken with an ElevenLabs voice for that enemy. The worse you play, the more they talk and the meaner it gets. It has no effect on combat numbers. [Decided]

**Why it fits:** the final boss is a choir, and enemies are supposed to visibly fight back. Voice turns the grader's facts (wrong note, accuracy, timing) into a character reacting, and the player hears the feedback without looking away from the sheet.

### When enemies talk [Decided]
| Moment | Screen | What they say |
|---|---|---|
| Card missed | Review · Miss | Names your actual mistakes ("That was an E. The chart said G.") |
| Enemy turn | Enemy Turn (during the attack) | Jab based on your last card and your HP |
| Card landed | Review · Hit | Grudging line, **only** at heat 0 or 1 and 1 in 3 times (mostly silent) |
| Fight intro | Versus slam | One fixed intro line per enemy |
| Player K.O. | K.O. | One fixed finisher line per enemy |
| Encore lands | Encore | Boss's last words (fixed) |

**Never while the mic is recording.** Lines only play in review, enemy turn, and transitions, never during count-in or recording, so the speakers can't leak into pitch detection. If a line is still playing when the next recording would start, it is cut. [Decided]

### Heat: bad play means more trash talk [Decided]
A per-fight `heat` value from 0 to 3 picks how much and how mean the enemy talks.

| Heat | Trigger | Lines per turn | Tone |
|---|---|---|---|
| 0 | Last card ≥ 90% | 0–1 | Grudging respect |
| 1 | Last card passed (80–89%) | 1 | Light jab |
| 2 | Last card failed | 1–2 | Roast that names the wrong notes / rushing / dragging |
| 3 | 2+ fails in a row, **or** player HP ≤ `LOW_HP_TAUNT` | 2 | Full roast, calls back earlier mistakes this fight |

- Heat goes up 1 on each fail, down 1 on each pass, and resets to 0 at the start of each fight.
- Taunts reference real data only: the wrong note names (in the player's **written** key), how many notes were missed, early/late, silent notes, HP left, and how many times this card has failed.
- Rating: PG-13, no slurs, no profanity past "damn". Mean about the playing, never about the person. [Decided]

### Voices [Default]
| Enemy | Voice direction |
|---|---|
| Snare Goblin | Raspy, fast, cackling street heckler |
| Brass Serpent | Slow, smug, hissing jazz critic |
| The Hollow Choir | One line spoken by 3 voices at once, slightly detuned and offset, so it sounds like a choir |

### How it works
1. When grading finishes, the client sends `{ enemyId, heat, facts }` to `/api/taunt` (Vercel serverless function; the ElevenLabs API key never reaches the browser).
2. The function picks a line from **per-enemy templates** and fills in the facts (no LLM; fast and always in character). It avoids repeating a template within the same fight.
3. It calls ElevenLabs text-to-speech with that enemy's voice (low-latency model) and streams the audio back.
4. The request starts the moment grading ends, so the review stamp and card animation (~1 s) hide the latency.
5. Fixed lines (intros, K.O. finishers, Encore last words) are generated **at build time** and shipped as audio files.
6. If the request fails or takes longer than `TAUNT_TIMEOUT_MS`, show the subtitle only and keep going. Gameplay never waits on audio. [Decided]

### UI [Decided]
- **Speech bubble** over the enemy's head with the line as subtitles (always shown, even with voice off), plus a small voice waveform while it plays.
- At heat 3 the bubble shakes and the enemy does its attack pose while talking.
- **Settings:** `Voice` volume slider and `Trash talk: Spicy / Mild / Off`. Mild caps heat at 1; Off shows no bubbles.

### Content
- `src/content/taunts.ts`: templates per enemy, per heat, per moment. Aim for 8+ templates per enemy per heat so a run doesn't repeat.
- Template slots: `{wrongNote}`, `{expectedNote}`, `{missCount}`, `{totalNotes}`, `{accuracy}`, `{hp}`, `{failCount}`, `{timing}` (rushed/dragged).

---

## 8. Architecture

### State (Zustand)
```ts
type Screen =
  | 'title' | 'keySelect' | 'map' | 'combat'
  | 'victory' | 'finalVictory' | 'loss';

interface GameState {
  screen: Screen;
  instrumentKey: KeyId | null;
  playerHp: number;            // reset to PLAYER_HP after each victory
  nodes: { id: string; type: 'enemy' | 'boss'; status: 'locked' | 'available' | 'beaten' }[];
  currentNodeId: string | null;
  combat: {
    enemyHp: number;
    enemyMaxHp: number;
    enemyIntent: number;
    round: number;
    hand: { type: CardType; exercise: Exercise }[]; // cards not yet passed; exercise refreshed each round
    ultimate: { enabled: boolean; charged: boolean; failedOnce: boolean } | null; // null for regular enemies
    activeAction: { kind: 'card'; index: number } | { kind: 'ultimate' } | null;
    phase: 'playerTurn' | 'recording' | 'review' | 'enemyTurn' | 'over';
    heat: 0 | 1 | 2 | 3;          // trash-talk level, §7a; resets each fight
    failStreak: number;           // consecutive failed cards, feeds heat
    usedTaunts: string[];         // template ids already spoken this fight
  } | null;
  taunt: { text: string; audioUrl: string | null; heat: number } | null; // current speech bubble
  lastResult: NoteResult[] | null;
  resetRun(): void;            // used by "Continue" (loss) and "Start New Adventure"
}
```

**Ultimate charge logic**
```ts
charged =
  (round === 1 && !failedOnce) ||   // free attempt at the start
  hand.length === 0;                // all cards passed: always available
```

### Music data (source of truth = note list)
```ts
type CardType = 'chord' | 'scale' | 'rhythm';

interface Note {
  midi: number;       // concert pitch
  startBeat: number;  // from beat 0 of the exercise (after count-in)
  durBeats: number;
}
interface Exercise {
  id: string;
  tempo: number;          // BPM
  timeSig: [number, number];
  notes: Note[];
}
interface Level {
  nodeId: string;
  pools: Record<CardType, Exercise[]>; // new exercise drawn per card per round
  ultimate?: Exercise;                  // boss only: main song excerpt
}
interface NoteResult {
  index: number;
  correct: boolean;
  playedMidi: number | null; // null = silent
  onsetOffsetMs: number | null;
}
```
- The ABC string for abcjs is **generated from** the note list (transposed to written pitch), so grading and display can never drift apart.
- Draw exercises without repeating within a fight until the pool runs out.

### Suggested folder layout
```
src/
  config.ts          # all tunable numbers (§9)
  store.ts           # Zustand store
  content/           # levels, exercise pools, main song excerpt (note lists)
    taunts.ts        # trash-talk templates per enemy / heat / moment (§7a)
  voice/
    taunt.ts         # builds facts from NoteResult[], calls /api/taunt, plays audio (ducks + cuts before recording)
api/
  taunt.ts           # Vercel function: template -> ElevenLabs TTS, holds the API key
  audio/
    clock.ts         # Tone.js transport, count-in, shared time
    pitch.ts         # mic + Pitchy polling
    onset.ts         # onset detection (pitch change + volume)
    grade.ts         # per-note correct/wrong
  notation/
    toAbc.ts         # note list -> ABC string (with transposition)
    Staff.tsx        # abcjs render, cursor, note coloring, ghost notes
  screens/           # Title, KeySelect, Map, Combat, Victory, FinalVictory, Loss
  components/        # Card, HpBar, Sprite, UltimateButton, RecordingOverlay, Review
  styles/palette.css # single palette file, retro CSS
```

---

## 9. Config (all tunable numbers)

Put these in `src/config.ts`. Change numbers **here only**.

| Name | Default | Notes |
|---|---|---|
| `PLAYER_HP` | 20 | [Decided] heals to full after each victory |
| `ENEMY_HP` | 90 | [Decided] regular enemies |
| `ENEMY_DAMAGE` | 4 | [Decided] |
| `BOSS_HP` | 120 | [Decided] |
| `BOSS_DAMAGE` | 4 | [Decided] see balance warning in §4 |
| `CARD_DAMAGE` | 30 | [Decided] for regular fights; [Open] for boss fight (notes say 90) |
| `ULTIMATE_DAMAGE` | 120 | [Decided] |
| `ULTIMATE_BARS` | 8 | [Default] length of the song excerpt |
| `HAND_SIZE` | 3 | [Decided] |
| `BARS_PER_CARD` | 3 | [Decided] |
| `MIN_POOL_SIZE` | 5 | [Default] exercises per card type per level |
| `COUNT_IN_BEATS` | 4 | [Decided] |
| `DEFAULT_TEMPO_BPM` | 80 | [Default] per exercise can override |
| `PITCH_POLL_MS` | 25 | [Default] |
| `MIN_CLARITY` | 0.9 | [Default] Pitchy clarity cutoff |
| `PITCH_TOLERANCE_CENTS` | 50 | [Default] half a semitone |
| `MIN_PITCH_COVERAGE` | 0.6 | [Default] share of a note's readings that must be right |
| `TIMING_WINDOW_MS` | 150 | [Default] ± allowed onset error |
| `ONSET_RMS_RISE` | tune by testing | [Open] volume jump that counts as a new note |
| `INPUT_LATENCY_MS` | 80 | [Default] fixed mic delay offset |
| `RECORD_TAIL_MS` | 300 | [Default] |
| `PASS_THRESHOLD` | 0.8 | [Default] share of notes correct to pass a card |
| `ULTIMATE_PASS_THRESHOLD` | 0.8 | [Default] |
| `REVIEW_DURATION_MS` | 1500 | [Default] |
| `INSTRUMENT_KEYS` | C (0), B♭ (+2), E♭ (+9), F (+7) | [Open] which to offer; value = `writtenOffset` in semitones |
| `TAUNT_TIMEOUT_MS` | 1200 | [Default] past this, show subtitle only |
| `TAUNT_MAX_SECONDS` | 3 | [Default] max length of one spoken line |
| `LOW_HP_TAUNT` | 8 | [Default] player HP at or below this forces heat 3 |
| `TAUNT_ON_HIT_CHANCE` | 0.33 | [Default] chance an enemy talks after you land a card |
| `VOICE_DUCK_DB` | -12 | [Default] music volume while an enemy talks |

---

## 10. Tech stack (suggested)

| Layer | Choice | Status | Why | If we swap it |
|---|---|---|---|---|
| Framework | React + Vite | [Default] | Screens map to components; fast setup | Plain JS: rewrite screens + manual screen switching |
| Language | TypeScript | [Default] | Types for card/note data catch mistakes | JS is fine; drop the types |
| State | Zustand | [Decided] | One small store every screen reads, no prop passing | Any store; only `store.ts` changes |
| Notation | abcjs | [Decided] | Renders SVG (easy recoloring), has timing callbacks, handles multi-line music for the ultimate | VexFlow: rewrite `notation/` only |
| Pitch detection | Pitchy + Web Audio | [Decided] | Friend already using it; monophonic fits single-note instruments | — |
| Audio timing | Tone.js | [Decided] | Precise scheduling of count-in and shared clock | Raw Web Audio scheduling; `audio/clock.ts` only |
| Styling | Plain retro CSS, single palette file, pixel fonts | [Decided] | Fast, consistent look | — |
| Animation | CSS transitions (Framer Motion if needed) | [Default] | Card drag, shrink, fly-off, loss fall + red fade | — |
| Hosting | Vercel | [Decided] | Static site; free HTTPS (required for mic access) | Netlify works the same |
| Backend | One Vercel function (`api/taunt.ts`) | [Decided] | Keeps the ElevenLabs key off the client; everything else runs in the browser | Any serverless host |
| Voice | ElevenLabs text-to-speech | [Decided] | Enemy trash talk (§7a); designed voice per enemy | Subtitles only (feature still works) |

---

## 11. Build order (suggested)

1. **Audio spike first** (riskiest): mic → Pitchy → print detected notes. Then count-in + shared clock + per-note grading on a hard-coded exercise. Test on the real instrument.
2. Rhythm-card onset detection by volume.
3. Staff rendering with abcjs from the note list, cursor, note coloring, ghost notes. Then multi-line rendering for the ultimate.
4. Zustand store + combat rules, including ultimate charge logic, heal after victory, and run reset (test with a fake "pass/fail" button before audio is wired in).
5. Screens: title, key select, map, combat, victory, final victory, loss.
6. Content: main song excerpt + exercise pools per level.
7. Card drag + animations, ultimate button, loss animation, sprites, backgrounds.
8. Tune §9 numbers by playtesting, especially the boss fight.

---

## 12. Phases

**MVP**
- Everything in §2–§7 marked [Decided] or [Default].
- Fixed latency offset, hand-written exercise pools and one main song.

**Prize track (ElevenLabs), after MVP combat works**
- Enemy trash talk per §7a: speech bubble + subtitles first, then `/api/taunt` with live TTS, then build-time fixed lines, then the 3-voice Choir.

**Stretch**
- Latency calibration (tap along to clicks).
- Live pitch indicator (how sharp/flat right now).
- Per-note early/late timing ticks.
- Different background per node, more enemy sprites.
- Loot screen after victories.

**Later (AI)**
- Gemini: generate songs and exercise pools so every run is new.
- ElevenLabs beyond trash talk: spoken boss count-ins.

---

## 13. Open questions

- [ ] Boss-fight card damage: 30 (assumed) or 90 (as written in the notes)? See §4.
- [ ] Boss fight is very tight if the first ultimate fails (no further mistakes allowed). Keep, or lower `BOSS_DAMAGE` / raise HP?
- [ ] Does using the ultimate take the player's turn (boss attacks after)? Assumed yes.
- [ ] Which main song?
- [ ] Which instrument keys to offer?
- [ ] `ONSET_RMS_RISE` value — needs testing with a real instrument.
- [ ] Trash talk: which ElevenLabs voices per enemy, and who writes the taunt templates?

## 14. Risks

- **Rhythm-card onsets** (same pitch repeated) are the hardest to detect reliably. Mitigation: build first; if unreliable, loosen `TIMING_WINDOW_MS` or grade that card on pitch + note count.
- **Content volume**: new music every round needs several exercises per card type per level. Mitigation: keep exercises short (3 bars); write them as note lists; AI generation is the later fix.
- **Mic latency varies by device.** Mitigation: fixed offset now, calibration as Stretch.
- **Room noise / quiet instruments.** Mitigation: `MIN_CLARITY` cutoff; test in a noisy room before demo.
- **Enemy voice leaking into the mic.** Mitigation: never play voice during count-in or recording; cut any line still playing when recording starts.
- **TTS latency or quota on demo day.** Mitigation: start the request as soon as grading ends, `TAUNT_TIMEOUT_MS` fallback to subtitles, fixed lines pre-generated.
