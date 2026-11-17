import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineNotice, OFFLINE_MESSAGE } from './OfflineNotice';

describe('OfflineNotice', () => {
  it('[Req 9.8] announces the in-character offline message as an alert', () => {
    render(<OfflineNotice />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The exchange has gone dark. Check your connection.',
    );
    expect(OFFLINE_MESSAGE).toBe('The exchange has gone dark. Check your connection.');
  });

  it('[Req 9.4] has no animation class, so reduced motion has nothing to switch off', () => {
    const { container } = render(<OfflineNotice />);
    expect(container.innerHTML).not.toMatch(/animate-/);
  });
});
