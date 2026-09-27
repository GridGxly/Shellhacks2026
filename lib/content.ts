import {
  BOSS_DAMAGE, BOSS_HP, BOSS_HP_CAP, BOSS_HP_PER_ACT, DAMAGE_PER_ACT, ENEMY_DAMAGE, ENEMY_HP, ENEMY_HP_CAP,
  ENEMY_HP_PER_ACT, TEMPO_BASE, TEMPO_PER_ACT, TEMPO_PER_FIGHT,
} from './config';

export type InstrumentId = 'trumpet' | 'clarinet' | 'tenorSax' | 'altoSax' | 'flute' | 'frenchHorn';

export interface Instrument {
  id: InstrumentId;
  name: string;
  keyLabel: string;
  writtenOffset: number; // written = concert + shift + writtenOffset
  shift: number; // octave shift so content sits in the instrument's range
  personality: string;
  readsIn: string;
  range: string;
  sprite: string;
  iconIndex: number;
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'trumpet', name: 'Trumpet', keyLabel: 'B♭', writtenOffset: 2, shift: 0, personality: 'Loud, bright, first through the door.', readsIn: 'Treble · written C major', range: 'F♯3 – C6', sprite: '/assets/sprites/riff-trumpet.png', iconIndex: 0 },
  { id: 'clarinet', name: 'Clarinet', keyLabel: 'B♭', writtenOffset: 2, shift: 0, personality: 'Smooth and sneaky. Slides under the choir.', readsIn: 'Treble · written C major', range: 'E3 – C7', sprite: '/assets/sprites/riff-clarinet.png', iconIndex: 1 },
  { id: 'tenorSax', name: 'Tenor Sax', keyLabel: 'B♭', writtenOffset: 14, shift: -12, personality: 'Gravel and swagger. Talks back.', readsIn: 'Treble · written C major', range: 'A♭2 – E5', sprite: '/assets/sprites/riff-tenorsax.png', iconIndex: 2 },
  { id: 'altoSax', name: 'Alto Sax', keyLabel: 'E♭', writtenOffset: 9, shift: -12, personality: 'Sharp tongue, sharper tone.', readsIn: 'Treble · written G major', range: 'D♭3 – A♭5', sprite: '/assets/sprites/riff-altosax.png', iconIndex: 3 },
  { id: 'flute', name: 'Flute', keyLabel: 'C', writtenOffset: 0, shift: 0, personality: 'Fast, light, gone before they blink.', readsIn: 'Treble · written B♭ major', range: 'C4 – C7', sprite: '/assets/sprites/riff-flute.png', iconIndex: 4 },
  { id: 'frenchHorn', name: 'French Horn', keyLabel: 'F', writtenOffset: 7, shift: -12, personality: 'Huge, warm, a little dangerous.', readsIn: 'Treble · written F major', range: 'B2 – F5', sprite: '/assets/sprites/riff-frenchhorn.png', iconIndex: 5 },
];

export type VoiceKey = 'goblin' | 'serpent' | 'choir';

export interface Act {
  n: number;
  name: string;
  bg: string;
  bgFilter?: string;
}

export const ACTS: Act[] = [
  { n: 1, name: 'The Hollow Climb', bg: '/assets/bg/drum-hollow.png' },
  { n: 2, name: 'Percussion Pits', bg: '/assets/bg/drum-hollow.png', bgFilter: 'hue-rotate(-35deg) saturate(1.2) brightness(0.8)' },
  { n: 3, name: 'Clockwork Keep', bg: '/assets/bg/spire.png', bgFilter: 'brightness(0.75)' },
  { n: 4, name: 'Haunted Strings', bg: '/assets/bg/choir-nave.png', bgFilter: 'hue-rotate(160deg) saturate(0.6) brightness(0.8)' },
  { n: 5, name: 'Wind Wastes', bg: '/assets/bg/brass-canyon.png', bgFilter: 'hue-rotate(-20deg) brightness(0.8)' },
  { n: 6, name: 'The Summit Stage', bg: '/assets/bg/summit.png', bgFilter: 'brightness(0.85)' },
];

export interface Enemy {
  id: string;
  name: string;
  place: string;
  act: number; // 1..6
  floor: number; // 1..18
  boss: boolean;
  hp: number;
  damage: number;
  tempo: number;
  sprite: string;
  attackSprite?: string;
  spriteFilter?: string;
  bg: string;
  bgFilter?: string;
  size: number;
  attackSfx: string;
  voice: VoiceKey;
  intro?: string; // pre-generated voice line
  ko?: string;
  defeat?: string;
}

type Seed = [id: string, name: string, voice: VoiceKey, size: number, attackSfx: string];

const ROSTER: Seed[][] = [
  [['goblin', 'Snare Goblin', 'goblin', 320, 'goblin'], ['serpent', 'Brass Serpent', 'serpent', 340, 'serpent'], ['choir', 'The Hollow Choir', 'choir', 430, 'choir']],
  [['cymbal-crab', 'Cymbal Crab', 'goblin', 320, 'goblin'], ['maraca-twins', 'Maraca Twins', 'goblin', 300, 'goblin'], ['tuba-golem', 'Tuba Golem', 'serpent', 420, 'serpent']],
  [['metronome-knight', 'Metronome Knight', 'serpent', 330, 'goblin'], ['xylophone-skeleton', 'Xylophone Skeleton', 'goblin', 320, 'goblin'], ['organ-gargoyle', 'Organ Gargoyle', 'choir', 420, 'choir']],
  [['violin-specter', 'Violin Specter', 'choir', 320, 'choir'], ['harp-siren', 'Harp Siren', 'choir', 330, 'choir'], ['accordion-mimic', 'Accordion Mimic', 'serpent', 400, 'serpent']],
  [['kazoo-harpy', 'Kazoo Harpy', 'goblin', 320, 'goblin'], ['bagpipe-beast', 'Bagpipe Beast', 'serpent', 360, 'serpent'], ['theremin-wisp', 'Theremin Wisp', 'choir', 400, 'choir']],
  [['autotune-android', 'Autotune Android', 'choir', 330, 'choir'], ['conductor-lich', 'Conductor Lich', 'serpent', 340, 'serpent'], ['silent-maestro', 'The Choir Ascendant', 'choir', 440, 'choir']],
];

const ACT1_BG = ['/assets/bg/drum-hollow.png', '/assets/bg/brass-canyon.png', '/assets/bg/choir-nave.png'];
const ACT1_PLACE = ['Drum Hollow', 'Brass Canyon', 'The Choir Nave'];

export const ENEMIES: Enemy[] = ROSTER.flatMap((row, a) =>
  row.map(([id, name, voice, size, sfx], i) => {
    const act = a + 1;
    const boss = i === 2;
    return {
      id,
      name,
      act,
      floor: a * 3 + i + 1,
      boss,
      place: act === 1 ? ACT1_PLACE[i] : ACTS[a].name,
      hp: boss ? Math.min(BOSS_HP + BOSS_HP_PER_ACT * a, BOSS_HP_CAP) : Math.min(ENEMY_HP + ENEMY_HP_PER_ACT * a, ENEMY_HP_CAP),
      damage: (boss ? BOSS_DAMAGE : ENEMY_DAMAGE) + DAMAGE_PER_ACT * a,
      tempo: TEMPO_BASE + TEMPO_PER_FIGHT * i + TEMPO_PER_ACT * a,
      sprite: id === 'silent-maestro' ? '/assets/sprites/choir.png' : `/assets/sprites/${id}.png`,
      spriteFilter: id === 'silent-maestro' ? 'sepia(0.55) saturate(2.2) hue-rotate(300deg) brightness(1.15)' : undefined,
      attackSprite: id === 'goblin' ? '/assets/sprites/goblin-attack.png' : undefined,
      bg: act === 1 ? ACT1_BG[i] : ACTS[a].bg,
      bgFilter: act === 1 ? undefined : ACTS[a].bgFilter,
      size,
      attackSfx: `/audio/sfx/${sfx}-attack.mp3`,
      voice,
      intro: `/audio/voice/${id}-intro.mp3`,
      ko: `/audio/voice/${id}-ko.mp3`,
      defeat: `/audio/voice/${id}-defeat.mp3`,
    } satisfies Enemy;
  }),
);

export const FINAL_FLOOR = ENEMIES.length; // 18
