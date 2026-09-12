'use client';

import { memo } from 'react';

const CHIP_STYLE: Record<number, { face: string; edge: string; ink: string }> = {
  10:  { face: '#c02537', edge: '#8c1526', ink: '#fff' },  // red
  25:  { face: '#1f7a4d', edge: '#0f5636', ink: '#fff' }, // green
  100: { face: '#1a1a1e', edge: '#000000', ink: '#fff' },  // black
};

export type ChipProps = {
  value: number;
  size?: number;
  index?: number;
  onClick?: () => void;
  disabled?: boolean;
};

/** A single casino chip as an SVG disc. */
function ChipImpl({ value, size = 44, index = 0, onClick, disabled }: ChipProps) {
  const s = CHIP_STYLE[value] ?? CHIP_STYLE[100];
  const interactive = !!onClick;

  const disc = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="chip-slide drop-shadow-md"
      style={{ animationDelay: `${index * 60}ms` }}
      aria-label={`$${value} chip`}
      role="img"
    >
      <circle cx="24" cy="24" r="23" fill={s.edge} />
      {/* edge spots */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="22" y="0" width="4" height="7" rx="1.5"
          fill="#ffffff" opacity="0.85"
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="17.5" fill={s.face} />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
      <text
        x="24" y="29"
        fontSize={value >= 100 ? 13 : 15}
        fontWeight="700"
        fill={s.ink}
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
      >
        {value}
      </text>
    </svg>
  );

  if (!interactive) return disc;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`Bet $${value}`}
      className="rounded-full transition enabled:hover:-translate-y-1 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      {disc}
    </button>
  );
}

export const Chip = memo(ChipImpl);
