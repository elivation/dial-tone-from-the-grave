import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CallState } from '@/lib/callMachine';
import { CallStatus } from './CallStatus';

const show = (state: CallState) => {
  render(<CallStatus state={state} />);
  return screen.getByRole('status');
};

describe('CallStatus', () => {
  it('[Req 2.10] says in character that all the lines are busy', () => {
    expect(show({ status: 'busy' })).toHaveTextContent(/all lines are busy/i);
  });

  it('[Req 2.6] says it was a wrong number', () => {
    expect(show({ status: 'wrong-number' })).toHaveTextContent(/wrong number/i);
  });

  it('[Req 2.2] tells people to pick up when the phone is idle, and to dial once it is off the hook', () => {
    expect(show({ status: 'idle' })).toHaveTextContent(/pick up/i);
  });

  it('[Req 9.1] is a polite live region, so screen readers hear each change', () => {
    expect(
      show({ status: 'ringing', operatorNumber: '1023', callee: 'operator', ringsRemaining: 3 }),
    ).toHaveAttribute('aria-live', 'polite');
  });

  it('[Req 12.5] says the phone is ringing when it rings by itself', () => {
    expect(show({ status: 'ringing-in', messageIndex: 0 })).toHaveTextContent(
      'The phone is ringing',
    );
  });
  it('says something for every state, except the emergency notice which speaks for itself', () => {
    const states: CallState[] = [
      { status: 'idle' },
      { status: 'off-hook' },
      { status: 'dialling', digits: '1' },
      { status: 'ringing', operatorNumber: '1023', callee: 'operator', ringsRemaining: 3 },
      { status: 'connected', operatorNumber: '1023', callee: 'operator', turnIndex: 0 },
      { status: 'wrong-number' },
      { status: 'busy' },
      { status: 'ringing-in', messageIndex: 0 },
      { status: 'incoming-message', messageIndex: 0 },
    ];
    for (const state of states) {
      const { unmount } = render(<CallStatus state={state} />);
      expect(screen.getByRole('status').textContent, state.status).not.toBe('');
      unmount();
    }
    render(<CallStatus state={{ status: 'emergency-notice' }} />);
    expect(screen.getAllByRole('status').at(-1)).toBeEmptyDOMElement();
  });
});
