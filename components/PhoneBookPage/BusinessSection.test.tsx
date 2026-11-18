import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BusinessResult } from '@/lib/listingSearch';
import { BusinessSection } from './BusinessSection';
import { NO_LISTINGS_MESSAGE } from './sections';

function listing(overrides: Partial<BusinessResult> = {}): BusinessResult {
  return {
    id: 'b1',
    name: 'Pipe Dreams Plumbing',
    category: 'Plumber',
    suburb: 'Edenvale',
    address: '12 Kloof Street',
    phone: '011 000 1001',
    dial_number: '61001',
    hours: 'Mon to Sat, 7am to 6pm',
    is_24hr: false,
    description: 'Geysers, leaks and burst pipes.',
    is_advert: false,
    is_spirit: false,
    score: 0.9,
    ...overrides,
  };
}

const three = [
  listing({ id: 'b1' }),
  listing({ id: 'b2', name: 'Candlewick Electrical', dial_number: '61002', phone: '011 000 1002' }),
  listing({ id: 'b3', name: 'Hollow Hardware', dial_number: '61003', phone: '011 000 1003' }),
];

describe('BusinessSection', () => {
  it('[Req 5.1] renders three results as three listing rows with name, suburb, phone, hours and description', () => {
    render(<BusinessSection listings={three} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    const first = rows[0]!;
    expect(within(first).getByText('Pipe Dreams Plumbing')).toBeInTheDocument();
    expect(first).toHaveTextContent('Edenvale');
    expect(first).toHaveTextContent('011 000 1001');
    expect(first).toHaveTextContent('Mon to Sat, 7am to 6pm');
    expect(first).toHaveTextContent('Geysers, leaks and burst pipes.');
  });

  it('[Req 5.1] keeps the name before the suburb, phone, hours and description in the DOM', () => {
    render(<BusinessSection listings={[listing()]} />);
    const text = screen.getByRole('listitem').textContent ?? '';
    const order = ['Pipe Dreams', 'Edenvale', '011 000 1001', 'Mon to Sat', 'Geysers'];
    const positions = order.map((part) => text.indexOf(part));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });

  it('[Req 5.1] prints the short number in exchange style next to the 011 number', () => {
    render(<BusinessSection listings={[listing()]} />);
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('HO 6-1001');
    expect(row).toHaveTextContent('011 000 1001');
  });

  it('[Req 5.2] gives an is_advert listing an accessible advert label', () => {
    render(
      <BusinessSection listings={[listing({ is_advert: true, name: 'Ashgrove Undertakers' })]} />,
    );
    const advert = screen.getByRole('button', { name: /advert.*ashgrove undertakers/i });
    expect(advert).toBeInTheDocument();
  });

  it('[Req 5.2] does not label an ordinary listing as an advert', () => {
    render(<BusinessSection listings={[listing()]} />);
    expect(screen.queryByText(/advert/i)).not.toBeInTheDocument();
  });

  it('[Req 5.6] Enter on a row opens the detail dialog with the full details', async () => {
    const user = userEvent.setup();
    render(<BusinessSection listings={three} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.tab();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog', { name: 'Pipe Dreams Plumbing' });
    expect(dialog).toHaveTextContent('12 Kloof Street');
    expect(dialog).toHaveTextContent('Plumber');
    expect(dialog).toHaveTextContent('HO 6-1001');
  });

  it('[Req 5.6] Space and a click open the dialog too', async () => {
    const user = userEvent.setup();
    render(<BusinessSection listings={three} />);
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog', { name: 'Pipe Dreams Plumbing' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /candlewick electrical/i }));
    expect(screen.getByRole('dialog', { name: 'Candlewick Electrical' })).toBeInTheDocument();
  });

  it('[Req 5.6] moves focus into the dialog, and back to the row when it closes', async () => {
    const user = userEvent.setup();
    render(<BusinessSection listings={three} />);
    const row = screen.getByRole('button', { name: /pipe dreams plumbing/i });
    await user.click(row);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  it('[Req 9.3] the list is named, and is not hidden from assistive technology', () => {
    render(<BusinessSection listings={three} />);
    const list = screen.getByRole('list', { name: 'Business listings' });
    expect(list).toBeVisible();
    expect(list.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('[Req 5.1] renders an empty list for no results', () => {
    render(<BusinessSection listings={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
  it('[Req 9.9] says no listings were found when there are no businesses', () => {
    render(<BusinessSection listings={[]} />);
    expect(screen.getByText(NO_LISTINGS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
  it('[Req 9.9] does not say it when there are businesses', () => {
    render(<BusinessSection listings={[listing()]} />);
    expect(screen.queryByText(NO_LISTINGS_MESSAGE)).not.toBeInTheDocument();
  });
  it('[Req 11.7] the detail dialog has a Dial button that dials the short number and closes the dialog', async () => {
    const onDial = vi.fn();
    const user = userEvent.setup();
    render(<BusinessSection listings={three} onDial={onDial} />);
    await user.click(screen.getByRole('button', { name: /Pipe Dreams Plumbing/ }));
    const dialog = screen.getByRole('dialog', { name: 'Pipe Dreams Plumbing' });
    const dial = within(dialog).getByRole('button', {
      name: 'Dial Pipe Dreams Plumbing, HO 6-1001',
    });
    await user.click(dial);
    expect(onDial).toHaveBeenCalledExactlyOnceWith('61001');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('[Req 11.7] the Dial button is not inside the row button, which would nest buttons', async () => {
    render(<BusinessSection listings={three} onDial={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Dial / })).not.toBeInTheDocument();
    for (const row of screen.getAllByRole('button')) {
      expect(row.querySelector('button')).toBeNull();
    }
  });

  it('[Req 13.5] labels a listing the caller has dialled as called, and no other', () => {
    render(<BusinessSection listings={three} calledIds={['b2']} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[1]).toHaveTextContent('called');
    expect(rows[0]).not.toHaveTextContent('called');
    expect(rows[2]).not.toHaveTextContent('called');
  });
});
