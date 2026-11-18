/** Anything that holds GPU memory until it is told to let go. */
export type Disposable = { dispose: () => void };

/** A leaf in the air: the page it came from stays alive until it lands. */
export type Turn<T> = { id: number; direction: 1 | -1; from: T };

/**
 * The page textures the book is showing, and the ones it must keep a moment longer. `garbage`
 * lists what this change has just made unreachable. The component frees it once, after it has
 * rendered this state, so a page is never freed while something still draws it.
 */
export type Deck<T> = {
  current: T;
  /** Identity and position of the page `current` shows, to tell a flip from a repaint. */
  id: string | undefined;
  index: number | undefined;
  turn: Turn<T> | null;
  garbage: readonly T[];
  turns: number;
};

export type DeckAction<T> =
  | {
      type: 'show';
      next: T;
      id: string | undefined;
      index: number | undefined;
      /** False with reduced motion: a flip then swaps the page at once. */
      animate: boolean;
    }
  | { type: 'finish' };

export function initDeck<T>(
  current: T,
  id: string | undefined,
  index: number | undefined,
): Deck<T> {
  return { current, id, index, turn: null, garbage: [], turns: 0 };
}

/** The textures that are in use right now. */
export function liveItems<T>(deck: Deck<T>): T[] {
  return deck.turn ? [deck.current, deck.turn.from] : [deck.current];
}

function directionOf<T>(deck: Deck<T>, action: DeckAction<T> & { type: 'show' }): 0 | 1 | -1 {
  const { id, index } = action;
  if (!action.animate || id === deck.id) return 0;
  if (index === undefined || deck.index === undefined) return 0;
  return index < deck.index ? -1 : 1;
}

/**
 * Pure, so rapid flips can be checked as a property: after any run of changes every texture is
 * freed exactly once, and the ones on show or in the air are never freed.
 */
export function deckReducer<T>(deck: Deck<T>, action: DeckAction<T>): Deck<T> {
  if (action.type === 'finish') {
    if (!deck.turn) return deck;
    return { ...deck, turn: null, garbage: [deck.turn.from] };
  }
  if (action.next === deck.current) return deck;
  const direction = directionOf(deck, action);
  const shown = { current: action.next, id: action.id, index: action.index };
  if (direction === 0) {
    return { ...deck, ...shown, garbage: [deck.current] };
  }
  // A flip that lands mid turn ends that turn on the spot, then starts its own.
  return {
    ...deck,
    ...shown,
    turn: { id: deck.turns + 1, direction, from: deck.current },
    garbage: deck.turn ? [deck.turn.from] : [],
    turns: deck.turns + 1,
  };
}
