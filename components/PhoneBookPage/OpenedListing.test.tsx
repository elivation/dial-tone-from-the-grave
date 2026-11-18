import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIXTURE_BUSINESSES, FIXTURE_RESIDENTS } from '@/components/PhoneCanvas/__fixtures__/book';
import { OpenedListing } from './OpenedListing';

describe('OpenedListing', () => {
  it('[Req 13.2] shows a business in the detail dialog, with a Dial button that dials its number', async () => {
    const onDial = vi.fn();
    const business = FIXTURE_BUSINESSES[1];
    if (!business) throw new Error('no fixture');
    render(<OpenedListing listing={business} onClose={() => {}} onDial={onDial} />);
    const dialog = screen.getByRole('dialog', { name: business.name });
    expect(dialog).toHaveAttribute('open');
    await userEvent.click(screen.getByRole('button', { name: /^Dial / }));
    expect(onDial).toHaveBeenCalledWith(business.dial_number);
    expect(dialog).not.toHaveAttribute('open');
  });

  it('[Req 13.2] shows a resident in the same kind of dialog, with the surname and initials', async () => {
    const onDial = vi.fn();
    const resident = FIXTURE_RESIDENTS[0];
    if (!resident) throw new Error('no fixture');
    render(<OpenedListing listing={resident} onClose={() => {}} onDial={onDial} />);
    expect(screen.getByRole('dialog', { name: 'Dlamini T' })).toHaveTextContent(resident.address);
    await userEvent.click(screen.getByRole('button', { name: /^Dial / }));
    expect(onDial).toHaveBeenCalledWith(resident.dial_number);
  });

  it('[Req 13.2] calls onClose when the dialog is closed', async () => {
    const onClose = vi.fn();
    const business = FIXTURE_BUSINESSES[0];
    if (!business) throw new Error('no fixture');
    render(<OpenedListing listing={business} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /^Dial / })).not.toBeInTheDocument();
  });
});
