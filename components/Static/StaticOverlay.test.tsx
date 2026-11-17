import { afterEach, describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StaticOverlay } from './StaticOverlay';

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('StaticOverlay', () => {
  it('[Req 2.6] renders the static over the screen when visible, hidden from assistive tech', () => {
    mockReducedMotion(false);
    const { container } = render(<StaticOverlay visible />);
    const overlay = container.firstElementChild;
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay).toHaveClass('static-overlay-animated');
    // It must never take clicks or focus away from the phone underneath.
    expect(overlay).toHaveClass('pointer-events-none');
    expect(overlay).not.toHaveAttribute('tabindex');
  });

  it('[Req 2.6] renders nothing when not visible', () => {
    mockReducedMotion(false);
    const { container } = render(<StaticOverlay visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('[Req 9.4] with reduced motion drops the animation and only fades in over 200 ms', () => {
    mockReducedMotion(true);
    const { container } = render(<StaticOverlay visible />);
    const overlay = container.firstElementChild;
    expect(overlay).not.toHaveClass('static-overlay-animated');
    expect(overlay).toHaveClass('static-overlay-fade');
  });
});
