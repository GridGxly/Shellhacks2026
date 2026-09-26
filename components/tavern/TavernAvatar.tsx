'use client';

import type { CSSProperties } from 'react';
import { INSTRUMENTS, type InstrumentId } from '@/lib/content';
import { getTavernCharacter } from '@/lib/tavern-characters';
import { Sprite } from '../ui';

export interface TavernAvatarProps {
  characterId?: string | null;
  instrument: InstrumentId;
  x?: number;
  y?: number;
  size?: number;
  facing?: 'right' | 'left';
  /** Existing play/breathe animation class, applied inside the facing transform. */
  className?: string;
  style?: CSSProperties;
}

/** Decorative artwork; the containing player card supplies the accessible name. */
export default function TavernAvatar({ characterId, instrument, x = 0, y = 0, size = 340, facing = 'right', className, style }: TavernAvatarProps) {
  const character = getTavernCharacter(characterId);
  const selectedInstrument = INSTRUMENTS.find(item => item.id === instrument) ?? INSTRUMENTS[0];
  return <div className="tavern-avatar" data-character={character.id} aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: size, height: size, pointerEvents: 'none', ...style }}>
    <div style={{ width: '100%', height: '100%', transform: facing === 'left' ? 'scaleX(-1)' : undefined }}>
      <Sprite src={character.sprite ?? selectedInstrument.sprite} x={0} y={0} size={size} className={className} style={character.sprite ? { mixBlendMode: 'normal' } : undefined} />
    </div>
  </div>;
}
