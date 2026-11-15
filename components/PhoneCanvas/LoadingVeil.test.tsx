import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingVeil } from './LoadingVeil';

describe('LoadingVeil', () => {
  it('announces itself and shows the tagline while loading', () => {
    render(<LoadingVeil visible />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/In 1998, the line went dead/)).toBeInTheDocument();
  });

  it('hides from assistive tech and fades out once loaded', () => {
    const { container } = render(<LoadingVeil visible={false} />);
    const veil = container.firstElementChild;
    expect(veil).toHaveAttribute('aria-hidden', 'true');
    expect(veil).toHaveClass('opacity-0');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[Req 9.4] shortens the fade for people who ask for less motion', () => {
    const { container } = render(<LoadingVeil visible />);
    expect(container.firstElementChild).toHaveClass('motion-reduce:duration-200');
  });
});
