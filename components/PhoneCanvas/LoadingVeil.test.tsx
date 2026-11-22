import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingVeil } from './LoadingVeil';

describe('LoadingVeil', () => {
  it('announces the connection politely while loading', () => {
    render(<LoadingVeil visible />);
    expect(screen.getByRole('status')).toHaveTextContent('Connecting you to the exchange...');
  });

  it('hides from assistive tech and fades out once loaded', () => {
    const { container } = render(<LoadingVeil visible={false} />);
    const veil = container.firstElementChild;
    expect(veil).toHaveAttribute('aria-hidden', 'true');
    expect(veil).toHaveClass('opacity-0');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[Req 9.4] does not fade, and does not pulse, for people who ask for less motion', () => {
    const { container } = render(<LoadingVeil visible />);
    expect(container.firstElementChild).toHaveClass('motion-reduce:transition-none');
    expect(screen.getByText('Connecting you to the exchange...')).toHaveClass(
      'motion-safe:animate-pulse',
    );
  });

  it('lets taps through to the scene beneath', () => {
    const { container } = render(<LoadingVeil visible />);
    expect(container.firstElementChild).toHaveClass('pointer-events-none');
  });
});
