import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MuteToggle, type MuteControl } from './MuteToggle';

function fakeEngine(muted: boolean) {
  let state = muted;
  return {
    isMuted: vi.fn(() => state),
    setMuted: vi.fn((next: boolean) => {
      state = next;
    }),
  } satisfies MuteControl;
}

describe('MuteToggle', () => {
  it('[Req 8.7] starts muted, offering to unmute', () => {
    render(<MuteToggle audio={fakeEngine(true)} />);
    const button = screen.getByRole('button', { name: 'Unmute' });
    // The label says what a press will do, so it must not also claim to be pressed.
    expect(button).not.toHaveAttribute('aria-pressed');
  });

  it('[Req 8.7] unmutes on click, and the label changes to Mute', async () => {
    const audio = fakeEngine(true);
    render(<MuteToggle audio={audio} />);
    await userEvent.click(screen.getByRole('button', { name: 'Unmute' }));
    expect(audio.setMuted).toHaveBeenCalledWith(false);
    const button = screen.getByRole('button', { name: 'Mute' });
    await userEvent.click(button);
    expect(audio.setMuted).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
  });

  it('[Req 8.7] shows the choice remembered for the session', () => {
    render(<MuteToggle audio={fakeEngine(false)} />);
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
  });

  it('[Req 9.3] works from the keyboard', async () => {
    const audio = fakeEngine(true);
    render(<MuteToggle audio={audio} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(audio.setMuted).toHaveBeenCalledWith(false);
  });
});
