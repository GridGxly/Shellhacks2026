'use client';

import { useId } from 'react';
import { INSTRUMENTS, type InstrumentId } from '@/lib/content';
import { getTavernCharacter, TAVERN_CHARACTERS, type TavernCharacterId } from '@/lib/tavern-characters';
import TavernAvatar from './TavernAvatar';
import './tavern-characters.css';

export interface TavernCharacterSelectProps {
  characterId: string | null;
  instrument: InstrumentId;
  onCharacterChange: (id: TavernCharacterId) => void;
  onInstrumentChange: (id: InstrumentId) => void;
  onContinue: () => void;
  onBack?: () => void;
  disabled?: boolean;
  continueLabel?: string;
}

/** Controlled, cosmetic selection. Parent owns routing, room creation and audio. */
export default function TavernCharacterSelect({ characterId, instrument, onCharacterChange, onInstrumentChange, onContinue, onBack, disabled = false, continueLabel }: TavernCharacterSelectProps) {
  const id = useId();
  const selected = getTavernCharacter(characterId);
  return <section className="tavern-character-select" aria-labelledby={`${id}-heading`} aria-busy={disabled}>
    <h2 id={`${id}-heading`}>CHOOSE YOUR<br />PERFORMER</h2>
    <div className="tavern-character-preview" key={selected.id}>
      <TavernAvatar characterId={selected.id} instrument={instrument} size={436} />
    </div>
    <div className="tavern-character-description" aria-live="polite" aria-atomic="true">
      <strong>{selected.name.toUpperCase()}</strong>
      <p>{selected.description}</p>
    </div>
    <div className="tavern-character-panel">
      <fieldset className="tavern-character-roster" disabled={disabled}>
        <legend>CHARACTER · COSMETIC ONLY</legend>
        <div className="tavern-character-options">
          {TAVERN_CHARACTERS.map(character => <label key={character.id} className="tavern-character-option" data-selected={selected.id === character.id}>
            <input type="radio" name={`${id}-character`} value={character.id} checked={selected.id === character.id} onChange={() => onCharacterChange(character.id)} aria-label={character.name} />
            <span className="tavern-character-thumbnail"><TavernAvatar characterId={character.id} instrument={instrument} size={160} /></span>
            <span>{character.name.toUpperCase()}</span>
          </label>)}
        </div>
      </fieldset>
      <fieldset className="tavern-character-instruments" disabled={disabled}>
        <legend>INSTRUMENT · CHOOSE YOUR SOUND</legend>
        <div className="tavern-instrument-options">
          {INSTRUMENTS.map(item => <label key={item.id} className="tavern-instrument-option" data-selected={instrument === item.id}>
            <input type="radio" name={`${id}-instrument`} value={item.id} checked={instrument === item.id} onChange={() => onInstrumentChange(item.id)} aria-label={item.name} />
            <span>{item.name.toUpperCase()}</span>
          </label>)}
        </div>
      </fieldset>
      <p className="tavern-character-explanation">Every performer can use every instrument. Same scoring.</p>
    </div>
    <div className="tavern-character-actions">
      {onBack && <button type="button" className="tavern-character-back" disabled={disabled} onClick={onBack}>← BACK</button>}
      <button type="button" className="tavern-character-continue" disabled={disabled} onClick={onContinue}>{continueLabel ?? `USE ${selected.name.toUpperCase()} · CONTINUE →`}</button>
    </div>
  </section>;
}
