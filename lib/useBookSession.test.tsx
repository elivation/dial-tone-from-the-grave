import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { BusinessResult } from '@/lib/listingSearch';
import { BOOK_STORAGE_KEY } from './bookSession';
import { useBookSession } from './useBookSession';

const listing: BusinessResult = {
  id: 'b1',
  name: 'Geyser Gabriel',
  category: 'plumber',
  suburb: 'Edenvale',
  address: '1 Hollow Lane',
  phone: '011 000 1001',
  dial_number: '61001',
  hours: '24 hours',
  description: 'Geysers',
  is_24hr: true,
  is_advert: false,
  is_spirit: false,
  score: 1,
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useBookSession', () => {
  it('[Req 13.1] starts with no pages and adds one for a search', () => {
    const { result } = renderHook(() => useBookSession());
    expect(result.current.page).toBeNull();
    act(() => result.current.addPage('geyser', [listing]));
    expect(result.current.page).toMatchObject({ query: 'geyser', section: 'business' });
    expect(result.current.count).toBe(1);
  });

  it('[Req 13.3] marks a listing called by its dialled number', () => {
    const { result } = renderHook(() => useBookSession());
    act(() => result.current.addPage('geyser', [listing]));
    act(() => result.current.markDialled('61001'));
    expect(result.current.page).toMatchObject({ calledIds: ['b1'], dogEared: true });
  });

  it('[Req 13.2] flips between pages', () => {
    const { result } = renderHook(() => useBookSession());
    act(() => result.current.addPage('one', [listing]));
    act(() => result.current.addPage('two', [{ ...listing, id: 'b2' }]));
    act(() => result.current.flip(-1));
    expect(result.current.page?.query).toBe('one');
    expect(result.current.index).toBe(0);
  });

  it('[Req 13.4] survives a reload in the same tab and sends nothing to the server', () => {
    const first = renderHook(() => useBookSession());
    act(() => first.result.current.addPage('geyser', [listing]));
    act(() => first.result.current.markDialled('61001'));
    first.unmount();
    const second = renderHook(() => useBookSession());
    expect(second.result.current.page).toMatchObject({ query: 'geyser', dogEared: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[Req 13.4] keeps the pages in sessionStorage only', () => {
    const { result } = renderHook(() => useBookSession());
    act(() => result.current.addPage('geyser', [listing]));
    expect(sessionStorage.getItem(BOOK_STORAGE_KEY)).toContain('geyser');
    expect(localStorage.getItem(BOOK_STORAGE_KEY)).toBeNull();
  });

  it('[Req 13.4] starts empty, and does not throw, when the stored book is damaged', () => {
    sessionStorage.setItem(BOOK_STORAGE_KEY, '{"pages":[{"nope":true}]');
    const { result } = renderHook(() => useBookSession());
    expect(result.current.page).toBeNull();
    act(() => result.current.addPage('geyser', [listing]));
    expect(result.current.count).toBe(1);
  });

  it('[Req 13.4] carries on when storage refuses to save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useBookSession());
    act(() => result.current.addPage('geyser', [listing]));
    expect(result.current.count).toBe(1);
    vi.restoreAllMocks();
  });
});
