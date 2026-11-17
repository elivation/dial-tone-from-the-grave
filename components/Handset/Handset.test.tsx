import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CallState } from '@/lib/callMachine';
import { Handset } from './Handset';

const states: CallState[] = [
  { status: 'off-hook' },
  { status: 'dialling', digits: '10' },
  { status: 'ringing', operatorNumber: '1023', callee: 'operator', ringsRemaining: 2 },
  { status: 'connected', operatorNumber: '1023', callee: 'operator', turnIndex: 1 },
  { status: 'wrong-number' },
  { status: 'emergency-notice' },
  { status: 'busy' },
];

describe('Handset', () => {
  it('[Req 2.2] offers to pick up when the phone is idle, and calls back when pressed', async () => {
    const onPickUp = vi.fn();
    render(<Handset state={{ status: 'idle' }} onPickUp={onPickUp} onHangUp={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Hang up' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pick up the handset' }));
    expect(onPickUp).toHaveBeenCalledTimes(1);
  });

  it('[Req 2.7] offers to hang up from every state except idle, and calls back when pressed', async () => {
    for (const state of states) {
      const onHangUp = vi.fn();
      const { unmount } = render(<Handset state={state} onPickUp={() => {}} onHangUp={onHangUp} />);
      expect(screen.queryByRole('button', { name: 'Pick up the handset' })).not.toBeInTheDocument();
      const button = screen.getByRole('button', { name: 'Hang up' });
      expect(button, state.status).toBeEnabled();
      await userEvent.click(button);
      expect(onHangUp, state.status).toHaveBeenCalledTimes(1);
      unmount();
    }
  });
});
