/** Cosmetic Tavern identity. Instrument choice and pitch scoring stay independent. */
export type TavernCharacterId = 'riff' | 'nova' | 'brass' | 'ember';

export interface TavernCharacter {
  id: TavernCharacterId;
  name: string;
  description: string;
  /** Riff keeps his existing instrument-specific sprites. */
  sprite: string | null;
}

export const TAVERN_CHARACTERS: readonly TavernCharacter[] = [
  { id: 'riff', name: 'Riff', description: 'First through the door. Last to leave the stage.', sprite: null },
  { id: 'nova', name: 'Nova', description: 'A little starlight. A lot of stage presence.', sprite: '/assets/tavern/characters/nova.png' },
  { id: 'brass', name: 'Brass', description: 'A heart of brass. Impeccable timing.', sprite: '/assets/tavern/characters/brass.png' },
  { id: 'ember', name: 'Ember', description: 'Warm up the room. Turn up the chorus.', sprite: '/assets/tavern/characters/ember.png' },
];

export function isTavernCharacterId(value: unknown): value is TavernCharacterId {
  return typeof value === 'string' && TAVERN_CHARACTERS.some(character => character.id === value);
}

/** Old rooms and unknown values always retain the original performer. */
export function getTavernCharacter(value: unknown): TavernCharacter {
  return TAVERN_CHARACTERS.find(character => character.id === value) ?? TAVERN_CHARACTERS[0];
}
