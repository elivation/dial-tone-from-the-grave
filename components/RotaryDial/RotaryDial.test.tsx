import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { RotaryDial, DIAL_SIZE } from './RotaryDial';
import { HOLE_ANGLES, PULSES, STOP_ANGLE, travelDegrees, type Digit } from '@/lib/dial';

const CENTRE = DIAL_SIZE / 2;
const DRAG_RADIUS = 100;

function pointAt(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    clientX: CENTRE + DRAG_RADIUS * Math.sin(rad),
    clientY: CENTRE - DRAG_RADIUS * Math.cos(rad),
  };
}

function getDial() {
  return screen.getByRole('group', { name: 'Rotary dial' });
}

function getWheel() {
  return screen.getByTestId('finger-wheel');
}

/** Press a hole and drag it clockwise by `degrees` in 5 degree steps. */
function dragHole(digit: Digit, degrees: number) {
  const start = HOLE_ANGLES[digit];
  fireEvent.pointerDown(screen.getByTestId(`hole-${digit}`), { pointerId: 1, ...pointAt(start) });
  for (let moved = 5; moved < degrees; moved += 5) {
    fireEvent.pointerMove(getDial(), { pointerId: 1, ...pointAt(start + moved) });
  }
  fireEvent.pointerMove(getDial(), { pointerId: 1, ...pointAt(start + degrees) });
  fireEvent.pointerUp(getDial(), { pointerId: 1, ...pointAt(start + degrees) });
}

describe('[Req 1.6, 1.7, Req 9.1] RotaryDial static render', () => {
  it('renders exactly 10 finger holes, one per digit', () => {
    render(<RotaryDial disabled={false} onDigit={() => {}} />);
    expect(screen.getAllByTestId(/^hole-/)).toHaveLength(10);
  });

  it('prints every digit on the number card', () => {
    render(<RotaryDial disabled={false} onDigit={() => {}} />);
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      expect(screen.getByTestId(`label-${d}`)).toHaveTextContent(d);
    }
  });

  it('has an accessible name on the dial', () => {
    render(<RotaryDial disabled={false} onDigit={() => {}} />);
    expect(getDial()).toBeInTheDocument();
  });

  it('has a polite live region for digit announcements', () => {
    render(<RotaryDial disabled={false} onDigit={() => {}} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('marks the dial as disabled when disabled is true', () => {
    render(<RotaryDial disabled onDigit={() => {}} />);
    expect(getDial()).toHaveAttribute('aria-disabled', 'true');
  });

  it('draws the finger stop at the bottom right', () => {
    render(<RotaryDial disabled={false} onDigit={() => {}} />);
    expect(screen.getByTestId('finger-stop')).toHaveAttribute('data-angle', String(STOP_ANGLE));
  });
});

describe('[Req 1.1, 1.2, 1.3, 1.5] RotaryDial drag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[Req 1.1] dragging a hole all the way to the stop dials that digit', () => {
    const onDigit = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} />);
    dragHole('5', travelDegrees('5'));
    expect(onDigit).toHaveBeenCalledTimes(1);
    expect(onDigit).toHaveBeenCalledWith('5');
  });

  it('[Req 1.3] releasing early does not dial anything and springs back', () => {
    const onDigit = vi.fn();
    const onPulse = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} onPulse={onPulse} />);
    dragHole('5', travelDegrees('5') / 2);
    expect(onDigit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onPulse).not.toHaveBeenCalled();
    expect(getWheel()).toHaveAttribute('data-rotation', '0');
  });

  it('[Req 1.2] the dial runs back with one pulse per 100 ms and ends at rest', () => {
    const onPulse = vi.fn();
    render(<RotaryDial disabled={false} onDigit={() => {}} onPulse={onPulse} />);
    dragHole('5', travelDegrees('5'));

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onPulse).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onPulse).toHaveBeenCalledTimes(PULSES['5']);
    expect(getWheel()).toHaveAttribute('data-rotation', '0');
  });

  it('[Req 1.4] digit 0 needs nearly a full turn and sends 10 pulses', () => {
    const onDigit = vi.fn();
    const onPulse = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} onPulse={onPulse} />);
    dragHole('0', travelDegrees('0'));
    expect(onDigit).toHaveBeenCalledWith('0');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onPulse).toHaveBeenCalledTimes(10);
  });

  it('[Req 1.1] dragging anticlockwise does nothing', () => {
    const onDigit = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} />);
    const start = HOLE_ANGLES['3'];
    fireEvent.pointerDown(screen.getByTestId('hole-3'), { pointerId: 1, ...pointAt(start) });
    fireEvent.pointerMove(getDial(), { pointerId: 1, ...pointAt(start - 20) });
    expect(getWheel()).toHaveAttribute('data-rotation', '0');
    fireEvent.pointerUp(getDial(), { pointerId: 1, ...pointAt(start - 20) });
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('[Req 1.5] ignores drags while disabled', () => {
    const onDigit = vi.fn();
    render(<RotaryDial disabled onDigit={onDigit} />);
    dragHole('2', travelDegrees('2'));
    expect(onDigit).not.toHaveBeenCalled();
    expect(getWheel()).toHaveAttribute('data-rotation', '0');
  });

  it('[Req 1.2] ignores a new drag while the dial is still running back', () => {
    const onDigit = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} />);
    dragHole('9', travelDegrees('9'));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    dragHole('1', travelDegrees('1'));
    expect(onDigit).toHaveBeenCalledTimes(1);
    expect(onDigit).toHaveBeenCalledWith('9');
  });
});

/** jsdom has no matchMedia. This stands in for a visitor who asked for less motion. */
function preferReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(document.body, { key, ...init });
  });

describe('[Req 1.5, 1.6, Req 9.2] RotaryDial keyboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preferReducedMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('[Req 1.5] swings the hole to the stop in 150 ms, then dials the digit', () => {
    const onDigit = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} />);
    press('5');
    expect(getWheel()).toHaveAttribute('data-rotation', String(travelDegrees('5')));
    act(() => void vi.advanceTimersByTime(149));
    expect(onDigit).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onDigit).toHaveBeenCalledTimes(1);
    expect(onDigit).toHaveBeenCalledWith('5');
  });

  it('[Req 1.4, 1.5] then runs back with one pulse per 100 ms, and ends at rest', () => {
    const onPulse = vi.fn();
    render(<RotaryDial disabled={false} onDigit={() => {}} onPulse={onPulse} />);
    press('4');
    act(() => void vi.advanceTimersByTime(150));
    act(() => void vi.advanceTimersByTime(PULSES['4'] * 100));
    expect(onPulse).toHaveBeenCalledTimes(PULSES['4']);
    expect(getWheel()).toHaveAttribute('data-rotation', '0');
  });

  it('[Req 1.4] the 0 key sends 10 pulses', () => {
    const onPulse = vi.fn();
    render(<RotaryDial disabled={false} onDigit={() => {}} onPulse={onPulse} />);
    press('0');
    act(() => void vi.advanceTimersByTime(150 + 1000));
    expect(onPulse).toHaveBeenCalledTimes(10);
  });

  it('[Req 1.5] dials every digit from its own key', () => {
    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const) {
      const onDigit = vi.fn();
      const { unmount } = render(<RotaryDial disabled={false} onDigit={onDigit} />);
      press(digit);
      act(() => void vi.advanceTimersByTime(150));
      expect(onDigit, `key ${digit}`).toHaveBeenCalledWith(digit);
      unmount();
    }
  });

  it('[Req 1.8] skips the swing for people who ask for less motion, but still clicks every pulse', () => {
    preferReducedMotion(true);
    const onDigit = vi.fn();
    const onPulse = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} onPulse={onPulse} />);
    press('3');
    // Dialled at once, with no 150 ms wait.
    expect(onDigit).toHaveBeenCalledWith('3');
    act(() => void vi.advanceTimersByTime(PULSES['3'] * 100));
    expect(onPulse).toHaveBeenCalledTimes(PULSES['3']);
  });

  it('ignores the keys while the dial is disabled', () => {
    const onDigit = vi.fn();
    render(<RotaryDial disabled onDigit={onDigit} />);
    press('5');
    act(() => void vi.advanceTimersByTime(2000));
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('ignores a second key while the dial is still swinging or running back', () => {
    const onDigit = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} />);
    press('9');
    press('1');
    act(() => void vi.advanceTimersByTime(150));
    press('2');
    act(() => void vi.advanceTimersByTime(2000));
    expect(onDigit).toHaveBeenCalledTimes(1);
    expect(onDigit).toHaveBeenCalledWith('9');
  });

  it('ignores letters, other keys, held keys and shortcuts', () => {
    const onDigit = vi.fn();
    render(<RotaryDial disabled={false} onDigit={onDigit} />);
    press('a');
    press('Enter');
    press('5', { repeat: true });
    press('5', { ctrlKey: true });
    press('5', { metaKey: true });
    press('5', { altKey: true });
    act(() => void vi.advanceTimersByTime(2000));
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('leaves a key alone when something else on the page has already handled it', () => {
    const onDigit = vi.fn();
    const claim = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener('keydown', claim);
    render(<RotaryDial disabled={false} onDigit={onDigit} />);
    press('5');
    act(() => void vi.advanceTimersByTime(2000));
    document.removeEventListener('keydown', claim);
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('does not steal digits typed into a text field', () => {
    const onDigit = vi.fn();
    render(
      <>
        <input aria-label="Say something" />
        <RotaryDial disabled={false} onDigit={onDigit} />
      </>,
    );
    act(() => {
      fireEvent.keyDown(screen.getByLabelText('Say something'), { key: '5' });
    });
    act(() => void vi.advanceTimersByTime(2000));
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('stops listening when it is removed', () => {
    const onDigit = vi.fn();
    const { unmount } = render(<RotaryDial disabled={false} onDigit={onDigit} />);
    unmount();
    press('5');
    act(() => void vi.advanceTimersByTime(2000));
    expect(onDigit).not.toHaveBeenCalled();
  });
});

describe('[Req 1.7, Req 9.1] RotaryDial announces each digit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preferReducedMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('says "Dialled: 5" once the digit is dialled, then clears after a second', () => {
    render(<RotaryDial disabled={false} onDigit={() => {}} />);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('');
    press('5');
    expect(region).toHaveTextContent('');
    act(() => void vi.advanceTimersByTime(150));
    expect(region).toHaveTextContent('Dialled: 5');
    act(() => void vi.advanceTimersByTime(999));
    expect(region).toHaveTextContent('Dialled: 5');
    act(() => void vi.advanceTimersByTime(1));
    expect(region).toHaveTextContent('');
  });

  it('announces a digit dialled by dragging too', () => {
    render(<RotaryDial disabled={false} onDigit={() => {}} />);
    dragHole('7', travelDegrees('7'));
    expect(screen.getByRole('status')).toHaveTextContent('Dialled: 7');
  });

  it('announces the next digit fresh, not stacked on the last', () => {
    render(<RotaryDial disabled={false} onDigit={() => {}} />);
    press('2');
    act(() => void vi.advanceTimersByTime(150 + 200 + 500));
    press('8');
    act(() => void vi.advanceTimersByTime(150));
    expect(screen.getByRole('status')).toHaveTextContent(/^Dialled: 8$/);
  });
});
