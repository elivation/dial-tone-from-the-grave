'use client';
import type { KeyboardEvent } from 'react';
import type { BookPage } from '@/lib/bookSession';
import { SHEET_BAR, TABS_BAR, type SheetLayout } from './panel';

const BUTTON =
  'pointer-events-auto rounded border border-stone-900 px-3 py-1 text-stone-900 aria-disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900';

function describePage(page: BookPage): string {
  const notes = [
    page.calledIds.length > 0 ? `${page.calledIds.length} called` : '',
    page.dogEared ? 'dog-eared' : '',
  ].filter(Boolean);
  return notes.length > 0 ? `${page.query} (${notes.join(', ')})` : page.query;
}

/**
 * The accessible twin of flipping the 3D book: every page of the session in order, with Previous
 * and Next buttons, and the left and right arrow keys while focus is here. The buttons stay in
 * the tab order at either end (aria-disabled, not disabled), so focus is not lost on the last flip.
 * It shows on screen while it has focus, like the rest of the HTML layer.
 */
export function PageStack({
  pages,
  index,
  onFlip,
  layout = 'twin',
}: {
  pages: readonly BookPage[];
  index: number;
  onFlip: (by: -1 | 1) => void;
  layout?: SheetLayout;
}) {
  if (pages.length < 2) return null;
  const flip = (by: -1 | 1) => {
    const target = index + by;
    if (target >= 0 && target < pages.length) onFlip(by);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') flip(-1);
    else if (event.key === 'ArrowRight') flip(1);
    else return;
    event.preventDefault();
  };
  const open = pages[index];
  const large = layout === 'sheet' ? ' min-h-[44px] min-w-[44px]' : '';
  return (
    <nav
      aria-label="Book pages"
      onKeyDown={onKeyDown}
      className={`${layout === 'sheet' ? SHEET_BAR : TABS_BAR} flex-col gap-2 p-2`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-disabled={index === 0}
          onClick={() => flip(-1)}
          className={BUTTON + large}
        >
          Previous page
        </button>
        <p role="status">
          Page {index + 1} of {pages.length}: {open?.query}
        </p>
        <button
          type="button"
          aria-disabled={index === pages.length - 1}
          onClick={() => flip(1)}
          className={BUTTON + large}
        >
          Next page
        </button>
      </div>
      <ol aria-label="Pages in the book" className="list-inside list-decimal">
        {pages.map((page, i) => (
          <li key={page.id} aria-current={i === index ? 'page' : undefined}>
            {describePage(page)}
          </li>
        ))}
      </ol>
    </nav>
  );
}
