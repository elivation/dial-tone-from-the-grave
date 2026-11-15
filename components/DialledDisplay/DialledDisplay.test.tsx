import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DialledDisplay } from './DialledDisplay';

describe('DialledDisplay', () => {
  it('[Req 1.7] shows the digits dialled so far under an accessible name', () => {
    render(<DialledDisplay digits="1023" />);
    expect(screen.getByRole('status', { name: 'Dialled number' })).toHaveTextContent('1023');
  });

  it('[Req 1.7] is a live region, so each new digit is announced', () => {
    const { rerender } = render(<DialledDisplay digits="10" />);
    rerender(<DialledDisplay digits="102" />);
    expect(screen.getByRole('status')).toHaveTextContent('102');
  });
});
