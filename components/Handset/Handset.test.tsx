import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CallState } from '@/lib/callMachine';
import { Handset } from './Handset';

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

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

  describe('when the phone rings by itself', () => {
    const ringing: CallState = { status: 'ringing-in', messageIndex: 0 };
    afterEach(() => mockReducedMotion(false));

    it('[Req 12.2] offers to pick up, by mouse or keyboard', async () => {
      const onPickUp = vi.fn();
      render(<Handset state={ringing} onPickUp={onPickUp} onHangUp={() => {}} />);
      const button = screen.getByRole('button', { name: 'Pick up the handset' });
      await userEvent.click(button);
      button.focus();
      await userEvent.keyboard('{Enter}');
      expect(onPickUp).toHaveBeenCalledTimes(2);
    });

    it('[Req 12.5] shakes while it rings', () => {
      mockReducedMotion(false);
      render(<Handset state={ringing} onPickUp={() => {}} onHangUp={() => {}} />);
      expect(screen.getByRole('button')).toHaveClass('handset-shake');
    });

    it('[Req 12.5] does not shake with reduced motion', () => {
      mockReducedMotion(true);
      render(<Handset state={ringing} onPickUp={() => {}} onHangUp={() => {}} />);
      expect(screen.getByRole('button')).not.toHaveClass('handset-shake');
    });

    it('[Req 12.2] does not shake when the phone is quiet', () => {
      render(<Handset state={{ status: 'idle' }} onPickUp={() => {}} onHangUp={() => {}} />);
      expect(screen.getByRole('button')).not.toHaveClass('handset-shake');
    });

    it('[Req 12.2] offers to hang up while the message plays', async () => {
      const onHangUp = vi.fn();
      render(
        <Handset
          state={{ status: 'incoming-message', messageIndex: 0 }}
          onPickUp={() => {}}
          onHangUp={onHangUp}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Hang up' }));
      expect(onHangUp).toHaveBeenCalledTimes(1);
    });
  });
});
