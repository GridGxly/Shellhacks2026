'use client';

import { useId, useState } from 'react';
import { sfx } from '@/lib/audio';
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

// Where the notes burst from when an instrument is picked (the bell/keys sit
// right of centre, about chest height on every performer).
const FLOURISH = [[-40, -120], [30, -150], [95, -105]];

/** Controlled, cosmetic selection. Parent owns routing, room creation and audio. */
export default function TavernCharacterSelect({ characterId, instrument, onCharacterChange, onInstrumentChange, onContinue, onBack, disabled = false, continueLabel }: TavernCharacterSelectProps) {
  const id = useId();
  const selected = getTavernCharacter(characterId);
  // Which pick just happened decides the answer on stage: a new performer drops
  // in and lands, a new instrument gets a hop and a flourish of notes.
  const [change, setChange] = useState<'character' | 'instrument' | null>(null);
  const pickCharacter = (next: TavernCharacterId) => {
    if (next === selected.id) return;
    setChange('character');
    sfx('pop');
    sfx('drop', 0.18);
    onCharacterChange(next);
  };
  const pickInstrument = (next: InstrumentId) => {
    if (next === instrument) return;
    setChange('instrument');
    sfx('equip');
    onInstrumentChange(next);
  };
  return <section className="tavern-character-select" aria-labelledby={`${id}-heading`} aria-busy={disabled}>
    <h2 id={`${id}-heading`}>CHOOSE YOUR<br />PERFORMER</h2>
    <div className="tavern-character-preview" key={selected.id} data-change={change === 'character' ? 'swap' : undefined}>
      <div key={instrument} className={`tavern-performer${change === 'instrument' ? ' tavern-performer-flourish' : ''}`}>
        <TavernAvatar characterId={selected.id} instrument={instrument} size={436} />
        {change === 'instrument' && <span className="tavern-flourish-notes" aria-hidden="true">
          {FLOURISH.map(([dx, dy], n) => <span key={n} style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`, animationDelay: `${60 + n * 70}ms`, color: ['#FFD23F', '#FF7DB8', '#9FD8FF'][n] }}>{n === 1 ? '♫' : '♪'}</span>)}
        </span>}
      </div>
      {change === 'character' && <div className="tavern-swap-dust" aria-hidden="true">{Array.from({ length: 6 }, (_, n) => <i key={n} style={{ left: 40 + n * 44, animationDelay: `${180 + (n % 2) * 30}ms` }} />)}</div>}
    </div>
    <div className="tavern-character-description" key={`about-${selected.id}`} aria-live="polite" aria-atomic="true">
      <strong>{selected.name.toUpperCase()}</strong>
      <p>{selected.description}</p>
    </div>
    <div className="tavern-character-panel">
      <fieldset className="tavern-character-roster" disabled={disabled}>
        <legend>CHARACTER · COSMETIC ONLY</legend>
        <div className="tavern-character-options">
          {TAVERN_CHARACTERS.map(character => <label key={character.id} className="tavern-character-option" data-selected={selected.id === character.id}>
            <input type="radio" name={`${id}-character`} value={character.id} checked={selected.id === character.id} onChange={() => pickCharacter(character.id)} aria-label={character.name} />
            <span className="tavern-character-thumbnail"><TavernAvatar characterId={character.id} instrument={instrument} size={160} /></span>
            <span>{character.name.toUpperCase()}</span>
          </label>)}
        </div>
      </fieldset>
      <fieldset className="tavern-character-instruments" disabled={disabled}>
        <legend>INSTRUMENT · CHOOSE YOUR SOUND</legend>
        <div className="tavern-instrument-options">
          {INSTRUMENTS.map(item => <label key={item.id} className="tavern-instrument-option" data-selected={instrument === item.id}>
            <input type="radio" name={`${id}-instrument`} value={item.id} checked={instrument === item.id} onChange={() => pickInstrument(item.id)} aria-label={item.name} />
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
