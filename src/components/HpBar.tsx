/**
 * HpBar.tsx — a health bar. Never shows below 0 (PRD §4).
 */

interface HpBarProps {
  hp: number;
  maxHp: number;
  color?: string;
}

export function HpBar({ hp, maxHp, color = 'var(--player)' }: HpBarProps) {
  const shown = Math.max(0, hp); // HP never displays below 0
  const pct = maxHp > 0 ? (shown / maxHp) * 100 : 0;
  return (
    <div style={{ width: 160, background: 'var(--hp-back)', borderRadius: 4, overflow: 'hidden' }}>
      <div
        style={{
          width: `${pct}%`,
          height: 14,
          background: color,
          transition: 'width 200ms ease',
        }}
      />
      <span style={{ fontSize: 12 }}>
        {shown} / {maxHp}
      </span>
    </div>
  );
}
