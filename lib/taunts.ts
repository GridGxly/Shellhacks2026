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
  { id: 'h0h', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], only: ['serpent'], text: 'Sssomeone practised. How quaint.' },
  { id: 'h0i', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], only: ['serpent'], text: 'The canyon echoed that one. It rarely bothers.' },
  { id: 'h0d', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], only: ['choir', 'silent-maestro'], text: 'One clean phrase. We have sung ten thousand.' },
  { id: 'h0j', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], only: ['choir', 'silent-maestro'], text: 'A true note. We will remember it, when you have forgotten how.' },
  { id: 'h0k', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], text: 'Mm. You found the key. Now keep it.' },

  // ---------- heat 1: landed, but we noticed ----------
  { id: 'h1a', who: 'any', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], text: 'You {timing} bar {bar}. I heard that.' },
  { id: 'h1b', who: 'any', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['wrongNote'], text: 'That {wrongNote} was supposed to be a {expectedNote}. Sloppy.' },
  { id: 'h1f', who: 'any', heat: [1], moment: ['hit', 'enemyTurn'], text: '{accuracy} percent and you call that a win? Low bar.' },
  { id: 'h1c', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], only: ['goblin'], text: '{accuracy} percent? My drum keeps better time asleep.' },
  { id: 'h1g', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], text: 'Heh. {missCount} clams in there. I counted on my fingers. All four of them.' },
  { id: 'h1h', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], text: 'You {timing} it! Rhythm\'s not a suggestion, it\'s a lifestyle!' },
  { id: 'h1d', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], only: ['serpent'], text: "Sssquished that last note, didn't you." },
  { id: 'h1i', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['wrongNote'], text: 'A {wrongNote} where a {expectedNote} should live. I noticed. I always notice.' },
  { id: 'h1j', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], text: 'It landed. Like a dropped plate lands.' },
  { id: 'h1e', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], only: ['choir', 'silent-maestro'], text: 'We counted your mistakes. It did not take long. Yet.' },
  { id: 'h1k', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['choir', 'silent-maestro'], text: 'You {timing} the phrase. We breathe as one. You breathe alone.' },
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
  { id: 'h2e', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['serpent'], text: 'Ssso close. {expectedNote} was right there, and you chose {wrongNote}.' },
  { id: 'h2f', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], only: ['serpent'], text: '{accuracy} percent. In my canyon that is called an echo of failure.' },
  { id: 'h2g', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['timing'], only: ['serpent'], text: 'You {timing} the whole {cardType} card. The tempo is not a sssuggestion.' },
  { id: 'h2n', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], text: 'Delicious. I could hear you panic in real time.' },
  { id: 'h2o', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], text: '{accuracy} percent. Brass is a noble metal. You make it sound like tin.' },
  { id: 'h2h', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['choir', 'silent-maestro'], text: 'We sang {expectedNote}. You answered {wrongNote}. How lonely.' },
  { id: 'h2i', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], only: ['choir', 'silent-maestro'], text: '{missCount} wrong notes. We heard every one.' },
  { id: 'h2p', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], text: 'The hall is quiet now. Your wrong notes are still ringing in it.' },
  { id: 'h2q', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], only: ['choir', 'silent-maestro'], text: '{silentCount} silences where notes should be. We filled them for you.' },

  // ---------- heat 3: failing again, or low on HP ----------
  { id: 'h3a', who: 'any', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], text: 'Fail number {failCount} on the same {cardType}. {hp} HP left. Want me to play it for you?' },
  { id: 'h3h', who: 'any', heat: [3], moment: ['miss', 'enemyTurn'], text: '{hp} HP. The climb ends here, doesn\'t it?' },
  { id: 'h3b', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], only: ['goblin'], text: "{hp} HP and still flat! I'm gonna drum on your head next!" },
  { id: 'h3c', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], text: '{wrongNote}! Again with the {wrongNote}! It says {expectedNote}! Can you even read?' },
  { id: 'h3i', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], text: 'Hee hee! {hp} HP! Somebody call the band teacher!' },
  { id: 'h3j', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], text: '{failCount} tries on one card! You\'re not playing music, you\'re playing whack-a-mole!' },
  { id: 'h3d', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], only: ['serpent'], text: '{hp} HP. {accuracy} percent. I could hiss this card better, and I have no lungs.' },
  { id: 'h3e', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['serpent'], text: 'Every time the chart saysss {expectedNote}, you play {wrongNote}. Every. Time.' },
  { id: 'h3k', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], only: ['serpent'], text: 'Coil up, little bard. It is almost over, and so are you.' },
  { id: 'h3l', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['serpent'], text: 'Attempt {failCount}. I have shed my skin with more grace than that.' },
  { id: 'h3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], text: '{hp} breaths left, little trumpet. Spend them on a note you can actually read.' },
  { id: 'h3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], only: ['choir', 'silent-maestro'], text: 'You climbed all this way to play {accuracy} percent. We will sing at your funeral. In tune.' },
  { id: 'h3m', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], text: 'Kneel, bard. Even your silence is off-key.' },
  { id: 'h3n', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], text: '{failCount} times you reached for that phrase. {failCount} times it slipped away.' },

  // ---------- one voice per foe: lines only that villain says ----------
  // cymbal-crab
  { id: 'cymbal0a', who: 'goblin', heat: [0], moment: ['hit', 'enemyTurn'], only: ['cymbal-crab'], text: 'Clack! Lucky crash, sailor. The tide turns.' },
  { id: 'cymbal1b', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], only: ['cymbal-crab'], text: '{missCount} clams in that one. Fitting. I collect clams.' },
  { id: 'cymbal1c', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['cymbal-crab'], text: 'You {timing} it, matey. Even the waves keep better time.' },
  { id: 'cymbal2d', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['cymbal-crab'], text: '{wrongNote}?! Chart said {expectedNote}! Walk the plank!' },
  { id: 'cymbal2e', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], only: ['cymbal-crab'], text: 'Clack clack! {accuracy} percent! Scuttle back to the shallows!' },
  { id: 'cymbal3f', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], only: ['cymbal-crab'], text: '{hp} HP. I\'ll pinch the rest off ye, sideways.' },
  { id: 'cymbal3g', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['cymbal-crab'], text: '{failCount} tries on the same card. Ye sink like an anchor, sailor.' },
  // maraca-twins
  { id: 'maraca0a', who: 'goblin', heat: [0], moment: ['hit', 'enemyTurn'], only: ['maraca-twins'], text: 'Shake shake! Okay that one was good. Don\'t tell anyone!' },
  { id: 'maraca1b', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], only: ['maraca-twins'], text: 'We both counted {missCount} misses! Twice the counting, twice the fun!' },
  { id: 'maraca1c', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['maraca-twins'], text: 'You {timing} it! We felt it! Both of us! At the same time!' },
  { id: 'maraca2d', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['maraca-twins'], text: '{wrongNote}! {wrongNote}! It said {expectedNote}! Shake shake, wrong wrong!' },
  { id: 'maraca2e', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], only: ['maraca-twins'], text: '{accuracy} percent! That\'s like half of a half! We did the math! Twice!' },
  { id: 'maraca3f', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], only: ['maraca-twins'], text: '{hp} HP! Rattle rattle, you\'re gonna fall!' },
  { id: 'maraca3g', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], only: ['maraca-twins'], text: '{silentCount} notes of nothing! We shook louder than that asleep!' },
  // tuba-golem
  { id: 'tuba0a', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], only: ['tuba-golem'], text: 'Hm. Small horn. Big sound. Once.' },
  { id: 'tuba1b', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], only: ['tuba-golem'], text: '{missCount} cracks. Golem. Notices. Cracks.' },
  { id: 'tuba1c', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['tuba-golem'], text: 'Too {timing}. Golem. Is. Patient. You. Are. Not.' },
  { id: 'tuba2d', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['tuba-golem'], text: 'You. Played. {wrongNote}. Golem. Wanted. {expectedNote}.' },
  { id: 'tuba2e', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], only: ['tuba-golem'], text: '{accuracy} percent. Golem. Unimpressed. Golem. Is. Stone.' },
  { id: 'tuba3f', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], only: ['tuba-golem'], text: '{hp} HP. Golem. Sit. On. You. Now.' },
  { id: 'tuba3g', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['tuba-golem'], text: '{failCount} times. Same card. Even. Rocks. Learn.' },
  // metronome-knight
  { id: 'metronom0a', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], only: ['metronome-knight'], text: 'On the beat. For once. Carry on, squire.' },
  { id: 'metronom1b', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['metronome-knight'], text: 'You {timing} bar {bar}, squire. I counted. I always count.' },
  { id: 'metronom1c', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], only: ['metronome-knight'], text: '{accuracy} percent. A knight would call that a draw. I call it sloppy.' },
  { id: 'metronom2d', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['timing'], only: ['metronome-knight'], text: 'Tick. Tock. You {timing} the {cardType}. Dishonourable.' },
  { id: 'metronom2e', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['metronome-knight'], text: '{wrongNote} instead of {expectedNote}. My blade keeps better pitch.' },
  { id: 'metronom2f', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], only: ['metronome-knight'], text: '{missCount} of {totalNotes} off the beat. Kneel and reset your tempo.' },
  { id: 'metronom3g', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], only: ['metronome-knight'], text: '{hp} HP. Tick. Tock. Your time is up, squire.' },
  // xylophone-skeleton
  { id: 'xylophon0a', who: 'goblin', heat: [0], moment: ['hit', 'enemyTurn'], only: ['xylophone-skeleton'], text: 'Heh. That one tickled my funny bone. Just a little.' },
  { id: 'xylophon1b', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], only: ['xylophone-skeleton'], text: '{missCount} misses. I felt that one in my humerus.' },
  { id: 'xylophon1c', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['wrongNote'], only: ['xylophone-skeleton'], text: 'That {wrongNote} rattled me. Should\'ve been {expectedNote}, bonehead!' },
  { id: 'xylophon2d', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], only: ['xylophone-skeleton'], text: '{accuracy} percent? That\'s bone-dry, pal. Nothing on it!' },
  { id: 'xylophon2e', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], only: ['xylophone-skeleton'], text: '{silentCount} silent notes! I\'ve got no lungs and I still beat that!' },
  { id: 'xylophon3f', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], only: ['xylophone-skeleton'], text: '{hp} HP! You\'re gonna fit right in down here! Heh heh!' },
  { id: 'xylophon3g', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['xylophone-skeleton'], text: '{failCount} tries! Rattle rattle, you\'re falling apart faster than me!' },
  // organ-gargoyle
  { id: 'organ0a', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], only: ['organ-gargoyle'], text: 'A clean chord. The stone remembers it. Briefly.' },
  { id: 'organ1b', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], only: ['organ-gargoyle'], text: '{missCount} sour notes. The pipes carry every one to the rafters.' },
  { id: 'organ1c', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['organ-gargoyle'], text: 'You {timing} bar {bar}. This cathedral has kept time for nine hundred years.' },
  { id: 'organ2d', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['organ-gargoyle'], text: '{wrongNote} where {expectedNote} belonged. The whole nave heard it.' },
  { id: 'organ2e', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], only: ['organ-gargoyle'], text: '{accuracy} percent. I have watched pigeons perform better on my ledge.' },
  { id: 'organ3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], only: ['organ-gargoyle'], text: '{hp} HP. The stone will hold your echo long after you fall.' },
  { id: 'organ3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['organ-gargoyle'], text: '{failCount} attempts. Gargoyles wait centuries. You will not need that long.' },
  // violin-specter
  { id: 'violin0a', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], only: ['violin-specter'], text: 'Mm. That note almost made me feel alive again.' },
  { id: 'violin1b', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], only: ['violin-specter'], text: '{missCount} notes slipped through your fingers. Like mine did, once.' },
  { id: 'violin1c', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['violin-specter'], text: 'You {timing} the phrase. Your bow arm trembles, little ghost.' },
  { id: 'violin2d', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['violin-specter'], text: '{wrongNote}. Oh, it should have been {expectedNote}. How mournful.' },
  { id: 'violin2e', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], only: ['violin-specter'], text: '{accuracy} percent. Even the dead wince at that tuning.' },
  { id: 'violin3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], only: ['violin-specter'], text: '{hp} HP. Soon you\'ll haunt these halls with me. Out of tune, forever.' },
  { id: 'violin3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], only: ['violin-specter'], text: '{silentCount} notes of silence. You\'re already halfway to being a ghost.' },
  // harp-siren
  { id: 'harp0a', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], only: ['harp-siren'], text: 'Pretty. Come a little closer and do it again.' },
  { id: 'harp1b', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], only: ['harp-siren'], text: '{missCount} little slips, darling. The sea swallows those whole.' },
  { id: 'harp1c', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['harp-siren'], text: 'You {timing} it, darling. The tide never rushes. It waits.' },
  { id: 'harp2d', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['harp-siren'], text: 'Sweet thing, {expectedNote}, not {wrongNote}. Your pitch drowned first.' },
  { id: 'harp2e', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], only: ['harp-siren'], text: '{accuracy} percent. Sailors have crashed on better songs than yours.' },
  { id: 'harp3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], only: ['harp-siren'], text: '{hp} HP. Just stop swimming, darling. Let the song pull you under.' },
  { id: 'harp3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['harp-siren'], text: '{failCount} times on one card. I could listen to you fail all night.' },
  // accordion-mimic
  { id: 'accordio0a', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], only: ['accordion-mimic'], text: 'Oh, I can play that too. Listen. Ha. Better.' },
  { id: 'accordio1b', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], only: ['accordion-mimic'], text: '{missCount} mistakes. I copied them all. Want to hear them back?' },
  { id: 'accordio1c', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['accordion-mimic'], text: 'You {timing} it. So I {timing} it too. Now we both sound bad.' },
  { id: 'accordio2d', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['accordion-mimic'], text: '{wrongNote}! {wrongNote}! I\'m just playing what you played! It was {expectedNote}!' },
  { id: 'accordio2e', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], only: ['accordion-mimic'], text: '{accuracy} percent. I\'m a treasure chest full of your wrong notes.' },
  { id: 'accordio3f', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], only: ['accordion-mimic'], text: '{hp} HP. Squeeze, squeeze. You\'re running out of air.' },
  { id: 'accordio3g', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['accordion-mimic'], text: 'Attempt {failCount}. I\'ve learned your song. You haven\'t.' },
  // kazoo-harpy
  { id: 'kazoo0a', who: 'goblin', heat: [0], moment: ['hit', 'enemyTurn'], only: ['kazoo-harpy'], text: 'Bzzt! Fine! One good one! Don\'t let it go to your head!' },
  { id: 'kazoo1b', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], only: ['kazoo-harpy'], text: '{missCount} flubs! Even my kazoo winced! Bzzzt!' },
  { id: 'kazoo1c', who: 'goblin', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['kazoo-harpy'], text: 'You {timing} it! Keep up, slowpoke, I\'ve got wings!' },
  { id: 'kazoo2d', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['kazoo-harpy'], text: '{wrongNote}?! It said {expectedNote}! I\'ll peck the right note into you!' },
  { id: 'kazoo2e', who: 'goblin', heat: [2], moment: ['miss', 'enemyTurn'], only: ['kazoo-harpy'], text: 'Ha! {accuracy} percent! Bzzzt! Wrong wrong wrong!' },
  { id: 'kazoo3f', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], only: ['kazoo-harpy'], text: '{hp} HP! Caw caw! Somebody\'s going down!' },
  { id: 'kazoo3g', who: 'goblin', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], only: ['kazoo-harpy'], text: '{silentCount} notes of nothing! Did your horn fly the coop?' },
  // bagpipe-beast
  { id: 'bagpipe0a', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], only: ['bagpipe-beast'], text: 'Aye, that one had some lungs behind it. Barely.' },
  { id: 'bagpipe1b', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], only: ['bagpipe-beast'], text: '{missCount} wee mistakes. The whole glen heard them, laddie.' },
  { id: 'bagpipe1c', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['bagpipe-beast'], text: 'You {timing} it, laddie. A drone never wavers. You do.' },
  { id: 'bagpipe2d', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['bagpipe-beast'], text: '{wrongNote}? Och! It\'s {expectedNote}! Flatter than the moors, that.' },
  { id: 'bagpipe2e', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], only: ['bagpipe-beast'], text: '{accuracy} percent. My pipes wheeze sweeter than that, and they\'re full of holes.' },
  { id: 'bagpipe3f', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], only: ['bagpipe-beast'], text: '{hp} HP. Away wi\' ye, back down the mountain.' },
  { id: 'bagpipe3g', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['bagpipe-beast'], text: '{failCount} tries! By the highlands, give it a rest, laddie!' },
  // theremin-wisp
  { id: 'theremin0a', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], only: ['theremin-wisp'], text: 'Ooh. You touched it. The note. Just for a moment.' },
  { id: 'theremin1b', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], only: ['theremin-wisp'], text: '{missCount} notes you reached for... and never quite touched.' },
  { id: 'theremin1c', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['theremin-wisp'], text: 'You {timing} it. Time bends here. You bent it the wrong way.' },
  { id: 'theremin2d', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['theremin-wisp'], text: 'Wooo... {wrongNote}. The air wanted {expectedNote}. You never touched it.' },
  { id: 'theremin2e', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], only: ['theremin-wisp'], text: '{accuracy} percent. Your notes drift away like smoke.' },
  { id: 'theremin3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], only: ['theremin-wisp'], text: '{hp} HP. Flicker, flicker, little flame. Almost out.' },
  { id: 'theremin3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['silentCount'], only: ['theremin-wisp'], text: '{silentCount} silences. The void thanks you for your contribution.' },
  // autotune-android
  { id: 'autotune0a', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], only: ['autotune-android'], text: 'Pitch accepted. Do not get used to it.' },
  { id: 'autotune1b', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], only: ['autotune-android'], text: 'Analysis complete. {missCount} errors detected. Correction recommended.' },
  { id: 'autotune1c', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['autotune-android'], text: 'Timing deviation: {timing}. Bar {bar}. Recalibrate human.' },
  { id: 'autotune2d', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['autotune-android'], text: 'Error. Input {wrongNote}. Expected {expectedNote}. Autotune cannot save you.' },
  { id: 'autotune2e', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], only: ['autotune-android'], text: 'Accuracy: {accuracy} percent. Human performance within failure parameters.' },
  { id: 'autotune3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], only: ['autotune-android'], text: '{hp} HP remaining. Initiating shutdown of trumpet unit.' },
  { id: 'autotune3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['autotune-android'], text: 'Attempt {failCount}. Error. Error. Learning not detected.' },
  // conductor-lich
  { id: 'conducto0a', who: 'serpent', heat: [0], moment: ['hit', 'enemyTurn'], only: ['conductor-lich'], text: 'Adequate. The orchestra may continue. For now.' },
  { id: 'conducto1b', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], only: ['conductor-lich'], text: '{missCount} errors. Every one scored in my ledger, in blood.' },
  { id: 'conducto1c', who: 'serpent', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['conductor-lich'], text: 'You {timing} bar {bar}. Watch the baton, fool!' },
  { id: 'conducto2d', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['conductor-lich'], text: '{wrongNote}?! The score says {expectedNote}! Again! From the top!' },
  { id: 'conducto2e', who: 'serpent', heat: [2], moment: ['miss', 'enemyTurn'], only: ['conductor-lich'], text: '{accuracy} percent. I have raised better players from the grave.' },
  { id: 'conducto3f', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], only: ['conductor-lich'], text: '{hp} HP. Take your final bow. I\'ll conduct the requiem.' },
  { id: 'conducto3g', who: 'serpent', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['conductor-lich'], text: 'From the top. Attempt {failCount}. Again. Until you break.' },
  // silent-maestro
  { id: 'silent0a', who: 'choir', heat: [0], moment: ['hit', 'enemyTurn'], only: ['silent-maestro'], text: 'A clean phrase. The last one many climbers ever played.' },
  { id: 'silent1b', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], only: ['silent-maestro'], text: '{missCount} flaws. We have heard every climber\'s flaws. Yours are ordinary.' },
  { id: 'silent1c', who: 'choir', heat: [1], moment: ['hit', 'enemyTurn'], needs: ['timing'], only: ['silent-maestro'], text: 'You {timing} bar {bar}. Silence keeps perfect time. You do not.' },
  { id: 'silent2d', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], needs: ['wrongNote'], only: ['silent-maestro'], text: '{wrongNote}. We sang {expectedNote}. The spire rejects you.' },
  { id: 'silent2e', who: 'choir', heat: [2], moment: ['miss', 'enemyTurn'], only: ['silent-maestro'], text: '{accuracy} percent, at the top of the world. How small you sound up here.' },
  { id: 'silent3f', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], only: ['silent-maestro'], text: '{hp} HP. We are the last silence you will ever hear.' },
  { id: 'silent3g', who: 'choir', heat: [3], moment: ['miss', 'enemyTurn'], needs: ['failCount'], only: ['silent-maestro'], text: '{failCount} times. We ascended. You only repeat.' },
];

export function pickTaunt(
  who: VoiceKey,
  enemyId: string,
  heat: number,
  moment: TauntMoment,
  facts: TauntFacts,
  used: string[],
): { id: string; text: string } | null {
  // A miss is a failed card, which is what heat 2 lines are written for; below that a first miss found no line at all.
  if (moment === 'miss') heat = Math.max(2, heat);
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
  // A foe's own lines first (6:1), then its persona's (2:1), then anyone's.
  const weighted = pool.flatMap((t) => Array<Template>(t.only ? 6 : t.who === 'any' ? 1 : 2).fill(t));
  const t = weighted[Math.floor(Math.random() * weighted.length)];
  const text = t.text.replace(/\{(\w+)\}/g, (_, k: keyof TauntFacts) => String(facts[k] ?? ''));
  return { id: t.id, text };
}
