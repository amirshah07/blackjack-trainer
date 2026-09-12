'use client';

import { memo } from 'react';
import type { Card as CardType, Suit } from '@/game/types';

const SUIT_GLYPH: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const RED: Suit[] = ['hearts', 'diamonds'];

export type CardProps = {
  card?: CardType;
  /** Face-down renders the back design; the rank is not in the DOM at all. */
  faceDown?: boolean;
  /** Deal-in animation offset, so cards in a hand stagger. */
  index?: number;
  size?: 'sm' | 'md';
};

/**
 * A single playing card as inline SVG.
 *
 * Face-down cards deliberately render NO rank or suit data - the hole card
 * must not be readable from the DOM, or the counting drill is trivially
 * defeatable with devtools.
 */
function CardImpl({ card, faceDown = false, index = 0, size = 'md' }: CardProps) {
  const w = size === 'sm' ? 48 : 64;
  const h = Math.round(w * 1.4);

  if (faceDown || !card) {
    return (
      <svg
        width={w}
        height={h}
        viewBox="0 0 64 90"
        className="card-deal drop-shadow-lg"
        style={{ animationDelay: `${index * 90}ms` }}
        aria-label="Face-down card"
        role="img"
      >
        <rect x="1" y="1" width="62" height="88" rx="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <rect x="5" y="5" width="54" height="80" rx="4" fill="#1e3a8a" />
        <path d="M5 45 L32 5 L59 45 L32 85 Z" fill="#1d4ed8" opacity="0.55" />
        <circle cx="32" cy="45" r="11" fill="#f8fafc" opacity="0.18" />
      </svg>
    );
  }

  const red = RED.includes(card.suit);
  const colour = red ? '#dc2626' : '#0f172a';
  const glyph = SUIT_GLYPH[card.suit];
  const label = `${card.rank} of ${card.suit}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 64 90"
      className="card-deal drop-shadow-lg"
      style={{ animationDelay: `${index * 90}ms` }}
      aria-label={label}
      role="img"
    >
      <rect x="1" y="1" width="62" height="88" rx="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
      <text x="7" y="22" fontSize="17" fontWeight="700" fill={colour} fontFamily="ui-sans-serif, system-ui">
        {card.rank}
      </text>
      <text x="7" y="36" fontSize="14" fill={colour} fontFamily="ui-sans-serif, system-ui">
        {glyph}
      </text>
      <text x="34" y="60" fontSize="30" fill={colour} textAnchor="middle" fontFamily="ui-sans-serif, system-ui">
        {glyph}
      </text>
      {/* No mirrored bottom corner: at this size it collides with the card
          fanned in front of it, and the top-left corner is the only one a
          fanned hand actually shows. */}
    </svg>
  );
}

export const Card = memo(CardImpl);
