import type { Card, Suit, Rank } from '@/domain/cards';
import type { Shoe } from '@/domain/deck';
import type { Action, Upcard } from '@/domain/strategy';
import type { Outcome } from '@/domain/rules';

export type Mode = 'basic' | 'counting' | 'live';

export type Speed = 'slow' | 'medium' | 'fast';

/**
 * Milliseconds between individual cards, per speed preset.
 *
 * These pace ONE card at a time, not a whole round. At a 3-player table that
 * is 10 cards per hand, so "medium" deals a hand over roughly 7 seconds -
 * about the pace of a real dealer, and slow enough to actually keep a count.
 */
export const SPEED_MS: Record<Speed, number> = {
  slow: 1100,
  medium: 700,
  fast: 420,
};

/** Pause between the end of one hand and the start of the next. */
export const BETWEEN_HANDS_MS = 1400;

export type Phase =
  | 'idle'        // pre-deal, or between hands
  | 'betting'     // live only: placing chips
  | 'dealing'     // opening cards going out one at a time
  | 'playerTurn'  // user acting on their hand(s)
  | 'seatsTurn'   // other seats auto-playing
  | 'dealerTurn'  // dealer drawing
  | 'settlement'  // dealer done, outcomes not yet applied
  | 'resolved'    // outcomes applied and on screen; terminal until NEW_HAND
  | 'countCheck'; // counting only: paused for a true-count estimate

export type Config = {
  numDecks: number;      // 1-8
  numOtherPlayers: number; // 2-7
  speed: Speed;
};

export const DEFAULT_CONFIG: Config = {
  numDecks: 6,
  numOtherPlayers: 3,
  speed: 'medium',
};

/** Bankroll constants, live mode only. */
export const STARTING_BANKROLL = 1000;
export const MIN_BET = 10;

/** Hands cannot re-split past this many. */
export const MAX_HANDS = 4;

/**
 * Count check-ins fire after a random number of hands in this inclusive range,
 * re-rolled after each check so the timing cannot be anticipated.
 *
 * Kept deliberately short: cards are dealt one at a time, so a single hand is
 * ~10-20 seconds and a wider range would leave minutes between checks.
 */
export const CHECK_INTERVAL_MIN = 2;
export const CHECK_INTERVAL_MAX = 4;

/**
 * One slot in the opening deal. The table is dealt a card at a time, in
 * casino order (each seat, then the user, then the dealer; twice round), so
 * a counter can actually follow the cards.
 */
export type DealTarget =
  | { kind: 'seat'; seatId: number }
  | { kind: 'player' }
  | { kind: 'dealer'; hole: boolean };

export type HandStatus = 'active' | 'stood' | 'bust' | 'blackjack' | 'doubled';

export type Hand = {
  cards: Card[];
  status: HandStatus;
  /** True once this hand came from a split - suppresses the 3:2 natural bonus. */
  fromSplit: boolean;
  /** Live mode: chips committed to this hand (doubles as the double-down stake). */
  bet: number;
  outcome: Outcome | null;
};

export function emptyHand(bet = 0): Hand {
  return { cards: [], status: 'active', fromSplit: false, bet, outcome: null };
}

/** A non-interactive seat that auto-plays basic strategy. */
export type Seat = {
  id: number;
  hands: Hand[];
};

/** Verdict on the user's last action, for the Basic Strategy toast. */
export type Decision = {
  chosen: Action;
  correct: Action;
  wasCorrect: boolean;
};

/** Result of a submitted true-count estimate, for the Card Counting toast. */
export type CountCheck = {
  guess: number;
  actual: number;
  wasCorrect: boolean;
  /** The breakdown revealed on a wrong answer - the only place the count appears. */
  running: number;
  decksRemaining: number;
};

export type GameState = {
  mode: Mode;
  phase: Phase;
  config: Config;

  shoe: Shoe;
  discardCount: number;
  /** Set when the cut card was passed; the next NEW_HAND reshuffles. */
  pendingReshuffle: boolean;

  playerHands: Hand[];
  activeHandIndex: number;
  /** Remaining cards of the opening deal, consumed one per DEAL_CARD. */
  dealQueue: DealTarget[];
  seats: Seat[];
  dealerHand: Hand;
  /** Dealer's hole card stays hidden until the dealer's turn. */
  holeCardRevealed: boolean;

  /**
   * NEVER rendered directly. Surfaces only inside the count-check toast,
   * and only when the user's estimate was wrong.
   */
  runningCount: number;

  lastDecision: Decision | null;
  lastCountCheck: CountCheck | null;

  handsPlayed: number;
  /** Hand number at which the next count check-in fires (counting mode). */
  nextCheckAt: number;

  bankroll: number;
  currentBet: number;
  /** Live mode: true once the bankroll can no longer cover the minimum bet. */
  busted: boolean;
};

export type GameAction =
  | { type: 'CONFIGURE'; mode: Mode; config: Config }
  | { type: 'PLACE_BET'; amount: number }
  | { type: 'CLEAR_BET' }
  | { type: 'NEW_HAND' }
  | { type: 'DEAL_CARD' }
  | { type: 'PLAYER_ACTION'; action: Action }
  | { type: 'PLAY_SEATS' }
  | { type: 'DEALER_PLAY' }
  | { type: 'SETTLE' }
  | { type: 'SUBMIT_COUNT'; guess: number }
  | { type: 'DISMISS_DECISION' }
  | { type: 'DISMISS_COUNT_CHECK' }
  | { type: 'RESET_SESSION' };

export type { Card, Suit, Rank, Shoe, Action, Upcard, Outcome };
