import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PULSES, type Digit } from '@/lib/dial';
import { useCall, type CallAudio } from '@/components/PhoneScene/useCall';
import { useDialNumber } from '@/components/PhoneScene/useDialNumber';
import { DialButton } from './DialButton';

const makeAudio = () => ({
  startDialTone: vi.fn(),
  stopDialTone: vi.fn(),
  startRingTone: vi.fn(),
  stopRingTone: vi.fn(),
  startBusyTone: vi.fn(),
  stopBusyTone: vi.fn(),
  startStatic: vi.fn(),
  stopStatic: vi.fn(),
  playDisconnectedTone: vi.fn(),
  click: vi.fn(),
  stopAll: vi.fn(),
  unlockOnFirstInteraction: vi.fn(() => vi.fn()),
});

let audio: ReturnType<typeof makeAudio>;

/** The real call and dial controller, with the Dial button wired up the way the page wires it. */
function Harness({ offline = false, number = '61019' }: { offline?: boolean; number?: string }) {
  const call = useCall({ audio: audio as CallAudio, offline });
  const dial = useDialNumber({ call, offline });
  const { state, controller } = call;
  const digits = state.status === 'dialling' ? state.digits : '';
  return (
    <div>
      <p data-testid="status">{state.status}</p>
      <p data-testid="digits">{digits}</p>
      <p data-testid="phase">{controller.phase}</p>
      <button type="button" onClick={call.pickUp}>
        Pick up
      </button>
      <DialButton dialNumber={number} name="Sithole Hot Water" onDial={dial} />
    </div>
  );
}

const status = () => screen.getByTestId('status').textContent;
const digits = () => screen.getByTestId('digits').textContent;
const run = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const fullDial = (digit: Digit) => 150 + PULSES[digit] * 100;

beforeEach(() => {
  vi.useFakeTimers();
  // Testing Library only advances fake timers for user-event when it sees a Jest-style global.
  Object.assign(globalThis, { jest: { advanceTimersByTime: vi.advanceTimersByTime } });
  audio = makeAudio();
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'jest');
  vi.useRealTimers();
});

describe('[Req 11.7] DialButton', () => {
  it('[Req 11.7] is a real button named with the listing and its printed number', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Dial Sithole Hot Water, HO 6-1019' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveTextContent('Dial');
  });

  it('[Req 11.7] by keyboard, picks up and dials every digit in order, then rings', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Dial Sithole/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(status()).toBe('off-hook');

    const seen: string[] = [];
    for (const digit of '61019') {
      run(fullDial(digit as Digit));
      seen.push(digits() ?? '');
    }
    expect(seen).toEqual(['6', '61', '610', '6101', '61019']);
    expect(audio.click).toHaveBeenCalledTimes(
      [...'61019'].reduce((n, d) => n + PULSES[d as Digit], 0),
    );
  });

  it('[Req 11.7] works with the space bar as well', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    screen.getByRole('button', { name: /^Dial Sithole/ }).focus();
    await user.keyboard(' ');
    expect(status()).toBe('off-hook');
  });

  it('[Req 11.7] waits for the dial to come back to rest before the next digit', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Dial Sithole/ }));
    run(150);
    expect(digits()).toBe('6');
    expect(screen.getByTestId('phase').textContent).toBe('returning');
    // Still running back: no second digit yet.
    run(PULSES['6'] * 100 - 1);
    expect(screen.getByTestId('phase').textContent).toBe('returning');
    run(1);
    expect(screen.getByTestId('phase').textContent).toBe('swinging');
    expect(digits()).toBe('6');
    run(150);
    expect(digits()).toBe('61');
  });

  it('[Req 11.7, 2.4] after the last digit the normal 2 second pause places the call', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness number="2" />);
    await user.click(screen.getByRole('button', { name: /^Dial Sithole/ }));
    run(fullDial('2'));
    expect(status()).toBe('dialling');
    run(1999);
    expect(status()).toBe('dialling');
    run(1);
    expect(status()).toBe('wrong-number');
  });

  it('[Req 11.7] a number half dialled by hand is hung up first, so the digits are not appended', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness number="72001" />);
    await user.click(screen.getByRole('button', { name: /^Dial Sithole/ }));
    // Dial 7, then press the button again part way through.
    run(fullDial('7'));
    await user.click(screen.getByRole('button', { name: /^Dial Sithole/ }));
    for (let i = 0; i < 200 && digits() !== '72001'; i++) run(50);
    expect(status()).toBe('dialling');
    expect(digits()).toBe('72001');
  });

  it('[Req 9.8] does nothing while offline, because the dial is locked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness offline />);
    await user.click(screen.getByRole('button', { name: /^Dial Sithole/ }));
    run(5000);
    expect(status()).toBe('idle');
  });

  it('[Req 11.7] with reduced motion the digits go in at once, one per run back', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    }));
    const user = userEvent.setup({ delay: null });
    render(<Harness number="22222" />);
    await user.click(screen.getByRole('button', { name: /^Dial Sithole/ }));
    for (let i = 0; i < 5; i++) run(PULSES['2'] * 100);
    expect(digits()).toBe('22222');
    vi.unstubAllGlobals();
  });
});
