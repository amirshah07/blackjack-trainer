import { createShuffledShoe, deal, needsReshuffle, decksRemaining } from '@/domain/deck';
import { handValue, isBlackjack, isBust, canSplit, canDouble } from '@/domain/hand';
import { dealerShouldHit, settle, PAYOUT } from '@/domain/rules';
import { getCorrectAction, upcardValue } from '@/domain/strategy';
import { updateRunningCount, trueCount, estimatedDecksRemaining } from '@/domain/counting';
import { botAction } from '@/domain/bot';
import {
  emptyHand, DEFAULT_CONFIG, STARTING_BANKROLL, MIN_BET, MAX_HANDS,
  CHECK_INTERVAL_MIN, CHECK_INTERVAL_MAX,
  type GameState, type GameAction, type Hand, type Seat, type Config, type Mode,
} from './types';
import type { Card } from '@/domain/cards';
import type { Shoe } from '@/domain/deck';
import type { Action, Upcard } from '@/domain/strategy';

/** Injectable RNG so tests can make shuffles and check intervals deterministic. */
export type Rng = () => number;

function pickCheckInterval(handsPlayed: number, rng: Rng): number {
  const span = CHECK_INTERVAL_MAX - CHECK_INTERVAL_MIN + 1;
  return handsPlayed + CHECK_INTERVAL_MIN + Math.floor(rng() * span);
}

export function initialState(
  mode: Mode = 'basic',
  config: Config = DEFAULT_CONFIG,
  rng: Rng = Math.random,
): GameState {
  return {
    mode,
    phase: mode === 'live' ? 'betting' : 'idle',
    config,
    shoe: createShuffledShoe(config.numDecks, rng),
    discardCount: 0,
    pendingReshuffle: false,
    playerHands: [],
    activeHandIndex: 0,
    seats: Array.from({ length: config.numOtherPlayers }, (_, i) => ({ id: i, hands: [] })),
    dealerHand: emptyHand(),
    holeCardRevealed: false,
    runningCount: 0,
    lastDecision: null,
    lastCountCheck: null,
    handsPlayed: 0,
    nextCheckAt: pickCheckInterval(0, rng),
    bankroll: STARTING_BANKROLL,
    currentBet: 0,
    busted: false,
  };
}

/**
 * Mid-hand safety net.
 *
 * The cut card is only checked BETWEEN hands, but a full round at a crowded
 * table can consume more cards than remain past it - a 1-deck shoe with 7
 * other players is the worst case. Rather than deal from an empty shoe, we
 * reshuffle in place, exactly as a dealer would.
 *
 * The running count resets with the new shoe: those cards are unseen, so any
 * count carried over would be meaningless.
 */
function ensureCards(
  shoe: Shoe,
  running: number,
  rng: Rng,
): { shoe: Shoe; running: number } {
  if (shoe.cards.length > 0) return { shoe, running };
  return { shoe: createShuffledShoe(shoe.numDecks, rng), running: 0 };
}

/**
 * Deals one card, folding it into the running count as it goes.
 *
 * Every card that becomes visible must pass through here - that single
 * chokepoint is what keeps the count honest. The dealer's hole card is the
 * one exception and is counted later, on reveal.
 */
function dealCounted(
  shoe: Shoe,
  running: number,
  rng: Rng = Math.random,
): { card: Card; shoe: Shoe; running: number } {
  const safe = ensureCards(shoe, running, rng);
  const { card, shoe: next } = deal(safe.shoe);
  return { card, shoe: next, running: updateRunningCount(safe.running, [card]) };
}

/** Deals without counting - used for the hole card, counted on reveal instead. */
function dealHidden(shoe: Shoe, rng: Rng = Math.random): { card: Card; shoe: Shoe } {
  const safe = ensureCards(shoe, 0, rng);
  return deal(safe.shoe);
}

function upcardOf(state: GameState): Upcard {
  const up = state.dealerHand.cards[0];
  return up ? upcardValue(up) : 2;
}

/** Marks terminal hand statuses after cards change. */
function restatus(hand: Hand): Hand {
  if (isBust(hand.cards)) return { ...hand, status: 'bust' };
  if (hand.status === 'doubled') return hand;
  if (isBlackjack(hand.cards) && !hand.fromSplit) return { ...hand, status: 'blackjack' };
  return hand;
}

/** Advances to the next unfinished hand, or moves the phase on when none remain. */
function advanceHand(state: GameState): GameState {
  const next = state.playerHands.findIndex(
    (h, i) => i > state.activeHandIndex && h.status === 'active',
  );

  if (next !== -1) {
    return { ...state, activeHandIndex: next };
  }

  // All player hands resolved. If every one busted the dealer needn't draw.
  const allDone = state.playerHands.every((h) => h.status !== 'active');
  if (!allDone) return state;

  const anyLive = state.playerHands.some((h) => h.status !== 'bust');
  return { ...state, phase: anyLive ? 'seatsTurn' : 'dealerTurn' };
}

function startNewHand(state: GameState, rng: Rng): GameState {
  // Reshuffle at the cut card before dealing, never mid-hand.
  let shoe = state.shoe;
  let running = state.runningCount;
  let discardCount = state.discardCount;

  if (state.pendingReshuffle || needsReshuffle(shoe)) {
    shoe = createShuffledShoe(state.config.numDecks, rng);
    running = 0; // fresh shoe, count resets
    discardCount = 0;
  }

  const bet = state.mode === 'live' ? state.currentBet : 0;
  if (state.mode === 'live' && bet < MIN_BET) return state; // must bet first

  const seats: Seat[] = state.seats.map((s) => ({ ...s, hands: [emptyHand()] }));
  let player: Hand = { ...emptyHand(bet) };
  let dealer: Hand = emptyHand();

  // Two rounds, dealt left to right: seats, then user, then dealer - as at a
  // real table. The dealer's second card is the hole card and stays uncounted.
  for (let round = 0; round < 2; round++) {
    for (const seat of seats) {
      const r = dealCounted(shoe, running, rng);
      shoe = r.shoe; running = r.running;
      seat.hands[0] = { ...seat.hands[0], cards: [...seat.hands[0].cards, r.card] };
    }

    const p = dealCounted(shoe, running, rng);
    shoe = p.shoe; running = p.running;
    player = { ...player, cards: [...player.cards, p.card] };

    if (round === 0) {
      const d = dealCounted(shoe, running, rng);
      shoe = d.shoe; running = d.running;
      dealer = { ...dealer, cards: [...dealer.cards, d.card] };
    } else {
      const d = dealHidden(shoe, rng); // hole card - counted on reveal
      shoe = d.shoe;
      dealer = { ...dealer, cards: [...dealer.cards, d.card] };
    }
  }

  const playerHand = restatus(player);
  const dealerBJ = isBlackjack(dealer.cards);

  // A natural on either side ends the hand immediately.
  const immediate = playerHand.status === 'blackjack' || dealerBJ;

  return {
    ...state,
    shoe,
    discardCount,
    runningCount: running,
    pendingReshuffle: false,
    playerHands: [playerHand],
    activeHandIndex: 0,
    seats: seats.map((s) => ({ ...s, hands: s.hands.map(restatus) })),
    dealerHand: dealer,
    holeCardRevealed: immediate,
    // Reveal counts the hole card the moment it turns face up.
    ...(immediate
      ? { runningCount: updateRunningCount(running, [dealer.cards[1]]) }
      : {}),
    phase: immediate ? 'dealerTurn' : 'playerTurn',
    lastDecision: null,
    lastCountCheck: null,
  };
}

function applyPlayerAction(state: GameState, action: Action, rng: Rng): GameState {
  const hand = state.playerHands[state.activeHandIndex];
  if (!hand || hand.status !== 'active') return state;

  const upcard = upcardOf(state);

  // Basic Strategy evaluates BEFORE applying, then applies what the user chose
  // regardless - a wrong play stands, and they live with the consequence.
  const decision =
    state.mode === 'basic'
      ? {
          chosen: action,
          correct: getCorrectAction(hand.cards, upcard),
          wasCorrect: action === getCorrectAction(hand.cards, upcard),
        }
      : state.lastDecision;

  let shoe = state.shoe;
  let running = state.runningCount;
  const hands = [...state.playerHands];
  let bankroll = state.bankroll;

  const draw = () => {
    const r = dealCounted(shoe, running, rng);
    shoe = r.shoe; running = r.running;
    return r.card;
  };

  switch (action) {
    case 'hit': {
      const updated = { ...hand, cards: [...hand.cards, draw()] };
      hands[state.activeHandIndex] = restatus(updated);
      break;
    }

    case 'stand': {
      hands[state.activeHandIndex] = { ...hand, status: 'stood' };
      break;
    }

    case 'double': {
      if (!canDouble(hand.cards)) return state;
      if (state.mode === 'live' && bankroll < hand.bet) return state;
      if (state.mode === 'live') bankroll -= hand.bet;

      const updated = {
        ...hand,
        cards: [...hand.cards, draw()],
        bet: hand.bet * 2,
        status: 'doubled' as const,
      };
      hands[state.activeHandIndex] = isBust(updated.cards)
        ? { ...updated, status: 'bust' }
        : updated;
      break;
    }

    case 'split': {
      if (!canSplit(hand.cards) || hands.length >= MAX_HANDS) return state;
      if (state.mode === 'live' && bankroll < hand.bet) return state;
      if (state.mode === 'live') bankroll -= hand.bet;

      const [a, b] = hand.cards;
      const isAces = a.rank === 'A';

      const first: Hand = { ...hand, cards: [a, draw()], fromSplit: true };
      const second: Hand = {
        ...emptyHand(hand.bet),
        cards: [b, draw()],
        fromSplit: true,
      };

      // Split aces get exactly one card each and then stand.
      const finish = (h: Hand): Hand =>
        isAces ? { ...h, status: 'stood' } : restatus(h);

      hands.splice(state.activeHandIndex, 1, finish(first), finish(second));
      break;
    }
  }

  const next: GameState = {
    ...state,
    shoe,
    runningCount: running,
    playerHands: hands,
    bankroll,
    lastDecision: decision ?? null,
  };

  // Hitting into 21 or busting ends the hand without another prompt.
  const current = next.playerHands[next.activeHandIndex];
  const finished =
    current.status !== 'active' || handValue(current.cards).total >= 21;

  if (finished && current.status === 'active') {
    next.playerHands = [...next.playerHands];
    next.playerHands[next.activeHandIndex] = { ...current, status: 'stood' };
  }

  return finished ? advanceHand(next) : next;
}

/** Auto-plays every other seat to completion, then hands off to the dealer. */
function playSeats(state: GameState, rng: Rng): GameState {
  let shoe = state.shoe;
  let running = state.runningCount;
  const upcard = upcardOf(state);

  const seats: Seat[] = state.seats.map((seat) => {
    const hands: Hand[] = [...seat.hands];

    for (let i = 0; i < hands.length; i++) {
      let guard = 0;
      while (hands[i].status === 'active' && guard++ < 20) {
        const h = hands[i];
        const act = botAction(h.cards, upcard, { handCount: hands.length });

        if (act === 'stand') { hands[i] = { ...h, status: 'stood' }; break; }

        if (act === 'split' && canSplit(h.cards) && hands.length < MAX_HANDS) {
          const [a, b] = h.cards;
          const isAces = a.rank === 'A';
          const c1 = dealCounted(shoe, running, rng); shoe = c1.shoe; running = c1.running;
          const c2 = dealCounted(shoe, running, rng); shoe = c2.shoe; running = c2.running;

          const mk = (card: Card, other: Card): Hand => {
            const nh: Hand = { ...emptyHand(), cards: [other, card], fromSplit: true };
            return isAces ? { ...nh, status: 'stood' } : restatus(nh);
          };
          hands.splice(i, 1, mk(c1.card, a), mk(c2.card, b));
          continue;
        }

        // hit, or a double that just draws one card and stops
        const r = dealCounted(shoe, running, rng); shoe = r.shoe; running = r.running;
        const updated = restatus({ ...h, cards: [...h.cards, r.card] });

        hands[i] = act === 'double' && updated.status === 'active'
          ? { ...updated, status: 'stood' }
          : updated;

        if (handValue(hands[i].cards).total >= 21 && hands[i].status === 'active') {
          hands[i] = { ...hands[i], status: 'stood' };
        }
      }
    }
    return { ...seat, hands };
  });

  return { ...state, seats, shoe, runningCount: running, phase: 'dealerTurn' };
}

/** Reveals the hole card and draws to the fixed stand-on-soft-17 rule. */
function playDealer(state: GameState, rng: Rng): GameState {
  let shoe = state.shoe;
  let running = state.runningCount;
  let cards = [...state.dealerHand.cards];

  // The hole card becomes visible now, so it joins the count now.
  if (!state.holeCardRevealed && cards[1]) {
    running = updateRunningCount(running, [cards[1]]);
  }

  // No live hands left to beat - dealer doesn't draw.
  const anyLive = state.playerHands.some((h) => h.status !== 'bust');
  if (anyLive) {
    let guard = 0;
    while (dealerShouldHit(cards) && guard++ < 20) {
      const r = dealCounted(shoe, running, rng);
      shoe = r.shoe; running = r.running;
      cards = [...cards, r.card];
    }
  }

  return {
    ...state,
    shoe,
    runningCount: running,
    holeCardRevealed: true,
    dealerHand: { ...state.dealerHand, cards },
    phase: 'settlement',
  };
}

function settleRound(state: GameState): GameState {
  let bankroll = state.bankroll;

  const playerHands = state.playerHands.map((hand) => {
    const outcome = settle(hand.cards, state.dealerHand.cards, hand.fromSplit);
    if (state.mode === 'live') {
      // The stake was already deducted when bet/doubled/split; return it plus
      // winnings, so a push returns exactly the stake.
      bankroll += hand.bet + hand.bet * PAYOUT[outcome];
    }
    return { ...hand, outcome };
  });

  const cardsOut =
    playerHands.reduce((n, h) => n + h.cards.length, 0) +
    state.seats.reduce((n, s) => n + s.hands.reduce((m, h) => m + h.cards.length, 0), 0) +
    state.dealerHand.cards.length;

  const handsPlayed = state.handsPlayed + 1;

  return {
    ...state,
    playerHands,
    bankroll,
    discardCount: state.discardCount + cardsOut,
    handsPlayed,
    pendingReshuffle: needsReshuffle(state.shoe),
    busted: state.mode === 'live' && bankroll < MIN_BET,
    currentBet: state.mode === 'live' ? 0 : state.currentBet,
    // Counting mode pauses for an estimate when the interval comes due.
    // Otherwise the hand is terminal until the next NEW_HAND - a distinct
    // phase from 'settlement' so a repeated SETTLE cannot double-count it.
    phase:
      state.mode === 'counting' && handsPlayed >= state.nextCheckAt
        ? 'countCheck'
        : 'resolved',
  };
}

function submitCount(state: GameState, guess: number, rng: Rng): GameState {
  const decksLeft = estimatedDecksRemaining(state.shoe);
  const actual = trueCount(state.runningCount, decksRemaining(state.shoe));

  return {
    ...state,
    lastCountCheck: {
      guess,
      actual,
      wasCorrect: guess === actual,
      running: state.runningCount,
      decksRemaining: decksLeft,
    },
    nextCheckAt: pickCheckInterval(state.handsPlayed, rng),
    phase: 'resolved',
  };
}

export function createReducer(rng: Rng = Math.random) {
  return function reducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
      case 'CONFIGURE':
        return initialState(action.mode, action.config, rng);

      case 'PLACE_BET': {
        if (state.mode !== 'live') return state;
        const amount = Math.min(action.amount, state.bankroll);
        return { ...state, currentBet: state.currentBet + amount, bankroll: state.bankroll - amount };
      }

      case 'CLEAR_BET': {
        if (state.mode !== 'live') return state;
        return { ...state, bankroll: state.bankroll + state.currentBet, currentBet: 0 };
      }

      case 'NEW_HAND':
        return startNewHand(state, rng);

      case 'PLAYER_ACTION':
        return state.phase === 'playerTurn'
          ? applyPlayerAction(state, action.action, rng)
          : state;

      case 'PLAY_SEATS':
        return state.phase === 'seatsTurn' ? playSeats(state, rng) : state;

      case 'DEALER_PLAY':
        return state.phase === 'dealerTurn' ? playDealer(state, rng) : state;

      case 'SETTLE':
        return state.phase === 'settlement' ? settleRound(state) : state;

      case 'SUBMIT_COUNT':
        return state.phase === 'countCheck'
          ? submitCount(state, action.guess, rng)
          : state;

      case 'DISMISS_DECISION':
        return { ...state, lastDecision: null };

      case 'DISMISS_COUNT_CHECK':
        return { ...state, lastCountCheck: null };

      case 'RESET_SESSION':
        return initialState(state.mode, state.config, rng);

      default:
        return state;
    }
  };
}

export const reducer = createReducer();
