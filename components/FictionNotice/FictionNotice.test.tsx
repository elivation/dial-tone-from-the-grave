import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FictionNotice, FICTION_NOTICE } from './FictionNotice';

describe('FictionNotice', () => {
  it('says plainly that everything in The Dead Pages is made up', () => {
    expect(FICTION_NOTICE).toBe(
      'All businesses, people and numbers in The Dead Pages are fictional.',
    );
    render(<FictionNotice />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(FICTION_NOTICE);
  });

  it('is small and out of the way, and never blocks the dial', () => {
    render(<FictionNotice />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('pointer-events-none');
    expect(footer).toHaveClass('text-xs');
  });
});
