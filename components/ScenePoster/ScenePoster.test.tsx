import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { POSTER_ALT, POSTER_SIZES, ScenePoster } from './ScenePoster';

describe('ScenePoster', () => {
  it('[Req 5.3] shows a still of the desk with alt text that describes it', () => {
    render(<ScenePoster hidden={false} />);
    const image = screen.getByRole('img', { name: POSTER_ALT });
    expect(image.getAttribute('src')).toMatch(/^\/poster\/.+\.webp$/);
    expect(POSTER_ALT).toMatch(/phone/i);
    expect(POSTER_ALT).toMatch(/candle/i);
  });

  it('[Req 5.3] gives the image its real size, so the page does not shift when it arrives', () => {
    render(<ScenePoster hidden={false} />);
    const image = screen.getByRole('img', { name: POSTER_ALT });
    expect(Number(image.getAttribute('width'))).toBe(POSTER_SIZES.landscape.width);
    expect(Number(image.getAttribute('height'))).toBe(POSTER_SIZES.landscape.height);
  });

  it('[Req 5.3] offers a portrait crop for tall screens, in AVIF first', () => {
    const { container } = render(<ScenePoster hidden={false} />);
    const portrait = [...container.querySelectorAll('source[media="(orientation: portrait)"]')];
    expect(portrait.map((source) => source.getAttribute('type'))).toEqual([
      'image/avif',
      'image/webp',
    ]);
    expect(portrait[0]?.getAttribute('srcset')).toMatch(/portrait\.avif$/);
  });

  it('loads the image at once, because it is the largest thing on the page', () => {
    render(<ScenePoster hidden={false} />);
    const image = screen.getByRole('img', { name: POSTER_ALT });
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(image).not.toHaveAttribute('loading', 'lazy');
  });

  it('[Req 9.4] fades out over half a second, and not at all with reduced motion', () => {
    const { container } = render(<ScenePoster hidden />);
    expect(container.firstElementChild).toHaveClass('opacity-0', 'duration-500');
    expect(container.firstElementChild).toHaveClass('motion-reduce:transition-none');
  });

  it('leaves the accessibility tree and stops catching taps once hidden', () => {
    const { container, rerender } = render(<ScenePoster hidden={false} />);
    expect(container.firstElementChild).not.toHaveAttribute('aria-hidden');
    expect(container.firstElementChild).toHaveClass('pointer-events-none');
    rerender(<ScenePoster hidden />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveClass('invisible');
  });
});
