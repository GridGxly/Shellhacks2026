# Slay the Choir — Design & Build Handoff

> **Archived (2026-09-26).** This is the design handoff from before any game logic existed. Parts of it no longer match the code. For example, there is no live leaderboard stream, raw `fights` log or bcrypt for new accounts any more. The current backend state, open items and how to verify it are in [`HANDOFF-BACKEND.md`](HANDOFF-BACKEND.md); rules and data model are in [`PRD.md`](PRD.md) (§7b).

_Last updated: 2026-09-26 · Owner: Ralph · Written for the next chat/agent picking this up_

## 1. What this is
ShellHacks 2026 game. A Slay the Spire 2–style run where every card is a short sight-reading exercise the player performs **on a real instrument into the mic**; pitch detection grades each note (Monkeytype-style feedback). The team PRD ("Sight-Reading Spire") is the source of truth for rules and numbers — ask Ralph for it if it isn't in the repo.

Core rules (from PRD): Title → Choose instrument (treble clef only) → 3-node vertical map (enemy → enemy → boss) → turn-based combat → Victory (heal to full) → map → boss → Final Victory. Player 20 HP. Enemies 90 HP, hit 4/turn, intent shown over head. Hand = 3 cards (Chord, Rhythm, Scale), 30 dmg each, pass at 80%. Fail = card returns with **new music**. One action per round, no End Turn. Boss 120 HP + **ultimate** (8-bar excerpt of the main song, 120 dmg, charged on round 1; if failed, recharges once all 3 cards are passed). Loss → run resets.

## 2. Where everything lives
| Thing | Location |
|---|---|
| Repo | github.com/GridGxly/Shellhacks2026 — Ralph's branch is `ralph-ui` (**note:** the local checkout is currently on `project-final-readme`, switched outside this chat; switch back before committing UI work) |
| Local path | `/Users/ralph/Documents/Projects/shellhacks` |
| Paper file | "Shellhacks" — file id `01M3DRNNWNJ9ZYFPFHF5YF6BJQ` |
| Current design | Paper page **"v2 · Redesign"** (page id `p-2-0`) |
| Old designs | Paper page "Page 1" — v1, **superseded**, keep for reference only |
| Code | Next.js 16 (App Router, TS) in repo root. **All of it is uncommitted.** |

## 3. Paper board layout (v2 · Redesign)
Organized into labelled rows. Each row has a "§" label artboard at x = -860.
- **§ A · Assets (y=-2200):** A1 Cast & Poses · A2 Stages, Logo & BGs · A3 Title Intro Storyboard
- **§ B · Title & Menus (y=0):** 01 Title (menu: BEGIN THE CLIMB) · 01a How to Play · 01b Mic Check · 01c Credits · 02 Choose Instrument
- **§ C · The Climb (y=1200):** 03 Map Node 1 · 03b Riff Stats & Upgrades (click portrait) · 11 Map Node 2
- **§ D · Combat (y=2400):** 04 Your Turn · 04b Pause & Settings (gear) · 04c Map Peek (scroll) · 05 Drag · 06 Count-in · 07 Recording · 07b Note Hit/Miss keyframes · 08a/08b Review · 09a Riff Attacks · 09b Enemy Turn · 09c Trash Talk heat ladder (ElevenLabs, PRD §7a on main)
- **§ E · Boss & Endings (y=3600):** 10 Victory · 12 Boss Encore · 13 Encore · 14 K.O. · 15 Loss · 16 Final Victory
- **§ F · Motion (y=4800):** M1 Card Open · M2 Fight (map→combat) · M3 Proceed (victory→map) · M4 K.O. · M5 HUD overlays (settings/map/stats) · M6 motion spec for every screen
- **§ G · README (y=6100):** header, key art, buttons, feature tiles, architecture, footer (exported to docs/readme/)

Recent system changes: HUD now has a clickable portrait (LV badge + green upgrade pip) and a TIPS counter (currency: +40 per win, spent on upgrades). Round counter is an octagon badge mirroring the mic orb, with 3 LANDED pips. Boss node on the map is a chained super lock until nodes 1–2 are cleared. Cards each get their own z-index so every damage gem shows.

## 4. Cast & naming
- **Riff** — hero. White spiky hair, magenta scarf, black leather jacket w/ gold trim, red high-tops. **Holds whatever instrument the player picked** (trumpet default). Attacks by playing it; notes fly at the enemy.
- **Snare Goblin** (node 1, Drum Hollow), **Brass Serpent** (node 2, Brass Canyon), **The Hollow Choir** (node 3 boss, Choir Nave).
- Ultimate = **ENCORE**. Placeholder song = *Ode to Joy* (public domain; PRD still lists main song as open).

## 5. Screen-by-screen intent (what must be true when coded)
- **01 Title** — logo lockup top, Riff rim-lit on the summit against the moon, Choir + Serpent as huge dark silhouettes behind (10 Second Ninja X idea), centered menu (START CAMPAIGN active with arrow brackets; HOW TO PLAY · MIC CHECK · CREDITS). **Preceded by the A3 intro montage:** Riff vs Goblin (0.0s) → Serpent hits back (1.2s) → Riff answers the Choir (2.4s) → Riff leaps to the summit (3.6s), lands 4.8s, logo slams, menu fades in. Skippable with any key.
- **02 Choose Instrument** — Fortnite-style showroom: spotlit stage, selected instrument floating big in the spotlight, carousel arrows, info card (name, key chip, one-line personality, reads-in, range), Riff on the left "EQUIPPED" holding it, icon strip + big yellow CHOOSE, ESC BACK.
- **03 / 11 Map** — illustrated mountain climb, medallion nodes on the clearings. States: available (yellow + FIGHT pin), locked (silhouette + lock), cleared (grey + red X), boss (larger, pink). "Next fight" panel. **No Riff on the map** (Ralph: it's a level select).
- **04 Combat** — StS layout: slim HUD, fighters on the same floor line, HP bars under feet, intent chip over enemy, 3 fanned cards cropped by bottom edge, instrument/mic orb bottom-left, round counter bottom-right, turn banner.
- **05 Drag** — lifted card, dotted target arrow, yellow corner reticle on enemy.
- **06–07 Perform overlay** — header (card type, key info, target, dmg), per-bar progress track (pips turn green/red, current pip yellow), staff with tempo top-left, pink cursor, played notes green, wrong notes red + dashed **ghost note** of what was played, upcoming notes dimmed; count-in 1-2-3-4; recording row with live accuracy vs 80% pass line + "hearing" pitch.
- **08a/b Review** — HIT!/MISSED stamp, %, accuracy bar, outcome.
- **09a Riff Attacks** — attack pose, notes fly across, impact burst, -30 pop, card shrinks & flies off top-right, enemy HP drops.
- **09b Enemy Turn** — Goblin attack pose, Riff hurt pose, red flash, -4 pop, HP 20→16. **Enemies must visibly fight back.**
- **10 Victory** — no Riff; centered result panel, HP restored bar, stats, note confetti, PROCEED.
- **12–13 Boss** — Hollow Choir, ENCORE round button (glows when charged), two-line 8-bar sheet with bar-progress track.
- **14 K.O. → 15 Loss** — Street-Fighter K.O. beat (fight bars, red wash, huge K.O.), then a stats Loss screen (climb progress, who beat you, CONTINUE → title, run reset). **No lingering fallen body.**
- **16 Final Victory** — Choir silenced, ENCORE LANDED, START NEW ADVENTURE.

## 6. Design system
Tokens are in the Paper file (Tailwind-v4 style names). Key values:
- ink `#1B1F3B` (UI dark `#101126`, panel `#14162E`/`#1E2140`, border `#2A2F55`/`#3A3F70`), parchment `#FFF6E0`, sun `#FFD23F`, magenta `#FF4FA3` (dark `#D1307E`/`#C23A7E`), sky `#6EC6FF`, meadow `#4CC26B`, hp `#E8434F`.
- Card colors: **Chord = magenta**, **Rhythm = gold `#C9901B`**, **Scale = blue `#2F7EC4`**.
- Fonts: Press Start 2P (display), Pixelify Sans (body), Silkscreen (labels), Noto Music (𝄞 ♭ ♩).
- Style rules Ralph cares about: crisp chunky pixels (don't overdetail), backgrounds support rather than shout, strong silhouettes, generous & consistent spacing, characters planted on the ground, playful but not cluttered, real game references (Slay the Spire, Hollow Knight, Goblin Slayer, 10 Second Ninja X, Fortnite select).

## 7. Code status (Next.js, uncommitted)
- `app/layout.tsx` loads the 3 pixel fonts via `next/font`; `app/page.tsx` + `components/KingdomScene.tsx` + `components/StartButton.tsx` implement the **old v1 bright "kingdom" start screen** (animated waterfalls, grass, notes, parallax). This is **outdated** vs v2 and should be replaced.
- `.claude/launch.json` runs `npm run dev` with autoPort (port 3000 was taken by another app).
- Nothing implements game logic yet. Follow the PRD's folder plan: `src/config.ts`, Zustand store, `audio/` (Tone.js clock, Pitchy), `notation/` (abcjs).

## 8. Assets to export from Paper for code
All art is AI-generated raster (transparent PNG sprites) living in Paper. Export via Paper (right-click → export, or `get_fill_image` gives the source URL) into `public/assets/`: Riff (idle, attack, leap, hurt, sax), Goblin (idle, attack), Serpent, Choir, 7 backgrounds, logo, instrument icon strip. Render with `image-rendering: pixelated`.

## 9. Known issues / open questions
- Paper renders a stray gap in Press Start 2P words ("INS TRUMENT", "TRUMPE T") — renderer quirk; fine in browsers.
- Paper MCP limitations: can't create shaders or animations; `scale` style is ignored; rotation origin is top-left.
- Instrument select picks an instrument (not a raw key) so Riff can hold it — confirm with team; PRD's key list is open.
- Loss screen follows Ralph's direction (K.O. then stats), which differs from PRD §3 text — update the PRD.
- Open from PRD: main song, boss-fight card damage (30 vs 90), boss difficulty tuning, onset threshold.
- Hurt/leap/attack poses are single frames; animation in code (squash, knockback, flash) or more frames still needed.

## 10. Suggested next steps
1. Switch to `ralph-ui`, delete v1 KingdomScene, scaffold screens + Zustand store with a fake pass/fail button.
2. Export Paper assets, build 04 Combat + 09a/09b animations first (highest demo value).
3. Build the perform overlay with abcjs + the Paper staff styling.
4. Title intro montage + title screen.
