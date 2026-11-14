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
