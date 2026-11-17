import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CallState } from '@/lib/callMachine';
import type { OperatorChat } from './useOperatorChat';
import type { UseCall } from './useCall';
import { PhoneScene } from './PhoneScene';

const call = vi.hoisted(() => ({ current: null as unknown }));
const chat = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('./useCall', () => ({ useCall: () => call.current }));
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
  setCall({ status: 'idle' });
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
});
