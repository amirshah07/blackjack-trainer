import { handValue, canSplit, canDouble } from '@/domain/hand';
import { MAX_HANDS, MIN_BET, type GameState, type Hand } from './types';
import type { Action } from '@/domain/strategy';

/**
 * View-model helpers. The UI layer cannot import domain/ directly, so every
 * derived value a component needs is computed here and handed over as plain
 * data.
 */

/** Display total: "7 / 17" for a soft hand, plain number otherwise. */
export function handLabel(hand: Hand, hidden = false): string {
  if (hidden) return '';
  if (hand.cards.length === 0) return '';

  const { total, isSoft } = handValue(hand.cards);
  if (hand.status === 'bust') return `${total} BUST`;
  if (hand.status === 'blackjack') return 'BLACKJACK';
  if (isSoft && total <= 21) return `${total - 10}/${total}`;
  return String(total);
}

/** Dealer's visible total while the hole card is down - upcard only. */
export function dealerVisibleLabel(state: GameState): string {
  if (state.holeCardRevealed) return handLabel(state.dealerHand);
  const up = state.dealerHand.cards[0];
  if (!up) return '';
  return String(handValue([up]).total);
}

export const OUTCOME_LABEL: Record<string, string> = {
  win: 'WIN',
  lose: 'LOSE',
  push: 'PUSH',
  blackjack: 'BLACKJACK 3:2',
};

/** Which actions are legal right now, for enabling the action bar. */
export function legalActions(state: GameState): Record<Action, boolean> {
  const hand = state.playerHands[state.activeHandIndex];
  const none = { hit: false, stand: false, double: false, split: false };

  if (!hand || state.phase !== 'playerTurn' || hand.status !== 'active') return none;

  const twoCards = canDouble(hand.cards);
  const affordable = state.mode !== 'live' || state.bankroll >= hand.bet;

  return {
    hit: true,
    stand: true,
    double: twoCards && affordable,
    split:
      canSplit(hand.cards) &&
      state.playerHands.length < MAX_HANDS &&
      affordable,
  };
}

/** True when the user can start the next hand. */
export function canDeal(state: GameState): boolean {
  if (state.busted) return false;
  const terminal = state.phase === 'idle' || state.phase === 'resolved' || state.phase === 'betting';
  if (!terminal) return false;
  if (state.mode === 'live') return state.currentBet >= MIN_BET;
  return true;
}

/**
 * The stake actually at risk right now.
 *
 * Before the deal that is the chips in the circle; once a hand is live the
 * stake moves onto the hand itself, and doubling or splitting changes it.
 * Reading `currentBet` alone shows an empty circle mid-hand and misses a
 * double, so the felt disagrees with what the player has committed.
 */
export function stakeAtRisk(state: GameState): number {
  if (state.mode !== 'live') return 0;

  // Once a hand is settled the stake has been paid out, so nothing is at
  // risk. Leaving the old amount on the felt shows chips in the circle while
  // Deal is disabled, which reads as a stuck table.
  if (state.phase === 'resolved' || state.phase === 'betting' || state.phase === 'idle') {
    return state.currentBet;
  }

  const onHands = state.playerHands.reduce((sum, h) => sum + h.bet, 0);
  return onHands > 0 ? onHands : state.currentBet;
}

/** Chip denominations affordable from the current bankroll. */
export function affordableChips(state: GameState, denominations: number[]): number[] {
  return denominations.filter((d) => d <= state.bankroll);
}
