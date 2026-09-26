// Trash-talk templates (PRD §7a). Filled from real grading facts, spoken by
// ElevenLabs on the server. PG-13: mock the playing, never the person.

import type { VoiceKey } from './content';

export type TauntMoment = 'miss' | 'enemyTurn' | 'hit';

export interface TauntFacts {
  wrongNote?: string; // what they played (written key)
  expectedNote?: string; // what the chart said (written key)
  wrongCount: number;
  missCount: number;
  silentCount: number;
  totalNotes: number;
  accuracy: number; // 0..100
  hp: number;
  failCount: number; // times this card type failed this fight
  timing?: 'rushed' | 'dragged';
  cardType: string;
  bar?: number;
}

interface Template {
  id: string;
  who: VoiceKey | 'any';
  heat: number[];
  moment: TauntMoment[];
  needs?: (keyof TauntFacts)[];
  text: string;
}

const T: Template[] = [
  // ---------- heat 0 / 1 (after a hit) ----------
  { id: 'h0a', who: 'any', heat: [0], moment: ['hit', 'enemyTurn'], text: '...Fine. Lucky bar.' },
  { id: 'h0b', who: 'goblin', heat: [0], moment: ['hit', 'enemyTurn'], text: "Tch. Don't get comfy, horn boy." },
  { id: 'h0c', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], text: 'Adequate. Barely.' },
  { id: 'h0d', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], text: 'One clean phrase. We have sung ten thousand.' },
  { id: 'h1a', who: 'any', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], text: 'You {timing} bar {bar}. I heard that.' },
  { id: 'h1b', who: 'any', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['wrongNote'], text: 'That {wrongNote} was supposed to be a {expectedNote}. Sloppy.' },
  { id: 'h1c', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], text: '{accuracy} percent? My drum keeps better time asleep.' },
  { id: 'h1d', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], text: 'Sssquished that last note, didn\'t you.' },
  { id: 'h1e', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], text: 'We counted your mistakes. It did not take long. Yet.' },

  // ---------- heat 2 (card failed) ----------
  { id: 'h2a', who: 'any', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: 'The chart said {expectedNote}. You played {wrongNote}. Reading, or guessing?' },
  { id: 'h2b', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], text: '{accuracy} percent? My drum has better pitch than you, and it\'s a drum!' },
  { id: 'h2c', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], text: '{silentCount} notes of pure silence. Were you playing, or napping?' },
  { id: 'h2d', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], text: 'Missed {missCount} out of {totalNotes}. Heh heh. Do it again, it was funny.' },
  { id: 'h2e', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: 'Ssso close. {expectedNote} was right there, and you chose {wrongNote}.' },
  { id: 'h2f', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], text: '{accuracy} percent. In my canyon that is called an echo of failure.' },
  { id: 'h2g', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['timing'], text: 'You {timing} the whole {cardType} card. The tempo is not a sssuggestion.' },
  { id: 'h2h', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: 'We sang {expectedNote}. You answered {wrongNote}. How lonely.' },
  { id: 'h2i', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], text: '{missCount} wrong notes. We heard every one.' },
  { id: 'h2j', who: 'any', heat: [2], moment: ['miss', 'enemyTurn'], text: '{missCount} of {totalNotes} wrong. That card is coming back to haunt you.' },

  // ---------- heat 3 (2+ fails or low HP) ----------
  { id: 'h3a', who: 'any', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], text: 'Fail number {failCount} on the same {cardType}. {hp} HP left. Want me to play it for you?' },
  { id: 'h3b', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], text: '{hp} HP and still flat! I\'m gonna drum on your head next!' },
  { id: 'h3c', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: '{wrongNote}! Again with the {wrongNote}! It says {expectedNote}! Can you even read?' },
  { id: 'h3d', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], text: '{hp} HP. {accuracy} percent. I could hiss this card better, and I have no lungs.' },
  { id: 'h3e', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: 'Every time the chart saysss {expectedNote}, you play {wrongNote}. Every. Time.' },
  { id: 'h3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], text: '{hp} breaths left, little trumpet. Spend them on a note you can actually read.' },
  { id: 'h3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], text: 'You climbed all this way to play {accuracy} percent. We will sing at your funeral. In tune.' },
];

export function pickTaunt(
  who: VoiceKey,
  heat: number,
  moment: TauntMoment,
  facts: TauntFacts,
  used: string[],
): { id: string; text: string } | null {
  const ok = T.filter(
    (t) =>
      (t.who === who || t.who === 'any') &&
      t.heat.includes(heat) &&
      t.moment.includes(moment) &&
      (t.needs ?? []).every((k) => {
        const v = facts[k];
        return v !== undefined && v !== null && v !== '' && v !== 0;
      }),
  );
  if (!ok.length) return null;
  const fresh = ok.filter((t) => !used.includes(t.id));
  const pool = fresh.length ? fresh : ok;
  // Prefer enemy-specific lines 2:1 over generic ones.
  const weighted = pool.flatMap((t) => (t.who === 'any' ? [t] : [t, t]));
  const t = weighted[Math.floor(Math.random() * weighted.length)];
  const text = t.text.replace(/\{(\w+)\}/g, (_, k: keyof TauntFacts) => String(facts[k] ?? ''));
  return { id: t.id, text };
}
