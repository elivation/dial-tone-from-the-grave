import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deckReducer, initDeck, liveItems, type Deck, type DeckAction } from './pageDeck';

class Fake {
  disposals = 0;
  dispose() {
    this.disposals += 1;
  }
}
const show = (
  next: Fake,
  id: string | undefined,
  index: number | undefined,
  animate = true,
): DeckAction<Fake> => ({ type: 'show', next, id, index, animate });

describe('pageDeck', () => {
  it('[Req 13.2] a change that is not a flip swaps the page in place and frees the old one', () => {
    const a = new Fake();
    const b = new Fake();
    const deck = deckReducer(initDeck(a, 'p1', 0), show(b, 'p1', 0));
    expect(deck.current).toBe(b);
    expect(deck.turn).toBeNull();
    expect(deck.garbage).toEqual([a]);
  });

  it('[Req 13.2] a flip forward keeps the old page for the turn and frees nothing yet', () => {
    const a = new Fake();
    const b = new Fake();
    const deck = deckReducer(initDeck(a, 'p1', 0), show(b, 'p2', 1));
    expect(deck.current).toBe(b);
    expect(deck.turn?.from).toBe(a);
    expect(deck.turn?.direction).toBe(1);
    expect(deck.garbage).toEqual([]);
  });

  it('[Req 13.2] a flip back turns the other way', () => {
    const deck = deckReducer(initDeck(new Fake(), 'p2', 1), show(new Fake(), 'p1', 0));
    expect(deck.turn?.direction).toBe(-1);
  });

  it('[Req 13.2] finishing the turn frees the old page, and finishing twice does nothing more', () => {
    const a = new Fake();
    const turning = deckReducer(initDeck(a, 'p1', 0), show(new Fake(), 'p2', 1));
    const done = deckReducer(turning, { type: 'finish' });
    expect(done.turn).toBeNull();
    expect(done.garbage).toEqual([a]);
    expect(deckReducer(done, { type: 'finish' })).toBe(done);
  });

  it('[Req 13.2] with reduced motion a flip is instant and frees the old page at once', () => {
    const a = new Fake();
    const deck = deckReducer(initDeck(a, 'p1', 0), show(new Fake(), 'p2', 1, false));
    expect(deck.turn).toBeNull();
    expect(deck.garbage).toEqual([a]);
  });

  it('[Req 13.2] a page with no index, such as the empty page, is never turned to', () => {
    const deck = deckReducer(initDeck(new Fake(), 'p1', 0), show(new Fake(), 'empty', undefined));
    expect(deck.turn).toBeNull();
  });

  it('[Req 13.2] flipping again mid turn finishes the first turn and starts a second', () => {
    const [a, b, c] = [new Fake(), new Fake(), new Fake()] as const;
    const first = deckReducer(initDeck(a, 'p1', 0), show(b, 'p2', 1));
    const second = deckReducer(first, show(c, 'p3', 2));
    expect(second.turn?.from).toBe(b);
    expect(second.turn?.id).not.toBe(first.turn?.id);
    expect(second.garbage).toEqual([a]);
  });

  it('[Req 13.2] a repaint mid turn replaces the page being turned to, and keeps the old one', () => {
    const [a, b, c] = [new Fake(), new Fake(), new Fake()] as const;
    const turning = deckReducer(initDeck(a, 'p1', 0), show(b, 'p2', 1));
    const repainted = deckReducer(turning, show(c, 'p2', 1));
    expect(repainted.turn?.from).toBe(a);
    expect(repainted.turn?.id).toBe(turning.turn?.id);
    expect(repainted.current).toBe(c);
    expect(repainted.garbage).toEqual([b]);
  });

  it('[Req 13.2] showing the page already shown changes nothing', () => {
    const a = new Fake();
    const deck = initDeck(a, 'p1', 0);
    expect(deckReducer(deck, show(a, 'p1', 0))).toBe(deck);
  });

  it('[Req 13.2] any run of flips, repaints and finished turns frees every texture once and keeps what is on show', () => {
    const step = fc.oneof(
      fc.record({ kind: fc.constant('flip' as const), index: fc.integer({ min: 0, max: 11 }) }),
      fc.record({ kind: fc.constant('repaint' as const), index: fc.constant(0) }),
      fc.record({ kind: fc.constant('finish' as const), index: fc.constant(0) }),
      fc.record({ kind: fc.constant('instant' as const), index: fc.integer({ min: 0, max: 11 }) }),
    );
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        const everything: Fake[] = [new Fake()];
        let deck: Deck<Fake> = initDeck(everything[0]!, 'p0', 0);
        let pageNo = 0;
        let index = 0;
        const dispatch = (action: DeckAction<Fake>) => {
          const before = deck;
          deck = deckReducer(deck, action);
          // The component frees whatever a new state lists as garbage, once, after rendering it.
          if (deck !== before) deck.garbage.forEach((item) => item.dispose());
          const live = liveItems(deck);
          expect(live.length).toBeLessThanOrEqual(2);
          for (const item of live) expect(item.disposals).toBe(0);
        };
        for (const s of steps) {
          if (s.kind === 'finish') dispatch({ type: 'finish' });
          else {
            const next = new Fake();
            everything.push(next);
            if (s.kind === 'repaint') dispatch(show(next, `p${pageNo}`, index));
            else {
              pageNo += 1;
              index = s.index;
              dispatch(show(next, `p${pageNo}`, index, s.kind === 'flip'));
            }
          }
        }
        dispatch({ type: 'finish' });
        for (const item of everything) {
          expect(item.disposals).toBe(item === deck.current ? 0 : 1);
        }
      }),
    );
  });
});
