import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookPage } from '@/lib/bookSession';
import type { BusinessResult } from '@/lib/listingSearch';
import { PageStack } from './PageStack';

const listing = (n: number): BusinessResult => ({
  id: `b${n}`,
  name: `Business ${n}`,
  category: 'plumber',
  suburb: 'Edenvale',
  address: `${n} Hollow Lane`,
  phone: `011 000 ${1000 + n}`,
  dial_number: `${61000 + n}`,
  hours: '24 hours',
  description: 'Invented',
  is_24hr: true,
  is_advert: false,
  is_spirit: false,
  score: 1,
});

const page = (n: number, overrides: Partial<BookPage> = {}): BookPage => ({
  id: `p${n}`,
  section: 'business',
  query: `search ${n}`,
  results: [listing(n)],
  calledIds: [],
  dogEared: false,
  ...overrides,
});

const three = [page(1), page(2, { calledIds: ['b2'], dogEared: true }), page(3)];

describe('PageStack', () => {
  it('[Req 13.5] lists every page in the book and marks the open one', () => {
    render(<PageStack pages={three} index={1} onFlip={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('search 1');
    expect(items[1]).toHaveAttribute('aria-current', 'page');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('status')).toHaveTextContent('Page 2 of 3: search 2');
  });

  it('[Req 13.5] says which pages are dog-eared and how many listings were called', () => {
    render(<PageStack pages={three} index={0} onFlip={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveTextContent('dog-eared');
    expect(items[1]).toHaveTextContent('1 called');
    expect(items[0]).not.toHaveTextContent('dog-eared');
    expect(items[0]).not.toHaveTextContent('called');
  });

  it('[Req 13.2] flips back and forward with the Previous and Next buttons', async () => {
    const onFlip = vi.fn();
    render(<PageStack pages={three} index={1} onFlip={onFlip} />);
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onFlip.mock.calls).toEqual([[-1], [1]]);
  });

  it('[Req 13.2] flips with the left and right arrow keys', async () => {
    const onFlip = vi.fn();
    render(<PageStack pages={three} index={1} onFlip={onFlip} />);
    screen.getByRole('button', { name: 'Next page' }).focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}{ArrowDown}');
    expect(onFlip.mock.calls).toEqual([[-1], [1]]);
  });

  it('[Req 13.2] does not flip past the first or last page, and keeps focus on the button', async () => {
    const onFlip = vi.fn();
    const { rerender } = render(<PageStack pages={three} index={0} onFlip={onFlip} />);
    const previous = screen.getByRole('button', { name: 'Previous page' });
    previous.focus();
    await userEvent.keyboard('{ArrowLeft}{Enter}');
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(previous).toHaveFocus();
    expect(onFlip).not.toHaveBeenCalled();
    rerender(<PageStack pages={three} index={2} onFlip={onFlip} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onFlip).not.toHaveBeenCalled();
  });

  it('[Req 13.5] shows nothing for a book of one page, which has nothing to flip to', () => {
    const { container } = render(<PageStack pages={[page(1)]} index={0} onFlip={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
