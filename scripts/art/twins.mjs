// Castor and Pollux as pixel art. Regenerate with: node scripts/art/twins.mjs
import { canvas } from './pix.mjs';
import { writeFileSync } from 'node:fs';

const INK = '#1B1F3B', MARBLE = '#F1ECE2', MARBLE_S = '#C9C0B2';
const SKIN = '#F3DDC6', SKIN_S = '#D8B596', HAIR = '#EFD9A4', HAIR_S = '#C4A56A';
const GOLD = '#FFD23F', GOLD_S = '#C9901B', TUNIC = '#FFF6E0', TUNIC_S = '#E1CFA8';
const WOOD = '#9A6232', WOOD_S = '#6A4020', LEATHER = '#7A4A2A', WHITE = '#FFFFFF';

function twin({ cloak, cloakS, band, star, starS, look }) {
  const c = canvas(46, 76);
  const X = 23; // centre column
  // star above the pilos: a chunky four-point spark
  c.rect(X - 1, 1, 2, 9, star).rect(X - 5, 4, 10, 3, star).rect(X - 3, 3, 6, 5, star).rect(X - 1, 4, 2, 3, starS);
  // pilos: the tall egg-shaped Dioscuri cap
  c.poly([[X - 8.5, 26], [X + 8.5, 26], [X + 7, 19], [X + 4, 13], [X + 1.5, 10], [X - 1.5, 10], [X - 4, 13], [X - 7, 19]], MARBLE);
  c.recolor(MARBLE, MARBLE_S, (x, y) => x - X >= 2 + (26 - y) * 0.12);
  c.rect(X - 8, 24, 16, 2, band);
  // hair curls and face
  c.ellipse(X - 7, 29, 2.6, 3.6, HAIR).ellipse(X + 7, 29, 2.6, 3.6, HAIR).rect(X - 6, 26, 12, 1, HAIR);
  c.ellipse(X - 7, 33, 2, 2.2, HAIR).ellipse(X + 7, 33, 2, 2.2, HAIR_S);
  c.rect(X - 6, 27, 12, 10, SKIN).rect(X - 5, 37, 10, 1, SKIN).rect(X - 4, 38, 8, 1, SKIN);
  c.recolor(SKIN, SKIN_S, (x, y) => x >= X + 4 && y < 39);
  c.rect(X - 8, 29, 2, 2, HAIR_S).rect(X + 6, 29, 2, 2, HAIR_S);
  c.rect(X - 5, 28, 2, 1, HAIR_S).rect(X - 3, 29, 2, 1, HAIR_S).rect(X + 3, 28, 2, 1, HAIR_S).rect(X + 1, 29, 2, 1, HAIR_S); // brows
  const e = look > 0 ? 1 : 0;
  c.rect(X - 4, 31, 3, 2, WHITE).rect(X + 1, 31, 3, 2, WHITE);
  c.rect(X - 4 + e + (look > 0 ? 1 : 0), 31, 1, 2, INK).rect(X + 1 + e + (look > 0 ? 1 : 0), 31, 1, 2, INK);
  c.rect(X, 33, 1, 2, SKIN_S).rect(X - 2, 36, 4, 1, SKIN_S); // nose, mouth
  // neck and shoulders
  c.rect(X - 2, 39, 4, 3, SKIN_S);
  // cape behind the shoulders, flaring past the knees
  c.poly([[X - 12, 41], [X + 12, 41], [X + 16, 71], [X + 9, 69], [X, 71], [X - 9, 69], [X - 16, 71]], cloakS);
  // chiton: shoulders to waist, then the skirt
  c.poly([[X - 11, 42], [X + 11, 42], [X + 10, 56], [X - 10, 56]], TUNIC);
  c.poly([[X - 10, 56], [X + 10, 56], [X + 11, 65], [X - 11, 65]], TUNIC);
  c.recolor(TUNIC, TUNIC_S, (x, y) => (y >= 57 && (x === X - 5 || x === X || x === X + 5)) || x >= X + 8);
  c.rect(X - 10, 54, 20, 2, GOLD_S); // belt
  // arms and hands
  c.rect(X - 14, 43, 3, 13, SKIN).rect(X + 11, 43, 3, 13, SKIN_S);
  c.rect(X - 15, 56, 4, 3, SKIN).rect(X + 11, 56, 4, 3, SKIN_S);
  // chlamys: cloak pinned at one shoulder, falling across the body
  c.poly([[X - 12, 41], [X + 2, 41], [X + 8, 58], [X + 6, 68], [X - 6, 68], [X - 13, 50]], cloak);
  c.recolor(cloak, cloakS, (x, y) => x - X > (y - 41) * 0.35 - 4);
  c.rect(X - 1, 42, 3, 3, GOLD).rect(X, 43, 1, 1, GOLD_S); // brooch
  // legs and sandals
  c.rect(X - 7, 65, 4, 8, SKIN).rect(X + 3, 65, 4, 8, SKIN_S);
  c.rect(X - 7, 69, 4, 1, LEATHER).rect(X + 3, 69, 4, 1, LEATHER);
  c.rect(X - 8, 73, 6, 2, LEATHER).rect(X + 2, 73, 6, 2, LEATHER);
  return c;
}

// The Dioscuri as one figure: Castor (gold cloak, blue-white star) and Pollux (crimson cloak,
// orange star, boxer's wraps) stand shoulder to shoulder, Pollux's arm over his brother's
// shoulder as in the San Ildefonso group. The Harmonic Canon they play sits in front of them
// (drawn by the stage), so their hands rest out of sight on its strings.
const castor = twin({ cloak: '#E2A838', cloakS: '#A87520', band: GOLD, star: '#DDF3FF', starS: '#6EC6FF', look: 1 });
castor.outline(INK);
const pollux = twin({ cloak: '#D1307E', cloakS: '#8E1F57', band: '#D1307E', star: '#FFC46B', starS: '#E8843A', look: 1 });
pollux.rect(34, 52, 4, 1, LEATHER).rect(34, 54, 4, 1, LEATHER).rect(8, 52, 4, 1, LEATHER);
pollux.outline(INK).mirror();

const pair = canvas(72, 76);
const paste = (src, dx) => src.px.forEach((row, y) => row.forEach((c, x) => { if (c) pair.set(x + dx, y, c); }));
paste(castor, 0);
paste(pollux, 26);
// Pollux's arm across his brother's shoulders: sleeve at his own shoulder, forearm over
// Castor's collar, hand resting on Castor's far shoulder.
pair.rect(12, 41, 29, 5, INK).rect(13, 42, 20, 3, SKIN).rect(33, 42, 7, 3, TUNIC).recolor(SKIN, SKIN_S, (x, y) => y === 44 && x > 12 && x < 33);
pair.rect(9, 40, 6, 7, INK).rect(10, 41, 4, 5, SKIN);
writeFileSync('public/assets/training/dioscuri.svg', pair.svg(5));
console.log('ok');
