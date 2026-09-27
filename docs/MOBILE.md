# Handheld standards

How Slay the Choir plays on phones and tablets, and the rules every new screen follows.

Desktop screens are designed at 1440×900. Phone screens that need their own layout (home, combat, Gemini Lab) are designed in Paper at 1950×900 stage px, which is 852×393 landscape at 2.29×. `components/Game.tsx` still scales one 1440×900 stage to the glass; the extra phone width in Paper is how we compose a landscape layout before it is implemented with rails, bleed, and `Scene` cover. Section 13 (P1) and Section 14 (S2, S3, S7/S8 phone) on page v2 are the boards for this.

## The model: one stage, controls on rails

Every implemented screen lives on a 1440×900 stage. `components/Game.tsx` scales that stage uniformly to fit the glass. On a handheld the art frame keeps its composition, and three things change around it:

1. **Bleed.** Full-screen layers run past the frame into the leftover glass, so play never sits between letterbox bars.
2. **Rails.** Edge controls leave the frame and hug the safe edge of the glass.
3. **Clusters.** Controls grow as whole groups so they never render below 85% of their designed size.

Desktop gets `--ui: 1` and no bleed, so it renders exactly as designed.

## When a screen is handheld

`lib/viewport.ts` sets `data-handheld` on `<html>` when the pointer is coarse (phones, tablets) or the window is 540px tall or less, so a short laptop window previews it too. CSS keys off `:root[data-handheld]`; components read `useViewport()`. Don't sniff user agents or window widths in components.

## Tokens

Set on `<html>` on every resize and rotation. Values are in stage px unless noted.

| Token | Meaning |
|---|---|
| `--stage-scale` | Rendered px per stage px. |
| `--ui` | Control-cluster scale: `0.85 ÷ --stage-scale`, clamped 1 to 2.4. Always 1 on desktop. |
| `--ui-soft` | Half-strength `--ui`: `1 + (--ui − 1) × 0.5`. |
| `--bleed-x`, `--bleed-y` | Distance from the art frame to the edge of the glass. |
| `--safe-l/r/t/b` | Notch and home-indicator insets. |
| `--rail-l/r/t/b` | How far an edge control moves outward: bleed minus the safe inset. Negative when the frame itself sits under the notch, which moves the control inward. |
| `--hud-bottom` | Bottom edge of the scaled HUD. |
| `--tap` | A 44px rendered touch target, expressed in the element's own px. |

## The rules

### 1. Stage: never reflow the art

Position everything in stage px, as designed. Screens don't get phone breakpoints; the stage scale handles size. The only exception is text entry (see [Forms](#forms)).

### 2. Bleed: full-screen layers reach the glass

Dims, flashes, wipes, curtains and backdrops use `.bleed` instead of `.fill`. A screen root uses `.screen-clip`: it clips to the frame on desktop and lets rails overflow on handhelds, where the viewport clips at the glass instead.

```tsx
<div className="fill screen-clip">
  <div className="bleed" style={{ background: 'rgba(16,17,38,0.7)' }} />
</div>
```

### 3. Rails: anchor to the safe edge

Offset an edge control by its rail. On desktop every rail is 0, so the designed position is unchanged.

```tsx
<div className="ui-bl" style={{ position: 'absolute', left: 'calc(40px - var(--rail-l))', bottom: 'calc(50px - var(--rail-b))' }}>
```

Anything that sits under the HUD measures from it, `top: 'calc(var(--hud-bottom) + 33px)'`, so it clears the HUD at any `--ui`.

### 4. Clusters: scale groups, not pieces

Give each control group the class for the corner or edge it is anchored to: `.ui-tl`, `.ui-tr`, `.ui-bl`, `.ui-br`, `.ui-t`, `.ui-b`, `.ui-l` or `.ui-r`. The group scales by `--ui` from that origin, so its gaps, borders and type ratios stay the designed ones. Examples: the HUD bar, mic orb, round badge, title modes and links, and the account chip.

When a component needs the numbers (the card hand grows by `min(1.34, 1 + (ui − 1) × 0.3)` and re-fans around the centre), read them from `useViewport()`.

### 5. Soft scale: things inside the composition

Add `.ui-soft` next to the anchor class for anything that lives inside the art: turn banners, taunt bubbles, damage tags, map pins and labels, the instrument card, the choose bar. It grows half as much, so it reads at arm's length without covering the fight.

### 6. Touch: 44px, or slop

Every control must take a 44px (rendered) finger. When the design calls for a smaller control, keep its look and add `.tap`: its `::after` grows the hit area to `--tap`. Hover effects stay inside `@media (hover: hover)`. Keyboard hints use `.kbd-only`; tap wording uses `.touch-only`.

### 7. Type: larger inside its box

Copy the player reads during play gets handheld sizes in the "Handheld type" block of `app/globals.css`. They're set before the stage scale, so each box keeps its shape: card titles 26px, card text 28px, sheet labels 18px. Give the element a class and add a `:root[data-handheld]` rule; don't branch font sizes in JSX.

### 8. Priority: leave out, or design the phone board

When something doesn't fit, keep what the player acts on and mark the rest `.desk-only` (the HUD identity, key hints, the stats showcase, two leaderboard columns). When a phone needs a compact stand-in, add it with `.hand-only` (the LV chip in the stats panel). When the desktop composition cannot be honest on a 852×393 landscape glass, design a phone board in Paper at 1950×900 (S2 home, S3 combat, S7/S8 lab) and implement that. Never paper over a bad phone layout with a background-image.

### 9. Fit to glass: centred panels

Panels that float in the middle (sheet music, pause, upgrades, map peek, victory, loss) use `useStageFit`. It measures the panel and returns the largest scale that fits inside the safe area, optionally under the HUD. Desktop gets back `{ k: 1, top: designedTop }`. Centre the panel horizontally on the stage and scale it from its top edge:

```tsx
const panel = useRef<HTMLDivElement>(null);
const fit = useStageFit(panel, 110, { underHud: true });

<div ref={panel} style={{ position: 'absolute', left: 300, width: 840, top: fit.top, scale: fit.k === 1 ? undefined : fit.k, transformOrigin: '50% 0' }}>
```

Give the panel a compact handheld layout first (a class plus `:root[data-handheld]` rules, like `.pause-panel`), then let the fit grow it.

### 10. Rotate: landscape only

The stage is landscape. Portrait phones see the rotate card (`RotateHint` in `Game.tsx`). Turning to landscape plays `stageWake`, a 460ms stepped iris, or a short fade with reduced motion. Full screen is offered from menus (the title links and the pause panel) where the browser supports it, never as a floating button over play. iPhone Safari has no element full screen, so the rotate card suggests adding the game to the home screen.

### 11. Motion: stepped, never idle

Handhelds change where things sit, never how they move. Rails and cluster scaling never add, drop or retime an animation. Motion uses `steps(n)`. Idle loops (infinite breathe, bob, glow, rattle) stay off. The rotate wake is stepped too: 460ms in 8 steps. Respect `prefers-reduced-motion`.

### 12. Weight: light art, no idle work

- Draw sprite, background and character art through `art(src)` from `lib/art.ts`. Phones get 512px WebP copies (`m/`); small portraits use `art(src, 'thumb')`, a 256px copy (`t/`). On phones, 43 MB of PNG becomes 3.1 MB.
- After adding or changing art, run `node scripts/optimize-art.mjs` and commit the generated files.
- Art rendered on the server, before boot, can't call `art()` (the server can't see the device). Use a `<picture>` with a media query, as `BootGate` does.
- Do no work nobody sees. The mic loop sleeps without listeners, the tavern clock only runs in timed phases, and during a performance only the sheet re-renders (the `LiveSheet` store), with live grading throttled to every 66ms.
- Revoke object URLs, memoise heavy static layers with `React.memo`, and bake expensive looks into images: the menu backdrop is a pre-blurred WebP, not a live `filter: blur()`.

## Forms

Text entry is the one exception to "never reflow": a phone keyboard needs native-sized fields. The account modal and the tavern lobby render into `.mobile-surface` (`components/MobileSurface.tsx`), a native-size layer. The phone tavern lobby fits one landscape screen using the grid at the end of `app/globals.css`.

## New screen checklist

- [ ] Designed at 1440×900 in Paper, positioned in stage px. Phones that need their own layout also get a 1950×900 board.
- [ ] Root is `.fill .screen-clip`; full-screen layers use `.bleed`.
- [ ] Edge controls carry a rail offset and a `.ui-*` anchor class.
- [ ] Labels and tags inside the composition add `.ui-soft`.
- [ ] Every control is at least 44px rendered, or has `.tap`.
- [ ] Copy read during play has a handheld size rule.
- [ ] Detail a phone doesn't need is `.desk-only`.
- [ ] Centred panels use `useStageFit`.
- [ ] Art goes through `art()`.
- [ ] Motion follows the M6 spec: stepped timing, nothing retimed for phones.
- [ ] Checked in landscape on phone sizes and in portrait (rotate card).

## Testing

Handheld mode needs a coarse pointer or a short window.

- Chrome DevTools device mode with touch emulation, in landscape: 667×375 (iPhone SE), 740×360 (Galaxy S), 852×393 (iPhone 15), 932×430 (iPhone 15 Pro Max).
- Or make a desktop window shorter than 540px.
- Turn to portrait for the rotate card, then back for the wake.
- Check notch insets with a notched device preset, or on a real phone.
