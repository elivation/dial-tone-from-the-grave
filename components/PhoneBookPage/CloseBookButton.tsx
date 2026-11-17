'use client';
import type { KeyboardEvent } from 'react';
/** Escape closes the book, unless it is already closing the listing detail dialog. */
export function closesBook(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape') return false;
  return !(event.target instanceof Element && event.target.closest('dialog'));
}
/** Puts the phone book away. Sits with the other controls, on screen for everyone. */
export function CloseBookButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      onKeyDown={(event) => {
        if (closesBook(event)) onClose();
      }}
      className="pointer-events-auto rounded border border-amber-200/40 bg-black/70 px-4 py-1 font-serif text-sm tracking-widest text-amber-200/90 hover:bg-amber-200/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
    >
      Close the book
    </button>
  );
}
