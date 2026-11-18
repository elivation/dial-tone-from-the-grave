import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResidentResult } from '@/lib/listingSearch';
import { NO_LISTINGS_MESSAGE } from './sections';
import { WhiteSection } from './WhiteSection';

function resident(overrides: Partial<ResidentResult> = {}): ResidentResult {
  return {
    id: 'r1',
    surname: 'Nkosi',
    initials: 'T',
    address: '4 Jacaranda Road',
    suburb: 'Edenvale',
    phone: '011 000 5001',
    dial_number: '72001',
    score: 0.9,
    ...overrides,
  };
}

const three = [
  resident({ id: 'r1' }),
  resident({
    id: 'r2',
    surname: 'Botha',
    initials: 'A J',
    phone: '011 000 5002',
    dial_number: '72002',
  }),
  resident({
    id: 'r3',
    surname: 'Naidoo',
    initials: 'S',
    phone: '011 000 5003',
    dial_number: '72003',
  }),
];

describe('WhiteSection', () => {
  it('[Req 6.1] renders three residents as three rows', () => {
    render(<WhiteSection residents={three} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('[Req 6.1] shows surname, initials, address, suburb and phone in that order', () => {
    render(<WhiteSection residents={[resident()]} />);
    const row = screen.getByRole('listitem');
    const text = row.textContent ?? '';
    const order = ['Nkosi', 'T', '4 Jacaranda Road', 'Edenvale', '011 000 5001'];
    const positions = order.map((part) => text.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('[Req 6.1] has a phone number in every row', () => {
    render(<WhiteSection residents={three} />);
    const rows = screen.getAllByRole('listitem');
    rows.forEach((row, i) => expect(row).toHaveTextContent(three[i]!.phone));
  });

  it('[Req 6.1] marks the surname for uppercase display and keeps the stored text for screen readers', () => {
    render(<WhiteSection residents={[resident()]} />);
    const surname = within(screen.getByRole('listitem')).getByText('Nkosi');
    expect(surname).toHaveClass('uppercase');
  });

  it('[Req 11.7] prints the short number in exchange style next to the 011 number', () => {
    render(<WhiteSection residents={[resident()]} />);
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('011 000 5001');
    expect(row).toHaveTextContent('MO 7-2001');
  });

  it('[Req 6.2] shows no adverts', () => {
    render(<WhiteSection residents={three} />);
    expect(screen.queryByText(/advert/i)).not.toBeInTheDocument();
  });

  it('[Req 6.5] uses dark stone text, never a pale colour, on every row', () => {
    render(<WhiteSection residents={three} />);
    for (const row of screen.getAllByRole('listitem')) expect(row).toHaveClass('text-stone-900');
  });

  it('[Req 9.3] the list is named and not hidden from assistive technology', () => {
    render(<WhiteSection residents={three} />);
    const list = screen.getByRole('list', { name: 'Resident listings' });
    expect(list.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('[Req 6.1] renders an empty list for no residents', () => {
    render(<WhiteSection residents={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
  it('[Req 9.9] says no listings were found when there are no residents', () => {
    render(<WhiteSection residents={[]} />);
    expect(screen.getByText(NO_LISTINGS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
  it('[Req 9.9] does not say it when there are residents', () => {
    render(<WhiteSection residents={three} />);
    expect(screen.queryByText(NO_LISTINGS_MESSAGE)).not.toBeInTheDocument();
  });
  it('[Req 11.7] each row has its own Dial button that sends that row short number', async () => {
    const onDial = vi.fn();
    render(<WhiteSection residents={three} onDial={onDial} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[1]).toHaveAccessibleName('Dial Botha A J, MO 7-2002');
    await userEvent.click(buttons[1]!);
    expect(onDial).toHaveBeenCalledExactlyOnceWith('72002');
  });
  it('[Req 11.7] without an onDial there are no buttons, so read-only callers are unchanged', () => {
    render(<WhiteSection residents={three} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('[Req 13.5] labels a resident the caller has dialled as called, and no other', () => {
    render(<WhiteSection residents={three} calledIds={['r2']} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[1]).toHaveTextContent('called');
    expect(rows[0]).not.toHaveTextContent('called');
  });
});
