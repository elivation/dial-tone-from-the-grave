import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneCanvasLoader } from './PhoneCanvasLoader';
import { hasWebGL } from './webgl';

// The real scene needs WebGL. Stand in a canvas that reports ready when asked.
vi.mock('next/dynamic', () => ({
  default: () =>
    function FakeCanvas({ onReady }: { onReady: () => void }) {
      return <button onClick={onReady}>scene</button>;
    },
}));
vi.mock('./webgl', () => ({ hasWebGL: vi.fn() }));

describe('PhoneCanvasLoader', () => {
  beforeEach(() => {
    vi.mocked(hasWebGL).mockReturnValue(true);
  });

  it('shows the candlelit veil until the scene is ready, then lets it fade', async () => {
    render(<PhoneCanvasLoader />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    // The scene is aria-hidden on purpose, so look for it among hidden elements.
    await userEvent.click(screen.getByRole('button', { hidden: true, name: 'scene' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the 3D scene out of the accessibility tree', () => {
    render(<PhoneCanvasLoader />);
    expect(
      screen.getByRole('button', { hidden: true, name: 'scene' }).closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it('[Req 9.5] renders the fallback instead when WebGL is not available', () => {
    vi.mocked(hasWebGL).mockReturnValue(false);
    render(<PhoneCanvasLoader fallback={<p>The switchboard is out of order.</p>} />);
    expect(screen.getByText('The switchboard is out of order.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
