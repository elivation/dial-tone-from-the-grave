import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloseBookButton } from './CloseBookButton';
describe('CloseBookButton', () => {
  it('[Req 9.3] is a visible button named Close the book', () => {
    render(<CloseBookButton onClose={() => {}} />);
    const button = screen.getByRole('button', { name: 'Close the book' });
    expect(button).toBeVisible();
    expect(button.className).not.toContain('sr-only');
  });
  it('[Req 9.3] closes the book on click', async () => {
    const onClose = vi.fn();
    render(<CloseBookButton onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close the book' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('[Req 9.3] closes the book on Enter, Space and Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CloseBookButton onClose={onClose} />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close the book' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
