import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import { PhoneBookPage } from './PhoneBookPage';

const business: BusinessResult = {
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
};

const resident: ResidentResult = {
  id: 'r1',
  surname: 'Nkosi',
  initials: 'T',
  address: '4 Jacaranda Road',
  suburb: 'Edenvale',
  phone: '011 000 5001',
  dial_number: '72001',
  score: 0.9,
};

type Props = Partial<Parameters<typeof PhoneBookPage>[0]>;

function setup(props: Props = {}) {
  const onSectionChange = vi.fn();
  const onClose = vi.fn();
  render(
    <PhoneBookPage
      businesses={[business]}
      residents={[resident]}
      activeSection="white"
      onSectionChange={onSectionChange}
      onClose={onClose}
      spiritOnly={false}
      {...props}
    />,
  );
  return { onSectionChange, onClose, user: userEvent.setup() };
}

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

function focusTab(name: string) {
  act(() => screen.getByRole('tab', { name }).focus());
}

afterEach(() => vi.unstubAllGlobals());

describe('PhoneBookPage', () => {
  it('[Req 6.4] shows a White Pages tab and a Business tab', () => {
    setup();
    expect(screen.getByRole('tab', { name: 'White Pages' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Business' })).toBeInTheDocument();
  });

  it('[Req 6.4] marks the active section tab as selected', () => {
    setup({ activeSection: 'business' });
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'White Pages' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('[Req 6.4] clicking Business calls onSectionChange with business', async () => {
    const { onSectionChange, user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Business' }));
    expect(onSectionChange).toHaveBeenCalledWith('business');
  });

  it('[Req 6.4] shows the residents in the panel when the white pages are active', () => {
    setup({ activeSection: 'white' });
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Nkosi');
    expect(panel).not.toHaveTextContent('Pipe Dreams Plumbing');
  });

  it('[Req 6.4] shows the businesses in the panel when the business section is active', () => {
    setup({ activeSection: 'business' });
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Pipe Dreams Plumbing');
    expect(panel).not.toHaveTextContent('Nkosi');
  });

  it('[Req 9.3] links each tab to its panel with aria-controls and aria-labelledby', () => {
    setup({ activeSection: 'business' });
    const tab = screen.getByRole('tab', { name: 'Business' });
    const panel = screen.getByRole('tabpanel');
    expect(tab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
  });

  it('[Req 9.3] gives only the active tab a place in the tab order', () => {
    setup({ activeSection: 'white' });
    expect(screen.getByRole('tab', { name: 'White Pages' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveAttribute('tabindex', '-1');
  });

  it('[Req 6.4] ArrowRight moves focus to the next tab without selecting it', async () => {
    const { onSectionChange, user } = setup();
    focusTab('White Pages');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveFocus();
    expect(onSectionChange).not.toHaveBeenCalled();
  });

  it('[Req 6.4] ArrowRight on the last tab wraps to the first', async () => {
    const { user } = setup({ activeSection: 'business' });
    focusTab('Business');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'White Pages' })).toHaveFocus();
  });

  it('[Req 6.4] ArrowLeft on the first tab wraps to the last', async () => {
    const { user } = setup();
    focusTab('White Pages');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveFocus();
  });

  it('[Req 6.4] Home and End jump to the first and last tab', async () => {
    const { user } = setup();
    focusTab('White Pages');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'White Pages' })).toHaveFocus();
  });

  it('[Req 6.4] Enter selects the focused tab', async () => {
    const { onSectionChange, user } = setup();
    focusTab('White Pages');
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onSectionChange).toHaveBeenCalledWith('business');
  });

  it('[Req 6.4] Space selects the focused tab', async () => {
    const { onSectionChange, user } = setup();
    focusTab('White Pages');
    await user.keyboard('{ArrowRight} ');
    expect(onSectionChange).toHaveBeenCalledWith('business');
  });

  it('[Req 9.3] shows the tabs when a tab has keyboard focus', () => {
    setup();
    const tablist = screen.getByRole('tablist');
    expect(tablist.className).toContain('focus-within:');
  });

  it('[Req 6.6] switches sections without a transition when reduced motion is on', () => {
    mockReducedMotion(true);
    setup();
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveClass('transition-none');
  });

  it('[Req 6.6] fades the tab change in 200 ms or less when motion is allowed', () => {
    mockReducedMotion(false);
    setup();
    const tab = screen.getByRole('tab', { name: 'Business' });
    expect(tab).toHaveClass('duration-150');
    expect(tab).not.toHaveClass('transition-none');
  });

  it('[Req 7.3] hides the tabs when spiritOnly is set', () => {
    setup({ spiritOnly: true });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('[Req 7.3] headed The Dead Pages: Spirit Listings when spiritOnly is set', () => {
    setup({ spiritOnly: true });
    expect(
      screen.getByRole('heading', { name: 'The Dead Pages: Spirit Listings' }),
    ).toBeInTheDocument();
  });

  it('[Req 7.3] shows the business listings, never residents, when spiritOnly is set', () => {
    setup({ spiritOnly: true, activeSection: 'white' });
    expect(screen.getByRole('list', { name: 'Business listings' })).toBeInTheDocument();
    expect(screen.queryByText('Nkosi')).not.toBeInTheDocument();
  });
  it('[Req 9.3] Escape on a focused tab closes the book', async () => {
    const { onClose, user } = setup();
    focusTab('White Pages');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('[Req 9.3] Escape inside the listing detail dialog closes only the dialog', async () => {
    const { onClose, user } = setup({ activeSection: 'business' });
    await user.click(screen.getByRole('button', { name: /Pipe Dreams Plumbing/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
  it('[Req 9.3] Escape in a field elsewhere on the page does not close the book', async () => {
    const { onClose, user } = setup();
    render(<input aria-label="elsewhere" />);
    await user.click(screen.getByRole('textbox', { name: 'elsewhere' }));
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});
