import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CallState } from '@/lib/callMachine';
import { INCOMING_MESSAGES } from '@/lib/incoming';
import type { OperatorChat } from './useOperatorChat';
import type { UseCall } from './useCall';
import type { BusinessResult } from '@/lib/listingSearch';
import type { BookView } from '@/components/PhoneCanvas/PhoneBook3D';
import type { OperatorChatOptions } from './useOperatorChat';
import { addPage, emptySession } from '@/lib/bookSession';
import type { Listing } from '@/lib/sse';
import { PhoneScene } from './PhoneScene';

const call = vi.hoisted(() => ({ current: null as unknown }));
const chat = vi.hoisted(() => ({ current: null as unknown }));

const useCallSpy = vi.hoisted(() => vi.fn());
vi.mock('./useCall', () => ({
  useCall: (options: unknown) => {
    useCallSpy(options);
    return call.current;
  },
}));
const openBookSpy = vi.hoisted(() => ({ current: vi.fn() }));
const chatOptions = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('./useOperatorChat', () => ({
  useOperatorChat: (options: unknown) => {
    chatOptions.current = options;
    return chat.current;
  },
}));
// There is no WebGL in jsdom. The stub shows whether the scene was handed a book, and hands the
// test the book's callbacks so it can click and flip the way the 3D pages would.
vi.mock('@/components/PhoneCanvas/PhoneCanvasLoader', () => ({
  PhoneCanvasLoader: ({
    book,
    active,
    onSettled,
  }: {
    book?: BookView;
    active: boolean;
    onSettled?: () => void;
  }) => {
    bookView.current = book;
    return (
      <div
        data-testid="scene"
        data-active={String(active)}
        data-book={book ? `open:${book.results.length}` : 'none'}
        data-first={book?.results[0]?.id ?? ''}
        data-called={(book?.calledIds ?? []).join(',')}
        data-dogeared={String(book?.dogEared ?? false)}
      >
        <button type="button" onClick={onSettled}>
          settle scene
        </button>
      </div>
    );
  },
}));
const bookView = vi.hoisted(() => ({ current: undefined as unknown }));

const restingDial: UseCall['controller'] = {
  rotation: 0,
  phase: 'idle',
  activeDigit: null,
  disabled: true,
  reducedMotion: false,
  grab: () => false,
  drag: () => {},
  release: () => false,
  press: () => false,
};

function setCall(state: CallState) {
  call.current = {
    state,
    controller: restingDial,
    pickUp: vi.fn(),
    hangUp: vi.fn(),
    dismiss: vi.fn(),
    send: vi.fn(),
  } satisfies UseCall;
}

function setChat(overrides: Partial<OperatorChat> = {}) {
  const closeBook = vi.fn();
  const openBook = vi.fn();
  openBookSpy.current = openBook;
  chat.current = {
    transcript: [],
    streaming: false,
    results: [],
    bookOpen: false,
    closing: false,
    send: vi.fn(),
    closeBook,
    openBook,
    ...overrides,
  } satisfies OperatorChat;
  return closeBook;
}

beforeEach(() => {
  sessionStorage.clear();
  useCallSpy.mockClear();
  setCall({ status: 'idle' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PhoneScene poster', () => {
  const pickUpSpy = () => (call.current as UseCall).pickUp;

  it('[Req 5.3] leaves the scene asleep until the first tap', async () => {
    setChat();
    render(<PhoneScene />);
    expect(scene()).toHaveAttribute('data-active', 'false');
    await userEvent.pointer({ keys: '[MouseLeft>]', target: document.body });
    expect(scene()).toHaveAttribute('data-active', 'true');
  });

  it('[Req 9.2] wakes the scene on a number key, which the on-hook phone ignores', async () => {
    setChat();
    render(<PhoneScene />);
    await userEvent.keyboard('5');
    expect(scene()).toHaveAttribute('data-active', 'true');
    expect(pickUpSpy()).not.toHaveBeenCalled();
  });

  it('[Req 5.3] Pick up the handset wakes the scene and picks up only once it is ready', async () => {
    setChat();
    render(<PhoneScene />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick up the handset' }));
    expect(scene()).toHaveAttribute('data-active', 'true');
    expect(pickUpSpy()).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'settle scene' }));
    expect(pickUpSpy()).toHaveBeenCalledTimes(1);
  });

  it('[Req 9.3] focus stays on the handset button while the scene wakes', async () => {
    setChat();
    render(<PhoneScene />);
    const handset = screen.getByRole('button', { name: 'Pick up the handset' });
    await userEvent.click(handset);
    expect(scene()).toHaveAttribute('data-active', 'true');
    expect(handset).toHaveFocus();
  });

  it('[Req 9.3] the handset button works from the keyboard on the poster', async () => {
    setChat();
    render(<PhoneScene />);
    act(() => screen.getByRole('button', { name: 'Pick up the handset' }).focus());
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'settle scene' }));
    expect(pickUpSpy()).toHaveBeenCalledTimes(1);
  });

  it('[Req 13.2] Open the book is on the poster after a reload, and opening it wakes the scene', async () => {
    storeBook();
    setChat({ bookOpen: false });
    render(<PhoneScene />);
    expect(scene()).toHaveAttribute('data-active', 'false');
    await userEvent.click(await screen.findByRole('button', { name: 'Open the book' }));
    expect(openBookSpy.current).toHaveBeenCalledTimes(1);
    expect(scene()).toHaveAttribute('data-active', 'true');
  });
});

describe('PhoneScene phone book', () => {
  it('[Req 9.3] offers no Close the book button until a search has opened the book', () => {
    setChat();
    render(<PhoneScene />);
    expect(screen.queryByRole('button', { name: 'Close the book' })).not.toBeInTheDocument();
  });

  it('[Req 9.3] shows a Close the book button that puts the book away', async () => {
    const closeBook = setChat({ bookOpen: true });
    render(<PhoneScene />);
    await userEvent.click(screen.getByRole('button', { name: 'Close the book' }));
    expect(closeBook).toHaveBeenCalledTimes(1);
  });

  it('[Req 9.3] Escape from inside the book puts it away', async () => {
    const closeBook = setChat({ bookOpen: true });
    const user = userEvent.setup();
    render(<PhoneScene />);
    await user.click(screen.getByRole('tab', { name: 'Business' }));
    await user.keyboard('{Escape}');
    expect(closeBook).toHaveBeenCalledTimes(1);
  });

  it('[Req 9.3] puts focus on the handset button after the book is closed', async () => {
    setChat({ bookOpen: true });
    const user = userEvent.setup();
    render(<PhoneScene />);
    await user.click(screen.getByRole('button', { name: 'Close the book' }));
    expect(screen.getByRole('button', { name: 'Pick up the handset' })).toHaveFocus();
  });

  it('[Req 9.9] a search with no results still opens the book, and says so', () => {
    setChat({ bookOpen: true, results: [] });
    render(<PhoneScene />);
    expect(screen.getByTestId('scene')).toHaveAttribute('data-book', 'open:0');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('No listings found in this exchange.');
  });
});

const storeBook = () =>
  sessionStorage.setItem(
    'dtftg_book',
    JSON.stringify(
      addPage(emptySession, { query: 'plumber', results: [business(1)] as readonly Listing[] }),
    ),
  );
describe('PhoneScene open the book', () => {
  it('[Req 13.2] offers no Open the book button while the session has no pages', () => {
    setChat();
    render(<PhoneScene />);
    expect(screen.queryByRole('button', { name: 'Open the book' })).not.toBeInTheDocument();
  });
  it('[Req 13.2] offers Open the book when the book is closed and the session has pages, after a reload', async () => {
    storeBook();
    setChat({ bookOpen: false });
    render(<PhoneScene />);
    expect(await screen.findByRole('button', { name: 'Open the book' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Close the book' })).not.toBeInTheDocument();
  });
  it('[Req 13.2] shows Close the book, not Open the book, while the book is open', async () => {
    storeBook();
    setChat({ bookOpen: true });
    render(<PhoneScene />);
    expect(await screen.findByRole('button', { name: 'Close the book' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Open the book' })).not.toBeInTheDocument();
  });
  it('[Req 13.2] Open the book opens the book and moves focus to Close the book', async () => {
    storeBook();
    setChat({ bookOpen: false });
    const user = userEvent.setup();
    const { rerender } = render(<PhoneScene />);
    await user.click(await screen.findByRole('button', { name: 'Open the book' }));
    expect(openBookSpy.current).toHaveBeenCalledTimes(1);
    setChat({ bookOpen: true });
    rerender(<PhoneScene />);
    expect(screen.getByRole('button', { name: 'Close the book' })).toHaveFocus();
  });
  it('[Req 13.2] closing a book that has pages moves focus to Open the book', async () => {
    storeBook();
    setChat({ bookOpen: true });
    const user = userEvent.setup();
    const { rerender } = render(<PhoneScene />);
    await user.click(await screen.findByRole('button', { name: 'Close the book' }));
    setChat({ bookOpen: false });
    rerender(<PhoneScene />);
    expect(screen.getByRole('button', { name: 'Open the book' })).toHaveFocus();
  });
});
describe('PhoneScene listings sheet', () => {
  it('[Req 13.2] offers no Listings button while the book is closed', () => {
    setChat({ bookOpen: false });
    render(<PhoneScene />);
    expect(screen.queryByRole('button', { name: 'Listings' })).not.toBeInTheDocument();
  });
  it('[Req 13.2] a Listings button opens the current page as an on-screen list with Dial buttons', async () => {
    setChat({ bookOpen: true });
    const user = userEvent.setup();
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    await user.click(screen.getByRole('button', { name: 'Listings' }));
    const sheet = screen.getByRole('dialog', { name: 'Listings on this page' });
    expect(within(sheet).getByRole('button', { name: /^Dial Business 1,/ })).toBeVisible();
  });
  it('[Req 13.2] closing the sheet puts focus back on the Listings button', async () => {
    setChat({ bookOpen: true });
    const user = userEvent.setup();
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    await user.click(screen.getByRole('button', { name: 'Listings' }));
    await user.click(screen.getByRole('button', { name: 'Close listings' }));
    expect(screen.queryByRole('dialog', { name: 'Listings on this page' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Listings' })).toHaveFocus();
  });
  it('[Req 13.2] flipping a page inside the sheet shows that page there', async () => {
    setChat({ bookOpen: true });
    const user = userEvent.setup();
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    act(() => options().onResults?.(results(2), 'electrician'));
    await user.click(screen.getByRole('button', { name: 'Listings' }));
    const sheet = screen.getByRole('dialog', { name: 'Listings on this page' });
    await user.click(within(sheet).getByRole('button', { name: 'Previous page' }));
    expect(within(sheet).getByRole('button', { name: /^Dial Business 1,/ })).toBeVisible();
  });
});
const business = (n: number): BusinessResult => ({
  id: `b${n}`,
  name: `Business ${n}`,
  category: 'plumber',
  suburb: 'Edenvale',
  address: `${n} Hollow Lane`,
  phone: `011 000 ${1000 + n}`,
  dial_number: `${61000 + n}`,
  hours: '24 hours',
  description: 'Invented',
  is_24hr: true,
  is_advert: false,
  is_spirit: false,
  score: 1,
});
const results = (n: number) => [business(n)];
const options = () => chatOptions.current as OperatorChatOptions;
const book = () => bookView.current as BookView;
const scene = () => screen.getByTestId('scene');

describe('PhoneScene session book', () => {
  it('[Req 13.1] a search adds a page and the 3D book shows it', () => {
    setChat({ bookOpen: true, results: results(1) });
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    expect(scene()).toHaveAttribute('data-first', 'b1');
    act(() => options().onResults?.(results(2), 'electrician'));
    expect(scene()).toHaveAttribute('data-first', 'b2');
  });

  it('[Req 13.2] clicking bare paper on the 3D page flips back to the earlier search', () => {
    setChat({ bookOpen: true });
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    act(() => options().onResults?.(results(2), 'electrician'));
    act(() => book().onFlip?.(-1));
    expect(scene()).toHaveAttribute('data-first', 'b1');
    expect(book().canFlip).toEqual({ previous: false, next: true });
    act(() => book().onFlip?.(1));
    expect(scene()).toHaveAttribute('data-first', 'b2');
  });

  it('[Req 13.2] tells the 3D book which page of the session it is on, so a flip turns the leaf the right way', () => {
    setChat({ bookOpen: true });
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    act(() => options().onResults?.(results(2), 'electrician'));
    const second = book();
    expect(second.pageIndex).toBe(1);
    act(() => book().onFlip?.(-1));
    expect(book().pageIndex).toBe(0);
    expect(book().pageId).not.toBe(second.pageId);
  });
  it('[Req 13.2] offers Previous and Next in the HTML mirror, with arrow keys', async () => {
    setChat({ bookOpen: true });
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    act(() => options().onResults?.(results(2), 'electrician'));
    screen.getByRole('button', { name: 'Previous page' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(scene()).toHaveAttribute('data-first', 'b1');
    expect(screen.getByText('Page 1 of 2: plumber')).toBeInTheDocument();
  });

  it('[Req 13.3] a call to a listing in the book rings it in pencil and dog-ears the page', () => {
    setChat({ bookOpen: true });
    const { rerender } = render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    expect(scene()).toHaveAttribute('data-called', '');
    setCall({ status: 'ringing', operatorNumber: '61001', callee: 'listing', ringsRemaining: 2 });
    rerender(<PhoneScene />);
    expect(scene()).toHaveAttribute('data-called', 'b1');
    expect(scene()).toHaveAttribute('data-dogeared', 'true');
  });

  it('[Req 13.3] a call to an operator, or to a number that is not in the book, marks nothing', () => {
    setChat({ bookOpen: true });
    const { rerender } = render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    setCall({ status: 'connected', operatorNumber: '1023', callee: 'operator', turnIndex: 0 });
    rerender(<PhoneScene />);
    setCall({ status: 'connected', operatorNumber: '69999', callee: 'listing', turnIndex: 0 });
    rerender(<PhoneScene />);
    expect(scene()).toHaveAttribute('data-called', '');
  });

  it('[Req 13.5] the HTML mirror labels the called listing', () => {
    setChat({ bookOpen: true });
    const { rerender } = render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    setCall({ status: 'connected', operatorNumber: '61001', callee: 'listing', turnIndex: 0 });
    rerender(<PhoneScene />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('called');
  });

  it('[Req 13.4] a reload in the same tab brings the pages back', () => {
    setChat({ bookOpen: true });
    const first = render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    first.unmount();
    render(<PhoneScene />);
    expect(scene()).toHaveAttribute('data-first', 'b1');
  });

  it('[Req 13.1] a search that finds nothing shows the empty page, and the next click brings the last page back', () => {
    setChat({ bookOpen: true });
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    act(() => options().onResults?.([], 'unicorns'));
    expect(scene()).toHaveAttribute('data-book', 'open:0');
    act(() => book().onFlip?.(-1));
    expect(scene()).toHaveAttribute('data-first', 'b1');
  });

  it('[Req 13.2] clicking a listing on the 3D page opens its detail, which dials it', async () => {
    setChat({ bookOpen: true });
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    act(() => book().onOpenListing?.('b1'));
    const dialog = screen.getByRole('dialog', { name: 'Business 1' });
    expect(dialog).toHaveAttribute('open');
    await userEvent.click(screen.getByRole('button', { name: /^Dial Business 1/ }));
    expect(dialog).not.toHaveAttribute('open');
  });

  it('[Req 13.2] clicking an id that is not on the page opens nothing', () => {
    setChat({ bookOpen: true });
    render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    act(() => book().onOpenListing?.('nope'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('[Req 4.5] the book stays up while the call connects, because the chat no longer clears it', () => {
    setChat({ bookOpen: true });
    const { rerender } = render(<PhoneScene />);
    act(() => options().onResults?.(results(1), 'plumber'));
    setCall({ status: 'connected', operatorNumber: '61001', callee: 'listing', turnIndex: 0 });
    rerender(<PhoneScene />);
    expect(scene()).toHaveAttribute('data-book', 'open:1');
    expect(screen.getByRole('button', { name: 'Close the book' })).toBeInTheDocument();
  });
});

describe('PhoneScene incoming call', () => {
  it('[Req 12.5] says the phone is ringing and lets the caller pick up', async () => {
    setCall({ status: 'ringing-in', messageIndex: 0 });
    setChat();
    render(<PhoneScene />);
    expect(screen.getByText('The phone is ringing.')).toHaveAttribute('role', 'status');
    await userEvent.click(screen.getByRole('button', { name: 'Pick up the handset' }));
    expect((call.current as UseCall).pickUp).toHaveBeenCalledTimes(1);
  });
  it('[Req 12.2] shows the message once the call is answered', () => {
    setCall({ status: 'incoming-message', messageIndex: 0 });
    setChat();
    render(<PhoneScene />);
    expect(screen.getByRole('log', { name: 'Message from the line' })).toHaveTextContent(
      INCOMING_MESSAGES[0] ?? '',
    );
  });
  it('[Req 12.2] shows no message panel at any other time', () => {
    setChat();
    render(<PhoneScene />);
    expect(screen.queryByRole('log', { name: 'Message from the line' })).not.toBeInTheDocument();
  });
});
describe('PhoneScene static', () => {
  const overlay = (container: HTMLElement) => container.querySelector('.static-overlay');

  it('[Req 2.6] shows the static over the scene on a wrong number', () => {
    setCall({ status: 'wrong-number' });
    setChat();
    const { container } = render(<PhoneScene />);
    expect(overlay(container)).not.toBeNull();
  });

  it('[Req 2.8] shows no static on the emergency notice, or when the line is quiet', () => {
    setChat();
    for (const state of [
      { status: 'emergency-notice' },
      { status: 'idle' },
      { status: 'busy' },
    ] satisfies CallState[]) {
      setCall(state);
      const { container, unmount } = render(<PhoneScene />);
      expect(overlay(container)).toBeNull();
      unmount();
    }
  });
});

describe('PhoneScene offline', () => {
  const goOffline = () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
  };
  const goOnline = () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
  };

  it('[Req 9.8] shows no overlay and leaves the dial alone while online', () => {
    setChat();
    render(<PhoneScene />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useCallSpy).toHaveBeenLastCalledWith({ offline: false });
  });

  it('[Req 9.8] covers the scene with the in-character message and disables the dial when offline', () => {
    setChat();
    const { container } = render(<PhoneScene />);
    act(goOffline);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The exchange has gone dark. Check your connection.',
    );
    expect(useCallSpy).toHaveBeenLastCalledWith({ offline: true });
    expect(container.querySelector('[inert]')).not.toBeNull();
  });

  it('[Req 9.8] clears the overlay when the connection returns', () => {
    setChat();
    const { container } = render(<PhoneScene />);
    act(goOffline);
    act(goOnline);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container.querySelector('[inert]')).toBeNull();
    expect(useCallSpy).toHaveBeenLastCalledWith({ offline: false });
  });

  it('[Req 9.8] hangs up a call in progress when the line goes dark', () => {
    setCall({ status: 'connected', operatorNumber: '1023', callee: 'operator', turnIndex: 0 });
    setChat();
    render(<PhoneScene />);
    act(goOffline);
    expect((call.current as UseCall).hangUp).toHaveBeenCalledTimes(1);
  });
});
