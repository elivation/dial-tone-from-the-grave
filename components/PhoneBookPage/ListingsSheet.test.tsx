import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookPage } from '@/lib/bookSession';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import { BusinessSection } from './BusinessSection';
import { DialButton } from './DialButton';
import { ListingsButton, ListingsSheet } from './ListingsSheet';
import { PageStack } from './PageStack';
import { WhiteSection } from './WhiteSection';

const business = (n: number): BusinessResult => ({
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
const resident = (n: number): ResidentResult => ({
  id: `r${n}`,
  surname: `Dlamini${n}`,
  initials: 'T',
  address: `${n} Jacaranda Road`,
  suburb: 'Edenvale',
  phone: `011 000 ${5000 + n}`,
  dial_number: `${72000 + n}`,
  score: 1,
});
const pages: BookPage[] = [1, 2].map((n) => ({
  id: `p${n}`,
  section: 'business',
  query: `search ${n}`,
  results: [business(n)],
  calledIds: [],
  dogEared: false,
}));

const offScreen = (element: Element) => element.closest('[class*="-left-[10000px]"]');

describe('sheet layout of the listing lists', () => {
  it('[Req 13.2] a business row has its own Dial button, and the list is not in the off-screen panel', async () => {
    const onDial = vi.fn();
    render(
      <BusinessSection layout="sheet" listings={[business(1), business(2)]} onDial={onDial} />,
    );
    const dial = screen.getByRole('button', { name: /^Dial Business 2,/ });
    expect(offScreen(dial)).toBeNull();
    await userEvent.click(dial);
    expect(onDial).toHaveBeenCalledWith('61002');
  });

  it('[Req 13.2] a resident row has a Dial button, and the list is not in the off-screen panel', () => {
    render(<WhiteSection layout="sheet" residents={[resident(1)]} onDial={() => {}} />);
    const dial = screen.getByRole('button', { name: /^Dial Dlamini1 T,/ });
    expect(offScreen(dial)).toBeNull();
  });

  it('[Req 13.2] a sheet list still opens a listing, as the twin does', async () => {
    render(<BusinessSection layout="sheet" listings={[business(1)]} onDial={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /^Business 1/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('[Req 13.2] the page buttons are on screen, not in the off-screen bar, in a sheet', () => {
    render(<PageStack layout="sheet" pages={pages} index={0} onFlip={() => {}} />);
    expect(offScreen(screen.getByRole('button', { name: 'Next page' }))).toBeNull();
  });

  it('[Req 13.2] the Dial button in a sheet is at least 44 by 44 CSS pixels', () => {
    render(<DialButton size="large" dialNumber="61001" name="Business 1" onDial={() => {}} />);
    const { className } = screen.getByRole('button', { name: /^Dial Business 1/ });
    expect(className).toContain('min-h-[44px]');
    expect(className).toContain('min-w-[44px]');
  });
});

describe('ListingsSheet', () => {
  const sheet = (onClose = () => {}, onDial = vi.fn()) =>
    render(
      <ListingsSheet
        businesses={[business(1), business(2)]}
        residents={[]}
        activeSection="business"
        onSectionChange={() => {}}
        spiritOnly={false}
        onDial={onDial}
        pageStack={{ pages, index: 0, onFlip: () => {} }}
        onClose={onClose}
      />,
    );

  it('[Req 13.2] opens as a modal dialog with the current page listings and big Dial buttons', () => {
    sheet();
    const dialog = screen.getByRole('dialog', { name: 'Listings on this page' });
    expect(within(dialog).getAllByRole('button', { name: /^Dial / })).toHaveLength(2);
    expect(within(dialog).getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });

  it('[Req 13.2] dialling closes the sheet first so the phone is in view', async () => {
    const onClose = vi.fn();
    const onDial = vi.fn();
    sheet(onClose, onDial);
    await userEvent.click(screen.getByRole('button', { name: /^Dial Business 1,/ }));
    expect(onDial).toHaveBeenCalledWith('61001');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('[Req 13.2] Close and Escape close it', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    sheet(onClose);
    await user.click(screen.getByRole('button', { name: 'Close listings' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ListingsButton', () => {
  it('[Req 13.2] is a visible button named Listings that opens the sheet', async () => {
    const onOpen = vi.fn();
    render(<ListingsButton onOpen={onOpen} />);
    const button = screen.getByRole('button', { name: 'Listings' });
    expect(button).toBeVisible();
    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('[Req 13.2] shows only below 768 px wide or 501 px tall, where the 3D book is too small to tap', () => {
    render(<ListingsButton onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: 'Listings' }).className).toContain('listings-button');
    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(min-height: 501px\)\s*{\s*\.listings-button\s*{\s*display: none;/,
    );
  });
});
