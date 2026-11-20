import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './page';

vi.mock('@/components/PhoneScene/PhoneScene', () => ({ PhoneScene: () => <div>scene</div> }));

describe('Home', () => {
  it('[Req 5.3] puts the candlelit desk gradient behind the scene', () => {
    render(<Home />);
    expect(screen.getByRole('main')).toHaveClass('desk-backdrop');
  });

  it('names the page for screen readers', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dial Tone from the Grave' }),
    ).toBeInTheDocument();
  });
});
