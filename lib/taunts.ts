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
  /** Lines about a prop (the goblin's drum, the serpent's canyon) only fit that one enemy. */
  only?: string[];
  text: string;
}

// Three personas voice all eighteen foes: the goblin's gremlin cackle, the serpent's sneering
// hiss, the Choir's many-mouthed "we". Every line is about the playing, never the player.
const T: Template[] = [
  // ---------- heat 0: the card landed ----------
  { id: 'h0a', who: 'any', heat: [0], moment: ['hit', 'enemyTurn'], text: '...Fine. Lucky bar.' },
  { id: 'h0e', who: 'any', heat: [0], moment: ['hit', 'enemyTurn'], text: 'Enjoy it. That was the easy card.' },
  { id: 'h0b', who: 'goblin', heat: [0], moment: ['hit', 'enemyTurn'], text: "Tch. Don't get comfy, horn boy." },
  { id: 'h0f', who: 'goblin', heat: [0], moment: ['hit', 'enemyTurn'], text: 'Ow! Okay, okay. Beginner\'s luck. Do it again, I dare you.' },
  { id: 'h0g', who: 'goblin', heat: [0], moment: ['hit', 'enemyTurn'], only: ['goblin'], text: 'Hey! Watch the drum! I just had it tuned!' },
  { id: 'h0c', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], text: 'Adequate. Barely.' },
  { id: 'h0h', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], text: 'Sssomeone practised. How quaint.' },
  { id: 'h0i', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], only: ['serpent'], text: 'The canyon echoed that one. It rarely bothers.' },
  { id: 'h0d', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], text: 'One clean phrase. We have sung ten thousand.' },
  { id: 'h0j', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], text: 'A true note. We will remember it, when you have forgotten how.' },
  { id: 'h0k', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], text: 'Mm. You found the key. Now keep it.' },

  // ---------- heat 1: landed, but we noticed ----------
  { id: 'h1a', who: 'any', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], text: 'You {timing} bar {bar}. I heard that.' },
  { id: 'h1b', who: 'any', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['wrongNote'], text: 'That {wrongNote} was supposed to be a {expectedNote}. Sloppy.' },
  { id: 'h1f', who: 'any', heat: [1], moment: ['hit', 'enemyTurn'], text: '{accuracy} percent and you call that a win? Low bar.' },
  { id: 'h1c', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], only: ['goblin'], text: '{accuracy} percent? My drum keeps better time asleep.' },
  { id: 'h1g', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], text: 'Heh. {missCount} clams in there. I counted on my fingers. All four of them.' },
  { id: 'h1h', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], text: 'You {timing} it! Rhythm\'s not a suggestion, it\'s a lifestyle!' },
  { id: 'h1d', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], text: "Sssquished that last note, didn't you." },
  { id: 'h1i', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['wrongNote'], text: 'A {wrongNote} where a {expectedNote} should live. I noticed. I always notice.' },
  { id: 'h1j', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], text: 'It landed. Like a dropped plate lands.' },
  { id: 'h1e', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], text: 'We counted your mistakes. It did not take long. Yet.' },
  { id: 'h1k', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], text: 'You {timing} the phrase. We breathe as one. You breathe alone.' },
  { id: 'h1l', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], text: '{missCount} small cracks. Cracks become ruins, little trumpet.' },

  // ---------- heat 2: the card failed ----------
  { id: 'h2a', who: 'any', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: 'The chart said {expectedNote}. You played {wrongNote}. Reading, or guessing?' },
  { id: 'h2j', who: 'any', heat: [2], moment: ['miss', 'enemyTurn'], text: '{missCount} of {totalNotes} wrong. That card is coming back to haunt you.' },
  { id: 'h2k', who: 'any', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], text: '{silentCount} notes never happened. Were you playing, or thinking about it?' },
  { id: 'h2b', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], only: ['goblin'], text: "{accuracy} percent? My drum has better pitch than you, and it's a drum!" },
  { id: 'h2c', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], text: '{silentCount} notes of pure silence. Were you playing, or napping?' },
  { id: 'h2d', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], text: 'Missed {missCount} out of {totalNotes}. Heh heh. Do it again, it was funny.' },
  { id: 'h2l', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], text: 'BONK! Wrong! Ha! I love this job.' },
  { id: 'h2m', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['timing'], text: 'You {timing} so hard the {cardType} card filed a complaint.' },
  { id: 'h2e', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: 'Ssso close. {expectedNote} was right there, and you chose {wrongNote}.' },
  { id: 'h2f', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], only: ['serpent'], text: '{accuracy} percent. In my canyon that is called an echo of failure.' },
  { id: 'h2g', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['timing'], text: 'You {timing} the whole {cardType} card. The tempo is not a sssuggestion.' },
  { id: 'h2n', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], text: 'Delicious. I could hear you panic in real time.' },
  { id: 'h2o', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], text: '{accuracy} percent. Brass is a noble metal. You make it sound like tin.' },
  { id: 'h2h', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: 'We sang {expectedNote}. You answered {wrongNote}. How lonely.' },
  { id: 'h2i', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], text: '{missCount} wrong notes. We heard every one.' },
  { id: 'h2p', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], text: 'The hall is quiet now. Your wrong notes are still ringing in it.' },
  { id: 'h2q', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], text: '{silentCount} silences where notes should be. We filled them for you.' },

  // ---------- heat 3: failing again, or low on HP ----------
  { id: 'h3a', who: 'any', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], text: 'Fail number {failCount} on the same {cardType}. {hp} HP left. Want me to play it for you?' },
  { id: 'h3h', who: 'any', heat: [3], moment: ['miss', 'enemyTurn'], text: '{hp} HP. The climb ends here, doesn\'t it?' },
  { id: 'h3b', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], only: ['goblin'], text: "{hp} HP and still flat! I'm gonna drum on your head next!" },
  { id: 'h3c', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: '{wrongNote}! Again with the {wrongNote}! It says {expectedNote}! Can you even read?' },
  { id: 'h3i', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], text: 'Hee hee! {hp} HP! Somebody call the band teacher!' },
  { id: 'h3j', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], text: '{failCount} tries on one card! You\'re not playing music, you\'re playing whack-a-mole!' },
  { id: 'h3d', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], text: '{hp} HP. {accuracy} percent. I could hiss this card better, and I have no lungs.' },
  { id: 'h3e', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: 'Every time the chart saysss {expectedNote}, you play {wrongNote}. Every. Time.' },
  { id: 'h3k', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], text: 'Coil up, little bard. It is almost over, and so are you.' },
  { id: 'h3l', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], text: 'Attempt {failCount}. I have shed my skin with more grace than that.' },
  { id: 'h3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], text: '{hp} breaths left, little trumpet. Spend them on a note you can actually read.' },
  { id: 'h3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], text: 'You climbed all this way to play {accuracy} percent. We will sing at your funeral. In tune.' },
  { id: 'h3m', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], text: 'Kneel, bard. Even your silence is off-key.' },
  { id: 'h3n', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], text: '{failCount} times you reached for that phrase. {failCount} times it slipped away.' },
];

export function pickTaunt(
  who: VoiceKey,
  enemyId: string,
  heat: number,
  moment: TauntMoment,
  facts: TauntFacts,
  used: string[],
): { id: string; text: string } | null {
  const ok = T.filter(
    (t) =>
      (t.who === who || t.who === 'any') &&
      (!t.only || t.only.includes(enemyId)) &&
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
