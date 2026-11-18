import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenBookButton } from './OpenBookButton';

describe('OpenBookButton', () => {
  it('[Req 13.2] is a visible button named Open the book', () => {
    render(<OpenBookButton onOpen={() => {}} />);
    const button = screen.getByRole('button', { name: 'Open the book' });
    expect(button).toBeVisible();
    expect(button.className).not.toContain('sr-only');
  });

  it('[Req 13.2] opens the book on click and on Enter', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<OpenBookButton onOpen={onOpen} />);
    await user.click(screen.getByRole('button', { name: 'Open the book' }));
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
