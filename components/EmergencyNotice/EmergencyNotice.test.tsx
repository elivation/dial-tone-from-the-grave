import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmergencyNotice } from './EmergencyNotice';

const MESSAGE =
  'This is a game and cannot call anyone. If you have an emergency, please use a real phone and dial 112 or 10111.';

describe('EmergencyNotice', () => {
  it('[Req 2.8] says plainly that this is a game, with the safety message', () => {
    render(<EmergencyNotice onDismiss={() => {}} />);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(MESSAGE);
  });

  it('[Req 2.8] is plain: a white screen with black text, nothing spooky', () => {
    render(<EmergencyNotice onDismiss={() => {}} />);
    const notice = screen.getByRole('alertdialog');
    expect(notice).toHaveClass('bg-white');
    expect(notice).toHaveClass('text-black');
  });

  it('[Req 2.8] dismisses with the button', async () => {
    const onDismiss = vi.fn();
    render(<EmergencyNotice onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('[Req 9.3] dismisses with Escape, and puts keyboard focus on the button when it opens', () => {
    const onDismiss = vi.fn();
    render(<EmergencyNotice onDismiss={onDismiss} />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
