import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CallState } from '@/lib/callMachine';
import type { OperatorChat } from './useOperatorChat';
import type { UseCall } from './useCall';
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
vi.mock('./useOperatorChat', () => ({ useOperatorChat: () => chat.current }));
// There is no WebGL in jsdom. The stub shows whether the scene was handed a book.
vi.mock('@/components/PhoneCanvas/PhoneCanvasLoader', () => ({
  PhoneCanvasLoader: ({ book }: { book?: { results: unknown[] } }) => (
    <div data-testid="scene" data-book={book ? `open:${book.results.length}` : 'none'} />
  ),
}));

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
  chat.current = {
    transcript: [],
    streaming: false,
    results: [],
    bookOpen: false,
    closing: false,
    send: vi.fn(),
    closeBook,
    ...overrides,
  } satisfies OperatorChat;
  return closeBook;
}

beforeEach(() => {
  useCallSpy.mockClear();
  setCall({ status: 'idle' });
});

afterEach(() => {
  vi.restoreAllMocks();
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
